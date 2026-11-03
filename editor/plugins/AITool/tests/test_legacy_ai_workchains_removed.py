import unittest
from pathlib import Path


AITool_ROOT = Path(__file__).resolve().parents[1]
CAI_EXTENSIONS = AITool_ROOT / "cai_extensions"


class LegacyAIWorkchainsRemovedTests(unittest.TestCase):
    def test_legacy_scene_planning_and_placement_sources_are_removed(self):
        self.assertFalse((CAI_EXTENSIONS / "scene_plan_tools.py").exists())
        self.assertFalse((CAI_EXTENSIONS / "scene_placement").exists())
        self.assertFalse(
            (CAI_EXTENSIONS / "mcp" / "tools" / "place_object_near.py").exists()
        )


if __name__ == "__main__":
    unittest.main()
