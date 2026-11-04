"""Focused DeepSeek conversation for unresolved node-graph review tasks."""

from __future__ import annotations

from functools import cache
import json
from pathlib import Path
import logging
import threading
import time
import urllib.error
import urllib.request
import uuid
from typing import Any

from .. import deepseek_client
from .node_graph_review_service import NodeGraphReviewService

logger = logging.getLogger(__name__)


@cache
def _legacy_policy():
    """Copy shared with the Web builder for callers still sending raw context."""
    path = Path(__file__).resolve().parents[1] / "cabbage_chat_policy.json"
    return json.loads(path.read_text(encoding="utf-8"))


class NodeGraphReviewChatService:
    TIMEOUT_SECONDS = 45
    MAX_MESSAGES = 24
    MAX_TASKS = 20
    MAX_GRAPH_CHARS = 18000
    MAX_ACTIVE_TASKS = 40
    MAX_PROJECT_ACTORS = 80
    MAX_ACTOR_ALIASES = 12
    MAX_ACTOR_TAGS = 12

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._tasks: dict[str, dict[str, Any]] = {}

    @staticmethod
    def _error(code: str, message: str) -> dict[str, Any]:
        return {"success": False, "status": "error", "error": code, "message": message}

    @classmethod
    def _normalize_payload(cls, payload: Any) -> dict[str, Any]:
        if not isinstance(payload, dict):
            raise ValueError("包菜答疑请求格式不正确")
        locale = "en-US" if str(payload.get("locale") or "").lower().startswith("en") else "zh-CN"
        messages = []
        for item in (payload.get("messages") or [])[-cls.MAX_MESSAGES :]:
            if not isinstance(item, dict):
                continue
            role = "assistant" if item.get("role") == "assistant" else "user"
            content = str(item.get("content") or "").strip()[:4000]
            if content:
                messages.append({"role": role, "content": content})
        if not messages or messages[-1]["role"] != "user":
            raise ValueError("请输入需要继续询问的问题")

        tasks = []
        for task in (payload.get("tasks") or [])[: cls.MAX_TASKS]:
            if not isinstance(task, dict):
                continue
            task_key = str(task.get("taskKey") or task.get("issueKey") or "")[:160]
            task_type = str(task.get("type") or "")
            if task_type not in {"tutorial", "goal", "node-issue"}:
                task_type = "node-issue"
            tasks.append({
                "taskKey": task_key,
                "issueKey": task_key,
                "type": task_type,
                "title": str(task.get("title") or "")[:160],
                "titleEn": str(task.get("titleEn") or "")[:160],
                "message": str(task.get("message") or "")[:800],
                "messageEn": str(task.get("messageEn") or "")[:800],
                "suggestion": str(task.get("suggestion") or "")[:800],
                "suggestionEn": str(task.get("suggestionEn") or "")[:800],
                "completionCriteria": str(task.get("completionCriteria") or "")[:600],
                "completionCriteriaEn": str(task.get("completionCriteriaEn") or "")[:600],
                "completionSignal": str(task.get("completionSignal") or "")[:80],
                "guidanceIntent": str(task.get("guidanceIntent") or "")[:80],
                "nodeId": str(task.get("nodeId") or "")[:160],
                "blockId": str(task.get("blockId") or "")[:160],
                "edgeId": str(task.get("edgeId") or "")[:160],
                "code": str(task.get("code") or "")[:80],
            })

        graph_excerpt = payload.get("graphExcerpt") if isinstance(payload.get("graphExcerpt"), dict) else {}
        graph_text = json.dumps(graph_excerpt, ensure_ascii=False, separators=(",", ":"))
        if len(graph_text) > cls.MAX_GRAPH_CHARS:
            graph_text = graph_text[: cls.MAX_GRAPH_CHARS] + "…"

        raw_project_context = payload.get("projectContext")
        raw_project_context = raw_project_context if isinstance(raw_project_context, dict) else {}
        actors = []
        seen_actor_names = set()
        for item in (raw_project_context.get("actors") or [])[: cls.MAX_PROJECT_ACTORS]:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or "").strip()[:240]
            name_key = name.casefold()
            if not name or name_key in seen_actor_names:
                continue
            seen_actor_names.add(name_key)
            aliases = []
            for alias in (item.get("aliases") or [])[: cls.MAX_ACTOR_ALIASES]:
                value = str(alias or "").strip()[:240]
                if value and value.casefold() != name_key and value not in aliases:
                    aliases.append(value)
            tags = []
            for tag in (item.get("tags") or [])[: cls.MAX_ACTOR_TAGS]:
                value = str(tag or "").strip()[:120]
                if value and value not in tags:
                    tags.append(value)
            actors.append({
                "name": name,
                "type": str(item.get("type") or "actor").strip()[:120] or "actor",
                "tags": tags,
                "aliases": aliases,
            })
        project_context = {
            "sceneName": str(raw_project_context.get("sceneName") or "").strip()[:320],
            "actorContextAvailable": raw_project_context.get("actorContextAvailable") is True,
            "actors": actors,
        }

        raw_profile = payload.get("assistanceProfile")
        raw_profile = raw_profile if isinstance(raw_profile, dict) else {}
        try:
            score = max(0, min(int(round(float(raw_profile.get("score", raw_profile.get("fluencyScore", 0)) or 0))), 100))
        except (TypeError, ValueError):
            score = 0
        last_user_text = messages[-1]["content"].casefold()
        selected_task_key = str(payload.get("selectedTaskKey") or "")[:160]
        same_task_user_messages = sum(1 for item in messages if item["role"] == "user")
        detail_requested = payload.get("detailGuidanceRequested") is True or any(
            term.casefold() in last_user_text for term in _legacy_policy()["detailTerms"]
        ) or bool(selected_task_key and same_task_user_messages >= 2)
        return {
            "requestId": str(payload.get("requestId") or f"node_chat_{uuid.uuid4().hex}"),
            "locale": locale,
            "worldId": str(payload.get("worldId") or "")[:160],
            "projectScopeId": str(payload.get("projectScopeId") or "")[:160],
            "graphRevision": str(payload.get("graphRevision") or "")[:160],
            "assistanceProfile": {
                "score": score,
                "updatedAt": max(0, int(raw_profile.get("updatedAt") or 0)),
            },
            "selectedTaskKey": selected_task_key,
            "detailGuidanceRequested": detail_requested,
            "tasks": tasks,
            "graphText": graph_text,
            "projectContext": project_context,
            "messages": messages,
        }

    @classmethod
    def _guidance_metadata(cls, request: dict[str, Any]) -> dict[str, Any]:
        if not request["detailGuidanceRequested"]:
            return {"needsShowcase": False, "guidanceIntent": "", "steps": []}
        policy = _legacy_policy()
        task_guides, issue_guides = policy["taskGuides"], policy["issueGuides"]
        question = request["messages"][-1]["content"].casefold()
        guide = None
        for rule in policy["keywords"]:
            if any(word in question for word in rule["any"]) and (
                not rule["also"] or any(word in question for word in rule["also"])
            ):
                guide = task_guides.get(rule["guide"]) or issue_guides[rule["guide"]]
                break
        selected = next((task for task in request["tasks"] if task["taskKey"] == request["selectedTaskKey"]), None)
        if not guide and selected:
            if selected["type"] == "goal":
                guide = next((g for g in task_guides.values() if g["intent"] == selected["guidanceIntent"]), None)
            guide = guide or task_guides.get(selected["taskKey"]) or issue_guides.get(selected["code"])
        locale = request["locale"]
        return {
            "needsShowcase": bool(guide),
            "guidanceIntent": guide["intent"] if guide else "",
            "steps": guide[locale] if guide else policy["prompts"][locale]["fallbackSteps"],
        }

    @staticmethod
    def _build_messages(request: dict[str, Any]) -> list[dict[str, str]]:
        selected = next((task for task in request["tasks"] if task["taskKey"] == request["selectedTaskKey"]), None)
        context = {
            "worldId": request["worldId"],
            "projectScopeId": request["projectScopeId"],
            "graphRevision": request["graphRevision"],
            "selectedTask": selected,
            "activeTasks": request["tasks"],
            "graphExcerpt": request["graphText"],
            "projectContext": request["projectContext"],
        }
        profile = request["assistanceProfile"]
        band = "unscored"
        if profile["updatedAt"] > 0:
            band = "high" if profile["score"] >= 75 else "low" if profile["score"] <= 45 else "medium"
        copy = _legacy_policy()["prompts"][request["locale"]]
        return [
            {"role": "system", "content": copy["base"] + copy["scores"][band]
             + (copy["detail"] if request["detailGuidanceRequested"] else "")},
            {"role": "system", "content": copy["contextPrefix"] + json.dumps(context, ensure_ascii=False)},
            *request["messages"],
        ]

    @classmethod
    def _prepare_request(cls, payload: Any) -> dict[str, Any]:
        if not isinstance(payload, dict) or "modelMessages" not in payload:
            legacy = cls._normalize_payload(payload)
            return {"requestId": legacy["requestId"], "modelMessages": cls._build_messages(legacy),
                    "guidance": cls._guidance_metadata(legacy)}

        messages = payload["modelMessages"]
        if not isinstance(messages, list) or not 3 <= len(messages) <= cls.MAX_MESSAGES + 2:
            raise ValueError("包菜答疑消息数量无效")
        model_messages = []
        for index, item in enumerate(messages):
            roles = ("system",) if index < 2 else ("user", "assistant")
            if not isinstance(item, dict) or item.get("role") not in roles:
                raise ValueError("包菜答疑消息角色无效")
            content = item.get("content")
            if not isinstance(content, str) or not content.strip() or (index >= 2 and len(content) > 4000):
                raise ValueError("包菜答疑消息内容无效")
            model_messages.append({"role": item["role"], "content": content})
        if model_messages[-1]["role"] != "user":
            raise ValueError("请输入需要继续询问的问题")
        guidance = payload.get("guidance")
        if (not isinstance(guidance, dict) or not isinstance(guidance.get("steps"), list)
                or not isinstance(guidance.get("guidanceIntent"), str)
                or not isinstance(guidance.get("needsShowcase"), bool)
                or len(guidance["steps"]) > 8
                or any(not isinstance(step, str) or len(step) > 500 for step in guidance["steps"])):
            raise ValueError("包菜操作引导格式无效")
        return {
            "requestId": str(payload.get("requestId") or f"node_chat_{uuid.uuid4().hex}"),
            "modelMessages": model_messages,
            "guidance": {key: guidance[key] for key in ("needsShowcase", "guidanceIntent", "steps")},
        }

    @classmethod
    def _build_http_request(cls, request: dict[str, Any], settings: Any, *, stream: bool) -> urllib.request.Request:
        return deepseek_client.build_request(
            settings, request["modelMessages"], temperature=0.25, max_tokens=1400, stream=stream,
        )

    def _append_content(self, task_id: str, text: str) -> None:
        if not text:
            return
        with self._lock:
            state = self._tasks.get(task_id)
            if not state or state["cancel"].is_set():
                return
            state["content"] += text
            state["updatedAt"] = time.time()

    def _finish_task(self, task_id: str, status: str, *, error: str = "", message: str = "") -> None:
        with self._lock:
            state = self._tasks.get(task_id)
            if not state:
                return
            state["status"] = status
            state["error"] = error
            state["message"] = message
            state["updatedAt"] = time.time()

    def _run_stream(self, task_id: str, request: dict[str, Any], settings: Any) -> None:
        def stop_if_cancelled() -> bool:
            with self._lock:
                state = self._tasks.get(task_id)
                cancelled = not state or state["cancel"].is_set()
            if cancelled:
                self._finish_task(task_id, "cancelled", message="已停止等待本次回答。")
            return cancelled

        try:
            http_request = self._build_http_request(request, settings, stream=True)
            for text in deepseek_client.stream_text(
                http_request, timeout=self.TIMEOUT_SECONDS, should_stop=stop_if_cancelled,
            ):
                self._append_content(task_id, text)

            with self._lock:
                state = self._tasks.get(task_id)
                if not state or state["status"] == "cancelled":
                    return
                if state["cancel"].is_set():
                    state["status"] = "cancelled"
                    state["message"] = "已停止等待本次回答。"
                elif not str(state.get("content") or "").strip():
                    state["status"] = "error"
                    state["error"] = "AI_EMPTY_RESPONSE"
                    state["message"] = "DeepSeek 没有返回可显示的内容。"
                else:
                    state["status"] = "completed"
                    state.update(request["guidance"])
                state["updatedAt"] = time.time()
        except urllib.error.HTTPError as exc:
            code = f"HTTP_{exc.code}"
            message = "DeepSeek 请求失败，请稍后再试。"
            if exc.code == 401:
                message = "DeepSeek API Key 无效或已过期。"
            elif exc.code == 429:
                message = "DeepSeek 请求过于频繁，请稍后再试。"
            self._finish_task(task_id, "error", error=code, message=message)
        except urllib.error.URLError:
            self._finish_task(task_id, "error", error="NETWORK_ERROR", message="无法连接 DeepSeek，请检查网络和配置。")
        except Exception as exc:
            logger.debug("Node graph review chat stream failed: %s", exc)
            self._finish_task(task_id, "error", error="AI_RESPONSE_ERROR", message="DeepSeek 返回内容无法读取，请稍后再试。")

    def _prune_locked(self) -> None:
        if len(self._tasks) < self.MAX_ACTIVE_TASKS:
            return
        completed = sorted(
            (
                (task_id, state)
                for task_id, state in self._tasks.items()
                if state.get("status") in {"completed", "cancelled", "error"}
            ),
            key=lambda item: float(item[1].get("updatedAt") or 0),
        )
        while len(self._tasks) >= self.MAX_ACTIVE_TASKS and completed:
            task_id, _ = completed.pop(0)
            self._tasks.pop(task_id, None)

    def start(self, payload: Any) -> dict[str, Any]:
        try:
            request = self._prepare_request(payload)
            settings = NodeGraphReviewService._resolve_settings()
            if not settings.api_key:
                return self._error("AI_NOT_CONFIGURED", "DeepSeek 未配置，包菜答疑暂不可用。")

            task_id = f"node_chat_task_{uuid.uuid4().hex}"
            now = time.time()
            state = {
                "taskId": task_id,
                "requestId": request["requestId"],
                "status": "running",
                "content": "",
                "error": "",
                "message": "",
                "needsShowcase": False,
                "guidanceIntent": "",
                "steps": [],
                "cancel": threading.Event(),
                "createdAt": now,
                "updatedAt": now,
            }
            with self._lock:
                self._prune_locked()
                self._tasks[task_id] = state
            thread = threading.Thread(
                target=self._run_stream,
                args=(task_id, request, settings),
                name=f"NodeGraphChat-{task_id[-8:]}",
                daemon=True,
            )
            state["thread"] = thread
            thread.start()
            return {
                "success": True,
                "status": "accepted",
                "taskId": task_id,
                "requestId": request["requestId"],
            }
        except ValueError as exc:
            return self._error("INVALID_PAYLOAD", str(exc))
        except Exception as exc:
            logger.debug("Node graph review chat start failed: %s", exc)
            return self._error("AI_CHAT_FAILED", "包菜答疑暂时不可用，请稍后再试。")

    def status(self, task_id: Any) -> dict[str, Any]:
        task_key = str(task_id or "")
        with self._lock:
            state = self._tasks.get(task_key)
            if not state:
                return self._error("TASK_NOT_FOUND", "没有找到这次包菜答疑请求。")
            return {
                "success": True,
                "status": state["status"],
                "taskId": task_key,
                "requestId": state["requestId"],
                "content": str(state.get("content") or ""),
                "error": str(state.get("error") or ""),
                "message": str(state.get("message") or ""),
                "needsShowcase": state.get("needsShowcase") is True,
                "guidanceIntent": str(state.get("guidanceIntent") or ""),
                "steps": [str(step) for step in (state.get("steps") or [])[:8]],
            }

    def cancel(self, task_id: Any) -> dict[str, Any]:
        task_key = str(task_id or "")
        with self._lock:
            state = self._tasks.get(task_key)
            if not state:
                return self._error("TASK_NOT_FOUND", "没有找到这次包菜答疑请求。")
            if state["status"] in {"completed", "cancelled", "error"}:
                return {"success": True, "status": state["status"], "taskId": task_key}
            state["cancel"].set()
            state["status"] = "cancelling"
            state["updatedAt"] = time.time()
            return {"success": True, "status": "cancelling", "taskId": task_key}

    def shutdown(self) -> None:
        with self._lock:
            for state in self._tasks.values():
                state["cancel"].set()


_service: NodeGraphReviewChatService | None = None


def get_node_graph_review_chat_service() -> NodeGraphReviewChatService:
    global _service
    if _service is None:
        _service = NodeGraphReviewChatService()
    return _service
