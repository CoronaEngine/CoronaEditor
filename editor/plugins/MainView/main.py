"""MainView's legacy-host adapter over the native main/scene contracts."""

import json
import logging
from typing import Optional

from api.editor_api import CoronaEditorApi
from runtime.plugin_base import PluginBase
from config.paths_config import get_default_paths

core_path = get_default_paths()

logger = logging.getLogger(__name__)


@PluginBase.register_web("MainView")
class MainView(PluginBase):


    @staticmethod
    def on_init(project_path: str = ""):
        result = CoronaEditorApi.main.on_init(project_path)
        if not isinstance(result, dict) or result.get("status") != "success":
            message = result.get("message", "初始化场景失败") if isinstance(result, dict) else "初始化场景失败"
            raise RuntimeError(message)
        return result


    @staticmethod
    def scene_save(scene_name: str) -> str:
        try:
            return json.dumps(CoronaEditorApi.main.scene_save(scene_name), ensure_ascii=False)
        except Exception as exc:
            return json.dumps({"status": "error", "message": str(exc)})

    @staticmethod
    def run_project(scene_path: Optional[str] = None) -> dict:
        try:
            if scene_path:
                snapshot = CoronaEditorApi.scene.get_snapshot(scene_path)
                if not isinstance(snapshot, dict) or snapshot.get("status") == "error":
                    message = snapshot.get("message", f"场景不存在: {scene_path}") if isinstance(snapshot, dict) else f"场景不存在: {scene_path}"
                    return {"status": "error", "message": message}
                scene_name = snapshot.get("scene_name") or snapshot.get("scene") or scene_path
                logger.info("开始运行场景: %s", scene_name)
            else:
                index = CoronaEditorApi.main.on_init()
                if not isinstance(index, dict) or index.get("status") != "success":
                    return {"status": "error", "message": "当前项目尚未完成初始化"}
                # Native on_init 现在返回 scenes + active_index（并带顶层 path）；
                # 旧构建返回 scene。两种都接受，否则“运行项目”会在有场景时误报没有场景。
                scenes = index.get("scenes") if isinstance(index.get("scenes"), list) else []
                try:
                    active_index = int(index.get("active_index") or 0)
                except (TypeError, ValueError):
                    active_index = 0
                active_index = min(max(active_index, 0), max(0, len(scenes) - 1))
                scene = index.get("scene")
                if not isinstance(scene, dict):
                    scene = scenes[active_index] if scenes and isinstance(scenes[active_index], dict) else {}
                scene_name = scene.get("path") if isinstance(scene, dict) else None
                if not scene_name:
                    scene_name = index.get("path")
                if not scene_name:
                    return {"status": "error", "message": "当前项目没有已加载场景"}
                logger.info("开始运行项目...")
            blockly_result = None
            try:
                from script_runtime.runner import run_generated_script
                run_generated_script(core_path.repo_root)
                blockly_result = "executed"
            except Exception as exc:
                logger.exception("Blockly 脚本执行失败: %s", exc)
                blockly_result = f"error: {exc}"
            return {"status": "success", "type": "scene" if scene_path else "project", "scene_name": scene_name, "blockly_result": blockly_result}
        except Exception as exc:
            logger.error("运行失败: %s", exc)
            return {"status": "error", "message": str(exc)}

__all__ = ["MainView", "core_path"]
