"""Lifecycle and request routing for the editor's Cabbage/NodeGraph services."""

import json
import logging
import sys
import threading
from pathlib import Path

from runtime.plugin_base import PluginBase


logger = logging.getLogger(__name__)
_AITOOL_DIR = Path(__file__).resolve().parent
if str(_AITOOL_DIR) not in sys.path:
    sys.path.insert(0, str(_AITOOL_DIR))

# Publish the lightweight facade before initializing its services.
INITIALIZE_AFTER_PUBLISH = True


def initialize_script_service(stop_token=None):
    return AITool.initialize_runtime(stop_token=stop_token)


@PluginBase.register_web("AITool")
class AITool(PluginBase):
    _runtime_lock = threading.RLock()
    _runtime_state = "cold"
    _runtime_error = ""
    _runtime_stop = threading.Event()
    _node_graph_review_service = None
    _node_graph_review_chat_service = None
    _node_graph_generation_service = None
    _cabbage_context_service = None

    _OPERATIONS = {
        "node_graph.review.start": ("_node_graph_review_service", "start"),
        "node_graph.review.status": ("_node_graph_review_service", "status"),
        "node_graph.review.chat.start": ("_node_graph_review_chat_service", "start"),
        "node_graph.review.chat.status": ("_node_graph_review_chat_service", "status"),
        "node_graph.review.chat.cancel": ("_node_graph_review_chat_service", "cancel"),
        "node_graph.generate.start": ("_node_graph_generation_service", "start"),
        "node_graph.generate.status": ("_node_graph_generation_service", "status"),
        "node_graph.generate.cancel": ("_node_graph_generation_service", "cancel"),
        "cabbage.context.load": ("_cabbage_context_service", "load"),
        "cabbage.context.record_event": ("_cabbage_context_service", "record_event"),
        "cabbage.context.update_task": ("_cabbage_context_service", "update_task"),
        "cabbage.context.append_message": ("_cabbage_context_service", "append_message"),
        "cabbage.goal_plan.start": ("_cabbage_context_service", "start_goal_plan"),
        "cabbage.goal_plan.status": ("_cabbage_context_service", "goal_plan_status"),
        "cabbage.profile.score.start": ("_cabbage_context_service", "start_score_update"),
        "cabbage.profile.score.status": ("_cabbage_context_service", "score_update_status"),
    }

    @classmethod
    def runtime_state(cls):
        with cls._runtime_lock:
            return cls._runtime_state, cls._runtime_error

    @classmethod
    def _initializing_response(cls):
        state, error = cls.runtime_state()
        if state == "failed":
            return {"success": False, "status": "degraded",
                    "message": f"AITool initialization failed: {error}"}
        if state == "stopped" or cls._runtime_stop.is_set():
            return {"success": False, "status": "degraded", "message": "AITool is stopped"}
        return {"success": False, "status": "initializing", "message": "AITool is initializing"}

    @staticmethod
    def _configure_runtime():
        from .cai_extensions.register import install
        from .configuration.local_secrets import load_ai_setting

        # Set editor paths before Quasar collects settings. No agent/tool warmup.
        install()
        load_ai_setting()

    @staticmethod
    def _service_factories():
        from .services.node_graph_review_service import get_node_graph_review_service
        yield "_node_graph_review_service", get_node_graph_review_service

        from .services.node_graph_review_chat_service import get_node_graph_review_chat_service
        yield "_node_graph_review_chat_service", get_node_graph_review_chat_service

        from .services.node_graph_generation_service import get_node_graph_generation_service
        yield "_node_graph_generation_service", get_node_graph_generation_service

        from .services.cabbage_context_service import get_cabbage_context_service
        yield "_cabbage_context_service", get_cabbage_context_service

    @staticmethod
    def _shutdown_services(services):
        for service in reversed(tuple(services)):
            if service is not None:
                try:
                    service.shutdown()
                except Exception:
                    logger.exception("AITool service shutdown failed")

    @classmethod
    def initialize_runtime(cls, stop_token=None):
        def stopped():
            return cls._runtime_stop.is_set() or (stop_token is not None and stop_token.is_set())

        with cls._runtime_lock:
            if cls._runtime_state == "ready":
                return not stopped()
            if cls._runtime_state != "cold":
                return False
            if stopped():
                cls._runtime_state = "stopped"
                return False
            cls._runtime_state = "initializing"

        services = {}
        published = False
        try:
            cls._configure_runtime()
            if stopped():
                return False
            for attribute, factory in cls._service_factories():
                if stopped():
                    return False
                services[attribute] = factory()
            with cls._runtime_lock:
                if stopped() or cls._runtime_state != "initializing":
                    return False
                for attribute, service in services.items():
                    setattr(cls, attribute, service)
                cls._runtime_state = "ready"
                published = True
            logger.info("AITool Cabbage/NodeGraph services ready")
            return True
        except Exception as error:
            with cls._runtime_lock:
                if not stopped() and cls._runtime_state != "stopped":
                    cls._runtime_error = str(error)
                    cls._runtime_state = "failed"
            logger.exception("AITool runtime initialization failed")
            return False
        finally:
            if not published:
                with cls._runtime_lock:
                    if cls._runtime_state == "initializing":
                        cls._runtime_state = "stopped"
                # Initialization owns these objects until publication. Cleanup may
                # finish concurrently; late factory results still get closed here.
                cls._shutdown_services(services.values())

    @classmethod
    def submit_request(cls, request) -> dict:
        try:
            parsed = json.loads(request) if isinstance(request, str) else request
        except (ValueError, TypeError):
            parsed = None
        if not isinstance(parsed, dict) or not isinstance(parsed.get("operation"), str):
            return {"success": False, "error": "INVALID_AI_REQUEST"}
        operation = parsed["operation"]
        if operation in {"ai.settings.get", "ai.settings.set"}:
            from .configuration.local_secrets import deepseek_api_key_status, set_deepseek_api_key

            try:
                if operation == "ai.settings.get":
                    return deepseek_api_key_status()
                payload = parsed.get("payload") or {}
                key = payload.get("api_key") if isinstance(payload, dict) else payload
                return set_deepseek_api_key(key)
            except ValueError as exc:
                return {"success": False, "error": str(exc)}
            except Exception:
                logger.exception("AITool settings operation failed")
                return {"success": False, "error": "AI 配置保存失败"}
        route = cls._OPERATIONS.get(operation)
        if route is None:
            return {"success": False, "error": "UNSUPPORTED_AI_OPERATION"}
        with cls._runtime_lock:
            if cls._runtime_state != "ready" or cls._runtime_stop.is_set():
                return cls._initializing_response()
            callback = getattr(getattr(cls, route[0]), route[1])
        if operation.endswith("status") or operation.endswith("cancel"):
            return callback(parsed.get("taskId") or parsed.get("task_id") or "")
        return callback(parsed.get("payload") or {})

    @classmethod
    def request_shutdown(cls):
        with cls._runtime_lock:
            cls._runtime_stop.set()
            cls._runtime_state = "stopped"

    @classmethod
    def cleanup(cls):
        with cls._runtime_lock:
            cls.request_shutdown()
            services = []
            for attribute in dict.fromkeys(route[0] for route in cls._OPERATIONS.values()):
                services.append(getattr(cls, attribute))
                setattr(cls, attribute, None)
        cls._shutdown_services(services)
