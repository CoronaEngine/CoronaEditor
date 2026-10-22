import configparser
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from plugins.ProjectLauncher import main as project_launcher
from api.editor_api import CoronaEditorApi
from config.project_state import CoronaSettings
from runtime import project_templates as project_utils


class ProjectCopyTests(unittest.TestCase):


    def test_project_launcher_python_does_not_import_project_copy_or_vision_import(self):
        source = Path(project_launcher.__file__).read_text(encoding="utf-8")
        self.assertNotIn("ProjectCopy", source)
        self.assertNotIn("vision_import", source)

    def test_settings_accepts_portable_scene_folder_without_project_ini(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            scene = root / "Portable"
            scene.mkdir()
            (scene / "scene.ini").write_text(
                "[format]\ntype = corona_scene_folder\nversion = 1\n"
                "[scene]\nname = Portable Name\n",
                encoding="utf-8",
            )
            config_path = root / "CoronaEditor.ini"
            config_path.write_text(
                "[General]\nlast_project =\n"
                "[History]\nrecent_projects = []\n",
                encoding="utf-8",
            )
            settings = CoronaSettings(str(config_path))

            self.assertTrue(settings.set_active_project(str(scene)))
            self.assertEqual(settings.active_project_path, str(scene))
            self.assertEqual(settings.active_project_config.get("scene", "name"), "Portable Name")
            recent = settings.get_recent_projects()
            self.assertEqual(recent[0]["name"], "Portable Name")
            self.assertTrue(recent[0]["if_exists"])

    def test_failed_automatic_project_hydration_is_not_retried_on_every_access(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            scene = root / "BrokenPortable"
            scene.mkdir()
            (scene / "scene.ini").write_text(
                "[format]\ntype = corona_scene_folder\nversion = 1\n"
                "[actors]\nBall.runtime.actor_version = 1\n"
                "Ball.runtime.actor_version = 1\n",
                encoding="utf-8",
            )
            config_path = root / "CoronaEditor.ini"
            config_path.write_text(
                f"[General]\nlast_project = {scene}\n"
                "[History]\nrecent_projects = []\n",
                encoding="utf-8",
            )
            settings = CoronaSettings(str(config_path))

            with self.assertLogs("config.project_state", level="ERROR") as captured:
                self.assertIsNone(settings.active_project_path)
                self.assertIsNone(settings.active_project_path)

            hydration_errors = [
                message for message in captured.output
                if "Unable to read scene.ini" in message
            ]
            self.assertEqual(len(hydration_errors), 1)

    def test_recent_projects_rejects_project_ini_only_directory(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            legacy = root / "Legacy"
            legacy.mkdir()
            (legacy / "project.ini").write_text(
                "[Project]\nname = Legacy\nentrance_scene = Scene/default.scene\n",
                encoding="utf-8",
            )
            config_path = root / "CoronaEditor.ini"
            config_path.write_text(
                f"[General]\nlast_project =\n[History]\nrecent_projects = {__import__('json').dumps([str(legacy)])}\n",
                encoding="utf-8",
            )
            settings = CoronaSettings(str(config_path))
            recent = settings.get_recent_projects()
            self.assertFalse(recent[0]["if_exists"])
            self.assertFalse(settings.set_active_project(str(legacy)))
            self.assertIsNone(settings.active_project_path)

    def test_portable_settings_save_does_not_modify_scene_ini_or_create_project_ini(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            scene = root / "Portable"
            scene.mkdir()
            scene_ini = scene / "scene.ini"
            scene_ini.write_text(
                "[format]\ntype = corona_scene_folder\nversion = 1\n"
                "[scene]\nname = Portable\n",
                encoding="utf-8",
            )
            config_path = root / "CoronaEditor.ini"
            config_path.write_text(
                "[General]\nlast_project =\n"
                "[History]\nrecent_projects = []\n",
                encoding="utf-8",
            )
            settings = CoronaSettings(str(config_path))
            self.assertTrue(settings.set_active_project(str(scene)))
            original_scene = scene_ini.read_bytes()
            self.assertTrue(settings.save_active_project_info())
            self.assertFalse((scene / "project.ini").exists())
            self.assertEqual(scene_ini.read_bytes(), original_scene)
            saved_editor = configparser.ConfigParser()
            saved_editor.read(config_path, encoding="utf-8")
            self.assertEqual(saved_editor.get("General", "last_project"), str(scene))


if __name__ == "__main__":
    unittest.main()
