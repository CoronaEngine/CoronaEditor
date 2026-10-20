"""
路径配置
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Optional


def _runtime_paths() -> dict:
    """Consume native resolved paths; standalone Python uses source defaults."""
    try:
        import CoronaEngine
    except ModuleNotFoundError as error:
        if error.name != "CoronaEngine":
            raise
    else:
        getter = getattr(CoronaEngine, "_get_runtime_paths", None)
        if callable(getter):
            return getter()
    editor_root = Path(__file__).resolve().parents[1]
    user_data = editor_root.parent
    return {
        "editor_root": str(editor_root),
        "frontend_index": str(editor_root / "Frontend" / "dist" / "index.html"),
        "asset_roots": [str(user_data / "assets")],
        "user_data_dir": str(user_data),
        "cache_dir": str(user_data / "cache"),
        "editor_state_file": str(user_data / "CoronaEditor.ini"),
        "project_data_dir": str(user_data / "data"),
    }


def get_editor_state_path() -> Path:
    return Path(_runtime_paths()["editor_state_file"])


def get_user_data_dir() -> Path:
    return Path(_runtime_paths()["user_data_dir"])


def get_project_data_dir() -> Path:
    return Path(_runtime_paths()["project_data_dir"])


@dataclass(frozen=True)
class PathsConfig:
    """路径配置"""

    repo_root: Path
    frontend_dist: Path
    generated_script_dir: Path
    autosave_dir: Path
    config_dir: Path
    assets_model_dir: Path
    object_recognition_db: Path
    screenshots_dir: Optional[Path] = None
    media_local_storage: Optional[Path] = None

def get_default_paths() -> PathsConfig:
    """获取默认路径配置"""
    paths = _runtime_paths()
    repo_root = Path(paths["editor_root"])
    config_dir = repo_root / "config"
    autosave_dir = get_project_media_dir()
    assets_model_dir = get_project_models_dir()
    object_recognition_db = get_project_recognition_db()

    return PathsConfig(
        repo_root=repo_root,
        frontend_dist=Path(paths["frontend_index"]),
        generated_script_dir=Path(paths["user_data_dir"]) / "runtime" / "generated",
        autosave_dir=autosave_dir,
        config_dir=config_dir,
        assets_model_dir=assets_model_dir,
        object_recognition_db=object_recognition_db,
        media_local_storage=autosave_dir,
    )


# ---------------------------------------------------------------------------
# 基于活跃项目路径的动态目录解析
# ---------------------------------------------------------------------------

def _get_active_project_path() -> Path:
    """获取当前活跃项目路径；未打开项目时使用用户数据目录。"""
    try:
        from runtime.project_context import get_active_project_path

        project_path = get_active_project_path()
        if project_path:
            return Path(project_path)
    except Exception:
        pass
    return get_user_data_dir() / "scratch"


def get_project_media_dir() -> Path:
    """获取当前项目的媒体存储目录: <project_path>/media/"""
    d = _get_active_project_path() / "media"
    d.mkdir(parents=True, exist_ok=True)
    return d


def get_project_models_dir() -> Path:
    """获取当前项目的模型目录: <project_path>/models/"""
    d = _get_active_project_path() / "models"
    d.mkdir(parents=True, exist_ok=True)
    return d


def get_project_screenshots_dir() -> Path:
    """获取当前项目的截图目录: <project_path>/screenshots/"""
    d = _get_active_project_path() / "screenshots"
    d.mkdir(parents=True, exist_ok=True)
    return d


def get_project_recognition_db() -> Path:
    """获取当前项目的物体识别数据库路径: <project_path>/models/database.db"""
    models_dir = get_project_models_dir()
    return models_dir / "database.db"


def get_repository_assets_dir() -> Path:
    """Return the first configured read-only asset root."""
    roots = get_repository_assets_dirs()
    if not roots:
        raise RuntimeError("No resources.asset_roots are configured")
    return roots[0]


def get_repository_assets_dirs() -> tuple[Path, ...]:
    return tuple(Path(root) for root in _runtime_paths()["asset_roots"])


def resolve_repository_asset_path(relative: str) -> Path:
    name = Path(relative)
    if name.anchor or ".." in name.parts or not relative:
        raise ValueError("Asset name must be relative to an asset root")
    for root in get_repository_assets_dirs():
        candidate = root / name
        if candidate.exists():
            return candidate
    return get_repository_assets_dir() / name
