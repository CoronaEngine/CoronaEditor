"""Streaming PBRT v4 geometry parser, including the dataset's TransformBegin dialect."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
import re

from runtime.archive import transforms as tr
from .external_scene import SceneBuilder
from .geometry_cache import primitive, write_obj
from .cameras import finite, perspective_camera, resolution, vertical_fov


_TOKEN = re.compile(r'\s+|#[^\n]*|"((?:[^"\\]|\\.)*)"|([\[\]])|([^\s\[\]"#]+)')
_SKIP_TOKEN = re.compile(r'\s+|#[^\n]*|"((?:[^"\\]|\\.)*)"|([\[\]])|(?:[+\-.\d][+\-.\deE\s]*)|([^\s\[\]"#]+)')


def statements(path):
    """Keep only one statement, even for files containing millions of curves."""
    current, depth, start = [], 0, 1
    with Path(path).open(encoding="utf-8-sig") as stream:
        for line_number, line in enumerate(stream, 1):
            end = 0
            while end < len(line):
                skipping = len(current) >= 2 and current[0][0] == "Shape" and current[1][0] == "curve"
                # Curve control points are explicitly out of scope. Scan their
                # numeric runs in bulk while still validating quotes/brackets
                # and recognizing directives on the same line.
                match = (_SKIP_TOKEN if skipping else _TOKEN).match(line, end)
                if match is None:
                    raise ValueError(f"Invalid token at {path}:{line_number}")
                end = match.end()
                token = match.group(0)
                if token.isspace() or token.startswith("#"):
                    continue
                quoted = match.group(1) is not None
                if quoted:
                    token = re.sub(r'\\(["\\])', r'\1', match.group(1))
                active_argument = len(current) == 1 and current[0][0] == "ActiveTransform"
                if not quoted and depth == 0 and token[0].isalpha() and token[0].isupper() and not active_argument:
                    if current:
                        yield start, current
                    current, start = [], line_number
                    skipping = False
                if not quoted and token in ("[", "]"):
                    depth += 1 if token == "[" else -1
                    if depth not in (0, 1):
                        raise ValueError(f"Invalid array at {path}:{line_number}")
                if not skipping:
                    current.append((token, quoted))
            if end != len(line):
                raise ValueError(f"Unterminated string at {path}:{line_number}")
    if depth:
        raise ValueError(f"Unterminated array in {path}")
    if current:
        yield start, current


def parameters(tokens):
    result, i = {}, 0
    while i < len(tokens):
        declaration, quoted = tokens[i]
        if not quoted or len(declaration.split()) != 2:
            raise ValueError(f"Invalid parameter declaration: {declaration}")
        _, name = declaration.split()
        if name in result:
            raise ValueError(f"Duplicate parameter: {name}")
        i += 1
        values = []
        if i < len(tokens) and tokens[i] == ("[", False):
            i += 1
            while i < len(tokens) and tokens[i] != ("]", False):
                values.append(tokens[i][0])
                i += 1
            if i == len(tokens):
                raise ValueError("Unterminated parameter array")
            i += 1
        else:
            values.append(tokens[i][0])
            i += 1
        result[name] = values
    return result


def source_camera(to_world, props, film):
    def scalar(params, name, default):
        values = params.get(name, [default])
        if len(values) != 1:
            raise ValueError(f"Camera/film {name} requires one value")
        return finite(values[0], name)

    width, height = resolution(scalar(film, "xresolution", 1280), scalar(film, "yresolution", 720))
    aspect = width / height
    frame = scalar(props, "frameaspectratio", aspect)
    if abs(frame - aspect) > 1e-6:
        raise ValueError("Camera frameaspectratio differing from film resolution is unsupported")
    screen = [-aspect, aspect, -1, 1] if aspect > 1 else [-1, 1, -1 / aspect, 1 / aspect]
    for name, params, expected in (
        ("screenwindow", props, screen),
        ("cropwindow", film, [0, 1, 0, 1]),
        ("pixelbounds", film, [0, width, 0, height]),
    ):
        actual = [finite(x, name) for x in params.get(name, expected)]
        if len(actual) != 4 or any(abs(a - b) > 1e-6 for a, b in zip(actual, expected)):
            raise ValueError(f"Non-default camera/film {name} is unsupported")
    if scalar(props, "lensradius", 0) != 0:
        raise ValueError("Camera depth of field is unsupported")
    return perspective_camera(
        to_world, image_x_sign=1,
        fov=vertical_fov(scalar(props, "fov", 90), "smaller", width, height),
        width=width, height=height,
        # PBRT rays have no perspective far-plane clip. These are native
        # rasterization limits, not PBRT camera parameters; the engine may
        # tighten them using world bounds without changing the source pose.
        near_plane=.001, far_plane=1e7,
    )


@dataclass
class State:
    matrices: list = field(default_factory=lambda: [tr.identity(), tr.identity()])
    active: tuple = (0, 1)
    reverse: bool = False
    shape_attributes: dict = field(default_factory=dict)

    def copy(self):
        return State([list(m) for m in self.matrices], self.active, self.reverse,
                     {name: list(values) for name, values in self.shape_attributes.items()})


def read_scene(source, *, cache_directory=None):
    builder = SceneBuilder(source, "pbrt4", cache_directory)
    root = Path(source).resolve().parent
    state, scopes, coordinates, objects = State(), [], {}, {}
    object_name = None
    in_world = False
    camera_description, film_description = None, {}

    def append(record):
        if object_name is not None:
            objects[object_name].append(record)
        else:
            path, matrix, reverse, kind, name = record
            builder.add(path, matrix, name, flip_normals=reverse, kind=kind)

    def process(path, chain=()):
        nonlocal state, object_name, in_world, coordinates, camera_description, film_description
        path = Path(path).resolve()
        if path in chain or len(chain) >= 64:
            raise ValueError(f"Recursive PBRT include: {path}")
        for line, statement in statements(path):
            command = statement[0][0]
            args = statement[1:]
            values = [x[0] for x in args if x[0] not in ("[", "]")]
            try:
                if command in {"Include", "Import"}:
                    if len(values) != 1:
                        raise ValueError("Expected one include filename")
                    saved, saved_scopes = state.copy(), list(scopes)
                    saved_object, saved_world = object_name, in_world
                    saved_coordinates = coordinates
                    if command == "Import":
                        # PBRT starts an imported builder with copied graphics
                        # state but its own empty named-coordinate dictionary.
                        coordinates = {}
                    try:
                        process(root / values[0], (*chain, path))
                    finally:
                        if command == "Import":
                            coordinates = saved_coordinates
                    if command == "Import":
                        if scopes != saved_scopes or object_name != saved_object:
                            raise ValueError("Unbalanced scope in Import")
                        state, in_world = saved, saved_world
                elif command == "WorldBegin":
                    if in_world or scopes:
                        raise ValueError("Unexpected WorldBegin")
                    # PBRT resets only the CTM and active transform bits here;
                    # Attribute defaults declared before WorldBegin remain active.
                    in_world = True
                    state.matrices, state.active = [tr.identity(), tr.identity()], (0, 1)
                    coordinates["world"] = [tr.identity(), tr.identity()]
                elif command == "WorldEnd":
                    pass
                elif command in {"AttributeBegin", "TransformBegin", "ObjectBegin"}:
                    scopes.append((command, state.copy(), object_name))
                    if command == "ObjectBegin":
                        if object_name is not None or len(values) != 1 or values[0] in objects:
                            raise ValueError("Invalid object definition")
                        object_name = values[0]
                        objects[object_name] = []
                elif command in {"AttributeEnd", "TransformEnd", "ObjectEnd"}:
                    if not scopes or scopes[-1][0] != command.replace("End", "Begin"):
                        raise ValueError("Unbalanced scope")
                    _, saved, old_object = scopes.pop()
                    if command == "TransformEnd":
                        state.matrices, state.active = saved.matrices, saved.active
                    else:
                        state = saved
                        object_name = old_object
                elif command == "ReverseOrientation":
                    state.reverse = not state.reverse
                elif command == "ActiveTransform":
                    state.active = {"All": (0,1), "StartTime": (0,), "EndTime": (1,)}[values[0]]
                elif command == "TransformTimes":
                    if len(values) != 2:
                        raise ValueError("Expected two transform times")
                elif command == "CoordinateSystem":
                    coordinates[values[0]] = [list(m) for m in state.matrices]
                elif command == "CoordSysTransform":
                    # Unlike Translate/Scale, this restores the entire saved
                    # TransformSet, regardless of ActiveTransform.
                    if values[0] in coordinates:
                        state.matrices = [list(m) for m in coordinates[values[0]]]
                    else:
                        builder.warning("UNKNOWN_COORDINATE_SYSTEM",
                                        f"Unknown coordinate system '{values[0]}'; retained current transform", path)
                elif command == "Attribute":
                    target = values[0]
                    if target == "shape":
                        state.shape_attributes.update(parameters(args[1:]))
                    elif target not in {"light", "material", "medium", "texture"}:
                        raise ValueError(f"Unknown Attribute target: {target}")
                elif command in {"Identity", "Transform", "ConcatTransform", "Translate", "Scale", "Rotate", "LookAt"}:
                    nums = [float(v) for v in values]
                    if command == "Identity":
                        m = tr.identity()
                    elif command in {"Transform", "ConcatTransform"}:
                        m = tr.affine(tr.transpose(nums)) if len(nums) == 16 else tr.affine(nums)
                    elif command in {"Translate", "Scale"}:
                        m = (tr.translate if command == "Translate" else tr.scale)(nums)
                    elif command == "Rotate":
                        m = tr.rotate(nums[0], nums[1:])
                    else:
                        if len(nums) != 9:
                            raise ValueError("LookAt needs nine numbers")
                        m = tr.inverse(tr.look_at(nums[:3], nums[3:6], nums[6:]))
                    for i in state.active:
                        state.matrices[i] = m if command in {"Identity", "Transform"} else tr.multiply(state.matrices[i], m)
                elif command == "Camera":
                    if in_world:
                        raise ValueError("Camera must precede WorldBegin")
                    if values[0] != "perspective":
                        raise ValueError("Only perspective PBRT cameras are supported")
                    if state.matrices[0] != state.matrices[1]:
                        raise ValueError("Animated camera transforms are unsupported")
                    coordinates["camera"] = [tr.inverse(m) for m in state.matrices]
                    # Camera's CTM is camera-from-world. Capture it before
                    # WorldBegin resets geometry transforms to identity.
                    camera_description = (coordinates["camera"][0], parameters(args[1:]))
                elif command == "Film":
                    if in_world:
                        raise ValueError("Film must precede WorldBegin")
                    film_description = parameters(args[1:])
                elif command == "ObjectInstance":
                    if object_name is not None:
                        raise ValueError("Nested ObjectInstance definitions are unsupported")
                    if values[0] not in objects:
                        raise ValueError(f"Unknown object: {values[0]}")
                    if state.matrices[0] != state.matrices[1]:
                        builder.warning("ANIMATED_GEOMETRY_UNSUPPORTED", "Skipped animated instance", path)
                        continue
                    # ReverseOrientation belongs to shapes in the object definition.
                    for model, matrix, reverse, kind, name in objects[values[0]]:
                        append((model, tr.multiply(state.matrices[0], matrix), reverse, kind, name))
                elif command == "Shape":
                    if not in_world:
                        raise ValueError("Shape outside WorldBegin")
                    kind = values[0]
                    if kind not in {"plymesh", "trianglemesh", "sphere", "disk"}:
                        builder.warning("UNSUPPORTED_SHAPE", f"Skipped unsupported PBRT shape '{kind}'", path, kind)
                        continue
                    if state.matrices[0] != state.matrices[1]:
                        builder.warning("ANIMATED_GEOMETRY_UNSUPPORTED", "Skipped animated shape", path, kind)
                        continue
                    # Explicit Shape parameters override inherited Attribute
                    # defaults. Later Attribute declarations override earlier ones.
                    props = {**state.shape_attributes, **parameters(args[1:])}
                    if kind == "plymesh":
                        model = root / props["filename"][0]
                        if model.suffix.lower() != ".ply":
                            raise ValueError("plymesh requires a PLY file")
                    elif kind == "trianglemesh":
                        def rows(key, width):
                            data = [float(x) for x in props.get(key, [])]
                            if len(data) % width:
                                raise ValueError(f"Invalid {key} array length")
                            return [data[i:i+width] for i in range(0, len(data), width)]
                        model = write_obj(rows("P", 3), [int(x) for x in props["indices"]],
                                          rows("N", 3), rows("uv" if "uv" in props else "st", 2), directory=cache_directory)
                    else:
                        kwargs = {k: float(props[k][0]) for k in ("radius", "zmin", "zmax", "phimax", "height") if k in props}
                        if "innerradius" in props:
                            kwargs["inner_radius"] = float(props["innerradius"][0])
                        model = primitive(kind, directory=cache_directory, **kwargs)
                    append((model, list(state.matrices[0]), state.reverse, kind, f"{path.stem}:{line}"))
                elif command not in {"Integrator", "Sampler", "PixelFilter", "Accelerator", "Option",
                                     "ColorSpace", "MakeNamedMaterial", "NamedMaterial", "Material", "Texture",
                                     "LightSource", "AreaLightSource", "MakeNamedMedium", "MediumInterface"}:
                    raise ValueError(f"Unknown PBRT directive: {command}")
            except (ValueError, KeyError, IndexError) as exc:
                raise ValueError(f"{path}:{line}: {exc}") from exc
    process(source)
    if scopes or not in_world:
        raise ValueError("Incomplete PBRT world or unbalanced scopes")
    if camera_description is not None:
        matrix, props = camera_description
        builder.cameras.append(source_camera(matrix, props, film_description))
    return builder.snapshot()
