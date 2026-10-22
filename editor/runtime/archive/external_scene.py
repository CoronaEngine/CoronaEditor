"""Shared file-backed snapshot builder for external, unsaved geometry scenes."""
from __future__ import annotations

from collections import Counter
import hashlib
from pathlib import Path

from .errors import ArchiveParseError
from runtime.archive import transforms as tr


class SceneBuilder:
    def __init__(self, source, format_name, cache_directory=None):
        self.source = Path(source).resolve()
        self.format_name = format_name
        self.cache_directory = cache_directory
        self.actors = []
        self.cameras = []
        self.diagnostics = {}
        self.counts = Counter()

    def warning(self, code, message, path=None, kind=""):
        key = (code, str(path or self.source), kind)
        if key not in self.diagnostics:
            self.diagnostics[key] = dict(severity="warning", recoverable=True, stage="archive_parse",
                                         code=code, message=message, path=key[1], shape_type=kind, count=0)
        self.diagnostics[key]["count"] += 1

    def add(self, path, matrix, name="", *, flip_uvs=False, flip_normals=False, face_normals=False, kind="mesh"):
        if len(self.actors) >= 100_000:
            raise ValueError("External scene exceeds 100000 instances")
        path = Path(path).resolve()
        if not path.is_file():
            raise ArchiveParseError("RESOURCE_NOT_FOUND", f"Geometry file does not exist: {path}", path=str(path))
        matrix = tr.affine(matrix)
        i = len(self.actors)
        guid = hashlib.sha256(f"{self.source}|{i}|{name}".encode()).hexdigest()[:24]
        self.actors.append({
            "name": name or f"{kind}_{i+1}", "actor_guid": "external-"+guid,
            "actor_type": "actor", "route": str(path), "asset_path": str(path),
            "transform": {"position": [matrix[3],matrix[7],matrix[11]], "rotation": [0,0,0],
                          "scale": [1,1,1], "matrix": tr.transpose(matrix)},
            "import_options": {"scene_geometry": True, "flip_uvs": bool(flip_uvs),
                               "flip_normals": bool(flip_normals), "face_normals": bool(face_normals)},
            "mechanics": {"body_type": "phantom", "physics_enabled": False, "collision_type": "none"},
            "material": {"source": "legacy", "overrides": []},
            "optics": {"diffuse": [0.7,0.7,0.7]}, "visible": True,
        })
        self.counts[kind] += 1

    def snapshot(self):
        return {
            "schema_version": 1, "archive_type": self.format_name, "read_only": True,
            "source_path": str(self.source), "project_root": str(self.source.parent),
            "source_camera_imported": bool(self.cameras),
            "scene": {"route": self.source.name, "name": self.source.parent.name,
                      "actors": self.actors, "cameras": self.cameras, "simulation_enabled": False,
                      "environment": {"sun_enabled": True, "floor_grid_enabled": False}},
            "diagnostics": list(self.diagnostics.values()), "geometry_counts": dict(self.counts),
        }


def parse_external_scene(path, *, cache_directory=None):
    source = Path(path).expanduser().resolve()
    try:
        if source.suffix.lower() == ".xml":
            from .mitsuba import read_scene
        elif source.suffix.lower() == ".pbrt":
            from .pbrt import read_scene
        else:
            raise ValueError("Expected a Mitsuba 3 XML or PBRT v4 file")
        return read_scene(source, cache_directory=cache_directory)
    except ArchiveParseError:
        raise
    except (OSError, ValueError, KeyError, IndexError, RecursionError) as exc:
        raise ArchiveParseError("EXTERNAL_SCENE_INVALID", str(exc), path=str(source)) from exc
