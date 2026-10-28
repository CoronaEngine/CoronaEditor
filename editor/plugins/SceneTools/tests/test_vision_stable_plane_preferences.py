import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from plugins.SceneTools.main import SceneTools
from runtime.archive.parser import parse_archive


class VisionStablePlanePreferencesTests(unittest.TestCase):

    def test_archive_preserves_camera_preference_and_defaults_to_enabled(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            scene = Path(temp_dir) / "scene.ini"
            for value, expected in ((None, True), ("true", True), ("false", False), ("off", False)):
                with self.subTest(value=value):
                    content = (
                        "[format]\ntype = corona_scene_folder\nversion = 1\n"
                        "[scene]\nname = Stable planes\n[camera]\ncount = 2\n"
                        "camera0.vision_render_mode = restir\n"
                        "camera0.vision_accumulation = true\ncamera0.vision_denoise = false\n"
                    )
                    if value is not None:
                        content += f"camera0.vision_stable_planes = {value}\n"
                    scene.write_text(content, encoding="utf-8")
                    cameras = parse_archive(str(scene))["scene"]["cameras"]
                    self.assertIs(cameras[0]["vision_stable_planes"], expected)
                    self.assertIs(cameras[1]["vision_stable_planes"], True)
                    self.assertIs(cameras[0]["vision_accumulation"], True)
                    self.assertIs(cameras[0]["vision_denoise"], False)

    def test_facade_forwards_explicit_false_and_pending_response(self):
        accepted = {"status": "success", "enabled": False, "pending": True}
        with patch("api.editor_api._invoke_manifest_cpp_api", return_value=accepted) as invoke:
            self.assertIs(SceneTools.set_vision_stable_planes("scene.ini", "camera", False), accepted)
            self.assertIs(SceneTools.get_vision_stable_planes("scene.ini", "camera"), accepted)
        self.assertEqual([call.args for call in invoke.call_args_list], [
            ("scene_tools.set_vision_stable_planes", ["scene.ini", "camera", False]),
            ("scene_tools.get_vision_stable_planes", ["scene.ini", "camera"]),
        ])



if __name__ == "__main__":
    unittest.main()
