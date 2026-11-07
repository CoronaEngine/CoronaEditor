import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { babelParse, parse } from 'vue/compiler-sfc';
import { editorApi } from '../../src/api/editorApi.js';
import { deferred } from './windowSessionFixtures.mjs';
import { emptySceneTreeSettlement, resolveSceneTreeSnapshot } from '../../src/utils/sceneTreeSnapshot.js';

function handler(name, deps) {
  const script = parse(readFileSync(new URL('../../src/views/sidebar/SceneBar.vue', import.meta.url), 'utf8')).descriptor.scriptSetup.content;
  const node = babelParse(script, { sourceType: 'module' }).program.body.flatMap(node =>
    node.type === 'FunctionDeclaration' ? [node] : (node.declarations || []).map(item => ({ ...item.init, name: item.id.name })))
    .find(node => node.id?.name === name || node.name === name);
  assert.ok(node, name);
  return new Function('deps', `with(deps){return (${script.slice(node.start, node.end)});}`)(deps);
}

test('rich tree uses one scoped V8 facade and retires the manifest reader', async t => {
  const oldWindow = globalThis.window, oldParse = JSON.parse, oldStringify = JSON.stringify;
  t.after(() => { globalThis.window = oldWindow; JSON.parse = oldParse; JSON.stringify = oldStringify; });
  const calls = [], result = { archive_session: 'archive', scene: 'scene.ini', tree_revision: 2, actors: [], cameras: [] };
  globalThis.window = { corona: { scene: { readTree: async (...args) => { calls.push(args); return result; } } } };
  JSON.parse = JSON.stringify = () => { throw Error('JSON tree transport'); };
  const scope = { archive_session: 'archive' };
  assert.equal(await editorApi.scene.readTree('scene.ini', scope), result);
  assert.deepEqual(calls, [['scene.ini', scope]]);
  assert.equal(editorApi.sceneTools?.listSceneTree, undefined);
});

function fixture(read) {
  const calls = [], cameras = [], retries = [], errors = [];
  const deps = {
    viewLifetime: { current: () => true }, currentSceneName: { value: 'scene.ini' },
    archiveSession: { value: 'archive' }, sceneTreeRequestSeq: 0,
    sceneTreeSettlement: { value: emptySceneTreeSettlement() }, sceneImages: { value: [{ name: 'previous' }] },
    editorApi: { scene: { readTree: (...args) => { calls.push(args); return read(...args); } } },
    normalizeHandle: value => String(value ?? ''), resolveSceneTreeSnapshot,
    applyCameraList: value => cameras.push(value),
    scheduleSceneTreeSettleRetry: (...args) => retries.push(args), logError: (...args) => errors.push(args),
  };
  return { deps, calls, cameras, retries, errors, run: handler('OnInitObjTree', deps) };
}

const snapshot = () => ({ archive_session: 'archive', scene: 'scene.ini', tree_revision: 3,
  actors: [{ actor_guid: 'probe', name: 'Probe', path: 'model.ply', type: 'model', visible: false,
    opaque_handle: '18446744073709551615', model_node_count: 42, load_status: 'gpu_failed',
    audio_resource_id: '18446744073709551614', load_error: { code: 'failed', message: 'Import failed' } }],
  cameras: [{ archive_session: 'archive', camera_id: 'main', opaque_handle: '18446744073709551613' }] });

test('SceneBar reads a complete rich projection under its observed archive', async () => {
  const f = fixture(async () => snapshot());
  await f.run();
  assert.deepEqual(f.calls, [['scene.ini', { archive_session: 'archive' }]]);
  assert.deepEqual(f.deps.sceneImages.value, [{ actor_guid: 'probe', actor_version: 1, archive_session: 'archive', name: 'Probe', path: 'model.ply', type: 'model',
    visible: false, handle: '18446744073709551615', model_node_count: 42,
    audioResourceId: '18446744073709551614', load_status: 'gpu_failed', load_error: { code: 'failed', message: 'Import failed' } }]);
  assert.deepEqual(f.cameras, [snapshot().cameras]);
  assert.equal(f.deps.archiveSession.value, 'archive');
  assert.deepEqual(f.errors, []);
});

for (const changed of ['archive', 'scene', 'unmount', 'newer request', 'reply archive', 'reply scene']) {
  test(`SceneBar cannot publish a rich tree after ${changed}`, async () => {
    const pending = deferred(), f = fixture(() => pending.promise);
    const work = f.run();
    assert.equal(f.calls.length, 1);
    const result = snapshot();
    if (changed === 'archive') f.deps.archiveSession.value = 'next';
    if (changed === 'scene') f.deps.currentSceneName.value = 'next.ini';
    if (changed === 'unmount') f.deps.viewLifetime.current = () => false;
    if (changed === 'newer request') f.deps.sceneTreeRequestSeq++;
    if (changed === 'reply archive') result.archive_session = 'wrong';
    if (changed === 'reply scene') result.scene = 'wrong.ini';
    pending.resolve(result); await work;
    assert.deepEqual(f.deps.sceneImages.value, [{ name: 'previous' }]);
    assert.deepEqual(f.cameras, []); assert.deepEqual(f.retries, []);
  });
}

test('a missing archive cannot be filled by an implicit current-world tree read', async () => {
  const f = fixture(async () => snapshot()); f.deps.archiveSession.value = '';
  await f.run(); assert.deepEqual(f.calls, []);
});

test('same-route project reopening changes tree scope before issuing the new read', () => {
  const calls = [], deps = { currentSceneName: { value: 'scene.ini' }, archiveSession: { value: 'old' },
    resolveOpenedProjectScene: () => 'scene.ini', publishModelNodeSelection() {},
    OnInitObjTree: () => calls.push(['tree', deps.archiveSession.value]), RefreshRenderBackendState() {},
  };
  handler('onProjectOpenedEvent', deps)({ archive_session: 'next' });
  assert.equal(deps.archiveSession.value, 'next'); assert.deepEqual(calls, [['tree', 'next']]);
});

test('a tree notification from a different archive cannot refresh the current tree', () => {
  let reads = 0;
  handler('onSceneTreeChangedEvent', { currentSceneName: { value: 'scene.ini' }, archiveSession: { value: 'archive' },
    OnInitObjTree: () => reads++,
  })({ scene: 'scene.ini', archive_session: 'retired' });
  assert.equal(reads, 0);
});
