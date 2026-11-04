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
    assert sources == {"__init__.py", "model_service.py"}
    assert not (AI_ROOT / "Quasar").exists()
    assert not any((AI_ROOT / "cai_extensions").rglob("*.py"))


def test_frontend_ai_operations_match_backend_routes():
    source = (AI_ROOT / "main.py").read_text(encoding="utf-8")
    tree = ast.parse(source)
    routes = next(
        node.value for node in ast.walk(tree)
        if isinstance(node, ast.Assign)
        and any(isinstance(target, ast.Name) and target.id == "_OPERATIONS" for target in node.targets)
    )
    frontend = (EDITOR_ROOT / "Frontend/src/services/aiModelService.js").read_text(encoding="utf-8")
    operations = set(re.findall(r"call\('([^']+)'", frontend))
    assert operations == set(ast.literal_eval(routes))


def test_production_ai_has_no_external_runtime_imports():
    forbidden = {"Quasar", "langchain", "langchain_core", "langgraph", "openai", "torch"}
    for path in AI_ROOT.rglob("*.py"):
        if "tests" in path.parts:
            continue
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            names = ([node.module or ""] if isinstance(node, ast.ImportFrom) else
                     [alias.name for alias in node.names] if isinstance(node, ast.Import) else [])
            assert not any(name.split(".")[0] in forbidden for name in names), path
