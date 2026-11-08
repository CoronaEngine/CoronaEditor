import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { babelParse, parse } from 'vue/compiler-sfc';
import { editorApi } from '../../src/api/editorApi.js';
import { deferred } from './windowSessionFixtures.mjs';
import { indexActorsByHandle } from '../../src/utils/viewportPick.js';

function handler(file, name, deps) {
  const script = parse(readFileSync(new URL(`../../src/${file}.vue`, import.meta.url), 'utf8')).descriptor.scriptSetup.content;
  const node = babelParse(script, { sourceType: 'module' }).program.body.flatMap(node =>
    node.type === 'FunctionDeclaration' ? [node] : (node.declarations || []).map(item => ({ ...item.init, name: item.id.name })))
    .find(node => node.id?.name === name || node.name === name);
  assert.ok(node, name);
  return new Function('deps', `with(deps){return (${script.slice(node.start, node.end)});}`)(deps);
}

test('Actor properties use one named V8 facade and retire the duplicate actor readers', async t => {
  const previous = globalThis.window, parse = JSON.parse, stringify = JSON.stringify;
  t.after(() => { globalThis.window = previous; JSON.parse = parse; JSON.stringify = stringify; });
  const calls = [], result = { archive_session: 'archive', scene: 'scene.ini', name: 'Probe' };
  globalThis.window = { corona: { scene: { readActorProperties: async (...args) => { calls.push(args); return result; } } } };
  JSON.parse = JSON.stringify = () => { throw new Error('JSON DTO transport'); };
  const scope = { archive_session: 'archive' };
  assert.equal(await editorApi.scene.readActorProperties('scene.ini', 'guid', scope), result);
  assert.deepEqual(calls, [['scene.ini', 'guid', scope]]);
  assert.equal(editorApi.scene.getActor, undefined);
  assert.equal(editorApi.scene.readActor, undefined);
});

function objectDeps(read) {
  return { loadSequence: 0, loading: { value: false }, archiveSession: { value: '' },
    selectedSceneName: { value: '' }, selectedActorName: { value: '' },
    viewLifetime: { current: () => true }, ikController: { clear() {}, select() {} },
    actor: { transform: { position: {}, rotation: {}, scale: {} }, mechanics: {}, cameraLock: { position: {} } },
    aliasDraft: { value: '' }, aliasError: { value: '' }, aliasSaving: { value: false },
    placeholderRebinding: { value: false }, saving: { value: false }, axes: ['x', 'y', 'z'],
    assignVector: (target, values, fallback) => Object.assign(target, values || fallback),
    readFollowCamera: data => data.follow_camera, normalizeBodyType: value => value || 'dynamic',
    syncViewportTransformBaseline() {}, logError() {}, unwrap: value => value,
    editorApi: { scene: { readActorProperties: read } },
  };
}

test('Object loads a scoped property projection and preserves opaque native identity', async () => {
  const calls = [], deps = objectDeps(async (...args) => {
    calls.push(args);
    return { archive_session: 'archive', scene: 'scene.ini', name: 'Probe', actor_guid: 'guid',
      handle: '18446744073709551615', actor_type: 'audio', load_status: 'error',
      load_error: { code: 'MISSING', message: 'missing resource' }, model: 'probe.wav',
      body_type: 'static', follow_camera: true, geometry: { position: [1, 2, 3] },
      camera_lock: { enabled: true, position_offset: [0, 0, 2] } };
  });
  await handler('views/sidebar/Object', 'loadActor', deps)('scene.ini', 'Probe', 'archive', 'guid');
  assert.deepEqual(calls, [['scene.ini', 'guid', { archive_session: 'archive' }]]);
  assert.equal(deps.actor.name, 'Probe');
  assert.equal(deps.actor.handle, '18446744073709551615');
  assert.equal(deps.actor.type, 'audio');
  assert.equal(deps.actor.loadError.code, 'MISSING');
  assert.equal(deps.actor.mechanics.bodyType, 'static');
  assert.equal(deps.loading.value, false);
});

for (const change of ['archive', 'scene', 'unmount', 'reload']) {
  test(`Object drops a property projection after ${change}`, async () => {
    const pending = deferred(), deps = objectDeps(() => pending.promise);
    const work = handler('views/sidebar/Object', 'loadActor', deps)('scene.ini', 'Probe', 'archive', 'guid');
    assert.equal(deps.loading.value, true);
    if (change === 'archive') deps.archiveSession.value = 'next';
    if (change === 'scene') deps.selectedSceneName.value = 'other.ini';
    if (change === 'unmount') deps.viewLifetime.current = () => false;
    if (change === 'reload') deps.loadSequence++;
    pending.resolve({ archive_session: 'archive', scene: 'scene.ini', name: 'Late' });
    await work;
    assert.equal(deps.actor.name, undefined);
  });
}

test('Object never resolves a missing observed archive against the new active world', async () => {
  const calls = [], deps = objectDeps((...args) => { calls.push(args); });
  await handler('views/sidebar/Object', 'loadActor', deps)('scene.ini', 'Probe', '', 'guid');
  assert.deepEqual(calls, []);
});

test('main viewport transform baseline uses the scoped property projection', async () => {
  const calls = [], deps = {
    cameraBindingState: { value: { sceneId: 'scene.ini', archiveSession: 'archive' } },
    viewCurrent: () => true, actorTransformBaselines: new Map(),
    mainSceneOperation: () => ({ current: () => true, archive: 'archive', sceneId: 'scene.ini' }),
    actorTransformKey: (scene, actor) => `${scene}::${actor}`, normalizeActorTransform: value => value,
    editorApi: { scene: { readActorProperties: async (...args) => {
      calls.push(args); return { archive_session: 'archive', scene: 'scene.ini', geometry: { position: [1, 2, 3] } };
    } } },
  };
  await handler('views/layout/MainPage', 'seedActorTransformBaseline', deps)('scene.ini', 'Probe');
  assert.deepEqual(calls, [['scene.ini', 'Probe', { archive_session: 'archive' }]]);
  assert.deepEqual(deps.actorTransformBaselines.get('scene.ini::Probe'), { position: [1, 2, 3] });
});

for (const change of ['archive', 'scene', 'unmount']) {
  test(`main viewport drops a property baseline after ${change}`, async () => {
    const pending = deferred(), deps = {
      cameraBindingState: { value: { sceneId: 'scene.ini', archiveSession: 'archive' } },
      viewCurrent: () => true, actorTransformBaselines: new Map(),
      mainSceneOperation: () => ({ current: () => true, archive: 'archive', sceneId: 'scene.ini' }),
      actorTransformKey: (scene, actor) => `${scene}::${actor}`, normalizeActorTransform: value => value,
      editorApi: { scene: { readActorProperties: () => pending.promise } },
    };
    const work = handler('views/layout/MainPage', 'seedActorTransformBaseline', deps)('scene.ini', 'Probe');
    if (change === 'archive') deps.cameraBindingState.value.archiveSession = 'next';
    if (change === 'scene') deps.cameraBindingState.value.sceneId = 'other.ini';
    if (change === 'unmount') deps.viewCurrent = () => false;
    pending.resolve({ archive_session: 'archive', scene: 'scene.ini', geometry: { position: [1, 2, 3] } });
    await work;
    assert.equal(deps.actorTransformBaselines.size, 0);
  });
}

test('actor index facade calls the named V8 binding with the observed scope and no JSON', async t => {
  const previous = globalThis.window;
  const parse = JSON.parse, stringify = JSON.stringify;
  t.after(() => { globalThis.window = previous; JSON.parse = parse; JSON.stringify = stringify; });
  const calls = [], result = { archive_session: 'archive', scene: 'scene.ini', actors: [] };
  globalThis.window = { corona: { scene: { readActorIndex: async (...args) => { calls.push(args); return result; } } } };
  JSON.parse = JSON.stringify = () => { throw new Error('JSON DTO transport'); };
  const scope = { archive_session: 'archive' };
  assert.equal(await editorApi.scene.readActorIndex('scene.ini', scope), result);
  assert.deepEqual(calls, [['scene.ini', scope]]);
});

test('CameraView picks use a scoped actor index without loading the full scene tree', async () => {
  const calls = [];
  const deps = { sceneId: 'scene.ini', camera: { value: { archive_session: 'archive' } },
    viewLifetime: { current: () => true }, actorPickIndex: new Map(), indexActorsByHandle,
    editorApi: { scene: { readActorIndex: async (...args) => {
      calls.push(args);
      return { scene: 'scene.ini', archive_session: 'archive', actors: [{ actor_guid: 'actor', name: 'Probe', type: '.actor' }] };
    } } },
  };
  const refresh = handler('views/tools/CameraView', 'refreshCameraViewActorPickIndex', deps);
  assert.equal(await refresh(), true);
  assert.deepEqual(calls, [['scene.ini', { archive_session: 'archive' }]]);
  assert.equal(deps.actorPickIndex.get('actor').name, 'Probe');
});

for (const change of ['archive', 'unmount']) {
  test(`CameraView drops an actor index that arrives after ${change}`, async () => {
    const pending = deferred(); let mounted = true;
    const original = new Map([['original', { name: 'Old' }]]);
    const deps = { sceneId: 'scene.ini', camera: { value: { archive_session: 'archive' } },
      viewLifetime: { current: () => mounted }, actorPickIndex: original, indexActorsByHandle,
      editorApi: { scene: { readActorIndex: () => pending.promise } },
    };
    const refresh = handler('views/tools/CameraView', 'refreshCameraViewActorPickIndex', deps);
    const work = refresh();
    if (change === 'archive') deps.camera.value = { archive_session: 'new-archive' };
    else mounted = false;
    pending.resolve({ scene: 'scene.ini', archive_session: 'archive', actors: [{ actor_guid: 'late', name: 'Late' }] });
    assert.equal(await work, false);
    assert.equal(deps.actorPickIndex, original);
  });
}

test('main viewport uses the same scoped actor index for Gizmo identity lookup', async () => {
  const calls = [], deps = {
    cameraBindingState: { value: { sceneId: 'scene.ini', archiveSession: 'archive' } },
    viewCurrent: () => true, actorPickIndex: new Map(), indexActorsByHandle,
    editorApi: { scene: { readActorIndex: async (...args) => {
      calls.push(args);
      return { scene: 'scene.ini', archive_session: 'archive', actors: [{ actor_guid: 'actor', name: 'Probe', type: 'actor' }] };
    } } },
  };
  const refresh = handler('views/layout/MainPage', 'refreshActorPickIndex', deps);
  assert.equal(await refresh('scene.ini'), true);
  assert.deepEqual(calls, [['scene.ini', { archive_session: 'archive' }]]);
  assert.equal(deps.actorPickIndex.get('actor').name, 'Probe');
});

for (const change of ['archive', 'scene', 'unmount']) {
  test(`main viewport drops a late actor index after ${change}`, async () => {
    const pending = deferred(); let mounted = true;
    const original = new Map([['original', { name: 'Old' }]]);
    const deps = { cameraBindingState: { value: { sceneId: 'scene.ini', archiveSession: 'archive' } },
      viewCurrent: () => mounted, actorPickIndex: original, indexActorsByHandle,
      editorApi: { scene: { readActorIndex: () => pending.promise },
        sceneTools: {} },
    };
    const work = handler('views/layout/MainPage', 'refreshActorPickIndex', deps)('scene.ini');
    if (change === 'archive') deps.cameraBindingState.value.archiveSession = 'next';
    else if (change === 'scene') deps.cameraBindingState.value.sceneId = 'other.ini';
    else mounted = false;
    pending.resolve({ scene: 'scene.ini', archive_session: 'archive', actors: [{ actor_guid: 'late', name: 'Late' }] });
    assert.equal(await work, false);
    assert.equal(deps.actorPickIndex, original);
  });
}

function targetDeps(read) {
  return { props: { sceneName: 'scene.ini', actorName: 'Before' }, initialLoadComplete: true,
    loadedArchiveSession: 'archive', graphLoadSequence: 1, panelClosing: false,
    viewLifetime: { current: () => true }, saveNow: async () => true,
    runStatus: { value: '' }, emit: () => {},
    editorApi: { scene: { readActorIndex: read } },
  };
}

test('node graph run target uses only the observed scene actor index after saving', async () => {
  const calls = [];
  const deps = targetDeps(async (...args) => {
    calls.push(['read', ...args]);
    return { scene: 'scene.ini', archive_session: 'archive', actors: [{ name: 'Probe' }] };
  });
  deps.saveNow = async () => { calls.push('save'); return true; };
  deps.emit = (...args) => calls.push(args);
  const select = handler('blockly/components/NodeGraphWorkspace', 'selectRunTarget', deps);
  await select({ target: { value: 'Probe' } });
  assert.equal(deps.runStatus.value, '');
  assert.deepEqual(calls, ['save', ['read', 'scene.ini', { archive_session: 'archive' }],
    ['select-target', { actorName: 'Probe', sceneName: 'scene.ini' }]]);
});

test('project graph resolves its observed scene before checking a run target', async () => {
  const calls = [], deps = targetDeps(async (...args) => {
    calls.push(args);
    return { scene: 'scene.ini', archive_session: 'archive', actors: [{ name: 'Probe' }] };
  });
  deps.props.sceneName = '';
  deps.editorApi.scene.readActive = async () => ({ scene: 'scene.ini', archive_session: 'archive' });
  deps.emit = (...args) => calls.push(args);
  await handler('blockly/components/NodeGraphWorkspace', 'selectRunTarget', deps)({ target: { value: 'Probe' } });
  assert.deepEqual(calls, [['scene.ini', { archive_session: 'archive' }],
    ['select-target', { actorName: 'Probe', sceneName: 'scene.ini' }]]);
});

test('project graph never applies its old run target to a new active archive', async () => {
  const calls = [], deps = targetDeps(async (...args) => calls.push(args));
  deps.props.sceneName = '';
  deps.editorApi.scene.readActive = async () => ({ scene: 'scene.ini', archive_session: 'next' });
  deps.emit = (...args) => calls.push(args);
  await handler('blockly/components/NodeGraphWorkspace', 'selectRunTarget', deps)({ target: { value: 'Probe' } });
  assert.deepEqual(calls, []);
});

test('an Actor removed since the dropdown was populated is rejected as a run target', async () => {
  const emitted = [], deps = targetDeps(async () => ({ scene: 'scene.ini', archive_session: 'archive', actors: [] }));
  deps.emit = (...args) => emitted.push(args);
  await handler('blockly/components/NodeGraphWorkspace', 'selectRunTarget', deps)({ target: { value: 'Removed' } });
  assert.match(deps.runStatus.value, /运行目标已不在当前场景/);
  assert.deepEqual(emitted, []);
});

for (const change of ['archive', 'reload', 'unmount', 'closing']) {
  test(`node graph does not emit a run target after ${change}`, async () => {
    const pending = deferred(), emitted = [];
    const deps = targetDeps(() => pending.promise);
    deps.emit = (...args) => emitted.push(args);
    const select = handler('blockly/components/NodeGraphWorkspace', 'selectRunTarget', deps);
    const work = select({ target: { value: 'Probe' } });
    await Promise.resolve();
    if (change === 'archive') deps.loadedArchiveSession = 'next';
    else if (change === 'reload') deps.graphLoadSequence++;
    else if (change === 'closing') deps.panelClosing = true;
    else deps.viewLifetime.current = () => false;
    pending.resolve({ scene: 'scene.ini', archive_session: 'archive', actors: [{ name: 'Probe' }] });
    await work;
    assert.deepEqual(emitted, []);
  });
}
