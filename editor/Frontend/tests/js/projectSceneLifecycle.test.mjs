import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveOpenedProjectScene } from '../../src/utils/projectSceneLifecycle.js';

test('opens the single materialized scene', () => {
  assert.equal(resolveOpenedProjectScene({ scene: { path: 'scene.ini' } }), 'scene.ini');
  assert.equal(resolveOpenedProjectScene({ scene: { path: ' scene.ini ' } }), 'scene.ini');
});
test('does not restore old scene lists or active indexes', () => {
  assert.equal(resolveOpenedProjectScene({ scenes: [{ path: 'old.scene' }], active_index: 8 }), '');
  assert.equal(resolveOpenedProjectScene({}), '');
});
