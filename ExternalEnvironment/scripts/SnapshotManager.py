import os
import json
import hashlib
import shutil
import logging
from typing import Dict, Any, List, Tuple
import concurrent.futures


class SnapshotManager:
    """
    SnapshotManager用于生成文件/文件夹快照、比较快照差异、同步文件/文件夹，并支持快照的Json存取。
    """

    def __init__(self, base_path: str = None):
        """
        初始化SnapshotManager，内部自动生成日志记录器。
        :param base_path: 快照操作的根目录（可选），如不指定则每次操作需传入路径
        """
        logging.basicConfig(
            level=logging.INFO,
            format="[%(asctime)s] %(levelname)s: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        self.logger = logging.getLogger(__name__)
        self.base_path = base_path
        self._last_snapshot = None
        self._last_snapshot_path = None

    def _file_hash(self, filepath: str, chunk_size: int = 128 * 1024) -> str:
        """
        计算文件的哈希值，使用blake2b算法。

        参数:
            filepath: 文件路径
            chunk_size: 读取块大小，默认128KB

        返回:
            哈希字符串
        """
        try:
            hasher = hashlib.blake2b()
            with open(filepath, "rb") as f:
                for chunk in iter(lambda: f.read(chunk_size), b""):
                    hasher.update(chunk)
            return hasher.hexdigest()
        except Exception as e:
            self.logger.error(f"计算文件哈希失败: {filepath}，原因: {e}")
            return ""

    def _collect_file_info(self, fpath: str) -> Dict[str, Any]:
        """
        收集单个文件的快照信息（含hash/size/mtime）。

        参数:
            fpath: 文件路径

        返回:
            文件信息字典
        """
        try:
            stat = os.stat(fpath)
            return {
                "size": stat.st_size,
                "mtime": stat.st_mtime,
                "hash": self._file_hash(fpath),
            }
        except Exception as e:
            self.logger.error(f"收集文件信息失败: {fpath}，原因: {e}")
            return {"size": 0, "mtime": 0, "hash": ""}

    def create_snapshot(self, path: str = None) -> Dict[str, Any]:
        """
        生成指定文件或文件夹的快照（平铺结构），并保存为成员变量。
        多线程加速文件哈希，目录遍历采用os.walk。

        参数:
            path: 文件或文件夹路径（可选，未指定则使用base_path）

        返回:
            快照字典，key为相对路径，value为属性dict
        """
        if path is None:
            if self.base_path is None:
                raise ValueError("未指定快照路径")
            path = self.base_path
        self.logger.info(f"生成快照: {path}")
        snapshot = {}
        if os.path.isfile(path):
            stat = os.stat(path)
            snapshot["."] = {
                "type": "file",
                "size": stat.st_size,
                "mtime": stat.st_mtime,
                "hash": self._file_hash(path),
            }
        elif os.path.isdir(path):
            file_tasks = []
            file_keys = []
            for root, dirs, files in os.walk(path):
                rel_root = os.path.relpath(root, path)
                dir_key = rel_root if rel_root != "." else "."
                snapshot[dir_key] = {"type": "dir"}
                for d in dirs:
                    rel_d = os.path.join(rel_root, d) if rel_root != "." else d
                    snapshot[rel_d] = {"type": "dir"}
                for f in files:
                    fpath = os.path.join(root, f)
                    rel_f = os.path.join(rel_root, f) if rel_root != "." else f
                    file_tasks.append(fpath)
                    file_keys.append(rel_f)
            cpu_count = os.cpu_count() or 1
            max_workers = min(32, cpu_count * 4)
            with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
                results = list(executor.map(self._collect_file_info, file_tasks))
            for rel_f, info in zip(file_keys, results):
                snapshot[rel_f] = {
                    "type": "file",
                    "size": info["size"],
                    "mtime": info["mtime"],
                    "hash": info["hash"],
                }
        else:
            self.logger.error(f"路径不存在: {path}")
            raise FileNotFoundError(f"路径不存在: {path}")
        self._last_snapshot = snapshot
        self._last_snapshot_path = path
        return snapshot

    def save_snapshot(self, json_path: str, snapshot: Dict[str, Any] = None):
        """
        保存快照为Json文件，默认保存最近一次快照。

        参数:
            json_path: Json文件路径
            snapshot: 快照字典（可选，未指定则保存最近一次快照）
        """
        if snapshot is None:
            snapshot = self._last_snapshot
        if snapshot is None:
            raise ValueError("没有可保存的快照")
        try:
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(snapshot, f, indent=2, ensure_ascii=False)
            self.logger.info(f"快照已保存到: {json_path}")
        except Exception as e:
            self.logger.error(f"保存快照失败: {e}")
            raise

    def load_snapshot(self, json_path: str):
        """
        从Json文件加载快照，并保存为成员变量。

        参数:
            json_path: Json文件路径

        返回:
            快照字典
        """
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                snapshot = json.load(f)
            self.logger.info(f"快照已加载: {json_path}")
            self._last_snapshot = snapshot
            self._last_snapshot_path = None
            return snapshot
        except Exception as e:
            self.logger.error(f"加载快照失败: {e}")
            raise

    def sync_file(self, src_file: str, dst_file: str):
        """
        同步单个文件到目标路径（覆盖模式），仅在内容有差异时才同步。

        参数:
            src_file: 源文件路径
            dst_file: 目标文件路径
        """
        src_snap = self.create_snapshot(src_file)
        dst_snap = self.create_snapshot(dst_file) if os.path.exists(dst_file) else {}
        diffs = self.compare_snapshots(dst_snap, src_snap)
        if not diffs:
            self.logger.info(f"单个文件无差异，无需同步: {src_file} -> {dst_file}")
            return
        try:
            os.makedirs(os.path.dirname(dst_file), exist_ok=True)
            shutil.copy2(src_file, dst_file)
            self.logger.info(f"同步单个文件: {src_file} -> {dst_file}")
        except Exception as e:
            self.logger.error(f"同步单个文件失败: {src_file} -> {dst_file}，原因: {e}")

    def sync_files(self, src_files: List[str], dst_files: List[str]):
        """
        同步多个文件到目标路径列表（覆盖模式），仅同步有差异的文件。

        参数:
            src_files: 源文件路径列表
            dst_files: 目标文件路径列表
        """
        if len(src_files) != len(dst_files):
            raise ValueError("源文件列表和目标文件列表长度不一致")
        for src, dst in zip(src_files, dst_files):
            self.sync_file(src, dst)

    def compare_snapshots(
        self, snap1: Dict[str, Any] = None, snap2: Dict[str, Any] = None
    ) -> List[Tuple[str, str]]:
        """
        比较两个快照（平铺结构），返回差异列表。

        参数:
            snap1: 源快照（可选，未指定则用最近一次快照）
            snap2: 目标快照（可选，必须指定一个）

        返回:
            差异列表，元素为 (操作类型, 路径)
        """
        if snap1 is None:
            snap1 = self._last_snapshot
        if snap1 is None or snap2 is None:
            raise ValueError("快照不能为空")
        diffs = []
        keys1 = set(snap1.keys())
        keys2 = set(snap2.keys())
        for name in keys1 - keys2:
            diffs.append(("delete", name))
        for name in keys2 - keys1:
            diffs.append(("add", name))
        for name in keys1 & keys2:
            item1 = snap1[name]
            item2 = snap2[name]
            if item1["type"] != item2["type"]:
                diffs.append(("type_change", name))
            elif item1["type"] == "file":
                if item1.get("hash") != item2.get("hash"):
                    diffs.append(("modify", name))
        return diffs

    def sync_from_snapshot(
        self,
        dst_path: str,
        src_snap: Dict[str, Any] = None,
        dst_snap: Dict[str, Any] = None,
        src_path: str = None,
    ):
        """
        根据快照同步文件/文件夹（以src_snap为准同步到dst_path），平铺结构。

        参数:
            dst_path: 目标路径
            src_snap: 源快照（可选，未指定则用最近一次快照）
            dst_snap: 目标快照（可选，未指定则自动生成）
            src_path: 源路径（可选，未指定则用最近一次快照路径）
        """
        if src_snap is None:
            src_snap = self._last_snapshot
        if src_snap is None:
            raise ValueError("没有可用的源快照")
        if src_path is None:
            src_path = self._last_snapshot_path
        if src_path is None:
            raise ValueError("没有可用的源路径")
        if dst_snap is None:
            dst_snap = self.create_snapshot(dst_path)
        diffs = self.compare_snapshots(dst_snap, src_snap)
        self.logger.info(f"同步差异: {diffs}")
        # 先处理删除和类型变更，后处理新增和修改，避免目录结构冲突
        for op, rel_path in diffs:
            src_item = os.path.join(src_path, rel_path)
            dst_item = os.path.join(dst_path, rel_path)
            try:
                if op == "delete":
                    if os.path.isdir(dst_item):
                        shutil.rmtree(dst_item)
                        self.logger.info(f"删除目录: {dst_item}")
                    elif os.path.isfile(dst_item):
                        os.remove(dst_item)
                        self.logger.info(f"删除文件: {dst_item}")
                elif op == "type_change":
                    if os.path.exists(dst_item):
                        if os.path.isdir(dst_item):
                            shutil.rmtree(dst_item)
                        else:
                            os.remove(dst_item)
                    if rel_path in src_snap and src_snap[rel_path]["type"] == "dir":
                        os.makedirs(dst_item, exist_ok=True)
                        self.logger.info(f"类型变更为目录: {dst_item}")
                    elif rel_path in src_snap and src_snap[rel_path]["type"] == "file":
                        os.makedirs(os.path.dirname(dst_item), exist_ok=True)
                        shutil.copy2(src_item, dst_item)
                        self.logger.info(f"类型变更为文件: {dst_item}")
            except Exception as e:
                self.logger.error(f"同步失败: {op} {dst_item}，原因: {e}")
        for op, rel_path in diffs:
            src_item = os.path.join(src_path, rel_path)
            dst_item = os.path.join(dst_path, rel_path)
            try:
                if op == "add":
                    if rel_path in src_snap and src_snap[rel_path]["type"] == "dir":
                        os.makedirs(dst_item, exist_ok=True)
                        self.logger.info(f"新增目录: {dst_item}")
                    elif rel_path in src_snap and src_snap[rel_path]["type"] == "file":
                        os.makedirs(os.path.dirname(dst_item), exist_ok=True)
                        shutil.copy2(src_item, dst_item)
                        self.logger.info(f"新增文件: {dst_item}")
                elif op == "modify":
                    shutil.copy2(src_item, dst_item)
                    self.logger.info(f"更新文件: {dst_item}")
            except Exception as e:
                self.logger.error(f"同步失败: {op} {dst_item}，原因: {e}")


if __name__ == "__main__":
    import time

    # 示例用法
    manager1 = SnapshotManager(base_path="./snap1")
    t1 = time.time()
    manager1.create_snapshot()
    t2 = time.time()
    manager1.save_snapshot("snapshot1.json")
    t3 = time.time()
    print(f"快照生成耗时: {t2 - t1:.3f} 秒")
    print(f"快照保存耗时: {t3 - t2:.3f} 秒")

    manager2 = SnapshotManager(base_path="./snap2")
    t4 = time.time()
    manager2.create_snapshot()
    t5 = time.time()
    manager2.save_snapshot("snapshot2.json")
    t6 = time.time()
    print(f"快照生成耗时: {t5 - t4:.3f} 秒")
    print(f"快照保存耗时: {t6 - t5:.3f} 秒")

    manager1.sync_from_snapshot(dst_path="./snap2", dst_snap=manager2._last_snapshot)
    print("同步完成")
    manager2.create_snapshot()  # 更新目标快照
    manager2.save_snapshot("snapshot2_updated.json")
    print("目标快照已更新")