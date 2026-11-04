"""Compare the Web-prepared chat with the legacy context request at the provider boundary."""

from pathlib import Path
import hashlib
import io
import json
import re
import subprocess
import threading
import urllib.request

import pytest


FRONTEND = Path(__file__).resolve().parents[2]
CAPTURE_REQUESTS = """
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { editorApi } from './src/api/editorApi.js';
import { aiService } from './src/services/aiService.js';
const inputs = JSON.parse(readFileSync(0, 'utf8'));
const original = JSON.stringify(inputs);
const requests = [];
editorApi.ai.submitRequest = async request => {
  requests.push(request);
  return { data: { taskId: 'fixture' } };
};
for (const input of inputs) {
  assert.deepEqual(await aiService.startCabbageChat(input), { taskId: 'fixture' });
}
assert.equal(JSON.stringify(inputs), original);
process.stdout.write(JSON.stringify(requests));
"""


def chat_cases():
    cases = {}
    def add(key, question, *, locale="zh-CN", tasks=(), selected="", score=50, scored=True,
            history=(), actors=(), graph=None):
        cases[key] = {
            "content": question, "locale": locale, "requestId": key, "selectedTaskKey": selected,
            "tasks": list(tasks), "assistant": {
                "worldId": "test-world", "projectScopeId": "scope", "graphRevision": "rev",
                "assistanceProfile": {"score": score, "updatedAt": int(scored)},
                "graphExcerpt": graph or {}, "projectContext": {
                    "sceneName": "场景 🌱", "actorContextAvailable": bool(actors), "actors": list(actors),
                }, "messages": [*history, {"role": "user", "id": "last", "content": question}],
            },
        }

    for lang in ("zh-CN", "en-US"):
        for score in (0, 45, 45.5, 50, 74.5, 75, 100):
            add(f"{lang}-{score}", "Review this graph", locale=lang, score=score, scored=score != 0)
        add(f"{lang}-unknown", "一步一步", locale=lang)
        for key in ("import_model", "transform_model", "adjust_lighting", "adjust_physics",
                    "create_node", "move_node", "connect_nodes", "drag_block",
                    "edit_block_parameter", "set_transition_condition", "run_node_graph"):
            task = {"taskKey": "tutorial." + key, "type": "tutorial", "title": "任务", "titleEn": "Task"}
            add(f"{lang}-{key}", "Show me", locale=lang, selected=task["taskKey"], tasks=[task])
        for issue in ("missing_actor_target", "actor_target_not_found", "start_node_count",
                      "invalid_edge_endpoint", "invalid_visible_condition_count", "non_boolean_condition",
                      "unknown_block_type", "missing_required_input"):
            task = {"taskKey": "issue", "type": "node-issue", "code": issue, "nodeId": "node", "edgeId": "edge"}
            add(f"{lang}-{issue}", "Show me", locale=lang, selected="issue", tasks=[task])
    add("explicit-overrides-selected", "展示物体的物理参数", selected="tutorial.transform_model",
        tasks=[{"type": "tutorial", "taskKey": "tutorial.transform_model"}])
    add("repeated-goal", "next", selected="goal", tasks=[{"type": "goal", "taskKey": "goal",
        "guidanceIntent": "move_node"}], history=[{"role": "user", "content": "earlier"}])
    for message_count, task_count, actor_count in ((24, 20, 80), (25, 21, 81)):
        history = [{"role": "assistant", "content": str(i)} for i in range(message_count - 1)]
        history[1]["content"] = " \n "
        history[2]["content"] = "🌱" * 4001
        actors = [{"name": f"actor-{i}"} for i in range(actor_count)]
        actors[:3] = [{"name": " Straße ", "tags": ["角色"] * 13,
                       "aliases": ["STRASSE", "chair", "chair"]}, {"name": "STRASSE"}, {"name": "球"}]
        tasks = [{"taskKey": f"task-{i}", "title": "🌱" * 161, "completionCriteriaEn": "done"}
                 for i in range(task_count)]
        add(f"limits-{message_count}", "x" * 4000 + "展示", history=history, tasks=tasks,
            selected=tasks[-1]["taskKey"], actors=actors, graph={"z": 1, "a": "🌱" * 18001})
    add("graph-order-and-escape", "help", graph={"version": 1, "nodes": [{"name": 'a, b: "x"\n',
        "id": "n", "fields": {"2": 0.00001, "10": 1e-7, "a": ["x", False, None]}}], "edges": []})
    return cases


CASES = chat_cases()


def legacy_payload(case):
    assistant = case["assistant"]
    data = {
        **assistant, "requestId": case["requestId"], "locale": case["locale"],
        "selectedTaskKey": case["selectedTaskKey"], "tasks": case["tasks"][:20],
        "messages": [{"role": m["role"], "content": m["content"]} for m in assistant["messages"][-24:]],
        "projectContext": {**assistant["projectContext"], "actors": assistant["projectContext"]["actors"][:80]},
        "detailGuidanceRequested": bool(re.search(
            "不理解|看不懂|不会|怎么做|怎么连接|放在哪里|为什么还是不行|一步一步|具体步骤|展示|演示", case["content"])),
    }
    # The native CEF bridge passes nlohmann::json objects to Python in sorted key order.
    return json.loads(json.dumps(data, sort_keys=True))


@pytest.fixture(scope="module")
def web_requests():
    captured = subprocess.run(
        ["node", "--input-type=module", "-e", CAPTURE_REQUESTS], cwd=FRONTEND,
        input=json.dumps(list(CASES.values())), capture_output=True, encoding="utf-8", check=True, timeout=20,
    )
    return dict(zip(CASES, json.loads(captured.stdout), strict=True))


@pytest.mark.parametrize("case_id", CASES)
def test_prepared_chat_matches_legacy_http_body_and_showcase(case_id, web_requests, monkeypatch):
    monkeypatch.syspath_prepend(str(FRONTEND.parent))
    from plugins.AITool.configuration.deepseek_settings import DeepSeekSettings
    from plugins.AITool.services.node_graph_review_service import NodeGraphReviewService
    from plugins.AITool.services.node_graph_review_chat_service import NodeGraphReviewChatService as Chat
    case = CASES[case_id]
    before = Chat._normalize_payload(legacy_payload(case))
    settings = DeepSeekSettings("fixture", "https://example.invalid", "test", "test")
    expected_body = Chat._build_http_request({"modelMessages": Chat._build_messages(before)}, settings, stream=True).data
    expected_guidance = Chat._guidance_metadata(before)
    request = web_requests[case_id]
    assert request["operation"] == "node_graph.review.chat.start"
    payload = json.loads(json.dumps(request["payload"], sort_keys=True))
    assert set(payload) == {"requestId", "modelMessages", "guidance"}

    def urlopen(req, timeout):
        wire.append(req.data)
        response = io.BytesIO(b'{"choices":[{"message":{"content":"answer"}}]}')
        response.headers = {"Content-Type": "application/json"}
        return response

    wire = []
    monkeypatch.setattr(urllib.request, "urlopen", urlopen)
    monkeypatch.setattr(NodeGraphReviewService, "_resolve_settings", lambda *args: settings)
    def unexpected(*args):
        pytest.fail("Web-prepared requests must bypass the Python prompt and guidance rules")
    monkeypatch.setattr(Chat, "_build_messages", unexpected)
    monkeypatch.setattr(Chat, "_guidance_metadata", unexpected)
    chat = Chat()
    task_id = chat.start(payload)["taskId"]
    chat._tasks[task_id]["thread"].join(5)
    status = chat.status(task_id)
    assert status["status"] == "completed"
    assert wire == [expected_body]
    assert {key: status[key] for key in expected_guidance} == expected_guidance


def test_wire_and_guidance_match_recording_from_7ec9b54(web_requests, monkeypatch):
    """Catch shared copy changes that would otherwise change both sides of the parity test."""
    monkeypatch.syspath_prepend(str(FRONTEND.parent))
    from plugins.AITool.configuration.deepseek_settings import DeepSeekSettings
    from plugins.AITool.services.node_graph_review_chat_service import NodeGraphReviewChatService as Chat
    settings = DeepSeekSettings("fixture", "https://example.invalid", "test", "test")
    records = []
    for case_id in sorted(web_requests):
        payload = json.loads(json.dumps(web_requests[case_id]["payload"], sort_keys=True))
        request = Chat._prepare_request(payload)
        body = Chat._build_http_request(request, settings, stream=True).data.decode("utf-8")
        records.append([case_id, body, request["guidance"]])
    wire = json.dumps(records, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    assert hashlib.sha256(wire).hexdigest() == "b8ea627adc3e1ee45bd75c5f22e18e65ca5c78cf469a40c57e0460e157c92ec6"


@pytest.mark.parametrize("partial", [b"", b"first "], ids=["before-first-chunk", "after-partial"])
def test_web_and_legacy_chat_cancel_identically(web_requests, monkeypatch, partial):
    monkeypatch.syspath_prepend(str(FRONTEND.parent))
    from plugins.AITool.configuration.deepseek_settings import DeepSeekSettings
    from plugins.AITool.services.node_graph_review_service import NodeGraphReviewService
    from plugins.AITool.services.node_graph_review_chat_service import NodeGraphReviewChatService as Chat
    monkeypatch.setattr(NodeGraphReviewService, "_resolve_settings",
                        lambda: DeepSeekSettings("fixture", "https://example.invalid", "test", "test"))
    case = "explicit-overrides-selected"
    # The selected transform task conflicts with the explicit physics question.
    for payload in (legacy_payload(CASES[case]), web_requests[case]["payload"]):
        paused, release = threading.Event(), threading.Event()
        class Stream(io.BytesIO):
            headers = {"Content-Type": "text/event-stream"}
            def __iter__(self):
                if partial:
                    yield b'data: {"choices":[{"delta":{"content":"' + partial + b'"}}]}\n'
                paused.set()
                assert release.wait(5)
                yield b'data: {"choices":[{"delta":{"content":"late"}}]}\n'
        monkeypatch.setattr(urllib.request, "urlopen", lambda req, timeout: Stream())
        chat = Chat()
        task_id = chat.start(payload)["taskId"]
        try:
            assert paused.wait(5)
            assert chat.cancel(task_id)["status"] == "cancelling"
            assert chat.status(task_id)["status"] == "cancelling"
        finally:
            release.set()
            chat._tasks[task_id]["thread"].join(5)
        status = chat.status(task_id)
        assert status["status"] == "cancelled" and status["content"] == partial.decode()
        assert (status["needsShowcase"], status["guidanceIntent"], status["steps"]) == (False, "", [])
        assert chat.cancel(task_id)["status"] == "cancelled"
