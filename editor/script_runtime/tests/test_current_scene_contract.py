from types import SimpleNamespace
import pytest




def test_native_snapshot_builds_restricted_scene_script_target():
    from script_runtime.manifest_adapter import scene_target_from_snapshot

    target = scene_target_from_snapshot(
        {
            "scene": "scene.ini",
            "scene_name": "Level",
            "script": "Scripts/level.py",
            "actors": [
                {"name": "Hero", "script": "Scripts/hero.py"},
                {"name": "Light"},
            ],
        }
    )

    assert target.route == "scene.ini"
    assert target.name == "Level"
    assert target.script_path == "Scripts/level.py"
    assert [actor.name for actor in target._actors] == ["Hero", "Light"]
    assert target._actors[0].script_path == "Scripts/hero.py"
    assert target._actors[1].script_path == ""








def test_runtime_scene_does_not_reconstruct_a_legacy_python_scene():
    from pathlib import Path

    source = (
        Path(__file__).resolve().parents[1] / "engine" / "corona_engine.py"
    ).read_text(encoding="utf-8")
    start = source.index("def _runtime_scene")
    end = source.index("def _runtime_scene_key", start)

    assert "script_runtime.compat.legacy_scene_adapter" not in source[start:end]


def test_known_actor_queries_do_not_fallback_to_legacy_scene_adapter():
    from pathlib import Path

    source = (
        Path(__file__).resolve().parents[1] / "engine" / "corona_engine.py"
    ).read_text(encoding="utf-8")
    start = source.index("def _iter_known_actors")
    end = source.index("def _deleted_names", start)

    assert "script_runtime.compat.legacy_scene_adapter" not in source[start:end]


def test_actor_resolution_does_not_fallback_to_legacy_scene_adapter():
    from pathlib import Path

    source = (
        Path(__file__).resolve().parents[1] / "engine" / "corona_engine.py"
    ).read_text(encoding="utf-8")
    start = source.index("def _resolve_actor")
    end = source.index("def _current_actor", start)

    assert "script_runtime.compat.legacy_scene_adapter" not in source[start:end]


def test_actor_runtime_target_prefers_native_snapshot_over_legacy_scene(monkeypatch):
    from types import SimpleNamespace

    from script_runtime.engine import corona_engine

    native_payload = {
        "scene": "scene.ini",
        "scene_name": "Level",
        "actors": [{"name": "Hero", "handle": 7}],
    }

    monkeypatch.setattr(
        corona_engine,
        "_native_scene_snapshot",
        lambda scene_name: (native_payload, []),
    )

    result = corona_engine.resolve_runtime_target(
        "actor", scene_name="scene.ini", actor_name="Hero"
    )

    assert result["status"] == "ok"
    assert result["binding_mode"] == "native_editor"
    assert result["actor"].name == "Hero"
    assert result["actor"].handle == 7


def test_runtime_target_does_not_implicitly_fallback_to_legacy_scene(monkeypatch):
    from script_runtime.engine import corona_engine

    monkeypatch.setattr(
        corona_engine,
        "_native_scene_snapshot",
        lambda scene_name: (None, ["native scene unavailable"]),
    )
    result = corona_engine.resolve_runtime_target(
        "project", scene_name="Scene/legacy.scene"
    )

    assert result["status"] == "error"
    assert result["binding_mode"] == ""
    assert "scene" not in result


def test_scene_environment_uses_the_script_runtime_scene_contract():
    from script_runtime.manifest_adapter import ScriptRuntimeSceneAdapter

    calls = []

    def invoke(method, args):
        calls.append((method, args))
        return {"status": "success", "scene": "scene.ini"}

    scene = ScriptRuntimeSceneAdapter(invoke)
    state = {
        "sun": {"enabled": True, "direction": [1.0, 2.0, 3.0]},
        "grid": {"enabled": False},
        "physics": {"gravity": [0.0, -9.8, 0.0]},
    }

    scene.get_environment("scene.ini")
    scene.set_environment("scene.ini", state)

    assert calls == [
        ("scene.get_environment", ["scene.ini"]),
        ("scene.set_environment", ["scene.ini", state]),
    ]


def test_script_runtime_scene_tools_exposes_actor_state_and_physics_aggregates():
    from script_runtime.manifest_adapter import ScriptRuntimeEditorApi

    calls = []

    def invoke(method, args):
        calls.append((method, args))
        return {"status": "success"}

    api = ScriptRuntimeEditorApi(invoke)
    api.scene_tools.set_actor_state("scene.ini", "Hero", {"visible": False})
    api.scene_tools.set_actor_physics(
        "scene.ini", "Hero", {"physics_enabled": True}
    )

    assert calls == [
        ("scene_tools.set_actor_state", ["scene.ini", "Hero", {"visible": False}]),
        ("scene_tools.set_actor_physics", ["scene.ini", "Hero", {"physics_enabled": True}]),
    ]


def test_native_actor_proxy_uses_script_runtime_scene_tools_for_actor_operations(monkeypatch):
    import api.editor_api
    from script_runtime.engine import corona_engine

    calls = []

    class SceneToolsApi:
        def set_actor_state(self, *args):
            calls.append(("state", args))
            return {"status": "success"}

        def set_actor_physics(self, *args):
            calls.append(("physics", args))
            return {"status": "success"}

    monkeypatch.setattr(
        api.editor_api,
        "get_script_runtime_editor_api",
        lambda: type("Api", (), {"scene_tools": SceneToolsApi()})(),
    )
    actor = corona_engine._NativeEditorActorProxy(
        type("Scene", (), {"route": "scene.ini"})(),
        {"name": "Hero", "geometry": {}},
    )

    actor.set_visible(False)
    actor.set_physics_enabled(True)

    assert calls == [
        ("state", ("scene.ini", "Hero", {"visible": False})),
        ("physics", ("scene.ini", "Hero", {"physics_enabled": True})),
    ]


def test_native_restore_operation_uses_script_runtime_aggregates(monkeypatch):
    import api.editor_api
    from script_runtime.engine import corona_engine

    calls = []

    class SceneToolsApi:
        def set_actor_state(self, *args):
            calls.append(("state", args))
            return {"status": "success"}

        def set_actor_physics(self, *args):
            calls.append(("physics", args))
            return {"status": "success"}

    monkeypatch.setattr(
        api.editor_api,
        "get_script_runtime_editor_api",
        lambda: type("Api", (), {"scene_tools": SceneToolsApi()})(),
    )

    assert corona_engine._native_restore_operation(
        "scene.ini", "Hero", "SetVisible", [False]
    )
    assert corona_engine._native_restore_operation(
        "scene.ini", "Hero", "SetMass", [3.0]
    )
    assert calls == [
        ("state", ("scene.ini", "Hero", {"visible": False})),
        ("physics", ("scene.ini", "Hero", {"mass": 3.0})),
    ]


def test_blockly_preview_snapshot_prefers_native_scene_values(monkeypatch, tmp_path):
    import api.editor_api
    from script_runtime.blockly import main as blockly_main

    route = str(tmp_path / "scene.ini")
    calls = []

    class SceneApi:
        def get_snapshot(self, scene_name=""):
            calls.append(("snapshot", scene_name))
            return {
                "status": "success",
                "scene": "scene.ini",
                "project_path": str(tmp_path),
                "name": "Level",
                "cameras": [{
                    "name": "MainCamera",
                    "position": [1.0, 2.0, 3.0],
                    "forward": [0.0, 0.0, 1.0],
                    "world_up": [0.0, 1.0, 0.0],
                    "fov": 45.0,
                }],
                "actors": [{
                    "name": "Hero",
                    "geometry": {
                        "position": [4.0, 5.0, 6.0],
                        "rotation": [0.0, 1.0, 0.0],
                        "scale": [1.0, 1.0, 1.0],
                    },
                }],
            }

        def get_environment(self, scene_name):
            calls.append(("environment", scene_name))
            return {
                "status": "success",
                "scene": route,
                "sun": {"enabled": True, "direction": [1.0, 2.0, 3.0]},
                "grid": {"enabled": False},
                "physics": {"gravity": [0.0, -9.8, 0.0]},
            }

    monkeypatch.setattr(
        api.editor_api,
        "get_script_runtime_editor_api",
        lambda: type("Api", (), {"scene": SceneApi()})(),
    )

    snapshot = blockly_main.ScratchTool._create_preview_state_snapshot()

    assert calls == [("snapshot", ""), ("environment", route)]
    assert snapshot["state"]["binding_mode"] == "native_editor"
    assert snapshot["state"]["environment"]["physics"]["gravity"] == [0.0, -9.8, 0.0]
    assert snapshot["state"]["actors"]["Hero"]["position"] == [4.0, 5.0, 6.0]


def test_blockly_project_snapshot_fails_closed_when_native_snapshot_is_unavailable(
    monkeypatch,
):
    from script_runtime.blockly import main as blockly_main

    import api.editor_api
    monkeypatch.setattr(api.editor_api, "get_script_runtime_editor_api", lambda: SimpleNamespace(
        scene=SimpleNamespace(get_snapshot=lambda: {"status": "error"})))
    with pytest.raises(RuntimeError, match="Current scene"):
        blockly_main.ScratchTool._create_preview_state_snapshot()


def test_blockly_preview_restore_uses_native_environment_camera_and_actor_contract(monkeypatch):
    import api.editor_api
    from script_runtime.blockly import main as blockly_main

    calls = []

    class SceneApi:
        def set_environment(self, scene_name, state):
            calls.append(("environment", scene_name, state))
            return {"status": "success"}

    monkeypatch.setattr(
        api.editor_api,
        "get_script_runtime_editor_api",
        lambda: type("Api", (), {"scene": SceneApi(), "viewport": type("Viewport", (), {
            "set_camera_pose": lambda self, *args: calls.append(("camera", *args)) or {"status": "success"}
        })()})(),
    )
    monkeypatch.setattr(blockly_main, "cancel_pending_auto_saves", lambda: None)
    monkeypatch.setattr(blockly_main.ScratchTool, "_notify_preview_state_restored", staticmethod(lambda: None))
    blockly_main.ScratchTool._preview_state_snapshot = {
        "route": "scene.ini",
        "state": {
                "binding_mode": "native_editor",
                "environment": {"grid": {"enabled": False}},
                "cameras": {"MainCamera": {"position": [1, 2, 3]}},
                "actors": {"Hero": {"position": [4, 5, 6], "rotation": [0, 1, 0], "scale": [1, 1, 1]}},
        }
    }

    try:
        restored, error = blockly_main.ScratchTool._restore_preview_state_snapshot()
    finally:
        blockly_main.ScratchTool._preview_state_snapshot = None

    assert restored is True
    assert error is None
    assert calls[0] == ("environment", "scene.ini", {"grid": {"enabled": False}})


def test_script_runtime_has_no_scene_switching_contract():
    from script_runtime.engine import corona_engine
    from script_runtime.manifest_adapter import ScriptRuntimeSceneAdapter
    assert not hasattr(corona_engine, "setScene")
    assert not hasattr(corona_engine, "nextScene")
    adapter = ScriptRuntimeSceneAdapter(lambda *args: None)
    assert not hasattr(adapter, "switch")
    assert not hasattr(adapter, "list_routes")


def test_preview_refuses_a_snapshot_from_another_project(monkeypatch, tmp_path):
    import api.editor_api
    from script_runtime.blockly.main import ScratchTool
    monkeypatch.setattr(api.editor_api, "get_script_runtime_editor_api", lambda: SimpleNamespace(
        scene=SimpleNamespace(get_snapshot=lambda: {"scene": "scene.ini", "project_path": str(tmp_path / "other")})))
    with pytest.raises(RuntimeError, match="different project"):
        ScratchTool._create_preview_state_snapshot(tmp_path / "requested")


def test_failed_preview_restore_keeps_snapshot_for_retry(monkeypatch):
    from script_runtime.blockly.main import ScratchTool
    snapshot = {"route": "C:/previous/scene.ini", "state": {"binding_mode": "native_editor"}}
    monkeypatch.setattr(ScratchTool, "_preview_state_snapshot", snapshot)
    def reject(cls, route, state):
        raise RuntimeError("Request does not identify the current scene")
    monkeypatch.setattr(ScratchTool, "_restore_native_preview_scene_state", classmethod(reject))
    restored, error = ScratchTool._restore_preview_state_snapshot()
    assert not restored
    assert "current scene" in error
    assert ScratchTool._preview_state_snapshot is snapshot
