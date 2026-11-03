"""Credential compatibility and request snapshots without a model framework."""

import os
import re
from dataclasses import replace
from pathlib import Path

import pytest

from editor.plugins.AITool.configuration import deepseek_settings, local_secrets


@pytest.fixture
def settings(tmp_path, monkeypatch):
    for name in local_secrets._ENV_NAMES:
        monkeypatch.setenv(name, "")
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setattr(local_secrets, "_ENV_FILE", tmp_path / ".env")
    monkeypatch.setattr(local_secrets, "_api_key", None)
    monkeypatch.setattr(deepseek_settings, "_SETTINGS_FILE", tmp_path / "deepseek_settings.json")
    deepseek_settings.load_model_options.cache_clear()
    yield local_secrets._ENV_FILE
    deepseek_settings.load_model_options.cache_clear()


def test_secrets_have_one_owner_and_are_not_embedded_in_production_sources():
    root = Path(__file__).resolve().parents[1]
    assert not (root / "utils" / "ai_setting.py").exists()
    pattern = re.compile(r"api_key\s*[:=]\s*[\"']sk-[A-Za-z0-9]{20,}")
    for path in root.rglob("*.py"):
        if "tests" not in path.parts:
            assert not pattern.search(path.read_text(encoding="utf-8")), path


def test_dotenv_preserves_process_values_and_supports_existing_syntax(settings, monkeypatch):
    settings.write_text(
        '\ufeffexport CORONA_DEEPSEEK_API_KEY="from-file"\n'
        "DEEPSEEK_API_KEY='fallback'\n# comment\nINVALID NAME=ignored\n",
        encoding="utf-8",
    )
    monkeypatch.setenv("CORONA_DEEPSEEK_API_KEY", "process-key")
    local_secrets.load_ai_setting()
    assert local_secrets.get_deepseek_api_key() == "process-key"
    assert os.environ["DEEPSEEK_API_KEY"] == "fallback"
    monkeypatch.setenv("CORONA_DEEPSEEK_API_KEY", "")
    local_secrets.load_ai_setting()
    assert local_secrets.get_deepseek_api_key() == "fallback"


def test_missing_key_keeps_unconfigured_response(settings):
    snapshot = deepseek_settings.resolve_settings()
    assert snapshot.api_key == ""
    assert snapshot.source == "unconfigured"
    assert snapshot.base_url == "https://api.deepseek.com"
    assert local_secrets.deepseek_api_key_status() == {"configured": False, "masked_key": ""}


def test_save_persists_both_aliases_and_preserves_unrelated_values(settings, caplog):
    settings.write_text("DEEPSEEK_API_KEY=old\nOTHER_SETTING=keep\n", encoding="utf-8")
    key = "sk-test-1234567890"
    result = local_secrets.set_deepseek_api_key(f'  "{key}"  ')
    assert result == {"configured": True, "masked_key": "sk-t...7890"}
    assert key not in repr(result) + caplog.text
    for name in local_secrets._ENV_NAMES:
        assert os.environ[name] == key
        assert f"{name}={key}" in settings.read_text(encoding="utf-8")
    assert "OTHER_SETTING=keep" in settings.read_text(encoding="utf-8")


@pytest.mark.parametrize("key", ["", "   ", "test\nkey", "test\rkey"])
def test_invalid_key_does_not_change_file_or_live_key(settings, key):
    local_secrets.set_deepseek_api_key("old-key")
    before = settings.read_bytes()
    with pytest.raises(ValueError):
        local_secrets.set_deepseek_api_key(key)
    assert settings.read_bytes() == before
    assert local_secrets.get_deepseek_api_key() == "old-key"


def test_failed_persistence_does_not_publish_a_new_key(settings, monkeypatch):
    local_secrets.set_deepseek_api_key("old-key")
    def fail(*args):
        raise OSError("read-only test file")
    monkeypatch.setattr(local_secrets, "_write_dotenv_updates", fail)
    with pytest.raises(OSError):
        local_secrets.set_deepseek_api_key("new-key")
    assert local_secrets.get_deepseek_api_key() == "old-key"
    assert all(os.environ[name] == "old-key" for name in local_secrets._ENV_NAMES)


def test_key_update_changes_next_snapshot_and_preserves_model_options(settings):
    deepseek_settings._SETTINGS_FILE.write_text(
        '{"model":"shared-model","node_graph":{"model":"node-model",'
        '"temperature":0.07,"max_tokens":7777,"thinking":true}}', encoding="utf-8",
    )
    local_secrets.set_deepseek_api_key("old-key")
    previous = [deepseek_settings.resolve_settings(purpose) for purpose in (None, "node_graph")]
    deepseek_settings._SETTINGS_FILE.write_text('{"model":"different-model"}', encoding="utf-8")
    local_secrets.set_deepseek_api_key("new-key")
    current = [deepseek_settings.resolve_settings(purpose) for purpose in (None, "node_graph")]
    for before, after in zip(previous, current):
        assert before.api_key == "old-key"
        assert after == replace(before, api_key="new-key")


@pytest.mark.parametrize("key,masked", [("short", "*****"), ("12345678", "********"), ("123456789", "1234...6789")])
def test_key_masking_is_unchanged(settings, key, masked):
    assert local_secrets.set_deepseek_api_key(key)["masked_key"] == masked
