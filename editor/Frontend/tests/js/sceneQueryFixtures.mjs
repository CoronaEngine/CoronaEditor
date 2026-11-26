import assert from 'node:assert/strict';

// Component fixtures describe returned projections; the exposed mock follows the same one-object
// contract as the production surface. Each projection is its own operation now, so the fixture
// exposes exactly the four the components call.
export function sceneQueryFixture(projections) {
  const scopeOf = request => {
    assert.ok(request.archive_session);
    assert.ok(request.scene);
    return { archive_session: request.archive_session };
  };
  const projection = key => async request => {
    assert.equal(typeof projections[key], 'function', key);
    return projections[key](request.scene, scopeOf(request));
  };
  return {
    read_scene_index: projection('index'),
    read_scene_tree: projection('tree'),
    read_scene_context: projection('context'),
    read_cameras: projection('cameras'),
    projections,
  };
}
