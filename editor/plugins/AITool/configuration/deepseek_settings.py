"""Editor-owned DeepSeek options; no provider registry or model runtime."""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from .local_secrets import get_deepseek_api_key


DEFAULT_MODEL = "deepseek-v4-flash"
DEFAULT_BASE_URL = "https://api.deepseek.com"
_SETTINGS_FILE = Path(__file__).resolve().parents[3] / "deepseek_settings.json"


@dataclass(frozen=True)
class DeepSeekSettings:
    api_key: str
    base_url: str
    model: str
    source: str
    temperature: float = 0.1
    max_tokens: int = 1200
    thinking_enabled: bool = False


@lru_cache(maxsize=1)
def load_model_options() -> dict[str, Any]:
    """Load optional non-secret options once; key updates do not reload models."""
    if not _SETTINGS_FILE.is_file():
        return {}
    try:
        options = json.loads(_SETTINGS_FILE.read_text(encoding="utf-8-sig"))
    except (OSError, ValueError) as error:
        # Do not include file contents, which might contain an accidental secret.
        raise ValueError("Unable to read deepseek_settings.json") from error
    if not isinstance(options, dict):
        raise ValueError("deepseek_settings.json must contain an object")
    return options


def resolve_settings(purpose: str | None = None) -> DeepSeekSettings:
    options = load_model_options()
    key = get_deepseek_api_key()
    model = str(options.get("model") or "").strip() or DEFAULT_MODEL
    temperature, max_tokens, thinking_enabled = 0.1, 1200, False
    if purpose == "node_graph":
        node = options.get("node_graph")
        node = node if isinstance(node, dict) else {}
        model = str(node.get("model") or "").strip() or model
        try:
            temperature = float(node.get("temperature"))
        except (TypeError, ValueError):
            temperature = 0.05
        try:
            max_tokens = int(node.get("max_tokens"))
        except (TypeError, ValueError):
            max_tokens = 12000
        if max_tokens <= 0:
            max_tokens = 12000
        thinking_enabled = node.get("thinking") is True
    # Preserve the existing configured URL and the unconfigured fallback.
    base_url = DEFAULT_BASE_URL + "/v1" if key else DEFAULT_BASE_URL
    return DeepSeekSettings(
        key, base_url, model, "editor-ai-setting" if key else "unconfigured",
        temperature, max_tokens, thinking_enabled,
    )
