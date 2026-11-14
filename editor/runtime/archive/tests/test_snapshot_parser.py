import json
import tempfile
import unittest
from pathlib import Path

from runtime.archive.errors import ArchiveParseError
from runtime.archive.parser import parse_archive


class ReadOnlySnapshotParserTests(unittest.TestCase):
    def test_explicit_material_and_lighting_survive_read_only_input(self):
        document = {
            "schema_version": 1, "read_only": True,
            "scene": {"route": "native-kitchen", "actors": [{
                "material": {"principled": {"base_color": {
                    "kind": "image", "path": "source.png", "encoding": "srgb"}}},
                "transform": {"matrix": list(range(16))}}], "cameras": [],
                "environment": {"authored_lighting": {"environments": [{"color": [1, 2, 3]}]}}},
        }
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "kitchen.snapshot.json"
            path.write_text(json.dumps(document), encoding="utf-8")
            actual = parse_archive(str(path))
            self.assertEqual(actual["scene"], document["scene"])
            self.assertTrue(actual["read_only"])
            self.assertEqual(actual["source_path"], str(path.resolve()))
            self.assertEqual(actual["archive_type"], "read_only_snapshot")

    def test_rejects_wrong_schema_mutable_or_invalid_scene_shape(self):
        valid = {"schema_version": 1, "read_only": True,
                 "scene": {"actors": [], "cameras": []}}
        invalid = [[], {}, {**valid, "schema_version": 2},
                   {**valid, "schema_version": True}, {**valid, "read_only": False},
                   {**valid, "read_only": 1}, {**valid, "scene": []},
                   {**valid, "scene": {"actors": {}, "cameras": []}},
                   {**valid, "scene": {"actors": [42], "cameras": []}}]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bad.snapshot.json"
            for document in invalid:
                with self.subTest(document=document):
                    path.write_text(json.dumps(document), encoding="utf-8")
                    with self.assertRaises(ArchiveParseError):
                        parse_archive(str(path))


if __name__ == "__main__":
    unittest.main()
