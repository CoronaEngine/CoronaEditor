import os
import re
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch

from editor.plugins.AITool.configuration import local_secrets
from editor.plugins.AITool.configuration.local_secrets import (
    apply_api_key_env_overrides,
    load_dotenv_file,
)


class LoadLocalAISettingTests(unittest.TestCase):
    def test_local_secret_loader_has_a_config_owner_and_utils_use_it_directly(self):
        aitool_root = Path(__file__).resolve().parents[1]
        config_source = aitool_root / "configuration" / "local_secrets.py"
        main_source = (aitool_root / "main.py").read_text(encoding="utf-8")
        review_source = (
            aitool_root / "services" / "node_graph_review_service.py"
        ).read_text(encoding="utf-8")

        self.assertTrue(config_source.is_file())
        self.assertFalse((aitool_root / "compat" / "legacy_local_ai_setting.py").exists())
        self.assertFalse((aitool_root / "compat" / "legacy_aitool_utils.py").exists())
        self.assertFalse(any(
            path.is_file() and "__pycache__" not in path.parts
            for path in (aitool_root / "utils").rglob("*")
        ))
        self.assertIn("from .configuration.local_secrets import", main_source)
        self.assertIn("from ..configuration.local_secrets import", review_source)

    def test_legacy_ai_setting_module_and_inline_secret_values_are_gone(self):
        aitool_root = Path(__file__).resolve().parents[1]
        self.assertFalse((aitool_root / "utils" / "ai_setting.py").exists())
        secret_pattern = re.compile(r"api_key\s*[:=]\s*[\"']sk-[A-Za-z0-9]{20,}")
        for path in aitool_root.rglob("*.py"):
            if "Quasar" in path.parts or "tests" in path.parts:
                continue
            self.assertIsNone(secret_pattern.search(path.read_text(encoding="utf-8")), path)

    def test_load_dotenv_file_sets_only_missing_environment_values(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            env_file = Path(temp_dir) / ".env"
            env_file.write_text(
                "OPENAI_API_KEY=from-dotenv\n"
                "# ignored comment\n"
                "QUOTED_KEY=\"quoted-value\"\n",
                encoding="utf-8",
            )
            with patch.dict(os.environ, {"OPENAI_API_KEY": "already-set"}, clear=False):
                loaded = load_dotenv_file(env_file)
                self.assertEqual("already-set", os.environ["OPENAI_API_KEY"])
                self.assertEqual("quoted-value", os.environ["QUOTED_KEY"])
            self.assertEqual({"QUOTED_KEY": "quoted-value"}, loaded)

    def test_provider_and_module_keys_are_overridden_by_environment(self):
        settings = {
            "providers": [
                {"name": "deepseek", "api_key": "placeholder"},
                {"name": "dashscope", "api_key": "placeholder"},
            ],
            "hunyuan3d": {"api_key": "placeholder"},
            "object_recognition": {"dashscope_api_key": "placeholder"},
            "music": {"api_key": "placeholder"},
        }
        with patch.dict(
            os.environ,
            {
                "CORONA_DEEPSEEK_API_KEY": "deepseek-test-key",
                "DASHSCOPE_API_KEY": "dashscope-test-key",
                "CORONA_HUNYUAN3D_API_KEY": "hunyuan-test-key",
                "SUNO_API_KEY": "suno-test-key",
            },
            clear=False,
        ):
            apply_api_key_env_overrides(settings)

        self.assertEqual("deepseek-test-key", settings["providers"][0]["api_key"])
        self.assertEqual("dashscope-test-key", settings["providers"][1]["api_key"])
        self.assertEqual("hunyuan-test-key", settings["hunyuan3d"]["api_key"])
        self.assertEqual(
            "dashscope-test-key",
            settings["object_recognition"]["dashscope_api_key"],
        )
        self.assertEqual("suno-test-key", settings["music"]["api_key"])

    def test_engine_adds_deepseek_provider_without_changing_quasar_defaults(self):
        settings = {"providers": [{"name": "example", "api_key": ""}]}
        with patch.dict(
            os.environ,
            {"CORONA_DEEPSEEK_API_KEY": "deepseek-test-key"},
            clear=False,
        ):
            apply_api_key_env_overrides(settings)

        self.assertEqual("deepseek", settings["providers"][0]["name"])
        self.assertEqual("deepseek-test-key", settings["providers"][0]["api_key"])
        self.assertEqual(
            "https://api.deepseek.com/v1",
            settings["providers"][0]["base_url"],
        )
        self.assertEqual("example", settings["providers"][1]["name"])

    def test_key_values_are_not_logged_or_returned(self):
        settings = {"providers": [{"name": "openai", "api_key": "placeholder"}]}
        with patch.dict(os.environ, {"OPENAI_API_KEY": "secret-test-key"}, clear=False):
            result = apply_api_key_env_overrides(settings)

        self.assertNotIn("secret-test-key", repr(result))
        self.assertEqual({"providers": 1, "overridden": 1}, result)


class DeepSeekKeySettingsTests(unittest.TestCase):
    KEY = "sk-test-1234567890"

    def _fake_quasar_modules(self, collector):
        quasar = types.ModuleType("Quasar")
        quasar.__path__ = []
        ai_service = types.ModuleType("Quasar.ai_service")
        ai_service.__path__ = []
        entrance = types.ModuleType("Quasar.ai_service.entrance")
        entrance.ai_entrance = types.SimpleNamespace(
            if_import=True, collector=collector
        )
        entrance.get_ai_entrance = lambda: types.SimpleNamespace(
            collector=collector
        )
        ai_agent = types.ModuleType("Quasar.ai_agent")
        ai_agent.__path__ = []
        executor = types.ModuleType("Quasar.ai_agent.executor")
        executor.reset_cached_agent = lambda: None
        return {
            "Quasar": quasar,
            "Quasar.ai_service": ai_service,
            "Quasar.ai_service.entrance": entrance,
            "Quasar.ai_agent": ai_agent,
            "Quasar.ai_agent.executor": executor,
        }

    def test_save_persists_key_without_exposing_it(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            env_file = Path(temp_dir) / ".env"
            env_file.write_text(
                "DEEPSEEK_API_KEY=old-value\nOTHER_SETTING=keep\n", encoding="utf-8"
            )
            with (
                patch.object(local_secrets, "_ENV_FILE", env_file),
                patch.object(local_secrets, "load_ai_setting"),
                patch.dict(os.environ, {}, clear=True),
            ):
                result = local_secrets.set_deepseek_api_key(self.KEY)

                self.assertTrue(result["configured"])
                self.assertEqual("sk-t...7890", result["masked_key"])
                self.assertNotIn(self.KEY, repr(result))
                self.assertEqual(self.KEY, os.environ["CORONA_DEEPSEEK_API_KEY"])
                self.assertEqual(self.KEY, os.environ["DEEPSEEK_API_KEY"])

            text = env_file.read_text(encoding="utf-8")
            self.assertIn(f"CORONA_DEEPSEEK_API_KEY={self.KEY}", text)
            self.assertIn(f"DEEPSEEK_API_KEY={self.KEY}", text)
            self.assertIn("OTHER_SETTING=keep", text)

    def test_key_validation_rejects_empty_and_control_characters(self):
        with self.assertRaises(ValueError):
            local_secrets.set_deepseek_api_key("   ")
        with self.assertRaises(ValueError):
            local_secrets.set_deepseek_api_key("sk-test\nrm -rf")

    def test_save_updates_live_provider_through_existing_loader(self):
        class Collector:
            def __init__(self):
                self._ai_settings = {
                    "providers": [
                        {"name": "example", "api_key": "example-key"},
                    ]
                }
                self._ai_load = {
                    "providers": lambda raw: {p["name"]: p for p in raw}
                }
                self._ai_config = types.SimpleNamespace()

            @property
            def AI_SETTINGS(self):
                return {
                    "providers": [
                        dict(provider)
                        for provider in self._ai_settings["providers"]
                    ]
                }

        collector = Collector()
        with tempfile.TemporaryDirectory() as temp_dir:
            with (
                patch.object(
                    local_secrets, "_ENV_FILE", Path(temp_dir) / ".env"
                ),
                patch.dict(sys.modules, self._fake_quasar_modules(collector)),
                patch.dict(os.environ, {}, clear=True),
            ):
                local_secrets.set_deepseek_api_key(self.KEY)

        providers = collector._ai_settings["providers"]
        self.assertEqual("deepseek", providers[0]["name"])
        self.assertEqual(self.KEY, providers[0]["api_key"])
        self.assertEqual(
            "https://api.deepseek.com/v1", providers[0]["base_url"]
        )
        self.assertEqual(self.KEY, collector._ai_config.providers["deepseek"]["api_key"])


if __name__ == "__main__":
    unittest.main()
