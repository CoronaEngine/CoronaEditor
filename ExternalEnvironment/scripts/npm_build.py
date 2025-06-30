"""
1. 构建前端时用到了vite需要临时设置一下nodejs的全局环境变量
2. 使用PyInstaller打包Python，然后研究如何与EXE一并打包
"""

import os
import logging
from pathlib import Path

import extutils

_logger = logging.getLogger(__name__)

# 常量定义
ROOT_DIR: Path = Path(__file__).parent.parent.parent.resolve()
ENV_DIR: Path = ROOT_DIR / "ExternalEnvironment"

NODE_JS_VERSION: str = "v22.14.0"
NODE_JS_DIR: Path = ENV_DIR / f"node-{NODE_JS_VERSION}-win-x64"
NODE_JS_ARCHIVE: Path = ENV_DIR / f"node-{NODE_JS_VERSION}-win-x64.zip"
NODE_JS_URL: str = f"https://nodejs.org/dist/{NODE_JS_VERSION}/{NODE_JS_ARCHIVE.name}"

FRONTEND_DIR: Path = ROOT_DIR / "SourceCode" / "CabbageEditor" / "CabbageEditorFrontend"
NPM_CMD: Path = NODE_JS_DIR / "npm.cmd"


def setup_nodejs_environment() -> None:
    """配置Node.js运行时环境

    异常:
        RuntimeError: 当环境配置失败时抛出
    """
    try:
        # 检查Node.js是否已安装
        dir_exists, is_dir_empty = extutils.check_directory_status(NODE_JS_DIR)
        if dir_exists and not is_dir_empty:
            _logger.info(f"[NODE] Node.js already installed at {NODE_JS_DIR}")
            return

        # 下载并验证安装包
        archive_valid = False
        if extutils.check_file_exists(NODE_JS_ARCHIVE):
            archive_valid = extutils.validate_archive(NODE_JS_ARCHIVE)
            if not archive_valid:
                _logger.warning(f"[NODE] Removing corrupted archive: {NODE_JS_ARCHIVE}")
                NODE_JS_ARCHIVE.unlink()

        if not archive_valid:
            _logger.info(f"[NODE] Downloading Node.js from {NODE_JS_URL}")
            extutils.download_file(NODE_JS_URL, NODE_JS_ARCHIVE)
            if not extutils.validate_archive(NODE_JS_ARCHIVE):
                raise RuntimeError("Downloaded Node.js archive is invalid")

        # 解压安装包
        _logger.info(f"[NODE] Extracting Node.js to {ENV_DIR}")
        extutils.extract_file(NODE_JS_ARCHIVE, ENV_DIR)

        # 二次验证解压结果
        if not extutils.check_directory_status(NODE_JS_DIR)[0]:
            raise RuntimeError("Node.js extraction failed")

    except Exception as e:
        _logger.error(f"[NODE_ERROR] Node.js setup failed: {str(e)}")
        raise RuntimeError("Node.js environment setup failed") from e


def install_frontend_dependencies() -> None:
    """安装前端项目依赖

    异常:
        RuntimeError: 当依赖安装失败时抛出
    """
    try:
        # 验证npm命令存在性
        if not extutils.check_file_exists(NPM_CMD):
            raise FileNotFoundError(f"NPM command not found: {NPM_CMD}")

        # 验证前端目录存在性
        if not extutils.check_directory_status(FRONTEND_DIR)[0]:
            raise FileNotFoundError(f"Frontend directory not found: {FRONTEND_DIR}")

        _logger.info(f"[FRONTEND] Installing npm dependencies in {FRONTEND_DIR}")

        extutils.run_command(
            [
                str(NPM_CMD),
                "install",
                "--prefix",
                str(FRONTEND_DIR),
            ],
            cwd=FRONTEND_DIR,
        )
    except Exception as e:
        _logger.error(f"[FRONTEND_ERROR] Failed to install dependencies: {str(e)}")
        raise RuntimeError("Frontend dependency installation failed") from e


def build_frontend() -> None:
    """执行前端项目构建

    异常:
        RuntimeError: 当构建过程失败时抛出
        FileNotFoundError: 关键文件缺失时抛出
    """
    try:
        _logger.info(f"[FRONTEND] Building project in {FRONTEND_DIR}")

        # 执行构建命令
        exit_code = extutils.run_command(
            command=[str(NPM_CMD), "run", "build"],
            cwd=FRONTEND_DIR,
            timeout=600,  # 10分钟超时
        )

        if exit_code != 0:
            raise RuntimeError(f"Build failed with exit code {exit_code}")

        _logger.info("[FRONTEND] Build completed successfully")

    except Exception as e:
        _logger.error(f"[FRONTEND_ERROR] Build process failed: {str(e)}")
        raise RuntimeError("Frontend build failed") from e


def main() -> None:
    # 项目配置参数（可通过配置文件扩展）
    config = {
        "source_dir": Path(
            __file__
        ).parent.parent.parent.resolve(),  # 源码目录：当前文件的三级父目录
        "build_dir_name": "build",  # 构建目录名称
    }

    """主部署流程"""
    try:
        # 获取当前PATH并添加新路径（添加到最前面）
        SYS_PATH: str = f"{NODE_JS_DIR}{os.pathsep}{os.environ.get('PATH', '')}"
        _logger.info(f"[TIPS] Add sys path: {SYS_PATH}")
        os.environ["PATH"] = SYS_PATH

        # 确保环境目录存在
        extutils.create_directory(ENV_DIR)

        # 配置Node.js环境
        setup_nodejs_environment()

        # 前端依赖安装 NPM
        install_frontend_dependencies()

        # 前端构建 NPM
        build_frontend()

        _logger.info("[SUCCESS] Environment setup completed")

    except Exception as e:
        _logger.critical(f"[FATAL] Deployment failed: {str(e)}")
        raise


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=[logging.StreamHandler()],
    )
    main()
