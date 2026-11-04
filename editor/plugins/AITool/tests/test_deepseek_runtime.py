"""Run the real AI facade in a standard-library-only, network-blocked process."""

from pathlib import Path
import os
import shutil
import subprocess
import sys
import textwrap

import pytest


@pytest.mark.parametrize("packaged", [False, True])
def test_runtime_requests_streaming_and_key_updates_without_external_packages(tmp_path, packaged):
    editor_root = Path(__file__).resolve().parents[3]
    if packaged:
        deployed = tmp_path / "中文 runtime" / "CabbageEditor"
        for relative in ("plugins/AITool", "runtime", "config", "api", "script_runtime"):
            shutil.copytree(
                editor_root / relative, deployed / relative,
                ignore=shutil.ignore_patterns("__pycache__", "tests", ".pytest_cache"),
            )
        editor_root = deployed
    script = textwrap.dedent('''
        import importlib.abc
        import io
        import json
        import os
        from pathlib import Path
        import socket
        import sys
        import threading
        import urllib.request

        sys.path.insert(0, sys.argv[1])
        forbidden = {"Quasar", "langchain", "langchain_core", "langgraph", "openai", "httpx", "pydantic", "torch"}
        class BlockExternal(importlib.abc.MetaPathFinder):
            def find_spec(self, fullname, path=None, target=None):
                if fullname.split(".")[0] in forbidden:
                    raise AssertionError("Unexpected external runtime import: " + fullname)
        sys.meta_path.insert(0, BlockExternal())
        def no_network(*args, **kwargs):
            raise AssertionError("Real network access is forbidden")
        socket.create_connection = no_network
        socket.socket.connect = no_network

        from plugins.AITool.configuration import local_secrets, deepseek_settings
        from plugins.AITool.main import AITool
        from plugins.AITool.services.node_graph_review_service import NodeGraphReviewService
        from plugins.AITool.services.node_graph_review_chat_service import NodeGraphReviewChatService
        from plugins.AITool.services.node_graph_generation_service import NodeGraphGenerationService
        from plugins.AITool.services.cabbage_context_service import CabbageContextService

        root = Path(sys.argv[2])
        assert local_secrets._ENV_FILE == Path(sys.argv[1]) / ".env"
        assert deepseek_settings._SETTINGS_FILE == Path(sys.argv[1]) / "deepseek_settings.json"
        local_secrets._ENV_FILE = root / ".env"
        local_secrets._ENV_FILE.write_text("OTHER_SETTING=keep\\n", encoding="utf-8")
        deepseek_settings._SETTINGS_FILE = root / "deepseek_settings.json"
        for name in local_secrets._ENV_NAMES:
            os.environ.pop(name, None)
        urllib.request.urlopen = no_network
        assert AITool.submit_request({"operation": "ai.settings.get"}) == {"configured": False, "masked_key": ""}
        assert AITool.initialize_runtime()
        assert AITool.runtime_state()[0] == "ready"
        payload = {"messages": [{"role": "user", "content": "How can I fix this node?"}]}
        assert AITool.submit_request({"operation": "node_graph.review.chat.start", "payload": payload})["error"] == "AI_NOT_CONFIGURED"

        def save(key):
            result = AITool.submit_request({"operation": "ai.settings.set", "payload": {"api_key": key}})
            assert result["configured"] and key not in repr(result)
        save("old-fixture-key")
        previous = NodeGraphReviewService._resolve_settings()
        requests = []
        entered, release = threading.Event(), threading.Event()
        class Response(io.BytesIO):
            def __init__(self, stream):
                self.stream = stream
                self.headers = {"Content-Type": "text/event-stream" if stream else "application/json"}
                super().__init__(json.dumps({"choices": [{"message": {"content": "{}"}}]}).encode())
            def __iter__(self):
                entered.set()
                assert release.wait(5), "Test stream was never released"
                yield b'data: {"choices":[{"delta":{"content":"hello"}}]}\\n'
                yield b'data: [DONE]\\n'
        def urlopen(request, timeout):
            body = json.loads(request.data)
            requests.append((request, timeout))
            return Response(body.get("stream", False))
        urllib.request.urlopen = urlopen

        assert NodeGraphReviewService._call_deepseek(previous, "review") == "{}"
        assert NodeGraphGenerationService._call_deepseek(NodeGraphReviewService._resolve_settings("node_graph"), "generate") == "{}"
        assert CabbageContextService._call_deepseek_for_goal_plan("world", "creative") == {}
        started = AITool.submit_request({"operation": "node_graph.review.chat.start", "payload": payload})
        assert started["success"] and entered.wait(5)
        task_id = started["taskId"]
        save("new-fixture-key")
        current = NodeGraphReviewService._resolve_settings()
        assert previous.api_key == "old-fixture-key" and current.api_key == "new-fixture-key"
        assert current.model == previous.model
        release.set()
        chat = AITool._node_graph_review_chat_service
        chat._tasks[task_id]["thread"].join(5)
        status = AITool.submit_request({"operation": "node_graph.review.chat.status", "taskId": task_id})
        assert status["status"] == "completed" and status["content"] == "hello", status
        NodeGraphReviewService._call_deepseek(current, "next review")

        profiles = [
            (0.1, 1200, 35, False), (0.05, 12000, 90, False),
            (0.25, 3600, 45, False), (0.25, 1400, 45, True), (0.1, 1200, 35, False),
        ]
        def pair(system, user):
            return [{"role": "system", "content": system}, {"role": "user", "content": user}]
        review_system = (
            "你是 CoronaEngine 3D 游戏节点逻辑审查员。只审查给定的可见节点、"
            "连线、条件和积木，不编造对象或积木。发现问题时合并成一句委婉、"
            "可执行的中文提示，句式接近‘……有问题，原因是……；这样做就好了。’只输出 JSON。"
        )
        generate_system = (
            "你是 CoronaEngine 内嵌节点图编辑器。你只输出一个 JSON 对象。"
            "必须根据本次提供的 XML 合同对 node_graph:project:global 做增删改查，返回完整最终节点图。"
            "禁止输出 Python、XML、文件路径、JSON Patch、Markdown 或合同外积木。"
        )
        goal_system = "你只负责为 CoronaEngine 生成结构化的个性化世界搭建任务，绝不生成或修改节点图、积木工作区和脚本，必须返回合法 JSON。"
        prompts = [
            pair(review_system, "review"), pair(generate_system, "generate"),
            pair(goal_system, CabbageContextService._goal_plan_prompt("world", "creative")),
            NodeGraphReviewChatService._build_messages(NodeGraphReviewChatService._normalize_payload(payload)),
            pair(review_system, "next review"),
        ]
        keys = ["old-fixture-key"] * 4 + ["new-fixture-key"]
        for (request, timeout), profile, key, messages in zip(requests, profiles, keys, prompts, strict=True):
            temperature, tokens, seconds, stream = profile
            assert request.full_url == "https://api.deepseek.com/v1/chat/completions"
            assert request.get_method() == "POST" and timeout == seconds
            headers = {"Authorization": "Bearer " + key, "Content-type": "application/json"}
            expected = {"model": "deepseek-v4-flash", "temperature": temperature, "max_tokens": tokens}
            if not stream:
                expected["response_format"] = {"type": "json_object"}
            expected["thinking"] = {"type": "disabled"}
            if stream:
                expected["stream"] = True
                headers["Accept"] = "text/event-stream"
            expected["messages"] = messages
            assert dict(request.header_items()) == headers
            assert request.data == json.dumps(expected, ensure_ascii=False).encode("utf-8")

        entered.clear()
        release.clear()
        started = AITool.submit_request({"operation": "node_graph.review.chat.start", "payload": payload})
        assert entered.wait(5)
        task_id = started["taskId"]
        assert AITool.submit_request({"operation": "node_graph.review.chat.cancel", "taskId": task_id})["status"] == "cancelling"
        release.set()
        chat._tasks[task_id]["thread"].join(5)
        assert AITool.submit_request({"operation": "node_graph.review.chat.status", "taskId": task_id})["status"] == "cancelled"
        assert "OTHER_SETTING=keep" in local_secrets._ENV_FILE.read_text(encoding="utf-8")
        assert not any(name.split(".")[0] in forbidden for name in sys.modules)
        assert str(Path(sys.argv[1]) / "plugins" / "AITool") not in sys.path
        AITool.cleanup()
        AITool.cleanup()
        assert AITool.runtime_state()[0] == "stopped"
        print("startup, request profiles, SSE, cancellation, key refresh and shutdown passed")
    ''')
    result = subprocess.run(
        [sys.executable, "-S", "-B", "-c", script, str(editor_root), str(tmp_path)],
        cwd=tmp_path, env={**os.environ, "PYTHONPATH": ""},
        capture_output=True, text=True, timeout=30,
    )
    assert result.returncode == 0, result.stdout + result.stderr
