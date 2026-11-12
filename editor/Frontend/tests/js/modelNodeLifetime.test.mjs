import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { computed, reactive, ref } from 'vue';
import { compileScript, parse } from 'vue/compiler-sfc';
import * as hierarchy from '../../src/utils/modelHierarchy.js';
import { createViewLifetime } from '../../src/utils/viewLifetime.js';
import { deferred } from './windowSessionFixtures.mjs';

const { descriptor } = parse(fs.readFileSync(new URL('../../src/components/ui/ModelNodeHierarchy.vue', import.meta.url), 'utf8'));
const compiled = compileScript(descriptor, { id: 'model-node-lifetime' }).content
  .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?\r?$/gm, '').replace('export default', 'return');
const node = { node_index: 0, parent_index: -1, child_count: 0, visible: true, position: [0, 0, 0] };

function mount(t, overrides = {}) {
  const calls = [], events = [], observers = [];
  let mounted, unmounted;
  const props = reactive({ active: true, sceneName: 'scene.ini',
    actor: { name: 'Model', actor_guid: 'guid', archive_session: 'archive', actor_version: 1 }, selection: {} });
  class Observer {
    constructor(receive) { this.receive = receive; this.closed = false; observers.push(this); }
    observe() {}
    disconnect() { this.closed = true; }
  }
  const component = new Function('computed', 'nextTick', 'onMounted', 'onUnmounted', 'ref', 'watch', 'editorApi',
    'flattenLoadedNodes', 'MODEL_NODE_DISPLAY_MAX_SKIP', 'resolveModelNodeDisplayParent', 'virtualNodeWindow',
    'createViewLifetime', 'ResizeObserver', compiled)(computed, overrides.nextTick || (() => Promise.resolve()),
    fn => { mounted = fn; }, fn => { unmounted = fn; }, ref,
    (_, receive, options) => { if (options?.immediate) receive(); },
    { scene: { readModelNodes: async (...args) => { calls.push({ read: args }); return overrides.read
      ? overrides.read(...args) : { nodes: [node], actor_version: 2 }; },
    setModelNodeState: async (...args) => { calls.push({ write: args }); return overrides.write
      ? overrides.write(...args) : { nodes: [{ ...node, ...args[1] }], actor_version: args[0].expected_actor_version + 1 }; } } },
    hierarchy.flattenLoadedNodes, hierarchy.MODEL_NODE_DISPLAY_MAX_SKIP, hierarchy.resolveModelNodeDisplayParent,
    hierarchy.virtualNodeWindow, createViewLifetime, Observer);
  const state = component.setup(props, { expose() {}, emit: (...args) => events.push(args) });
  t.after(() => unmounted());
  return { state, props, calls, events, observers, dispose: () => unmounted(), start: () => mounted() };
}

test('a page reply older than the applied edit cannot undo it', async t => {
  const page = mount(t, { read: async () => ({ nodes: [node], actor_version: 2 }) });
  await page.state.loadPage(-1);
  const data = await page.state.persistNodePatch(node, { visible: false });
  page.state.applyNode(data.nodes[0]);
  // A reply that predates the edit arrives late: the confirmed row wins.
  await page.state.loadPage(-1);
  assert.equal(page.state.pages.value['-1'].items[0].visible, false,
    'the stale reply must be merged with the confirmed edit, not replace it');
});

test('an unchanged node keeps its object identity across page replies', async t => {
  const page = mount(t, { read: async () => ({ nodes: [node], actor_version: 2 }) });
  await page.state.loadPage(-1);
  const first = page.state.pages.value['-1'].items[0];
  await page.state.loadPage(-1);
  assert.equal(page.state.pages.value['-1'].items[0], first,
    'a read that changed nothing must not rebuild the row');
});

test('an overlapping later page is merged by node index', async t => {
  const second = { ...node, node_index: 1, name: 'second' };
  let reads = 0;
  const page = mount(t, { read: async (_, request) => (reads++ === 0
    ? { nodes: [node], actor_version: 2, has_more: true, next_offset: 1 }
    : { nodes: request.offset === 1 ? [second] : [node, second], actor_version: 2 }) });
  await page.state.loadPage(-1);
  await page.state.loadPage(-1, 1);
  assert.deepEqual(page.state.pages.value['-1'].items.map(item => item.node_index), [0, 1]);
});

test('a page reply that drops a node removes it', async t => {
  let reads = 0;
  const page = mount(t, { read: async () => (reads++ === 0
    ? { nodes: [node], actor_version: 2 }
    : { nodes: [], actor_version: 2 }) });
  await page.state.loadPage(-1);
  await page.state.loadPage(-1);
  assert.deepEqual(page.state.pages.value['-1'].items, []);
});

test('a version conflict reloads the node page and retries once', async t => {
  let writes = 0;
  const page = mount(t, {
    read: async () => ({ nodes: [{ ...node, visible: false }], actor_version: 4 }),
    write: async (identity) => {
      writes += 1;
      if (writes === 1) throw Object.assign(new Error('Actor moved on'), { code: 'ACTOR_VERSION_CONFLICT' });
      assert.equal(identity.expected_actor_version, 4, 'the retry uses the reloaded version');
      return { nodes: [{ ...node, visible: true }], actor_version: 5 };
    },
  });
  await page.state.persistNodePatch(node, { visible: true });
  assert.equal(writes, 2);
  assert.equal(page.state.actorVersion.value, 5);
});

test('a non-conflict rejection is reported without a retry', async t => {
  let writes = 0;
  const page = mount(t, { write: async () => {
    writes += 1;
    throw Object.assign(new Error('read only'), { code: 'READ_ONLY' });
  } });
  await assert.rejects(page.state.persistNodePatch(node, { visible: false }), /read only/);
  assert.equal(writes, 1);
});

test('a page read in flight when a write lands cannot undo the patched row', async t => {
  let reads = 0;
  const pendingRead = deferred();
  const page = mount(t, {
    read: () => (++reads === 1
      ? Promise.resolve({ nodes: [node], actor_version: 2 })
      : pendingRead.promise),
    write: async (_, patch) => ({ nodes: [{ ...node, ...patch }], actor_version: 3 }),
  });
  await setImmediate();
  const refresh = page.state.loadMore('-1');
  const data = await page.state.persistNodePatch(node, { visible: false });
  page.state.applyNode(data.nodes[0]);
  pendingRead.resolve({ nodes: [node], actor_version: 2 });
  await refresh;
  assert.equal(page.state.pages.value['-1'].items[0].visible, false,
    'the read that started before the write is stale');
});

test('model node edit queued before retirement never reaches native state', async t => {
  const page = mount(t);
  const editing = page.state.persistNodePatch(node, { visible: false });
  page.dispose();
  await editing;
  assert.equal(page.calls.length, 0);
});

test('model node mutation chain retires its late reply and remaining edit', async t => {
  const pending = deferred();
  let writes = 0;
  const page = mount(t, { write: () => ++writes === 1 ? pending.promise : { actor_version: 3 } });
  const first = page.state.persistNodePatch(node, { visible: false });
  await setImmediate();
  const second = page.state.persistNodePatch(node, { visible: true });
  page.dispose(); pending.resolve({ actor_version: 2 });
  await Promise.all([first, second]);
  assert.equal(writes, 1);
  assert.equal(page.state.actorVersion.value, 1);
});

test('model node visibility completion after retirement cannot select or update old rows', async t => {
  const pending = deferred();
  const page = mount(t, { write: () => pending.promise });
  await page.state.loadPage(-1);
  const before = page.state.pages.value;
  const editing = page.state.toggleVisibility(node);
  await setImmediate(); page.dispose();
  pending.resolve({ actor_version: 8, nodes: [{ ...node, visible: false }] });
  await editing;
  assert.equal(page.state.pages.value, before);
  assert.equal(page.state.actorVersion.value, 2);
  assert.deepEqual(page.events, []);
});

test('model node reply for a replaced Actor cannot overwrite its current version', async t => {
  const pending = deferred();
  const page = mount(t, { write: () => pending.promise });
  const editing = page.state.persistNodePatch(node, { visible: false });
  await setImmediate();
  page.props.actor = { ...page.props.actor, actor_guid: 'replacement' };
  page.state.actorVersion.value = 50;
  pending.resolve({ actor_version: 8 });
  await editing;
  assert.equal(page.state.actorVersion.value, 50);
});

test('model node expansion cannot apply a retired page result', async t => {
  const pending = deferred();
  const page = mount(t, { read: () => pending.promise });
  const expanding = page.state.toggleExpanded(node);
  page.dispose(); pending.resolve({ nodes: [], actor_version: 2 });
  await expanding;
  assert.equal(page.state.expanded.value.size, 0);
});

test('model node synthetic root traversal cannot finish after retirement', async t => {
  const pending = deferred();
  let reads = 0;
  const page = mount(t, { read: () => ++reads === 1 ? { nodes: [{ ...node, child_count: 1 }], actor_version: 2 }
    : pending.promise });
  const loading = page.state.loadDisplayRoot();
  await setImmediate();
  assert.equal(reads, 2);
  page.dispose(); pending.resolve({ nodes: [], actor_version: 3 });
  await loading;
  assert.equal(page.state.displayRoot.value, -1);
});

test('model node observer callback ignores a retired and detached scroll element', async t => {
  const page = mount(t);
  page.state.scrollElement.value = { clientHeight: 600 };
  await page.start();
  const observer = page.observers[0];
  observer.receive();
  assert.equal(page.state.viewportHeight.value, 600);
  page.dispose(); page.state.scrollElement.value = null;
  observer.receive();
  assert.equal(observer.closed, true);
  assert.equal(page.state.viewportHeight.value, 600);
});

test('live model node edits remain serialized with successive native versions', async t => {
  const page = mount(t);
  await Promise.all([page.state.persistNodePatch(node, { visible: false }),
    page.state.persistNodePatch(node, { visible: true })]);
  assert.deepEqual(page.calls.map(call => call.write[0].expected_actor_version), [1, 2]);
  assert.equal(page.state.actorVersion.value, 3);
});

test('queued model node edit still rejects a replaced Actor', async t => {
  const pending = deferred();
  const page = mount(t, { write: () => pending.promise });
  const first = page.state.persistNodePatch(node, { visible: false });
  await setImmediate();
  const second = page.state.persistNodePatch(node, { visible: true });
  const rejected = assert.rejects(second, /inactive Actor/);
  page.props.actor = { ...page.props.actor, actor_guid: 'replacement' };
  pending.resolve({ actor_version: 2 });
  await Promise.all([first, rejected]);
  assert.equal(page.calls.length, 1);
});

test('live model node mutation queue recovers after a native rejection', async t => {
  let writes = 0;
  const page = mount(t, { write: () => {
    if (++writes === 1) throw new Error('version conflict');
    return { actor_version: 2 };
  } });
  await assert.rejects(page.state.persistNodePatch(node, { visible: false }), /version conflict/);
  await page.state.persistNodePatch(node, { visible: true });
  assert.deepEqual(page.calls.map(call => call.write[0].expected_actor_version), [1, 1]);
  assert.equal(page.state.actorVersion.value, 2);
});

test('live model node page can retry after a failed native read', async t => {
  let reads = 0;
  const page = mount(t, { read: () => {
    if (++reads === 1) throw new Error('read failed');
    return { nodes: [node], actor_version: 2 };
  } });
  assert.equal(await page.state.loadPage(-1), null);
  assert.equal(page.state.loading.value, false);
  assert.equal(page.state.pages.value['-1'].loading, false);
  assert.equal((await page.state.loadPage(-1)).items.length, 1);
});

test('model node mounted continuation cannot attach an observer after retirement', async t => {
  const pending = deferred();
  const page = mount(t, { nextTick: () => pending.promise });
  page.state.scrollElement.value = { clientHeight: 600 };
  const starting = page.start();
  page.dispose(); pending.resolve();
  await starting;
  assert.equal(page.observers.length, 0);
});
