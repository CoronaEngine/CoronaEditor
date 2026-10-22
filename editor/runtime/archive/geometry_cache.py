"""Deterministic derived OBJ files; source assets are never copied or modified."""
from __future__ import annotations

import hashlib
import math
import os
from pathlib import Path
import tempfile


def cache_root():
    return Path(os.environ.get("LOCALAPPDATA") or tempfile.gettempdir()) / "CoronaEngine" / "cache" / "scene_geometry_v1"


def write_obj(positions, indices, normals=None, uvs=None, *, directory=None):
    positions = list(positions)
    indices = list(indices)
    normals, uvs = list(normals or []), list(uvs or [])
    if not positions or len(indices) % 3 or not indices:
        raise ValueError("Triangle mesh requires vertices and complete triangles")
    for values, width, label in ((positions, 3, "positions"), (normals, 3, "normals"), (uvs, 2, "UVs")):
        if values and (len(values) != len(positions) or any(len(v) != width or not all(math.isfinite(x) for x in v) for v in values)):
            raise ValueError(f"Invalid mesh {label}")
    if any(type(i) is not int or i < 0 or i >= len(positions) for i in indices):
        raise ValueError("Triangle index is out of bounds")
    root = Path(directory) if directory is not None else cache_root()
    root.mkdir(parents=True, exist_ok=True)
    # Stream to disk and hash the exact bytes, without a second full OBJ in memory.
    fd, name = tempfile.mkstemp(prefix="mesh-", suffix=".tmp", dir=root)
    temporary = Path(name)
    digest = hashlib.sha256()
    try:
        with os.fdopen(fd, "wb") as stream:
            def emit(line):
                data = (line + "\n").encode("ascii")
                digest.update(data)
                stream.write(data)
            emit("# Corona derived geometry v1")
            for prefix, values in (("v", positions), ("vt", uvs), ("vn", normals)):
                for row in values:
                    emit(prefix + " " + " ".join(format(x, ".17g") for x in row))
            def corner(i):
                n = str(i + 1)
                return n + (("/" + n) if uvs else ("/" if normals else "")) + (("/" + n) if normals else "")
            for start in range(0, len(indices), 3):
                emit("f " + " ".join(corner(i) for i in indices[start:start+3]))
        target = root / (digest.hexdigest() + ".obj")
        if target.is_file():
            temporary.unlink()
        else:
            os.replace(temporary, target)
        return target
    finally:
        temporary.unlink(missing_ok=True)


def primitive(kind, *, radius=1.0, inner_radius=0.0, height=0.0,
              zmin=None, zmax=None, phimax=360.0, segments=64, rings=32, directory=None):
    if segments < 3 or rings < 2:
        raise ValueError("Insufficient primitive tessellation")
    if kind == "rectangle":
        return write_obj([(-1,-1,0), (1,-1,0), (1,1,0), (-1,1,0)],
                         [0,1,2,0,2,3], [(0,0,1)]*4, [(0,0),(1,0),(1,1),(0,1)], directory=directory)
    if kind == "cube":
        p, n, uv, ix = [], [], [], []
        for normal, u, v in [((1,0,0),(0,1,0),(0,0,1)), ((-1,0,0),(0,-1,0),(0,0,1)),
                              ((0,1,0),(-1,0,0),(0,0,1)), ((0,-1,0),(1,0,0),(0,0,1)),
                              ((0,0,1),(1,0,0),(0,1,0)), ((0,0,-1),(-1,0,0),(0,1,0))]:
            base = len(p)
            for a, b in ((-1,-1),(1,-1),(1,1),(-1,1)):
                p.append(tuple(normal[k]+a*u[k]+b*v[k] for k in range(3)))
                n.append(normal)
                uv.append(((a+1)/2,(b+1)/2))
            ix.extend(base+i for i in (0,1,2,0,2,3))
        return write_obj(p, ix, n, uv, directory=directory)
    if not all(math.isfinite(x) for x in (radius, inner_radius, height, phimax)) or radius <= 0 or not 0 < phimax <= 360:
        raise ValueError("Invalid primitive dimensions")
    p, n, uv, ix = [], [], [], []
    phi = math.radians(phimax)
    if kind == "disk":
        if not 0 <= inner_radius < radius:
            raise ValueError("Invalid disk inner radius")
        for j, r in enumerate((inner_radius, radius)):
            for i in range(segments+1):
                a = phi*i/segments
                p.append((r*math.cos(a), r*math.sin(a), height))
                n.append((0,0,1))
                uv.append((i/segments, 1-j))
        for i in range(segments):
            a, b = i, i+segments+1
            ix.extend((a,b,b+1))
            if inner_radius > 0:
                ix.extend((a,b+1,a+1))
    elif kind == "sphere":
        if any(x is not None and not math.isfinite(x) for x in (zmin, zmax)):
            raise ValueError("Invalid sphere clipping range")
        zmin = max(-radius, -radius if zmin is None else zmin)
        zmax = min(radius, radius if zmax is None else zmax)
        if not math.isfinite(zmin+zmax) or zmin >= zmax:
            raise ValueError("Invalid sphere clipping range")
        lo, hi = math.acos(zmax/radius), math.acos(zmin/radius)
        for j in range(rings+1):
            t = lo + (hi-lo)*j/rings
            for i in range(segments+1):
                a = phi*i/segments
                normal = (math.sin(t)*math.cos(a), math.sin(t)*math.sin(a), math.cos(t))
                p.append(tuple(radius*x for x in normal))
                n.append(normal)
                uv.append((i/segments, t/math.pi))
        for j in range(rings):
            for i in range(segments):
                a = j*(segments+1)+i
                b = a+segments+1
                if j != 0 or zmax < radius:
                    ix.extend((a,b,a+1))
                if j != rings-1 or zmin > -radius:
                    ix.extend((a+1,b,b+1))
    else:
        raise ValueError(f"Unsupported primitive: {kind}")
    return write_obj(p, ix, n, uv, directory=directory)
