"""Model configuration contracts retained from the previous settings resolver."""

import json

import pytest

from editor.plugins.AITool.configuration import deepseek_settings as config, local_secrets


@pytest.fixture
def options(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "_SETTINGS_FILE", tmp_path / "deepseek_settings.json")
    monkeypatch.setattr(local_secrets, "_api_key", "fixture-key")
    config.load_model_options.cache_clear()
    yield config._SETTINGS_FILE
    config.load_model_options.cache_clear()


@pytest.mark.parametrize("purpose,temperature,tokens", [(None, 0.1, 1200), ("node_graph", 0.05, 12000)])
def test_defaults_ignore_unrelated_legacy_model_environment(options, monkeypatch, purpose, temperature, tokens):
    monkeypatch.setenv("CORONA_LLM_MODEL", "must-not-replace-the-model")
    monkeypatch.setenv("CORONA_LLM_PROVIDER", "another-provider")
    result = config.resolve_settings(purpose)
    assert result.model == "deepseek-v4-flash"
    assert result.base_url == "https://api.deepseek.com/v1"
    assert (result.temperature, result.max_tokens, result.thinking_enabled) == (temperature, tokens, False)
    assert result.source == "editor-ai-setting"


@pytest.mark.parametrize("node_model,expected", [("node-model", "node-model"), ("  ", "shared-model"), (None, "shared-model")])
def test_node_model_override_does_not_change_other_features(options, node_model, expected):
    options.write_text(json.dumps({"model": "shared-model", "node_graph": {"model": node_model}}), encoding="utf-8")
    assert config.resolve_settings().model == "shared-model"
    assert config.resolve_settings("node_graph").model == expected


@pytest.mark.parametrize("temperature,tokens,thinking,expected", [
    (0.07, 7777, True, (0.07, 7777, True)),
    ("0.03", "9000", "true", (0.03, 9000, False)),
    (None, None, 1, (0.05, 12000, False)),
    ("invalid", -1, False, (0.05, 12000, False)),
    (0, 0, False, (0.0, 12000, False)),
    (0.1, 1500.9, None, (0.1, 1500, False)),
])
def test_parameter_conversion_and_fallback_are_unchanged(options, temperature, tokens, thinking, expected):
    options.write_text(json.dumps({"node_graph": {
        "temperature": temperature, "max_tokens": tokens, "thinking": thinking,
    }}), encoding="utf-8")
    result = config.resolve_settings("node_graph")
    assert (result.temperature, result.max_tokens, result.thinking_enabled) == expected


@pytest.mark.parametrize("text", ["[]", "{invalid-fixture-secret"])
def test_invalid_configuration_fails_without_echoing_content(options, text):
    options.write_text(text, encoding="utf-8")
    with pytest.raises(ValueError) as error:
        config.resolve_settings()
    assert "invalid-fixture-secret" not in str(error.value)
