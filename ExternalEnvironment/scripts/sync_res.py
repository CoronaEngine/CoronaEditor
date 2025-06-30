import shutil
import filecmp
import argparse
import logging
from pathlib import Path
from SnapshotManager import SnapshotManager

# 配置日志记录
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)


def main():
    parser = argparse.ArgumentParser(description="资源文件同步工具")
    parser.add_argument(
        "--python-root-dir",
        required=True,
        help="Python 根目录路径",
        type=Path,
    )
    parser.add_argument(
        "--runtime-output_dir",
        required=True,
        help="运行时输出目录路径",
        type=Path,
    )
    parser.add_argument(
        "--cmake-root-dir",
        required=True,
        help="项目根目录路径",
        type=Path,
    )
    args = parser.parse_args()

    # 路径变量定义
    PYTHON_DLL = args.python_root_dir / "python3.dll"
    PYTHON313_DLL = args.python_root_dir / "python313.dll"
    DLLS_SRC = args.python_root_dir / "DLLs"
    DLLS_DST = args.runtime_output_dir / "Resource" / "Python" / "DLLs"
    LIB_SRC = args.python_root_dir / "Lib"
    LIB_DST = args.runtime_output_dir / "Resource" / "Python" / "Lib"
    BACKEND_SRC = args.cmake_root_dir / "SourceCode" / "CabbageEditor" / "CabbageEditorBackend"
    BACKEND_DST = args.runtime_output_dir / "Resource" / "CabbageEditorBackend"
    FRONTEND_SRC = args.cmake_root_dir / "SourceCode" / "CabbageEditor" / "CabbageEditorFrontend" / "dist"
    FRONTEND_DST = args.runtime_output_dir / "Resource" / "CabbageEditorFrontend"

    # 确保所有目标目录存在
    for p in [
        args.runtime_output_dir,
        DLLS_DST,
        LIB_DST,
        BACKEND_DST,
        FRONTEND_DST,
    ]:
        p.mkdir(parents=True, exist_ok=True)

    mgr = SnapshotManager()
    mgr.sync_files(
        [PYTHON_DLL, PYTHON313_DLL],
        [
            args.runtime_output_dir / "python3.dll",
            args.runtime_output_dir / "python313.dll",
        ],
    )

    mgr.create_snapshot(DLLS_SRC)
    mgr.sync_from_snapshot(dst_path=DLLS_DST)

    mgr.create_snapshot(LIB_SRC)
    mgr.sync_from_snapshot(dst_path=LIB_DST)

    mgr.create_snapshot(BACKEND_SRC)
    mgr.sync_from_snapshot(dst_path=BACKEND_DST)

    mgr.create_snapshot(FRONTEND_SRC)
    mgr.sync_from_snapshot(dst_path=FRONTEND_DST)

    logging.info("同步完成。")


if __name__ == "__main__":
    main()  # 程序入口
