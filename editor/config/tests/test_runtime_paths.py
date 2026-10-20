"""Behavior checks for paths supplied by the native startup configuration."""

import os
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from config import paths_config


class RuntimePathsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="corona-runtime-paths-")
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.editor = root / "外部 editor"
        self.data = root / "user data"
        self.assets = (root / "override", root / "shared")
        for directory in (self.editor, *self.assets):
            directory.mkdir()
        self.native_paths = {
            "editor_root": str(self.editor),
            "frontend_index": str(self.editor / "Frontend/dist/index.html"),
            "asset_roots": [str(root) for root in self.assets],
            "user_data_dir": str(self.data),
            "cache_dir": str(root / "cache"),
            "editor_state_file": str(self.data / "CoronaEditor.ini"),
            "project_data_dir": str(self.data / "data"),
        }
        self.native = types.SimpleNamespace(_get_runtime_paths=lambda: dict(self.native_paths))
        modules = patch.dict(sys.modules, {"CoronaEngine": self.native})
        modules.start()
        self.addCleanup(modules.stop)
        self.old_cwd = Path.cwd()
        self.addCleanup(os.chdir, self.old_cwd)

    def test_external_paths_and_writable_outputs_ignore_cwd(self):
        os.chdir(self.assets[1])
        # No active project: output belongs to user data, not the source tree.
        context = types.SimpleNamespace(get_active_project_path=lambda: "")
        with patch.dict(sys.modules, {"runtime.project_context": context}):
            paths = paths_config.get_default_paths()
        self.assertEqual(paths.repo_root, self.editor)
        self.assertEqual(paths.frontend_dist, self.editor / "Frontend/dist/index.html")
        self.assertEqual(paths.generated_script_dir, self.data / "runtime/generated")
        self.assertEqual(paths.autosave_dir, self.data / "scratch/media")
        self.assertEqual(paths.assets_model_dir, self.data / "scratch/models")
        self.assertEqual(paths_config.get_editor_state_path(), self.data / "CoronaEditor.ini")
        self.assertFalse((self.editor / "runtime").exists())
        self.assertFalse((self.assets[1] / "media").exists())

    def test_asset_order_and_missing_resource_are_deterministic(self):
        relative = "audio/test.wav"
        for root in reversed(self.assets):
            (root / "audio").mkdir()
            (root / relative).write_bytes(b"test")
            self.assertEqual(paths_config.resolve_repository_asset_path(relative), root / relative)
        self.assertEqual(
            paths_config.resolve_repository_asset_path("missing.png"),
            self.assets[0] / "missing.png",
        )
        with self.assertRaises(ValueError):
            paths_config.resolve_repository_asset_path("../escape")
        self.native_paths["asset_roots"] = []
        with self.assertRaises(RuntimeError):
            paths_config.resolve_repository_asset_path("missing.png")

    def test_active_project_keeps_its_own_generated_resources(self):
        project = Path(self.temp.name) / "project"
        context = types.SimpleNamespace(get_active_project_path=lambda: str(project))
        with patch.dict(sys.modules, {"runtime.project_context": context}):
            self.assertEqual(paths_config.get_project_media_dir(), project / "media")
            self.assertEqual(paths_config.get_project_models_dir(), project / "models")

    def test_settings_use_native_state_location(self):
        from config.project_state import CoronaSettings

        os.chdir(self.assets[0])
        settings = CoronaSettings()
        self.assertEqual(Path(settings.config_path), self.data / "CoronaEditor.ini")
        self.assertEqual(Path(settings.get_default_path()), self.data / "data")
        self.assertTrue(self.data.is_dir())
        self.assertFalse((self.assets[0] / "CoronaEditor.ini").exists())

    def test_audio_roots_follow_host_order_and_allow_no_bundled_assets(self):
        from script_runtime.engine.corona_engine import _bundled_audio_roots

        self.assertEqual(_bundled_audio_roots(), tuple(root / "audio" for root in self.assets))
        self.native_paths["asset_roots"] = []
        self.assertEqual(_bundled_audio_roots(), ())

    def test_runtime_tools_use_user_data_when_no_project_is_open(self):
        from runtime import project_context

        os.chdir(self.assets[0])
        with patch.object(project_context, "get_active_project_path", return_value=""):
            self.assertEqual(
                project_context.get_project_root(fallback_to_environment=False),
                self.data / "scratch",
            )

    def test_standalone_source_default_does_not_depend_on_cwd(self):
        # A stub without the bootstrap binding also covers editor tooling/tests.
        with patch.dict(sys.modules, {"CoronaEngine": types.SimpleNamespace()}):
            before = paths_config.get_repository_assets_dir()
            os.chdir(self.assets[0])
            self.assertEqual(paths_config.get_repository_assets_dir(), before)
            self.assertEqual(before, Path(paths_config.__file__).resolve().parents[2] / "assets")


if __name__ == "__main__":
    unittest.main()
