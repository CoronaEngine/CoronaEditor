import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate as tick } from 'node:timers/promises';
import { createViewportPickController } from '../../src/utils/viewportPick.js';

function fixture({ onSelect } = {}) {
  let binding = { sceneId: 'scene.ini', cameraId: 'camera-a', archiveSession: 'world-a' };
  const calls = [], results = [], selections = [];
  let sequence = 0;
  const controller = createViewportPickController({
    api: { viewport: { pick: (...args) => new Promise((resolve, reject) => calls.push({ args, resolve, reject })) } },
    getCameraBinding: () => binding,
    getHitRect: () => ({ left: 10, top: 20, width: 200, height: 100 }),
    getRenderRect: () => ({ left: 0, top: 0, width: 400, height: 200 }),
    emitActorChange: (...args) => { selections.push(args); return onSelect?.(...args); },
    onResult: (payload, result) => results.push({ payload, result }),
    makeRequestId: () => `local-${++sequence}`,
  });
  const reply = (patch = {}) => ({ status: 'success', scene: 'scene.ini', camera_id: 'camera-a',
    archive_session: 'world-a', actor_guid: 'actor-guid', actor_name: 'Picked', actor_type: 'actor',
    actor_handle: '18446744073709551614', node_index: 4294967294, x: 50, y: 60, ...patch });
  return { controller, calls, results, selections, reply, setBinding: value => { binding = value; } };
}

test('viewport facade references one direct native pick binding without legacy transport', async t => {
  const calls = [];
  globalThis.window = { corona: { viewport: { pick: (...args) => { calls.push(args); return Promise.resolve('picked'); } } },
    coronaBridge: new Proxy({}, { get() { throw new Error('legacy Fast route'); } }),
    cefQuery: () => { throw new Error('legacy JSON route'); } };
  t.after(() => { delete globalThis.window; });
  const { editorApi } = await import(`../../src/api/editorApi.js?pick=${Date.now()}`);
  const options = { archive_session: 'world-a', x: 1, y: 2, width: 3, height: 4 };
  assert.equal(await editorApi.viewport.pick('scene.ini', 'camera-a', options), 'picked');
  assert.deepEqual(calls, [['scene.ini', 'camera-a', options]]);
  assert.equal('pickActor' in editorApi.sceneTools, false);
  assert.equal(editorApi.events.onActorPickResult, undefined);
});

test('pick sends exact archive/camera and render coordinates then selects authoritative identity without numeric handles', async () => {
  const f = fixture();
  assert.equal(f.controller.pickAt({ clientX: 50, clientY: 60 }), 'local-1');
  assert.deepEqual(f.calls[0].args, ['scene.ini', 'camera-a', { archive_session: 'world-a', x: 50, y: 60, width: 400, height: 200 }]);
  f.calls[0].resolve(f.reply());
  await tick();
  assert.deepEqual(f.selections, [['actor', 'scene.ini', 'Picked', { node_index: 4294967294 }]]);
  assert.equal(f.results[0].result.actor.handle, '18446744073709551614');
  assert.equal(f.results[0].result.status, 'selected');
  assert.equal(f.results[0].payload.requestId, 'local-1');
});

test('pick rejects outside hit regions and incomplete scopes without issuing requests', () => {
  const f = fixture();
  assert.equal(f.controller.pickAt({ clientX: 9, clientY: 30 }), false);
  f.setBinding({ sceneId: 'scene.ini', cameraId: 'camera-a' });
  assert.equal(f.controller.pickAt({ clientX: 50, clientY: 60 }), false);
  assert.deepEqual(f.calls, []);
});

test('newer clicks supersede older replies and each Promise completes once', async () => {
  const f = fixture();
  f.controller.pickAt({ clientX: 50, clientY: 60 });
  f.controller.pickAt({ clientX: 51, clientY: 61 });
  assert.equal(f.calls.length, 2);
  f.calls[1].resolve(f.reply({ status: 'miss' }));
  f.calls[0].resolve(f.reply());
  await tick();
  assert.deepEqual(f.results.map(item => item.result.status), ['miss']);
  assert.deepEqual(f.selections, []);
});

test('camera or archive changes and disposal suppress late native replies', async () => {
  for (const retire of [f => f.setBinding({ sceneId: 'scene.ini', cameraId: 'camera-b', archiveSession: 'world-a' }),
    f => f.setBinding({ sceneId: 'scene.ini', cameraId: 'camera-a', archiveSession: 'world-b' }),
    f => f.controller.dispose()]) {
    const f = fixture();
    f.controller.pickAt({ clientX: 50, clientY: 60 });
    assert.equal(f.calls.length, 1);
    retire(f);
    f.calls[0].resolve(f.reply());
    await tick();
    assert.deepEqual(f.results, []);
    assert.deepEqual(f.selections, []);
  }
});

test('native failures finish the latest click as an error without retry', async () => {
  const f = fixture();
  f.controller.pickAt({ clientX: 50, clientY: 60 });
  assert.equal(f.calls.length, 1);
  f.calls[0].reject(Object.assign(new Error('GPU readback timed out'), { code: 'PICK_TIMEOUT' }));
  await tick();
  assert.equal(f.results[0].result.status, 'error');
  assert.equal(f.results[0].payload.code, 'PICK_TIMEOUT');
  assert.equal(f.calls.length, 1);
});

test('a rejected selection does not leak an unhandled Promise or retry the pick', async t => {
  const warning = t.mock.method(console, 'warn', () => {});
  const f = fixture({ onSelect: () => Promise.reject(new Error('Archive retired after pick')) });
  f.controller.pickAt({ clientX: 50, clientY: 60 });
  f.calls[0].resolve(f.reply());
  await tick();
  assert.equal(f.results.length, 1);
  assert.equal(f.calls.length, 1);
  assert.equal(warning.mock.callCount(), 1);
});
