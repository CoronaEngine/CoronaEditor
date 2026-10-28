from pathlib import Path


PLUGIN_ROOT = Path(__file__).resolve().parents[1]
MAIN_SOURCE = PLUGIN_ROOT / "main.py"
VISION_ADAPTER = PLUGIN_ROOT / "compat" / "legacy_vision_scene_adapter.py"
VISION_IMPORT_ADAPTER = PLUGIN_ROOT / "vision_import.py"
COMPAT_IMPORT_ADAPTER = PLUGIN_ROOT / "compat" / "legacy_vision_import_adapter.py"


def test_scene_tools_has_a_local_boundary_document():
    boundary = PLUGIN_ROOT / "BOUNDARY.md"

    assert boundary.is_file()
    source = boundary.read_text(encoding="utf-8")
    assert "scene.*" in source
    assert "sceneTools.*" in source
    assert "native scene snapshot" in source
    assert "已删除 `legacy_vision_import_helper.py`" in source


def test_scene_tools_historical_facade_is_removed_after_native_migration():
    registry = (PLUGIN_ROOT.parents[1] / "runtime" / "registry.py").read_text(
        encoding="utf-8"
    )

    assert not (PLUGIN_ROOT / "compat" / "legacy_scene_tools.py").exists()
    assert "class SceneTools" in MAIN_SOURCE.read_text(encoding="utf-8")
    assert '"plugins.SceneTools.main", "SceneTools"' in registry




def test_runtime_vision_paths_remain_forwarding_aliases():
    assert not (PLUGIN_ROOT.parents[1] / "runtime" / "legacy_vision_import_adapter.py").exists()
    assert not (PLUGIN_ROOT.parents[1] / "runtime" / "legacy_vision_scene_adapter.py").exists()


def test_unreferenced_vision_helper_has_been_removed():
    assert not (PLUGIN_ROOT / "compat" / "legacy_vision_import_helper.py").exists()
    assert not VISION_IMPORT_ADAPTER.exists()

def test_scene_tools_uses_public_rendering_apis_without_archive_import():
    source = MAIN_SOURCE.read_text(encoding="utf-8")
    assert "from api.editor_api import CoronaEditorApi" in source
    assert "CoronaEditorApi.scene_tools.set_vision_render_mode" in source
    assert "vision_import" not in source
    assert "load_vision_scene" not in source
    assert "import_vision_scene" not in source
    assert not VISION_ADAPTER.exists()
    assert not COMPAT_IMPORT_ADAPTER.exists()
