import assert from 'node:assert/strict';
import test from 'node:test';
import { editorApi } from '../../src/api/editorApi.js';
import { createViewportUiModeStore, createViewportUiCalibrationStore } from '../../src/utils/viewportUiMode.js';

test('viewport bounds, mode and calibration use one raw scoped V8 call with JSON disabled', async t => {
  const previous = globalThis.window, calls = [];
  const result = { archive_session: 'archive', scene: 'scene.ini', camera_id: 'camera-id', mode: 'stereo3d' };
  globalThis.window = { corona: { viewport: { configure: async (...args) => { calls.push(args); return result; } } },
    coronaBridge: new Proxy({}, { get() { throw new Error('retired viewport Fast route'); } }),
    cefQuery: () => { throw new Error('retired query route'); } };
  const parse = JSON.parse, stringify = JSON.stringify;
  t.after(() => { globalThis.window = previous; JSON.parse = parse; JSON.stringify = stringify; });
  JSON.parse = JSON.stringify = () => { throw new Error('JSON transport forbidden'); };
  const patch = { archive_session: 'archive', mode: 'stereo3d', calibration: { pe: 18, angle: 0.2, offset: 4, parallaxScale: 2 },
    bounds: { x: 10, y: 20, width: 800, height: 600, renderWidth: 1600, renderHeight: 1200 } };
  assert.equal(await editorApi.viewport.configure('scene.ini', 'camera-id', patch), result);
  assert.equal(calls[0][2], patch);
  assert.deepEqual(calls, [['scene.ini', 'camera-id', patch]]);
});

test('mode and calibration stores share the scoped configuration operation without numeric handles', async () => {
  const calls = [], api = { configure: async (...args) => { calls.push(args); return true; } };
  const scope = { api, sceneId: 'scene.ini', cameraId: '18446744073709551615', archiveSession: 'archive' };
  assert.equal(await createViewportUiModeStore({ storage: null }).applyToNative({ ...scope, mode: 'stereo3d' }), true);
  assert.equal(await createViewportUiCalibrationStore({ storage: null }).applyToNative({ ...scope,
    calibration: { pe: 18, angle: 0.2, offset: 4, parallaxScale: 2 } }), true);
  assert.deepEqual(calls, [['scene.ini', scope.cameraId, { archive_session: 'archive', mode: 'stereo3d' }],
    ['scene.ini', scope.cameraId, { archive_session: 'archive', calibration: { pe: 18, angle: 0.2, offset: 4, parallaxScale: 2 } }]]);
  assert.equal('applyToBridge' in createViewportUiModeStore(), false);
  assert.equal('applyToBridge' in createViewportUiCalibrationStore(), false);
  assert.equal(await createViewportUiModeStore().applyToNative({ ...scope, archiveSession: '', mode: 'flat2d' }), false);
  assert.equal(calls.length, 2);
});

test('viewport configuration propagates native scope and lifetime errors without a legacy retry', async t => {
  const previous = globalThis.window;
  t.after(() => { globalThis.window = previous; });
  for (const code of ['PROJECT_CONTEXT_CHANGED', 'CAMERA_NOT_FOUND', 'WINDOW_CLOSED']) {
    const failure = Object.assign(new Error(code), { code });
    globalThis.window = { corona: { viewport: { configure: () => Promise.reject(failure) } } };
    await assert.rejects(editorApi.viewport.configure('scene.ini', 'camera-id', { archive_session: 'archive', mode: 'flat2d' }),
      error => error === failure);
  }
});
