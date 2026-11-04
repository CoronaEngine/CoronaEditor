"""Restricted manifest adapter for Script Runtime editor state operations.

The adapter reuses editor manifest names and schemas while keeping the
ScriptRuntime caller channel separate from the regular PythonScript channel.
"""

from __future__ import annotations

class ScriptRuntimeSceneAdapter:
    def __init__(self, invoke_manifest):
        self._invoke_manifest = invoke_manifest


    def get_snapshot(self, scene_name=""):
        return self._invoke_manifest("scene.get_snapshot", [scene_name])

    def get_environment(self, scene_name):
        return self._invoke_manifest("scene.get_environment", [scene_name])

    def set_environment(self, scene_name, state):
        return self._invoke_manifest("scene.set_environment", [scene_name, state])

    def set_actor_transform(self, scene_name, actor_name, transform):
        return self._invoke_manifest(
            "scene.set_actor_transform", [scene_name, actor_name, transform]
        )


class ScriptRuntimeSceneToolsAdapter:
    def __init__(self, invoke_manifest):
        self._invoke_manifest = invoke_manifest

    def create_actor(self, scene_name, source_path, actor_type, actor_data):
        return self._invoke_manifest(
            "scene_tools.create_actor",
            [scene_name, source_path, actor_type, actor_data],
        )

    def remove_actor(self, scene_name, actor_name):
        return self._invoke_manifest("scene_tools.remove_actor", [scene_name, actor_name])

    def set_actor_state(self, scene_name, actor_name, state):
        return self._invoke_manifest(
            "scene_tools.set_actor_state", [scene_name, actor_name, state]
        )

    def set_actor_animation(self, scene_name, actor_name, animation, blend_seconds=0.2):
        return self._invoke_manifest(
            "scene_tools.set_actor_animation", [scene_name, actor_name, animation, blend_seconds]
        )

    def pause_actor_animation(self, scene_name, actor_name):
        return self._invoke_manifest(
            "scene_tools.pause_actor_animation", [scene_name, actor_name]
        )

    def resume_actor_animation(self, scene_name, actor_name):
        return self._invoke_manifest(
            "scene_tools.resume_actor_animation", [scene_name, actor_name]
        )

    def set_actor_physics(self, scene_name, actor_name, physics):
        return self._invoke_manifest(
            "scene_tools.set_actor_physics", [scene_name, actor_name, physics]
        )


class ScriptRuntimeViewportAdapter:
    def __init__(self, invoke_manifest):
        self._invoke_manifest = invoke_manifest

    def set_camera_pose(self, scene_name, camera_name, camera):
        return self._invoke_manifest(
            "viewport.set_camera_pose", [scene_name, camera_name, camera]
        )


class ScriptRuntimeEditorApi:
    def __init__(self, invoke_manifest):
        self.scene = ScriptRuntimeSceneAdapter(invoke_manifest)
        self.scene_tools = ScriptRuntimeSceneToolsAdapter(invoke_manifest)
        self.viewport = ScriptRuntimeViewportAdapter(invoke_manifest)
