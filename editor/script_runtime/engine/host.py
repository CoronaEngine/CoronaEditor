"""Script Runtime host lifecycle helpers.

The editor host calls this module for canonical Script Runtime startup. Native
scene route/value objects are required; startup does not recreate legacy
Python Scene objects.
"""

from __future__ import annotations

import logging
import os
from typing import Any

from api.editor_api import get_script_runtime_editor_api
from script_runtime.manifest_adapter import scene_target_from_snapshot

logger = logging.getLogger(__name__)


def _native_scene_target():
    scene_api = get_script_runtime_editor_api().scene
    snapshot = scene_api.get_snapshot()
    if not isinstance(snapshot, dict) or snapshot.get("status") in ("error", "failed"):
        return None
    target = scene_target_from_snapshot(snapshot)
    return target if target.route else None


def initialize_scripts(host: Any, project_path: str) -> None:
    """Lazily bind the project ScriptsManager to the current scene."""
    if not project_path:
        return

    scene = None
    try:
        scene = _native_scene_target()
    except Exception as exc:
        logger.debug("Native Script Runtime scene target unavailable: %s", exc)

    if scene is None:
        return

    from .scripts_manager import ScriptsManager

    if host.scripts_mgr is None:
        host.scripts_mgr = ScriptsManager()
    project_script = os.path.join(project_path, "Scripts", "project_script.py")
    host.scripts_mgr.initialize_project(project_script, scene)
    logger.debug("ScriptsManager: canonical host initialization completed, scene=%s", scene.name)
    host._scripts_initialized = True


__all__ = ["initialize_scripts"]
