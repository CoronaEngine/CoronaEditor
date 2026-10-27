"""Load local AITool secrets without putting them in the repository."""

from __future__ import annotations

import logging
import os
import re
import sys
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_KEY_NAME = re.compile(r"[^A-Za-z0-9]+")
_ENV_FILE = Path(__file__).resolve().parents[3] / ".env"
_KNOWN_PROVIDER_ENV_NAMES = {
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "deepseek": "DEEPSEEK_API_KEY",
    "dashscope": "DASHSCOPE_API_KEY",
    "qwen": "DASHSCOPE_API_KEY",
    "gemini": "GEMINI_API_KEY",
    "moonshot": "MOONSHOT_API_KEY",
    "siliconflow": "SILICONFLOW_API_KEY",
}
_ENGINE_PROVIDER_DEFAULTS = {
    "deepseek": {
        "type": "openai-compatible",
        "base_url": "https://api.deepseek.com/v1",
        "api_key_env": "CORONA_DEEPSEEK_API_KEY",
    },
}


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
    env_names = _provider_env_names("deepseek")
    _write_dotenv_updates(_ENV_FILE, {name: key for name in env_names})
    for name in env_names:
        os.environ[name] = key


def _provider_env_names(provider_name: Any, explicit_name: Any = None) -> tuple[str, ...]:
    names = []
    if explicit_name:
        names.append(str(explicit_name).strip())
    normalized = _KEY_NAME.sub("_", str(provider_name).strip()).strip("_").upper()
    if normalized:
        names.append(f"CORONA_{normalized}_API_KEY")
        names.append(f"{normalized}_API_KEY")
        known = _KNOWN_PROVIDER_ENV_NAMES.get(str(provider_name).strip().lower())
        if known:
            names.append(known)
    return tuple(dict.fromkeys(names))


def apply_api_key_env_overrides(settings: dict[str, Any]) -> dict[str, int]:
    """Apply environment-backed keys and return counts only, never secrets."""
    changed = 0
    providers = settings.get("providers")
    if isinstance(providers, list):
        existing_names = {
            str(provider.get("name", "")).strip().lower()
            for provider in providers
            if isinstance(provider, dict)
        }
        for provider_name, defaults in _ENGINE_PROVIDER_DEFAULTS.items():
            key = _env_value(*_provider_env_names(provider_name, defaults["api_key_env"]))
            if key and provider_name not in existing_names:
                providers.insert(
                    0,
                    {
                        "name": provider_name,
                        **defaults,
                        "api_key": key,
                    },
                )
                existing_names.add(provider_name)
                changed += 1
    if isinstance(providers, list):
        for provider in providers:
            if not isinstance(provider, dict) or not provider.get("name"):
                continue
            key = _env_value(
                *_provider_env_names(provider["name"], provider.get("api_key_env"))
            )
            if key:
                provider["api_key"] = key
                changed += 1

    module_envs = {
        "hunyuan3d": ("CORONA_HUNYUAN3D_API_KEY", "HUNYUAN3D_API_KEY"),
        "object_recognition": ("DASHSCOPE_API_KEY", "CORONA_DASHSCOPE_API_KEY"),
        "music": ("SUNO_API_KEY", "CORONA_SUNO_API_KEY"),
    }
    module_fields = {
        "hunyuan3d": "api_key",
        "object_recognition": "dashscope_api_key",
        "music": "api_key",
    }
    for module_name, env_names in module_envs.items():
        module_settings = settings.get(module_name)
        key = _env_value(*env_names)
        if isinstance(module_settings, dict) and key:
            module_settings[module_fields[module_name]] = key
            if module_name == "hunyuan3d":
                module_settings["api_keys"] = [key]
            changed += 1
    provider_count = (
        sum(1 for p in providers if isinstance(p, dict) and p.get("api_key"))
        if isinstance(providers, list)
        else 0
    )
    return {"providers": provider_count, "overridden": changed}


def _apply_to_collector(collector: Any) -> dict[str, int]:
    settings = collector.AI_SETTINGS
    summary = apply_api_key_env_overrides(settings)
    if not summary["overridden"]:
        return summary
    for name, value in settings.items():
        collector._ai_settings[name] = value
        loader = collector._ai_load.get(name)
        if loader is not None:
            setattr(collector._ai_config, name, loader(value))
    return summary


def deepseek_api_key_status() -> dict[str, Any]:
    load_dotenv_file(_ENV_FILE)
    key = _env_value(*_provider_env_names("deepseek"))
    return {"configured": bool(key), "masked_key": _mask_secret(key)}


def set_deepseek_api_key(api_key: Any) -> dict[str, Any]:
    key = _unquote(str(api_key or "").strip())
    if not key:
        raise ValueError("DeepSeek API Key 不能为空")
    if any(char in key for char in "\r\n"):
        raise ValueError("DeepSeek API Key 格式无效")
    _persist_deepseek_key(key)
    entrance_module = sys.modules.get("Quasar.ai_service.entrance")
    entrance = getattr(entrance_module, "ai_entrance", None)
    if getattr(entrance, "if_import", False):
        load_ai_setting()
    return deepseek_api_key_status()


def load_ai_setting():
    """Load ``editor/.env`` and apply keys after Quasar settings collection."""
    try:
        load_dotenv_file(_ENV_FILE)

        from Quasar.ai_service.entrance import get_ai_entrance
        from Quasar.ai_agent.executor import reset_cached_agent

        entrance = get_ai_entrance()
        summary = _apply_to_collector(entrance.collector)
        logger.info("AITool API key environment overrides applied: %s", summary)
        reset_cached_agent()
    except Exception as exc:
        logger.warning("AITool local settings load failed: %s", exc)
