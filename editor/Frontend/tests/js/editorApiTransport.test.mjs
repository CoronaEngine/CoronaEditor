// Transport-level contracts for src/api/editorApi.js.
//
// These tests intentionally import ONLY node builtins plus the module under test, so they
// run without node_modules: `node --test tests/js/editorApiTransport.test.mjs`.
// The fake host below mimics the parts of the CEF surface editorApi.js actually uses.

import test from 'node:test';
import assert from 'node:assert/strict';

// Mirrors the shape of the C++ Editor API manifest closely enough for the JS validator:
// every entry needs `allowed_callers` to include the CEF caller bit (1).
const CALLER_CEF = 1;

const MANIFEST_METHODS = [
  {
    api: 'SceneTools.get_model_nodes',
    js_wrapper: 'sceneTools.getModelNodes',
    params: [{ name: 'scene_name', type: 'string' }, { name: 'actor_name', type: 'string' },
      { name: 'parent_index', type: 'integer', optional: true }, { name: 'offset', type: 'integer', optional: true },
      { name: 'limit', type: 'integer', optional: true }],
    return: 'object', allowed_callers: CALLER_CEF,
  },
  {
    api: 'SceneTools.set_model_node_state',
    js_wrapper: 'sceneTools.setModelNodeState',
    params: [{ name: 'scene_name', type: 'string' }, { name: 'actor_name', type: 'string' },
      { name: 'node_index', type: 'integer' }, { name: 'state', type: 'object' }],
    return: 'object', allowed_callers: CALLER_CEF,
  },
  { api: 'EditorApi.list_methods', params: [], return: 'object', allowed_callers: CALLER_CEF },
  { api: 'EditorApi.list_events', params: [], return: 'object', allowed_callers: CALLER_CEF },
  {
    api: 'EditorApi.register_callback',
    params: [
      { name: 'event', type: 'string' },
      { name: 'spec', type: 'object', optional: true },
    ],
    return: 'object',
    allowed_callers: CALLER_CEF,
  },
  {
    api: 'EditorApi.unregister_callback',
    params: [{ name: 'token', type: 'integer' }],
    return: 'object',
    allowed_callers: CALLER_CEF,
  },

];

const MANIFEST_EVENTS = [
  {
    event: 'LANChat.event',
    js_wrapper: 'events.onLanChatEvent',
    payload: 'object',
    allowed_callers: CALLER_CEF,
  },
  {
    event: 'Test.extension', js_wrapper: 'events.onExtension',
    payload: 'object', allowed_callers: CALLER_CEF,
  },
];

function createFakeCefHost() {
  const failFor = new Set();
  const hangFor = new Set();
  const requests = [];
  const pending = new Map();
  const callbacks = new Map();

  return {
    requests,
    failFor,
    hangFor,
    pending,
    callbacks,
    corona: {
      lanChat: {
        onEvent(callback) {
          callbacks.set(42, { callback });
          requests.push({ api: 'corona.lanChat.onEvent' });
          return () => callbacks.delete(42);
        },
      },
      project: {
        openProject(...args) {
          const api = 'corona.project.openProject';
          requests.push({ api, args });
          if (hangFor.has(api)) return new Promise((resolve, reject) => pending.set(api, { resolve, reject }));
          return Promise.resolve({ ok: true, status: 'opened', path: args[0] });
        },
        openProjectFile(...args) {
          const api = 'corona.project.openProjectFile';
          requests.push({ api, args });
          return new Promise((resolve, reject) => pending.set(api, { resolve, reject }));
        },
      },
      scene: {
        readCameraRenderSettings(...args) {
          requests.push({ api: 'corona.scene.readCameraRenderSettings', args });
          return Promise.resolve({ archive_session: args[2].archive_session, scene: args[0], camera_id: args[1], settings: {} });
        },
        setCameraRenderSettings(...args) {
          requests.push({ api: 'corona.scene.setCameraRenderSettings', args });
          return Promise.resolve({ archive_session: args[2].archive_session, scene: args[0], camera_id: args[1] });
        },
      },
      editor: {
        invoke(api, args) {
          const payload = { api, args };
          requests.push(payload);
          if (hangFor.has(api)) {
            return new Promise((resolve, reject) => pending.set(api, { resolve, reject }));
          }
          if (failFor.has(api)) {
            return Promise.reject(Object.assign(new Error(`${api} refused by native`), { code: '-2' }));
          }
          if (api === 'EditorApi.list_methods') {
            return Promise.resolve({ status: 'success', data: { methods: MANIFEST_METHODS } });
          }
          if (api === 'EditorApi.list_events') {
            return Promise.resolve({ status: 'success', data: { events: MANIFEST_EVENTS } });
          }
          return Promise.resolve({ status: 'success', data: {} });
        },
        on(event, callback) {
          callbacks.set(42, { event, callback });
          requests.push({ api: 'EditorApi.on', args: [event] });
          return Promise.resolve(42);
        },
        off(token) {
          requests.push({ api: 'EditorApi.off', args: [token] });
          callbacks.delete(token);
          if (failFor.has('EditorApi.off')) {
            return Promise.reject(Object.assign(new Error('EditorApi.off refused by native'), { code: '-2' }));
          }
          return Promise.resolve(true);
        },
      },
    },
    emit(token, payload, event) {
      callbacks.get(token)?.callback(payload, event);
    },
  };
}

// A fresh module instance per test so `editorApiCallbacks` starts empty.
async function loadEditorApi() {
  const host = createFakeCefHost();
  globalThis.window = host;
  const module = await import(`../../src/api/editorApi.js?fresh=${Date.now()}${Math.random()}`);
  return { editorApi: module.editorApi, host, limits: module.editorApiTransportLimits };
}

test('retired log subscription is absent before and after loading native events', async () => {
  const { editorApi } = await loadEditorApi();
  assert.equal(editorApi.events.onLogBatch, undefined);
  const stop = editorApi.lanChat.onEvent(() => {});
  assert.equal(editorApi.events.onLogBatch, undefined);
  stop();
  assert.equal(editorApi.events.onExtension, undefined, 'native discovery cannot add implicit capabilities');
});

test('orphan mesh movement subscription is absent before and after loading native events', async () => {
  const { editorApi } = await loadEditorApi();
  assert.equal(editorApi.events.onMeshMoveResult, undefined);
  const stop = editorApi.lanChat.onEvent(() => {});
  assert.equal(editorApi.events.onMeshMoveResult, undefined);
  stop();
});

test('model node operations are not exposed through the manifest transport', async () => {
  const { editorApi, host } = await loadEditorApi();
  assert.equal(editorApi.sceneTools?.getModelNodes, undefined);
  assert.equal(editorApi.sceneTools?.setModelNodeState, undefined);
  assert.equal(host.requests.some((item) => item.api === 'SceneTools.get_model_nodes' || item.api === 'SceneTools.set_model_node_state'), false);
});

test('camera render settings use one scoped V8 patch and expose no legacy Web setters', async () => {
  const { editorApi, host } = await loadEditorApi();
  const patch = {
    archive_session: 'archive-7',
    render_backend: 'vision',
    output_mode: 'final_color',
    vision: { render_mode: 'restir', accumulation: true },
  };

  await editorApi.scene.setCameraRenderSettings('SceneA', 'camera-1', patch);

  assert.deepEqual(host.requests.find(item => item.api === 'corona.scene.setCameraRenderSettings'), {
    api: 'corona.scene.setCameraRenderSettings', args: ['SceneA', 'camera-1', patch],
  });
  assert.equal(editorApi.sceneTools?.setRenderBackend, undefined);
  assert.equal(editorApi.sceneTools?.setOutputMode, undefined);
  assert.equal(editorApi.sceneTools?.setVisionRenderMode, undefined);
  assert.equal(editorApi.sceneTools?.setVisionAccumulation, undefined);
  assert.equal(editorApi.sceneTools?.setVisionDenoise, undefined);
  assert.equal(editorApi.sceneTools?.setVisionDenoiser, undefined);
  assert.equal(editorApi.sceneTools?.setVisionStablePlanes, undefined);
  assert.equal(host.requests.some(item => item.api.startsWith('SceneTools.set_')), false);
});

test('editor API calls pass structured values through the typed V8 binding', async () => {
  const { editorApi, host } = await loadEditorApi();
  const options = { load_policy: 'degraded' };
  await editorApi.project.openProject('C:/Projects/Kitchen/Kitchen.corona', options);

  const call = host.requests.find((request) => request.api === 'corona.project.openProject');
  assert.deepEqual(call.args, ['C:/Projects/Kitchen/Kitchen.corona', options]);
  assert.equal(host.cefQuery, undefined);
});

// Runs `body` with a short transport wait so timeout behaviour is exercised without
// making the suite wait for the production 30s limit.
async function withShortTimeout(limits, body) {
  const original = limits.responseTimeoutMs;
  limits.responseTimeoutMs = 20;
  try {
    return await body();
  } finally {
    limits.responseTimeoutMs = original;
  }
}

test('LANChat direct subscription needs no manifest and releases its native callback', async () => {
  const { editorApi, host } = await loadEditorApi();
  const seen = [];
  assert.equal(editorApi.events.onLanChatEvent, undefined);
  const stop = editorApi.lanChat.onEvent(payload => seen.push(payload));
  host.emit(42, { n: 1 });
  assert.deepEqual(seen, [{ n: 1 }]);
  stop(); stop();
  host.emit(42, { n: 2 });
  assert.deepEqual(seen, [{ n: 1 }]);
  assert.deepEqual(host.requests, [{ api: 'corona.lanChat.onEvent' }]);
});

test('a request with no native reply must fail with a diagnosable timeout', async () => {
  const { editorApi, host, limits } = await loadEditorApi();

  await withShortTimeout(limits, async () => {
    host.hangFor.add('EditorApi.list_methods');

    await assert.rejects(
      () => editorApi.listMethods(),
      (error) => {
        assert.equal(error.code, 'EDITOR_API_TIMEOUT');
        assert.match(error.message, /EditorApi\.list_methods/);
        // The native side may still be working; the message must not claim it was cancelled.
        assert.match(error.message, /may still be in progress/i);
        return true;
      }
    );
  });
});

test('a reply that arrives within the limit must still resolve', async () => {
  const { editorApi, limits } = await loadEditorApi();

  await withShortTimeout(limits, async () => {
    const response = await editorApi.listMethods();
    assert.ok(response, 'a prompt native reply must resolve normally');
  });
});

test('a late native reply after a timeout must be ignored', async () => {
  const { editorApi, host, limits } = await loadEditorApi();

  await withShortTimeout(limits, async () => {
    host.hangFor.add('EditorApi.list_methods');
    await assert.rejects(() => editorApi.listMethods());

    // The native handler finally answers. This must neither throw nor try to settle twice.
    const late = host.pending.get('EditorApi.list_methods');
    assert.ok(late, 'the fake host must have captured the hung request');
    assert.doesNotThrow(() => late.resolve({ status: 'success', data: { methods: MANIFEST_METHODS } }));
  });
});

const PICKER_CASES = [
  {
    api: 'corona.project.openProjectFile',
    invoke: (editorApi) => editorApi.project.openProjectFile(),
    selected: { name: 'Kitchen', path: 'C:/Projects/Kitchen/Kitchen.corona' },
    canceled: {},
  },
];

for (const picker of PICKER_CASES) {
  for (const result of ['selected', 'canceled']) {
    test(`${picker.api} accepts a ${result} result after the ordinary RPC deadline`, async () => {
      const { editorApi, host, limits } = await loadEditorApi();

      await withShortTimeout(limits, async () => {
        host.hangFor.add(picker.api);
        // Observe rejection immediately so the old timeout produces an assertion failure,
        // not an unhandled rejection before the simulated user finishes the dialog.
        const outcome = picker.invoke(editorApi).then(
          (value) => ({ value }), (error) => ({ error }),
        );
        await new Promise((resolve) => setTimeout(resolve, 60));

        const response = picker[result];
        host.pending.get(picker.api).resolve(response);
        const actual = await outcome;
        assert.ifError(actual.error);
        assert.deepEqual(actual.value, response);
        assert.deepEqual(host.requests, [{ api: picker.api, args: [] }]);
      });
    });
  }
}

test('a picker still rejects a native error after waiting past the ordinary RPC deadline', async () => {
  const { editorApi, host, limits } = await loadEditorApi();

  await withShortTimeout(limits, async () => {
    host.hangFor.add('corona.project.openProjectFile');
    const outcome = editorApi.project.openProjectFile().then(
      (value) => ({ value }), (error) => ({ error }),
    );
    await new Promise((resolve) => setTimeout(resolve, 60));

    host.pending.get('corona.project.openProjectFile').reject(
      Object.assign(new Error('dialog unavailable'), { code: '-2' }),
    );
    const actual = await outcome;
    assert.match(actual.error.message, /dialog unavailable/);
  });
});

test('a native project open remains pending past the ordinary manifest deadline', async () => {
  const { editorApi, host, limits } = await loadEditorApi();
  await withShortTimeout(limits, async () => {
    host.hangFor.add('corona.project.openProject');
    const outcome = editorApi.project.openProject('C:/Projects/World', { load_policy: 'degraded' })
      .then(value => ({ value }), error => ({ error }));
    await new Promise(resolve => setTimeout(resolve, 60));
    const reply = { ok: false, status: 'decision_required', diagnostics: [{ code: 'RESOURCE_NOT_FOUND' }] };
    host.pending.get('corona.project.openProject').resolve(reply);
    const actual = await outcome;
    assert.ifError(actual.error);
    assert.equal(actual.value, reply);
    assert.deepEqual(host.requests, [{ api: 'corona.project.openProject',
      args: ['C:/Projects/World', { load_policy: 'degraded' }] }]);
  });
});

// Characterization tests for wrapper -> manifest resolution. These pin behaviour so the
// lookup can be refactored (reverse map instead of a linear scan per call) without risk.
test('camera render settings use one scoped V8 patch and expose no legacy Web setters', async () => {
  const { editorApi, host } = await loadEditorApi();

  await editorApi.scene.readCameraRenderSettings('SceneA', 'camera-a', { archive_session: 'archive-a', family: 'restir' });

  const sent = host.requests.find((entry) => entry.api === 'corona.scene.readCameraRenderSettings');
  assert.ok(
    sent,
    `typed binding must reach native, saw: ${host.requests.map((r) => r.api).join(', ')}`
  );
  assert.deepEqual(sent.args, ['SceneA', 'camera-a', { archive_session: 'archive-a', family: 'restir' }]);
});

test('ReSTIR settings preserve the camera binding and nested settings through V8', async () => {
  const { editorApi, host } = await loadEditorApi();
  const settings = { direct: { temporal: { open: false, radius: 8 } }, indirect: { open: true } };
  await editorApi.scene.readCameraRenderSettings('SceneA', 'camera-b', { archive_session: 'archive-a', family: 'restir' });
  await editorApi.scene.setCameraRenderSettings('SceneA', 'camera-b', { family: 'restir', settings, archive_session: 'archive-a' });
  const calls = host.requests.filter(entry => entry.api.includes('CameraRenderSettings'));
  assert.deepEqual(calls.map(({ api, args }) => ({ api, args })), [
    { api: 'corona.scene.readCameraRenderSettings', args: ['SceneA', 'camera-b', { archive_session: 'archive-a', family: 'restir' }] },
    { api: 'corona.scene.setCameraRenderSettings', args: ['SceneA', 'camera-b', { family: 'restir', settings, archive_session: 'archive-a' }] },
  ]);
});

test('an unknown wrapper path is rejected instead of being sent to native', async () => {
  const { editorApi, host } = await loadEditorApi();

  assert.equal(editorApi.notARealNamespace, undefined);

  assert.equal(
    host.requests.some((entry) => entry.api === 'notARealNamespace.notARealMethod'),
    false,
    'an unresolvable wrapper must never reach native'
  );
});

test('explicit namespaces resolve declared methods and do not expose unknown members', async () => {
  const { editorApi, host } = await loadEditorApi();
  assert.equal(editorApi.sceneTools?.getModelNodes, undefined);
  assert.equal(typeof editorApi.scene.readCameraRenderSettings, 'function');
  assert.equal(typeof editorApi.sceneTools?.getRestirSettings, 'undefined');
  assert.equal(typeof editorApi.sceneTools?.setRestirSettings, 'undefined');
  assert.equal(editorApi.sceneTools?.then, undefined);

  const before = host.requests.filter(entry => !entry.api.startsWith('EditorApi.')).length;
  assert.equal(editorApi.sceneTools?.notARealMethod, undefined);
  assert.equal(Object.hasOwn(editorApi.sceneTools || {}, 'getFrameTiming'), false);
  assert.equal(editorApi.sceneTools?.getFrameTiming, undefined);
  assert.equal(host.requests.filter(entry => !entry.api.startsWith('EditorApi.')).length, before);
});

import {
  flattenLoadedNodes,
  MODEL_NODE_DISPLAY_MAX_SKIP,
  resolveModelNodeDisplayParent,
  virtualNodeWindow,
} from '../../src/utils/modelHierarchy.js';

test('loaded model nodes flatten only expanded branches and cap the render window', () => {
  const pages = {
    '-1': { items: [{ node_index: 0, name: 'root', child_count: 2 }] },
    '0': { items: [{ node_index: 1, name: 'a', child_count: 0 }, { node_index: 2, name: 'b', child_count: 0 }] },
  };
  const rows = flattenLoadedNodes(pages, new Set([0]));
  assert.deepEqual(rows.map((row) => [row.node.node_index, row.depth]), [[0, 0], [1, 1], [2, 1]]);

  const window = virtualNodeWindow(rows, 28, 28, 28, 1);
  assert.equal(window.start, 0);
  assert.equal(window.end, 3);
  assert.equal(window.topSpacer, 0);
  assert.equal(window.bottomSpacer, 0);
});

test('collapsed nodes do not contribute descendant rows', () => {
  const pages = {
    '-1': { items: [{ node_index: 0, name: 'root', child_count: 1 }] },
    '0': { items: [{ node_index: 1, name: 'child', child_count: 0 }] },
  };
  assert.deepEqual(flattenLoadedNodes(pages, new Set()).map((row) => row.node.node_index), [0]);
});

test('a lone synthetic root is skipped so nodes hang directly under the actor', () => {
  assert.equal(
    resolveModelNodeDisplayParent({ items: [{ node_index: 0, name: 'root', child_count: 12 }] }),
    0,
  );
  assert.equal(
    resolveModelNodeDisplayParent({ items: [{ node_index: 7, name: 'Scene', child_count: 3 }] }, 1),
    7,
  );
});

test('a single root that carries content of its own is kept', () => {
  assert.equal(
    resolveModelNodeDisplayParent({ items: [{ node_index: 0, name: 'temple', child_count: 0 }] }),
    -1,
  );
  assert.equal(resolveModelNodeDisplayParent({ items: [] }), -1);
});

test('several roots are real content, not a container to skip', () => {
  assert.equal(
    resolveModelNodeDisplayParent({
      items: [{ node_index: 0, child_count: 2 }, { node_index: 1, child_count: 0 }],
    }),
    -1,
  );
});

test('the synthetic root skip is bounded instead of walking away', () => {
  const page = { items: [{ node_index: 5, child_count: 9 }] };
  assert.equal(resolveModelNodeDisplayParent(page, MODEL_NODE_DISPLAY_MAX_SKIP), -1);
});

test('the flattened tree can start at the displayed parent instead of the roots', () => {
  const pages = {
    '-1': { items: [{ node_index: 0, name: 'root', child_count: 1 }] },
    '0': { items: [{ node_index: 1, name: 'a', child_count: 1 }] },
    '1': { items: [{ node_index: 2, name: 'b', child_count: 0 }] },
  };
  const rows = flattenLoadedNodes(pages, new Set([1]), '0');
  assert.deepEqual(rows.map((row) => [row.node.node_index, row.depth]), [[1, 0], [2, 1]]);
});
