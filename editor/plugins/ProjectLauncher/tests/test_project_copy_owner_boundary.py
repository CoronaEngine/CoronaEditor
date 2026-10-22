from pathlib import Path

EDITOR = Path(__file__).resolve().parents[3]


def test_old_project_copy_and_template_writers_are_removed():
    source = (EDITOR / "runtime/project_templates.py").read_text(encoding="utf-8")
    for token in ("create_project_from_template", "normalize_project_runtime_paths", "update_project_config",
                  "create_scene_from_template", "project.ini", ".scene"):
        assert token not in source
    assert "create_actor_from_template" in source
