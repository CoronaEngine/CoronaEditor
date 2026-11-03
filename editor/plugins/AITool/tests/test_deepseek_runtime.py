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
            requests.append((request, body, timeout))
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

        for (request, body, timeout), (temperature, tokens, seconds, stream) in zip(requests, [
            (0.1, 1200, 35, False), (0.05, 12000, 90, False),
            (0.25, 3600, 45, False), (0.25, 1400, 45, True), (0.1, 1200, 35, False),
        ]):
            assert request.full_url == "https://api.deepseek.com/v1/chat/completions"
            assert body["model"] == "deepseek-v4-flash"
            assert (body["temperature"], body["max_tokens"], timeout) == (temperature, tokens, seconds)
            assert body["thinking"] == {"type": "disabled"}
            assert bool(body.get("stream")) == stream
            if not stream:
                assert body["response_format"] == {"type": "json_object"}
        assert len(requests) == 5
        assert all(request.get_header("Authorization") == "Bearer old-fixture-key" for request, _, _ in requests[:4])
        assert requests[-1][0].get_header("Authorization") == "Bearer new-fixture-key"

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
