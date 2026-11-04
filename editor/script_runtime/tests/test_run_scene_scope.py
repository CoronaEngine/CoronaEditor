from Frontend.src.blockly.generators.runtime import block_program as ce


def test_same_scene_is_shared_only_with_children_of_the_same_run():
    a = ce.bind_context(ce.create_context("root-a", "actor", "scene.ini", "Probe"))
    try:
        ce.data_set("SCENE", "points", 37)
        ce._shared_lists(a)["items"] = [1]
        ce._shared_object_tags(a)["Probe"] = "old"
        child = ce.bind_context(ce.create_context("child", "actor", "scene.ini", "Clone", parent=a))
        try:
            assert ce.data_get("SCENE", "points") == 37
            ce.data_set("SCENE", "points", 42)
            assert ce._shared_variables(a)["points"] == 42
        finally:
            ce.release_context(child)
    finally:
        ce.release_context(a)
    b = ce.bind_context(ce.create_context("root-b", "actor", "scene.ini", "Probe"))
    try:
        assert ce.data_get("SCENE", "points", "unset") == "unset"
        assert not ce._shared_lists(b) and not ce._shared_object_tags(b)
    finally:
        ce.release_context(b)
