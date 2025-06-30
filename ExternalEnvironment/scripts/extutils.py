import sys
import gzip
import zipfile
import tarfile
import logging
import subprocess
import urllib.request
from pathlib import Path
from typing import Tuple, Optional
from urllib.error import URLError, HTTPError

_logger = logging.getLogger(__name__)


def run_command(
    command: list[str], cwd: Optional[Path] = None, timeout: Optional[float] = None
) -> int:
    """执行一个shell命令并验证执行结果。

    参数:
        command: 命令参数列表（不能为空，且所有参数必须是字符串）。
        cwd: 执行命令时的工作目录（会自动转换为Path对象）。
        timeout: 命令执行的超时时间（单位：秒）。

    返回:
        命令的退出状态码（0=成功，-1=超时，其他=错误码）。

    异常:
        ValueError: 如果命令为空或参数类型无效，抛出此异常。
    """
    # 参数校验
    if not command:
        raise ValueError("[CMD_INVALID] Command cannot be empty.")
    if any(not isinstance(arg, str) for arg in command):
        raise TypeError(f"[CMD_INVALID] Command arguments must be strings.")

    # 路径标准化
    working_directory = Path(cwd).resolve() if cwd else None

    try:
        # 执行命令时指定编码为UTF-8，并捕获输出
        result = subprocess.run(
            command,
            check=True,
            cwd=working_directory,
            timeout=timeout,
            text=True,
            encoding="utf-8",  # 明确指定编码
            errors="replace",  # 替换无法解码的字符
            stdout=sys.stdout,
            stderr=sys.stderr,
        )
        _logger.info(
            f"[CMD_SUCCESS] Command executed successfully | Command: {' '.join(command)}"
        )
        return 0
    except subprocess.CalledProcessError as e:
        _logger.error(
            f"[CMD_ERROR] Command failed | Return code: {e.returncode} | "
            f"Command: {' '.join(e.cmd)} | Error: {e.output}"
        )
        return e.returncode
    except subprocess.TimeoutExpired as e:
        _logger.error(
            f"[CMD_TIMEOUT] Command timed out | Timeout: {timeout}s | "
            f"Command: {' '.join(e.cmd)}"
        )
        return -1


def create_directory(directory_path: Path) -> None:
    """创建目录结构（自动创建父目录）。

    参数:
        directory_path: 要创建的目录路径（Path对象）。

    异常:
        FileExistsError: 如果路径被文件占用，抛出此异常。
        OSError: 如果目录创建失败，抛出此异常。
    """
    try:
        # 冲突检查
        if directory_path.exists() and not directory_path.is_dir():
            raise FileExistsError(
                f"[DIR_CONFLICT] Path is occupied by a file: {directory_path}"
            )

        # 创建目录
        directory_path.mkdir(parents=True, exist_ok=True)
        _logger.info(f"[DIR_READY] Directory is ready: {directory_path.resolve()}")
    except OSError as e:
        _logger.error(
            f"[DIR_ERROR] Directory creation failed | Path: {directory_path} | "
            f"System error: {e.strerror}"
        )
        raise


def download_file(url: str, destination: Path, timeout: Optional[float] = None) -> None:
    """下载文件到指定路径。

    参数:
        url: 文件的下载URL。
        destination: 下载后的文件保存路径（必须是文件路径）。
        timeout: 下载操作的超时时间（单位：秒）。

    异常:
        ValueError: URL无效或目标路径是目录时抛出。
        FileNotFoundError: 目标路径父目录不存在时抛出。
        HTTPError: HTTP请求失败时抛出。
        URLError: URL解析或连接失败时抛出。
        OSError: 文件写入失败时抛出。
    """
    # 参数校验
    if not url:
        raise ValueError("[DOWNLOAD_ERROR] URL cannot be empty.")
    if destination.is_dir():
        raise ValueError(f"[DOWNLOAD_ERROR] Destination is a directory: {destination}")
    if not destination.parent.exists():
        raise FileNotFoundError(
            f"[DOWNLOAD_ERROR] Parent directory does not exist: {destination.parent}"
        )

    try:
        # 发起请求并下载文件
        response = urllib.request.urlopen(url, timeout=timeout)
        with open(destination, "wb") as f:
            while True:
                chunk = response.read(16 * 1024)  # 分块读取
                if not chunk:
                    break
                f.write(chunk)
        _logger.info(
            f"[DOWNLOAD_SUCCESS] File downloaded | URL: {url} | Destination: {destination}"
        )
    except HTTPError as e:
        _logger.error(f"[DOWNLOAD_ERROR] HTTP Error {e.code}: {e.reason} | URL: {url}")
        raise
    except URLError as e:
        _logger.error(f"[DOWNLOAD_ERROR] URL Error: {e.reason} | URL: {url}")
        raise
    except OSError as e:
        _logger.error(
            f"[DOWNLOAD_ERROR] File write failed | Path: {destination} | Error: {e.strerror}"
        )
        raise


def extract_file(archive_path: Path, extract_dir: Path) -> None:
    """解压文件到指定目录。

    支持格式：ZIP、TAR、TAR.GZ、TAR.BZ2、GZ（单个文件）。

    参数:
        archive_path: 压缩文件路径。
        extract_dir: 解压目标目录。

    异常:
        FileNotFoundError: 压缩文件不存在时抛出。
        ValueError: 不支持的压缩格式时抛出。
        OSError: 解压过程中出现错误时抛出。
    """
    # 基础校验
    if not archive_path.is_file():
        raise FileNotFoundError(f"[EXTRACT_ERROR] Archive not found: {archive_path}")
    if not extract_dir.exists():
        create_directory(extract_dir)

    filename = archive_path.name.lower()
    try:
        # ZIP格式处理
        if filename.endswith(".zip"):
            with zipfile.ZipFile(archive_path, "r") as zip_ref:
                zip_ref.extractall(extract_dir)
            _logger.info(
                f"[EXTRACT_SUCCESS] ZIP extracted | Archive: {archive_path} | To: {extract_dir}"
            )

        # TAR系列格式处理
        elif filename.endswith((".tar.gz", ".tgz", ".tar.bz2", ".tar")):
            mode = "r"
            if filename.endswith((".tar.gz", ".tgz")):
                mode = "r:gz"
            elif filename.endswith(".tar.bz2"):
                mode = "r:bz2"
            with tarfile.open(archive_path, mode) as tar_ref:
                tar_ref.extractall(extract_dir)
            _logger.info(
                f"[EXTRACT_SUCCESS] TAR extracted | Archive: {archive_path} | To: {extract_dir}"
            )

        # 单个GZ文件处理
        elif filename.endswith(".gz"):
            target_file = extract_dir / archive_path.stem  # 去除.gz后缀
            with gzip.open(archive_path, "rb") as f_in:
                with open(target_file, "wb") as f_out:
                    f_out.write(f_in.read())
            _logger.info(
                f"[EXTRACT_SUCCESS] GZ extracted | Archive: {archive_path} | To: {target_file}"
            )

        else:
            raise ValueError(
                f"[EXTRACT_ERROR] Unsupported archive format: {archive_path}"
            )

    except zipfile.BadZipFile as e:
        _logger.error(
            f"[EXTRACT_ERROR] Invalid ZIP file | Archive: {archive_path} | Error: {str(e)}"
        )
        raise
    except tarfile.TarError as e:
        _logger.error(
            f"[EXTRACT_ERROR] TAR extraction failed | Archive: {archive_path} | Error: {str(e)}"
        )
        raise
    except gzip.BadGzipFile as e:
        _logger.error(
            f"[EXTRACT_ERROR] Invalid GZIP file | Archive: {archive_path} | Error: {str(e)}"
        )
        raise
    except OSError as e:
        _logger.error(
            f"[EXTRACT_ERROR] Extraction failed | Path: {archive_path} | Error: {e.strerror}"
        )
        raise


def check_file_exists(file_path: Path) -> bool:
    """验证文件是否存在且为普通文件

    参数:
        file_path (Path): 需要检测的文件路径

    返回:
        bool: True-文件存在且为普通文件，False-不存在或非文件

    异常:
        PermissionError: 当路径因权限问题无法访问时抛出

    示例:
        >>> check_file_exists(Path("test.txt"))
        [INFO] File existence check | Path: /path/to/test.txt | Status: Exists
        True
    """
    try:
        exists = file_path.is_file()
        status = "Exists" if exists else "Does not exist"
        _logger.info(
            f"[FILE_CHECK] File existence check | Path: {file_path} | Status: {status}"
        )
        return exists
    except PermissionError as e:
        _logger.error(
            f"[FILE_ERROR] Permission denied accessing file | Path: {file_path} | Error: {str(e)}"
        )
        raise
    except Exception as e:
        _logger.warning(
            f"[FILE_WARN] File check exception | Path: {file_path} | Error: {str(e)}"
        )
        return False


def check_directory_status(dir_path: Path) -> Tuple[bool, Optional[bool]]:
    """检测目录状态（存在性及是否为空）

    参数:
        dir_path (Path): 需要检测的目录路径

    返回:
        Tuple[bool, Optional[bool]]:
            (是否存在, 是否为空)
            当目录不存在时返回 (False, None)

    异常:
        PermissionError: 当目录因权限问题无法访问时抛出

    示例:
        >>> check_directory_status(Path("data"))
        [INFO] Directory status check | Path: /data | Exists: True | Empty directory: False
        (True, False)
    """
    try:
        # 检测目录是否存在
        exists = dir_path.is_dir()
        is_empty = None

        if exists:
            # 检测目录是否为空
            is_empty = not any(dir_path.iterdir())
            _logger.info(
                f"[DIR_CHECK] Directory status check | Path: {dir_path} | Exists: True | Empty directory: {is_empty}"
            )
        else:
            _logger.info(
                f"[DIR_CHECK] Directory status check | Path: {dir_path} | Exists: False"
            )

        return (exists, is_empty)
    except PermissionError as e:
        _logger.error(
            f"[DIR_ERROR] Permission denied accessing directory | Path: {dir_path} | Error: {str(e)}"
        )
        raise
    except Exception as e:
        _logger.warning(
            f"[DIR_WARN] Directory check exception | Path: {dir_path} | Error: {str(e)}"
        )
        return (False, None)


def validate_archive(archive_path: Path) -> bool:
    """验证压缩文件完整性

    支持格式: ZIP, TAR, GZ

    参数:
        archive_path (Path): 压缩文件路径

    返回:
        bool: True-文件完整且可读，False-文件损坏或格式不支持

    异常:
        FileNotFoundError: 当文件不存在时抛出

    示例:
        >>> validate_archive(Path("data.zip"))
        [INFO] Start validating archive integrity | Path: /data.zip | Type: ZIP
        [INFO] ZIP file integrity check passed | Path: /data.zip
        True
    """
    # 前置检查
    if not archive_path.is_file():
        _logger.error(f"[ARCHIVE_ERROR] Archive file not found | Path: {archive_path}")
        raise FileNotFoundError(f"Archive file not found: {archive_path}")

    try:
        # 根据后缀选择验证方式
        suffix = archive_path.suffix.lower()

        if suffix == ".zip":
            _logger.info(
                f"[ARCHIVE_CHECK] Start validating archive integrity | Path: {archive_path} | Type: ZIP"
            )
            with zipfile.ZipFile(archive_path) as zf:
                bad_file = zf.testzip()
                if bad_file is not None:
                    _logger.error(
                        f"[ARCHIVE_ERROR] ZIP file is corrupted | Path: {archive_path} | Corrupted file: {bad_file}"
                    )
                    return False
                _logger.info(
                    f"[ARCHIVE_CHECK] ZIP file integrity check passed | Path: {archive_path}"
                )
                return True

        elif suffix in (".tar", ".tar.gz", ".tgz", ".tar.bz2"):
            _logger.info(
                f"[ARCHIVE_CHECK] Start validating archive integrity | Path: {archive_path} | Type: TAR"
            )
            mode = "r:gz" if ".gz" in suffix else "r:bz2" if "bz2" in suffix else "r"
            with tarfile.open(archive_path, mode) as tf:
                tf.getmembers()  # 尝试读取成员列表
                _logger.info(
                    f"[ARCHIVE_CHECK] TAR file integrity check passed | Path: {archive_path}"
                )
                return True

        elif suffix == ".gz":
            _logger.info(
                f"[ARCHIVE_CHECK] Start validating archive integrity | Path: {archive_path} | Type: GZ"
            )
            with gzip.open(archive_path, "rb") as f:
                f.read(1)  # 尝试读取部分数据
                _logger.info(
                    f"[ARCHIVE_CHECK] GZ file integrity check passed | Path: {archive_path}"
                )
                return True

        else:
            _logger.error(
                f"[ARCHIVE_ERROR] Unsupported archive format | Path: {archive_path} | Extension: {suffix}"
            )
            return False

    except (gzip.BadGzipFile, zipfile.BadZipFile, tarfile.TarError) as e:
        _logger.error(
            f"[ARCHIVE_ERROR] Archive file is corrupted | Path: {archive_path} | Error: {str(e)}"
        )
        return False
    except Exception as e:
        _logger.error(
            f"[ARCHIVE_ERROR] Archive validation exception | Path: {archive_path} | Error: {str(e)}"
        )
        return False
