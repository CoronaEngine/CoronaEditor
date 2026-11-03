import ast
import re
from pathlib import Path


AI_ROOT = Path(__file__).resolve().parents[1]
EDITOR_ROOT = AI_ROOT.parents[1]


def test_aitool_module_does_not_import_editor_runtime_container_at_module_scope():
    source = (AI_ROOT / "main.py").read_text(encoding="utf-8")
    module_scope = source.split("@PluginBase.register_web", 1)[0]
    assert "from CoronaCore.core.corona_editor import CoronaEditor" not in module_scope


def test_aitool_runtime_does_not_bind_native_engine_objects():
    source = (AI_ROOT / "main.py").read_text(encoding="utf-8")
    assert "import CoronaEngine as corona_engine" not in source
    assert "corona_engine=corona_engine" not in source


def test_legacy_media_compatibility_layers_are_not_restored():
    assert not (AI_ROOT / "compat" / "legacy_image_utils.py").exists()
    assert not any(
        path.is_file() and "__pycache__" not in path.parts
        for path in (AI_ROOT / "utils").rglob("*")
    )


def test_ai_services_only_contain_current_frontend_features():
    sources = {
        path.relative_to(AI_ROOT / "services").as_posix()
        for path in (AI_ROOT / "services").rglob("*.py")
        if "tests" not in path.parts
    }
    assert sources == {
        "__init__.py", "node_graph_review_service.py",
        "node_graph_review_chat_service.py", "node_graph_generation_service.py",
        "cabbage_context_service.py",
    }
    assert {path.name for path in (AI_ROOT / "cai_extensions").rglob("*.py")} == {
        "__init__.py", "register.py", "paths_provider.py", "app_config_provider.py",
    }


def test_frontend_ai_operations_match_backend_routes():
    source = (AI_ROOT / "main.py").read_text(encoding="utf-8")
    tree = ast.parse(source)
    routes = next(
        node.value for node in ast.walk(tree)
        if isinstance(node, ast.Assign)
        and any(isinstance(target, ast.Name) and target.id == "_OPERATIONS" for target in node.targets)
    )
    frontend = (EDITOR_ROOT / "Frontend/src/services/aiService.js").read_text(encoding="utf-8")
    operations = set(re.findall(r"operation: '([^']+)'", frontend))
    assert operations == set(ast.literal_eval(routes))


def test_configuration_bridge_does_not_register_agent_runtime():
    source = (AI_ROOT / "cai_extensions/register.py").read_text(encoding="utf-8")
    tree = ast.parse(source)
    modules = {node.module for node in ast.walk(tree) if isinstance(node, ast.ImportFrom)}
    assert modules == {
        "Quasar.ai_config.paths_config", "Quasar.ai_tools.warmup",
        "app_config_provider", "paths_provider",
    }
