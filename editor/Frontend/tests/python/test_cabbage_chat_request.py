"""Compare the Web chat request with the old panel payload at the model HTTP boundary."""

import json
from pathlib import Path
import subprocess

import pytest


FRONTEND = Path(__file__).resolve().parents[2]
CAPTURE_REQUEST = """
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { editorApi } from './src/api/editorApi.js';
import { aiService } from './src/services/aiService.js';

const input = JSON.parse(readFileSync(0, 'utf8'));
const original = JSON.stringify(input);
editorApi.ai.submitRequest = async request => {
  process.stdout.write(JSON.stringify(request));
  return { data: { taskId: 'fixture' } };
};
assert.deepEqual(await aiService.startCabbageChat(input), { taskId: 'fixture' });
assert.equal(JSON.stringify(input), original);
"""


@pytest.mark.parametrize(
    "message_count, task_count, actor_count, locale, question, detail",
    [
        (1, 0, 0, "zh-CN", "你好", False),
        (24, 20, 80, "en-US", "How can I move the player?", False),
        (25, 21, 81, "zh-CN", "请展示如何连接对象", True),
    ],
    ids=["short", "exact-limits", "overflow"],
)
def test_web_chat_preserves_model_messages(
    monkeypatch, message_count, task_count, actor_count, locale, question, detail
):
    monkeypatch.syspath_prepend(str(FRONTEND.parent))
    from plugins.AITool.configuration.deepseek_settings import DeepSeekSettings
    from plugins.AITool.services.node_graph_review_chat_service import NodeGraphReviewChatService

    messages = [
        {"role": "assistant" if i % 2 else "user", "content": f"回合 {i}", "id": i}
        for i in range(message_count)
    ]
    messages[-1].update(role="user", content=question)
    if message_count > 1:
        messages[1]["content"] = " "  # Python filters empty entries after slicing.
        messages[2]["content"] = "🌱" * 4001
    tasks = [{"taskKey": f"task.{i}", "title": f"任务 {i}"} for i in range(task_count)]
    actors = [{"name": f"对象 {i}", "tags": ["角色"]} for i in range(actor_count)]
    if actors:
        actors[1] = actors[0]  # Deduplication must not pull actor 81 into the window.
    project = {"sceneName": "场景 🌱", "actorContextAvailable": bool(actors)}
    if actors:
        project["actors"] = actors
    assistant = {
        "worldId": "world", "projectScopeId": "scope", "graphRevision": "rev",
        "assistanceProfile": {"score": 80, "updatedAt": 1},
        "graphExcerpt": {"nodes": [{"label": "🌱" * 18001}]} if tasks else {},
        "projectContext": project, "messages": messages,
    }
    selected = tasks[-1]["taskKey"] if tasks else ""
    common = {"requestId": "chat-fixture", "locale": locale, "selectedTaskKey": selected}

    # The previous panel sent all tasks/actors and projected every history entry.
    history = [{"role": item["role"], "content": item["content"]} for item in messages]
    before = {
        **assistant, **common, "tasks": tasks,
        "messages": history, "detailGuidanceRequested": detail,
    }
    panel_input = {**common, "assistant": assistant, "tasks": tasks, "content": question}
    captured = subprocess.run(
        ["node", "--input-type=module", "-e", CAPTURE_REQUEST],
        cwd=FRONTEND, input=json.dumps(panel_input),
        capture_output=True, encoding="utf-8", check=True, timeout=15,
    )
    request = json.loads(captured.stdout)
    assert request["operation"] == "node_graph.review.chat.start"
    after = request["payload"]
    assert after == {
        **before, "messages": history[-24:], "tasks": tasks[:20],
        "projectContext": {**project, "actors": actors[:80]} if actors else project,
    }

    def provider_body(payload):
        settings = DeepSeekSettings("fixture", "https://example.invalid", "fixture", "test")
        normalized = NodeGraphReviewChatService._normalize_payload(payload)
        request = NodeGraphReviewChatService._build_http_request(normalized, settings, stream=True)
        return json.loads(request.data)

    assert provider_body(after)["messages"] == provider_body(before)["messages"]
