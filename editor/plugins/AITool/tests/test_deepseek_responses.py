"""Provider response compatibility, including cancellation during an in-flight reply."""

import io
import json
import threading
import urllib.request

import pytest

from editor.plugins.AITool.configuration.deepseek_settings import DeepSeekSettings
from editor.plugins.AITool.services.node_graph_generation_service import NodeGraphGenerationService
from editor.plugins.AITool.services.node_graph_review_chat_service import NodeGraphReviewChatService
from editor.plugins.AITool.services.node_graph_review_service import NodeGraphReviewService
from editor.plugins.AITool.services.tests.test_node_graph_generation_service import request_payload


def use_fixture_settings(monkeypatch):
    settings = DeepSeekSettings("fixture", "https://example.invalid", "test", "test")
    monkeypatch.setattr(NodeGraphReviewService, "_resolve_settings", lambda *args: settings)


@pytest.mark.parametrize(("content_type", "wire", "expected"), [
    ("application/json", b'{"choices":[{"message":{"content":" hello "}}]}', "hello"),
    ("text/event-stream; charset=utf-8", (
        b': keepalive\n\ndata: malformed\n'
        b'data: {"choices":[{"delta":{"content":"first "}}]}\n'
        b'data: {"choices":[{"message":{"content":" next "}}]}\n'
        b'data: [DONE]\ndata: {"choices":[{"delta":{"content":"late"}}]}\n'
    ), "first next"),
])
def test_chat_reads_stream_or_complete_message(monkeypatch, content_type, wire, expected):
    use_fixture_settings(monkeypatch)
    response = io.BytesIO(wire)
    response.headers = {"Content-Type": content_type}
    monkeypatch.setattr(urllib.request, "urlopen", lambda request, timeout: response)
    chat = NodeGraphReviewChatService()
    task_id = chat.start({"messages": [{"role": "user", "content": "help"}]})["taskId"]
    chat._tasks[task_id]["thread"].join(5)
    status = chat.status(task_id)
    assert (status["status"], status["content"]) == ("completed", expected)
    assert response.closed


def test_chat_cancel_keeps_partial_content_and_discards_late_chunks(monkeypatch):
    use_fixture_settings(monkeypatch)
    paused, release = threading.Event(), threading.Event()

    class Stream(io.BytesIO):
        headers = {"Content-Type": "text/event-stream"}

        def __iter__(self):
            yield b'data: {"choices":[{"delta":{"content":"first "}}]}\n'
            paused.set()
            assert release.wait(5)
            yield b'data: {"choices":[{"delta":{"content":"late"}}]}\n'

    monkeypatch.setattr(urllib.request, "urlopen", lambda request, timeout: Stream())
    chat = NodeGraphReviewChatService()
    task_id = chat.start({"messages": [{"role": "user", "content": "help"}]})["taskId"]
    try:
        assert paused.wait(5)
        assert chat.status(task_id)["content"] == "first "
        assert chat.cancel(task_id)["status"] == "cancelling"
        assert chat.status(task_id)["status"] == "cancelling"
    finally:
        release.set()
        chat._tasks[task_id]["thread"].join(5)
    status = chat.status(task_id)
    assert (status["status"], status["content"]) == ("cancelled", "first ")
    assert chat.cancel(task_id)["status"] == "cancelled"


def test_generation_cancel_discards_provider_reply_without_retry(monkeypatch):
    use_fixture_settings(monkeypatch)
    paused, release = threading.Event(), threading.Event()
    calls = []

    class Response(io.BytesIO):
        def read(self):
            paused.set()
            assert release.wait(5)
            return json.dumps({"choices": [{"message": {"content": "invalid graph"}}]}).encode()

    def urlopen(request, timeout):
        calls.append(request)
        return Response()

    monkeypatch.setattr(urllib.request, "urlopen", urlopen)
    service = NodeGraphGenerationService()
    try:
        task_id = service.start(request_payload())["taskId"]
        assert paused.wait(5)
        assert service.cancel(task_id)["status"] == "cancelled"
        assert service.status(task_id)["status"] == "cancelled"
        release.set()
        # Drain the single-worker queue, including the late completion callback.
        service._executor.submit(lambda: None).result(timeout=5)
        status = service.status(task_id)
        assert status["status"] == "cancelled"
        assert "result" not in status
        assert len(calls) == 1
    finally:
        release.set()
        service.shutdown()
