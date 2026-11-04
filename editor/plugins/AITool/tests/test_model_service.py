"""Exercise the actual generic provider boundary without network access."""
import io
import json
import threading
import time
import urllib.request

import pytest

from plugins.AITool.configuration.deepseek_settings import DeepSeekSettings
from plugins.AITool.services import model_service as module

MESSAGES = [{"role": "system", "content": "世界 🌱"}, {"role": "user", "content": "hello"}]


@pytest.fixture
def service(monkeypatch):
    monkeypatch.setattr(module, "resolve_settings", lambda profile: DeepSeekSettings(
        "fixture-secret", "https://example.invalid/v1", "fixture-model", "test",
        .05 if profile == "node_graph" else .1, 12000 if profile == "node_graph" else 1200,
    ))
    instance = module.ModelService()
    yield instance
    instance.shutdown()


def terminal(service, task_id):
    deadline = time.monotonic() + 3
    while time.monotonic() < deadline:
        result = service.status(task_id)
        if result["status"] in {"completed", "error", "cancelled"}:
            return result
        time.sleep(.002)
    pytest.fail("Task did not finish")


@pytest.mark.parametrize("options,tokens,temp,stream", [
    ({"format": "text", "max_tokens": 1400, "temperature": .25}, 1400, .25, True),
    ({"format": "json"}, 1200, .1, None),
    ({"format": "json", "profile": "node_graph"}, 12000, .05, None),
])
def test_final_messages_and_provider_options_pass_through(service, monkeypatch, options, tokens, temp, stream):
    calls = []
    def urlopen(request, timeout):
        calls.append(request)
        response = io.BytesIO(b'{"choices":[{"message":{"content":" answer "}}]}')
        response.headers = {"Content-Type": "application/json"}
        return response
    monkeypatch.setattr(urllib.request, "urlopen", urlopen)
    task = service.start({"messages": MESSAGES, "options": options})["taskId"]
    assert terminal(service, task)["content"] == "answer"
    body = json.loads(calls[0].data)
    assert body["messages"] == MESSAGES
    assert (body["max_tokens"], body["temperature"]) == (tokens, temp)
    assert body.get("stream") == stream
    assert calls[0].get_header("Authorization") == "Bearer fixture-secret"
    if stream is None:
        assert body["response_format"] == {"type": "json_object"}


@pytest.mark.parametrize("partial", ["", "first "])
def test_cancel_preserves_partial_text_and_late_reply_cannot_revive(service, monkeypatch, partial):
    entered, release = threading.Event(), threading.Event()
    class Stream(io.BytesIO):
        headers = {"Content-Type": "text/event-stream"}
        def __iter__(self):
            if partial:
                yield b'data: {"choices":[{"delta":{"content":"first "}}]}\n'
            entered.set()
            assert release.wait(3)
            yield b'data: {"choices":[{"delta":{"content":"late"}}]}\n'
    monkeypatch.setattr(urllib.request, "urlopen", lambda request, timeout: Stream())
    task = service.start({"messages": MESSAGES})["taskId"]
    try:
        assert entered.wait(3)
        assert service.cancel(task)["status"] == "cancelling"
    finally:
        release.set()
    result = terminal(service, task)
    assert result["status"] == "cancelled" and result["content"] == partial
    assert service.cancel(task)["status"] == "cancelled"


def test_shutdown_cancels_queued_work_and_rejects_new_requests(service, monkeypatch):
    entered, release = threading.Event(), threading.Event()
    def response(request, timeout):
        entered.set()
        assert release.wait(3)
        answer = io.BytesIO(b'{"choices":[{"message":{"content":"late"}}]}')
        answer.headers = {"Content-Type": "application/json"}
        return answer
    monkeypatch.setattr(urllib.request, "urlopen", response)
    tasks = [service.start({"messages": MESSAGES})["taskId"] for _ in range(8)]
    assert entered.wait(3)
    service.shutdown()
    release.set()
    assert all(service.status(task)["status"] == "cancelled" for task in tasks)
    assert service.start({"messages": MESSAGES})["error"] == "MODEL_SERVICE_STOPPED"


@pytest.mark.parametrize("payload", [
    {}, {"messages": []}, {"messages": [{"role": "tool", "content": "x"}]},
    {"messages": MESSAGES, "options": []},
    {"messages": MESSAGES, "options": {"format": "xml"}},
    {"messages": MESSAGES, "options": {"timeout": float("nan")}},
])
def test_invalid_provider_envelopes_never_open_network(service, monkeypatch, payload):
    monkeypatch.setattr(urllib.request, "urlopen", lambda *_args, **_kwargs: pytest.fail("Unexpected HTTP"))
    assert service.start(payload)["success"] is False


def test_failure_does_not_expose_provider_credentials(service, monkeypatch):
    monkeypatch.setattr(urllib.request, "urlopen", lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("fixture-secret")))
    task = service.start({"messages": MESSAGES})["taskId"]
    assert "fixture-secret" not in repr(terminal(service, task))


@pytest.mark.parametrize("content_type,wire,expected", [
    ("application/json", b'{"choices":[{"message":{"content":" hello "}}]}', "hello"),
    ("text/event-stream; charset=utf-8",
     b': keepalive\n\ndata: malformed\n'
     b'data: {"choices":[{"delta":{"content":"first "}}]}\n'
     b'data: {"choices":[{"message":{"content":" next "}}]}\n'
     b'data: [DONE]\ndata: {"choices":[{"delta":{"content":"late"}}]}\n', "first next"),
])
def test_provider_response_forms_keep_existing_text_semantics(service, monkeypatch, content_type, wire, expected):
    response = io.BytesIO(wire)
    response.headers = {"Content-Type": content_type}
    monkeypatch.setattr(urllib.request, "urlopen", lambda request, timeout: response)
    task = service.start({"messages": MESSAGES})["taskId"]
    assert terminal(service, task)["content"] == expected
    assert response.closed


@pytest.mark.parametrize("wire", [b'not-json', b'{"choices":[]}', b'{"choices":[{"message":{"content":""}}]}'])
def test_invalid_or_empty_provider_content_is_terminal_and_closes_response(service, monkeypatch, wire):
    response = io.BytesIO(wire)
    response.headers = {"Content-Type": "application/json"}
    monkeypatch.setattr(urllib.request, "urlopen", lambda request, timeout: response)
    task = service.start({"messages": MESSAGES})["taskId"]
    assert terminal(service, task)["status"] == "error"
    assert response.closed
