"""Bounded asynchronous model requests. Business context belongs to Web callers."""

from concurrent.futures import ThreadPoolExecutor
import threading
import math
import time
import uuid
import urllib.error

from ..deepseek_client import build_request, stream_text
from ..configuration.deepseek_settings import resolve_settings


class ModelService:
    def __init__(self):
        self._lock = threading.RLock()
        self._executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="DeepSeek")
        self._tasks = {}
        self._closed = False

    def start(self, payload):
        if not isinstance(payload, dict):
            return {"success": False, "error": "INVALID_MODEL_REQUEST"}
        messages = payload.get("messages")
        if not isinstance(messages, list) or not messages or len(messages) > 64:
            return {"success": False, "error": "INVALID_MODEL_MESSAGES"}
        if any(not isinstance(m, dict) or m.get("role") not in {"system", "user", "assistant"}
               or not isinstance(m.get("content"), str) for m in messages):
            return {"success": False, "error": "INVALID_MODEL_MESSAGES"}
        options = payload.get("options", {})
        if not isinstance(options, dict) or options.get("format", "text") not in {"text", "json"}:
            return {"success": False, "error": "INVALID_MODEL_OPTIONS"}
        try:
            settings = resolve_settings(options.get("profile"))
            timeout = max(1, min(float(options.get("timeout", 45)), 180))
            tokens = max(1, min(int(options.get("max_tokens", settings.max_tokens)), 32000))
            temperature = max(0, min(float(options.get("temperature", settings.temperature)), 2))
            if not all(math.isfinite(float(options.get(k, 0))) for k in ("timeout", "temperature", "max_tokens")):
                raise ValueError("Options must be finite")
        except (TypeError, ValueError, OverflowError):
            return {"success": False, "error": "INVALID_MODEL_OPTIONS"}
        if not settings.api_key:
            return {"success": False, "error": "AI_NOT_CONFIGURED", "message": "请配置 DeepSeek API Key"}
        if sum(len(m["content"]) for m in messages) > 4_000_000:
            return {"success": False, "error": "MODEL_INPUT_TOO_LARGE"}
        task_id = "model_" + uuid.uuid4().hex
        with self._lock:
            if self._closed:
                return {"success": False, "error": "MODEL_SERVICE_STOPPED"}
            # Retain terminal results briefly for polling, without unbounded task growth.
            terminal = sorted((key for key, t in self._tasks.items() if t["status"] in
                              {"completed", "cancelled", "error"}), key=lambda key: self._tasks[key]["updatedAt"])
            for key in terminal:
                if len(self._tasks) < 128:
                    break
                self._tasks.pop(key)
            if len(self._tasks) >= 128:
                return {"success": False, "error": "MODEL_QUEUE_FULL"}
            state = {"status": "running", "content": "", "error": "", "message": "",
                     "cancel": threading.Event(), "updatedAt": time.time()}
            self._tasks[task_id] = state
            request = build_request(
                settings, [{"role": m["role"], "content": m["content"]} for m in messages],
                temperature=temperature, max_tokens=tokens,
                thinking=options.get("thinking", settings.thinking_enabled) is True,
                stream=True if options.get("format", "text") == "text" else None,
            )
            self._executor.submit(self._run, task_id, request, timeout)
        return {"success": True, "status": "accepted", "taskId": task_id}

    def _run(self, task_id, request, timeout):
        state = self._tasks[task_id]
        try:
            if state["cancel"].is_set():
                return
            # Both response forms use the shared transport and preserve upstream text.
            for text in stream_text(request, timeout=timeout, should_stop=state["cancel"].is_set):
                with self._lock:
                    if not state["cancel"].is_set():
                        state["content"] += text
            with self._lock:
                if not state["cancel"].is_set():
                    state["status"] = "completed" if state["content"].strip() else "error"
                    if state["status"] == "error":
                        state.update(error="AI_EMPTY_RESPONSE", message="DeepSeek 返回了空内容")
        except urllib.error.HTTPError as exc:
            with self._lock:
                state.update(status="error", error=f"HTTP_{exc.code}", message=f"DeepSeek 请求失败（HTTP {exc.code}）")
        except Exception as exc:
            with self._lock:
                state.update(status="error", error="MODEL_REQUEST_FAILED", message=type(exc).__name__)
        finally:
            with self._lock:
                if state["cancel"].is_set():
                    state["status"] = "cancelled"
                state["updatedAt"] = time.time()

    def status(self, task_id):
        with self._lock:
            state = self._tasks.get(str(task_id))
            if not state:
                return {"success": False, "error": "TASK_NOT_FOUND"}
            return {"success": True, "taskId": task_id,
                    **{key: state[key] for key in ("status", "content", "error", "message")}}

    def cancel(self, task_id):
        with self._lock:
            state = self._tasks.get(str(task_id))
            if not state:
                return {"success": False, "error": "TASK_NOT_FOUND"}
            if state["status"] not in {"completed", "error", "cancelled"}:
                state["cancel"].set()
                state["status"] = "cancelling"
            return {"success": True, "taskId": task_id, "status": state["status"]}

    def shutdown(self):
        with self._lock:
            self._closed = True
            for state in self._tasks.values():
                if state["status"] not in {"completed", "error", "cancelled"}:
                    state["cancel"].set()
                    state["status"] = "cancelled"
        self._executor.shutdown(wait=False, cancel_futures=True)


_SERVICE = None


def get_model_service():
    global _SERVICE
    if _SERVICE is None:
        _SERVICE = ModelService()
    return _SERVICE
