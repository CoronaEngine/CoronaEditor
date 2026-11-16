import assert from 'node:assert/strict';
import test from 'node:test';
import { editorApi } from '../../src/api/editorApi.js';

// The manifest that used to be parsed here (api-name table, caller masks, js_wrapper column)
// was deleted with the named-binding migration: there is no route table left to inspect, so
// these guards now only pin the facade the Web code actually reaches.

test('unknown and retired capabilities are absent without mutating the API surface', () => {
  const before = Object.keys(editorApi.scene);
  for (const name of ['setActorState', 'setActorPhysics', 'setActorCameraLock', 'notARealMethod']) {
    assert.equal(editorApi.scene[name], undefined, name);
    assert.equal(Object.hasOwn(editorApi.scene, name), false, name);
  }
  assert.equal(editorApi.notARealNamespace, undefined);
  assert.equal(editorApi.sceneTools?.getFrameTiming, undefined);
  assert.deepEqual(Object.keys(editorApi.scene), before);
});

test('generic native callback and manifest discovery are absent', () => {
  assert.equal(editorApi.editor, undefined);
  assert.equal(editorApi.off, undefined);
  assert.equal(editorApi.scene.observe, undefined);
  assert.equal(editorApi.listMethods, undefined);
  assert.equal(editorApi.listEvents, undefined);
});
