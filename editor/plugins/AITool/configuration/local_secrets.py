"""Load local AITool secrets without putting them in the repository."""

from __future__ import annotations

import logging
import os
import re
import threading
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_ENV_FILE = Path(__file__).resolve().parents[3] / ".env"
_ENV_NAMES = ("CORONA_DEEPSEEK_API_KEY", "DEEPSEEK_API_KEY")
_SECRET_LOCK = threading.RLock()
_api_key: str | None = None


def _unquote(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        return value[1:-1]
    return value


def load_dotenv_file(path: Path) -> dict[str, str]:
    """Load a small dotenv-compatible file without overwriting process env."""
    if not path.is_file():
        return {}

    loaded: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        name, separator, value = line.partition("=")
        name = name.strip()
        if not separator or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", name):
            continue
        value = _unquote(value)
        if name not in os.environ:
            os.environ[name] = value
            loaded[name] = value
    return loaded


def _env_value(*names: str) -> str:
    for name in names:
        value = os.environ.get(name, "").strip()
        if value:
            return value
    return ""


def _mask_secret(value: str) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    if len(text) <= 8:
        return "*" * len(text)
    return f"{text[:4]}...{text[-4:]}"


def _write_dotenv_updates(path: Path, updates: dict[str, str]) -> None:
    """Update matching dotenv keys while preserving unrelated user entries."""
    text = path.read_text(encoding="utf-8-sig") if path.is_file() else ""
    for name, value in updates.items():
        line = f"{name}={value}"
        pattern = re.compile(rf"(?m)^\s*(?:export\s+)?{re.escape(name)}\s*=.*$")
        if pattern.search(text):
            text = pattern.sub(lambda _match: line, text)
        else:
            prefix = text.rstrip() + "\n" if text.strip() else ""
            text = f"{prefix}{line}\n"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def _persist_deepseek_key(key: str) -> None:
    env_names = _ENV_NAMES
    _write_dotenv_updates(_ENV_FILE, {name: key for name in env_names})
    for name in env_names:
        os.environ[name] = key


def load_ai_setting() -> None:
    """Load editor/.env without overwriting process environment values."""
    global _api_key
    with _SECRET_LOCK:
        try:
            load_dotenv_file(_ENV_FILE)
            _api_key = _env_value(*_ENV_NAMES)
        except Exception as error:
            logger.warning("AITool local settings load failed: %s", type(error).__name__)
            if _api_key is None:
                _api_key = ""


def get_deepseek_api_key() -> str:
    with _SECRET_LOCK:
        if not _api_key:
            load_ai_setting()
        return _api_key or ""


def deepseek_api_key_status() -> dict[str, Any]:
    with _SECRET_LOCK:
        load_dotenv_file(_ENV_FILE)
        key = _env_value(*_ENV_NAMES)
        return {"configured": bool(key), "masked_key": _mask_secret(key)}


def set_deepseek_api_key(api_key: Any) -> dict[str, Any]:
    global _api_key
    key = _unquote(str(api_key or "").strip())
    if not key:
        raise ValueError("DeepSeek API Key 不能为空")
    if any(char in key for char in "\r\n"):
        raise ValueError("DeepSeek API Key 格式无效")
    with _SECRET_LOCK:
        # Publish the new key only after persistence succeeds. Requests take a
        # value snapshot; an in-flight request retains its original credential.
        _persist_deepseek_key(key)
        _api_key = key
        return deepseek_api_key_status()
