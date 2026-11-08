import assert from 'node:assert/strict';

// Component fixtures describe returned projections; the exposed mock follows
// the same single, explicitly scoped query contract as the production bridge.
export function sceneQueryFixture(projections) {
  const readScene = async request => {
    assert.ok(request.archive_session);
    assert.ok(request.scene);
    const scope = { archive_session: request.archive_session };
    const results = [];
    const actorProjection = request.actors || 'none';
    if (actorProjection !== 'none') {
      assert.equal(typeof projections[actorProjection], 'function', actorProjection);
      results.push(await projections[actorProjection](request.scene, scope));
    }
    if (request.cameras && !(actorProjection === 'tree' && projections.tree)) {
      assert.equal(typeof projections.cameras, 'function');
      results.push(await projections.cameras(request.scene, scope));
    }
    assert.ok(results.length);
    return results.length === 1 ? results[0] : Object.assign({}, ...results);
  };
  readScene.projections = projections;
  return { readScene };
}
