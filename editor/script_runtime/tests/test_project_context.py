"""Blockly requests must belong to the current opening of the project."""
from unittest.mock import Mock

import pytest
from script_runtime.blockly import main as blockly


def test_reopening_same_project_rejects_old_session(tmp_path, monkeypatch):
    current = {"archive_session": "first-A", "project_path": str(tmp_path)}
    monkeypatch.setattr(blockly, "read_project_session", lambda: dict(current))
    request = {**current, "requestId": "old", "path": "script.py"}
    assert blockly.ScratchTool._request_project_context(request) == (tmp_path, None)
    assert blockly.ScratchTool.load_blockly_target({**request, "target_type": "project"})["status"] == "missing"
    assert not (tmp_path / "Scripts").exists()
    current["archive_session"] = "second-A"
    start = Mock()
    monkeypatch.setattr(blockly.ScratchTool, "_start_single", start)
    for method in (blockly.ScratchTool.load_blockly_target, blockly.ScratchTool.save_blockly_target,
                   blockly.ScratchTool.run_file):
        assert method(request)["code"] == "PROJECT_CONTEXT_CHANGED"
        assert method({**request, "archive_session": ""})["code"] == "PROJECT_CONTEXT_CHANGED"
    start.assert_not_called()
    assert not (tmp_path / "Scripts").exists()


@pytest.mark.parametrize("state,code", [({}, "NO_ACTIVE_PROJECT"),
    ({"archive_session": "A", "read_only": True}, "READ_ONLY_PROJECT")])
def test_unavailable_or_read_only_project_is_not_writable(tmp_path, monkeypatch, state, code):
    monkeypatch.setattr(blockly, "read_project_session", lambda: {**state, "project_path": str(tmp_path)})
    request = {"project_path": str(tmp_path), "archive_session": "A"}
    assert blockly.ScratchTool.save_blockly_target(request)["code"] == code
    assert not (tmp_path / "Scripts").exists()
