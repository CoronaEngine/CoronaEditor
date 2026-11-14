import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('input facade calls the one native V8 binding without the legacy routes', async t => {
  const calls = [];
  globalThis.window = { corona: { input: { dispatch: (...args) => { calls.push(args); return Promise.resolve({ status: 'queued' }); } } },
    cefQuery: () => { throw Error('legacy transport'); } };
  t.after(() => { delete globalThis.window; });
  const { editorApi } = await import(`../../src/api/editorApi.js?input=${Date.now()}`);
  const event = { archive_session: 'world', type: 'keyDown', code: 'KeyJ', key: 'd', modifiers: '' };
  assert.deepEqual(await editorApi.input.dispatch('scene.ini', 'main-camera', event), { status: 'queued' });
  assert.deepEqual(calls, [['scene.ini', 'main-camera', event]]);
  for (const name of ['sendKeyEvent', 'sendKeyUpEvent', 'sendMouseEvent']) assert.equal(name in editorApi.scripts, false);
});

test('pointer input uses scoped native event objects with viewport coordinates', async () => {
  const { createScriptInputSender } = await import('../../src/utils/scriptInput.js');
  const calls = [];
  let scope = { sceneId: 'scene.ini', cameraId: 'camera-a', archiveSession: 'world' };
  const sender = createScriptInputSender({ api: { input: { dispatch: async (...args) => { calls.push(args); return { status: 'queued' }; } } },
    getBinding: () => scope, getRenderRect: () => ({ left: 10, top: 20, width: 400, height: 200 }) });
  assert.deepEqual(await sender('click', { clientX: 35, clientY: 60, button: 0 }), { status: 'queued' });
  assert.deepEqual(calls[0], ['scene.ini', 'camera-a', { archive_session: 'world', type: 'mouse',
    event: 'click', button: 'LeftButton', x: 35, y: 60, viewport_x: 25, viewport_y: 40, viewport_width: 400, viewport_height: 200 }]);
  scope = { ...scope, archiveSession: '' };
  assert.equal(await sender('move', { clientX: 35, clientY: 60 }), false);
  assert.equal(calls.length, 1);
});

test('native SDL keyboard delivery has no browser key forwarding fallback in any page', async () => {
  for (const file of ['App.vue', 'views/layout/MainPage.vue', 'views/tools/CameraView.vue']) {
    const source = await readFile(new URL(`../../src/${file}`, import.meta.url), 'utf8');
    for (const retired of ['sendKeyEvent', 'sendKeyUpEvent', '__coronaScratchKeyForwarded', 'forwardScratchKey'])
      assert.equal(source.includes(retired), false, `${file}: ${retired}`);
  }
});

test('deferred mouse input keeps its original coordinates and cannot cross archive, camera or dispose boundaries', async () => {
  const { createScriptInputSender } = await import('../../src/utils/scriptInput.js');
  let scope = { sceneId: 'scene.ini', cameraId: 'a', archiveSession: 'one' };
  let rect = { left: 10, top: 20, width: 400, height: 200 };
  const calls = [];
  const sender = createScriptInputSender({ api: { input: { dispatch: async (...args) => calls.push(args) } },
    getBinding: () => scope, getRenderRect: () => rect });
  const pending = sender.capture('click', { clientX: 20, clientY: 30, button: 0 });
  rect = { left: 100, top: 200, width: 600, height: 300 };
  await pending();
  assert.equal(calls[0][2].viewport_x, 10);
  assert.equal(calls[0][2].viewport_width, 400);
  for (const change of [{ archiveSession: 'two' }, { cameraId: 'b' }, { sceneId: 'other.ini' }]) {
    const late = sender.capture('move', { clientX: 20, clientY: 30 });
    scope = { ...scope, ...change };
    assert.equal(await late(), false);
  }
  const disposed = sender.capture('move', { clientX: 20, clientY: 30 });
  sender.dispose();
  assert.equal(await disposed(), false);
  assert.equal(await sender('move', { clientX: 20, clientY: 30 }), false);
  assert.equal(calls.length, 1);
});
