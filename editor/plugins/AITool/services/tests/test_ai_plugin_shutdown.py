"""Exercise the actual facade lifecycle without model calls or user settings."""

import json
from pathlib import Path
import sys
import threading
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

EDITOR_ROOT = Path(__file__).resolve().parents[4]
if str(EDITOR_ROOT) not in sys.path:
    sys.path.insert(0, str(EDITOR_ROOT))

from plugins.AITool.main import AITool
from plugins.AITool.configuration import local_secrets


@pytest.fixture
def runtime():
    class Runtime(AITool):
        _runtime_lock = threading.RLock()
        _runtime_stop = threading.Event()
        _runtime_state = "cold"
        _runtime_error = ""

    services = []
    factories = []
    for attribute, methods in (
        ("_node_graph_review_service", ("start", "status")),
        ("_node_graph_review_chat_service", ("start", "status", "cancel")),
        ("_node_graph_generation_service", ("start", "status", "cancel")),
        ("_cabbage_context_service", (
            "load", "record_event", "update_task", "append_message",
            "start_goal_plan", "goal_plan_status", "start_score_update", "score_update_status",
        )),
    ):
        service = SimpleNamespace(shutdown=Mock())
        for method in methods:
            setattr(service, method, Mock(return_value={"success": True}))
        services.append(service)
        factories.append((attribute, Mock(return_value=service)))
    Runtime._configure_runtime = Mock()
    Runtime._service_factories = Mock(return_value=factories)
    yield Runtime, services, factories
    Runtime.cleanup()


def test_initialize_is_idempotent_and_cleanup_closes_each_service_once(runtime):
    app, services, factories = runtime
    assert app.initialize_runtime()
    assert app.initialize_runtime()
    app._configure_runtime.assert_called_once()
    for _, factory in factories:
        factory.assert_called_once()
    app.cleanup()
    app.cleanup()
    for service in services:
        service.shutdown.assert_called_once()
    assert app.runtime_state()[0] == "stopped"
    assert not app.initialize_runtime()


@pytest.mark.parametrize("operation,index,method,argument", [
    ("node_graph.review.start", 0, "start", {"workspace": {}}),
    ("node_graph.review.status", 0, "status", "task-1"),
    ("node_graph.review.chat.start", 1, "start", {"messages": []}),
    ("node_graph.review.chat.status", 1, "status", "task-1"),
    ("node_graph.review.chat.cancel", 1, "cancel", "task-1"),
    ("node_graph.generate.start", 2, "start", {"prompt": "move"}),
    ("node_graph.generate.status", 2, "status", "task-1"),
    ("node_graph.generate.cancel", 2, "cancel", "task-1"),
    ("cabbage.context.load", 3, "load", {}),
    ("cabbage.context.record_event", 3, "record_event", {"event": "opened"}),
    ("cabbage.context.update_task", 3, "update_task", {"taskId": "task-1"}),
    ("cabbage.context.append_message", 3, "append_message", {"content": "hello"}),
    ("cabbage.goal_plan.start", 3, "start_goal_plan", {"prompt": "build"}),
    ("cabbage.goal_plan.status", 3, "goal_plan_status", "task-1"),
    ("cabbage.profile.score.start", 3, "start_score_update", {}),
    ("cabbage.profile.score.status", 3, "score_update_status", "task-1"),
])
def test_current_operations_reach_their_service(runtime, operation, index, method, argument):
    app, services, _ = runtime
    assert app.initialize_runtime()
    request = {"operation": operation}
    request["taskId" if isinstance(argument, str) else "payload"] = argument
    assert app.submit_request(json.dumps(request)) == {"success": True}
    getattr(services[index], method).assert_called_once_with(argument)


def test_task_id_alias_is_preserved(runtime):
    app, services, _ = runtime
    app.initialize_runtime()
    app.submit_request({"operation": "node_graph.generate.cancel", "task_id": "task-2"})
    services[2].cancel.assert_called_once_with("task-2")


@pytest.mark.parametrize("payload", [None, [], "{bad", {}, {"operation": []}])
def test_malformed_requests_do_not_start_any_runtime(runtime, payload):
    app, _, _ = runtime
    assert app.submit_request(payload)["error"] == "INVALID_AI_REQUEST"
    app._configure_runtime.assert_not_called()


@pytest.mark.parametrize("operation", ["chat", "request.cancel", "request.status", "node_graph.review.chat"])
def test_retired_operations_are_rejected_without_fallback(runtime, operation):
    app, _, _ = runtime
    assert app.submit_request({"operation": operation})["error"] == "UNSUPPORTED_AI_OPERATION"
    app._configure_runtime.assert_not_called()


def test_settings_remain_accessible_before_runtime_ready(runtime, monkeypatch):
    app, _, _ = runtime
    status = Mock(return_value={"configured": False, "masked_key": ""})
    save = Mock(return_value={"configured": True, "masked_key": "masked"})
    monkeypatch.setattr(local_secrets, "deepseek_api_key_status", status)
    monkeypatch.setattr(local_secrets, "set_deepseek_api_key", save)
    assert app.submit_request({"operation": "ai.settings.get"})["configured"] is False
    assert app.submit_request({"operation": "ai.settings.set", "payload": {"api_key": "test"}})["configured"]
    save.assert_called_once_with("test")
    app._configure_runtime.assert_not_called()


def test_pre_requested_stop_does_not_load_configuration_or_services(runtime):
    app, _, _ = runtime
    stop = threading.Event()
    stop.set()
    assert not app.initialize_runtime(stop_token=stop)
    app._configure_runtime.assert_not_called()
    app._service_factories.assert_not_called()
    assert app.runtime_state()[0] == "stopped"


def test_partial_initialization_failure_closes_owned_services_and_never_retries(runtime):
    app, services, factories = runtime
    factories[1][1].side_effect = RuntimeError("factory unavailable")
    assert not app.initialize_runtime()
    services[0].shutdown.assert_called_once()
    services[1].shutdown.assert_not_called()
    factories[2][1].assert_not_called()
    assert app.runtime_state() == ("failed", "factory unavailable")
    assert app.submit_request({"operation": "node_graph.review.start"})["status"] == "degraded"
    assert not app.initialize_runtime()
    app._configure_runtime.assert_called_once()


def test_configuration_failure_is_degraded_without_constructing_services(runtime):
    app, _, _ = runtime
    app._configure_runtime.side_effect = RuntimeError("configuration unavailable")
    assert not app.initialize_runtime()
    app._service_factories.assert_not_called()
    assert app.runtime_state()[0] == "failed"


def test_shutdown_during_factory_call_closes_late_results_without_publishing(runtime):
    app, services, factories = runtime
    entered, release = threading.Event(), threading.Event()
    results = []

    def blocking_factory():
        entered.set()
        assert release.wait(3)
        return services[0]

    factories[0][1].side_effect = blocking_factory
    worker = threading.Thread(target=lambda: results.append(app.initialize_runtime()))
    worker.start()
    try:
        assert entered.wait(2)
        assert app.submit_request({"operation": "node_graph.review.start"})["status"] == "initializing"
        assert not app.initialize_runtime()
        app.cleanup()
        assert app.submit_request({"operation": "node_graph.review.start"})["status"] == "degraded"
    finally:
        release.set()
        worker.join(3)
    assert not worker.is_alive()
    assert results == [False]
    services[0].shutdown.assert_called_once()
    factories[1][1].assert_not_called()
    assert app._node_graph_review_service is None
    assert app.runtime_state()[0] == "stopped"


def test_initializer_cancellation_still_closes_partial_services(runtime):
    class CancelInitialization(BaseException):
        pass

    app, services, factories = runtime
    factories[1][1].side_effect = CancelInitialization()
    with pytest.raises(CancelInitialization):
        app.initialize_runtime()
    services[0].shutdown.assert_called_once()
    assert app.runtime_state()[0] == "stopped"


def test_cleanup_continues_after_one_shutdown_failure(runtime):
    app, services, _ = runtime
    app.initialize_runtime()
    services[-1].shutdown.side_effect = RuntimeError("shutdown failed")
    app.cleanup()
    app.cleanup()
    for service in services:
        service.shutdown.assert_called_once()


def test_local_settings_are_loaded_before_model_options(monkeypatch):
    from plugins.AITool.configuration import deepseek_settings

    calls = []
    monkeypatch.setattr(local_secrets, "load_ai_setting", lambda: calls.append("secrets"))
    monkeypatch.setattr(deepseek_settings, "load_model_options", lambda: calls.append("models"))
    AITool._configure_runtime()
    assert calls == ["secrets", "models"]
