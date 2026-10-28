import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from plugins.SceneTools.main import SceneTools


class VisionAccumulationPreferencesTests(unittest.TestCase):


    def test_plugin_accumulation_routes_explicit_false_and_pending_result(self):
        setter = getattr(SceneTools, "set_vision_accumulation", None)
        self.assertTrue(callable(setter))
        accepted = {"status": "success", "enabled": False, "pending": True}
        with patch("api.editor_api._invoke_manifest_cpp_api", return_value=accepted) as invoke:
            self.assertIs(setter("scene.ini", "camera", False), accepted)
            self.assertIs(SceneTools.get_vision_accumulation("scene.ini", "camera"), accepted)
        self.assertEqual([call.args for call in invoke.call_args_list], [
            ("scene_tools.set_vision_accumulation", ["scene.ini", "camera", False]),
            ("scene_tools.get_vision_accumulation", ["scene.ini", "camera"]),
        ])




if __name__ == "__main__":
    unittest.main()
