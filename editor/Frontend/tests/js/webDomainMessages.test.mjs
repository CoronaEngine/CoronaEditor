import { reactive } from 'vue';
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { createWebMessages, getWebMessages } from '../../src/api/webMessages.js';
import { memoryStorage } from './windowSessionFixtures.mjs';
import { createPinia } from 'pinia';
import { useCabbageAssistantStore } from '../../src/stores/cabbageAssistantStore.js';
import { worldModeState } from '../../src/services/worldModeService.js';

registerHooks({
  resolve(specifier, context, next) {
    return next(specifier.startsWith('@/') ? new URL(`../../src/${specifier.slice(2)}`, import.meta.url).href : specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('?raw')) return { format: 'module', shortCircuit: true,
      source: `export default ${JSON.stringify(readFileSync(new URL(url.slice(0, -4)), 'utf8'))}` };
    return next(url, context);
  },
});

function surfaces(t) {
  const previous = globalThis.window;
  const scope = crypto.randomUUID();
  const main = Object.assign(new EventTarget(), { sessionStorage: memoryStorage(), localStorage: memoryStorage(), location: { hash: '#/' } });
  main.sessionStorage.setItem('corona.editorUi.owner', scope);
  const dock = Object.assign(new EventTarget(), { sessionStorage: memoryStorage(), localStorage: main.localStorage,
    location: { hash: `#/NodeGraph?standalone=1&uiOwner=${scope}&uiWindow=graph` } });
  const mainMessages = getWebMessages(main), dockMessages = getWebMessages(dock);
  t.after(() => { mainMessages.dispose(); dockMessages.dispose(); globalThis.window = previous; });
  return { main, dock, mainMessages, dockMessages };
}

test('mounted node Dock exposes snapshot and apply through the common Web handler directory', async t => {
  const { dock, mainMessages } = surfaces(t);
  globalThis.window = dock;
  const graph = await import(`../../src/blockly/node-editor/aiNodeGraphService.js?owner=${crypto.randomUUID()}`);
  const workspace = { version: 1, globalVariablesWorkspace: {}, nodes: [{ id: 'start', nodeType: 'start', x: 0, y: 0, workspace: {} }], edges: [] };
  let calls = 0;
  t.after(graph.registerGeneratedNodeGraphConsumer({ getSnapshot: () => ({ workspace }),
    handler: () => { calls++; return { success: true }; } }));
  assert.deepEqual(await mainMessages.requestHandler('nodeGraph.snapshot', {}), { workspace });
  const result = { schemaVersion: 1, targetId: 'node_graph:project:global', workspace };
  assert.deepEqual(await mainMessages.requestHandler('nodeGraph.apply', result), { success: true });
  assert.equal(calls, 1);
});

test('tutorial restoration uses a single directed Web request with no native or private channel', async t => {
  const { dock, mainMessages } = surfaces(t);
  globalThis.window = dock;
  const tutorial = await import(`../../src/services/cabbageTutorialSessionService.js?owner=${crypto.randomUUID()}`);
  const stop = tutorial.registerTutorialRestorer('graph', payload => ({ success: true, bytes: payload.bytes }));
  t.after(() => { stop(); tutorial.closeTutorialSessionChannel(); });
  const result = await mainMessages.requestHandler('tutorial.restore:graph', { bytes: new Uint8Array([7, 255]) });
  assert.deepEqual(result, { success: true, bytes: new Uint8Array([7, 255]) });
});

test('Cabbage transient warnings use the common Web topic and stay out of storage', async t => {
  const { dock, mainMessages } = surfaces(t);
  globalThis.window = dock;
  const context = await import(`../../src/services/cabbageAssistantContextService.js?owner=${crypto.randomUUID()}`);
  const warnings = [];
  t.after(context.subscribeCabbagePreWarnings(value => warnings.push(value)));
  await mainMessages.emit('cabbage-pre-warning', { projectScopeId: 'scope', worldId: 'world',
    warning: { code: 'repeat', graphRevision: 'r1' } });
  for (let i = 0; i < 30 && !warnings.length; i++) await delay(5);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].code, 'repeat');
  assert.equal(dock.localStorage.length, 0);
});

test('assistant context uses the main document as owner without storage fallback', async t => {
  const { main, dock } = surfaces(t);
  let peerStorageWrites = 0;
  main.localStorage = { getItem() { throw new Error('storage disabled'); }, setItem() { throw new Error('storage disabled'); } };
  dock.localStorage = { getItem() { throw new Error('storage disabled'); }, setItem() { peerStorageWrites++; throw new Error('storage disabled'); } };
  globalThis.window = main;
  const owner = await import(`../../src/services/cabbageAssistantContextService.js?context-owner=${crypto.randomUUID()}`);
  const ownerSnapshots = [];
  const projectScopeId = '811c9dc5';
  t.after(owner.subscribeCabbageAssistantContext(value => ownerSnapshots.push(value), { projectScopeId }));
  owner.publishCabbageAssistantContext({ projectScopeId, worldId: 'world', activeTasks: [{ taskKey: 'owner-task' }] });

  globalThis.window = dock;
  const peer = await import(`../../src/services/cabbageAssistantContextService.js?context-peer=${crypto.randomUUID()}`);
  const peerSnapshots = [];
  t.after(peer.subscribeCabbageAssistantContext(value => peerSnapshots.push(value), { projectScopeId }));
  for (let i = 0; i < 40 && !peerSnapshots.length; i++) await delay(5);
  assert.equal(peerSnapshots.at(-1)?.activeTasks[0]?.taskKey, 'owner-task');
  peer.publishCabbageAssistantContext({ projectScopeId, worldId: 'world', activeTasks: [{ taskKey: 'peer-task' }] });
  for (let i = 0; i < 40 && ownerSnapshots.at(-1)?.activeTasks[0]?.taskKey !== 'peer-task'; i++) await delay(5);
  assert.equal(ownerSnapshots.at(-1)?.activeTasks[0]?.taskKey, 'peer-task');
  assert.equal(peerSnapshots.at(-1)?.activeTasks[0]?.taskKey, 'peer-task');
  assert.equal(peerStorageWrites, 0);
});

test('assistant subscription retirement rejects an in-flight initial snapshot', async t => {
  const { dock, mainMessages, dockMessages } = surfaces(t);
  const projectScopeId = 'retired-scope';
  let release;
  let entered;
  const blocked = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  t.after(release);
  t.after(mainMessages.handle('cabbage-assistant-context.read', async () => {
    entered();
    await blocked;
    return { projectScopeId, updatedAt: 100, activeTasks: [{ taskKey: 'retired-task' }] };
  }));
  globalThis.window = dock;
  const context = await import(`../../src/services/cabbageAssistantContextService.js?retirement=${crypto.randomUUID()}`);
  const received = [];
  const stop = context.subscribeCabbageAssistantContext(value => received.push(value), { projectScopeId });
  t.after(stop);
  await Promise.race([started, delay(1000).then(() => assert.fail('initial read did not reach the owner'))]);
  stop();
  stop();
  release();
  // A second reply on the same channel drains the earlier initialization reply.
  await dockMessages.request('main', 'cabbage-assistant-context.read', { projectScopeId });
  assert.deepEqual(received, []);
  assert.equal(context.readCabbageAssistantContext(projectScopeId), null);
});

async function contextBarrier(t, sender, receiver, snapshot) {
  const topic = `context-barrier-${crypto.randomUUID()}`;
  const arrived = new Promise(resolve => t.after(receiver.on(topic, resolve)));
  if (snapshot) await sender.emit('cabbage-assistant-context', snapshot);
  await sender.emit(topic, true);
  await Promise.race([arrived, delay(1000).then(() => assert.fail('context channel barrier timed out'))]);
}

test('persisted assistant context is accepted after a fresh startup snapshot', async t => {
  const { main } = surfaces(t);
  globalThis.window = main;
  const previous = { ...worldModeState };
  Object.assign(worldModeState, { activeProjectPath: 'D:/worlds/World', revision: 1 });
  t.after(() => Object.assign(worldModeState, previous));
  const context = await import(`../../src/services/cabbageAssistantContextService.js?startup-clock=${crypto.randomUUID()}`);
  const { aiService } = await import('../../src/services/aiService.js');
  const persisted = { worldId: 'World', updatedAt: 1, activeTasks: [
    { taskKey: 'saved-task', title: 'Persisted task', status: 'active', type: 'goal' },
  ] };
  t.mock.method(aiService, 'loadCabbageContext', async () => ({ success: true, context: persisted }));
  const store = useCabbageAssistantStore(createPinia());
  t.after(context.subscribeCabbageAssistantContext(snapshot => store.hydrateContext(snapshot)));
  const startup = context.publishCabbageAssistantContext({ worldId: 'World', activeTasks: [] });
  const loaded = await context.loadCurrentWorld();
  assert.equal(store.activeTasks[0]?.taskKey, 'saved-task', 'fresh UI startup cannot suppress the persisted world context');
  assert.ok(loaded.updatedAt > startup.updatedAt, 'publication clock advances independently of stored business time');
  assert.equal(persisted.updatedAt, 1, 'reading must not mutate the persisted context');
});

test('world load retains live graph context and valid selection while replacing saved tasks', async t => {
  const { main } = surfaces(t);
  globalThis.window = main;
  const previous = { ...worldModeState };
  Object.assign(worldModeState, { activeProjectPath: 'D:/worlds/World', revision: 1 });
  t.after(() => Object.assign(worldModeState, previous));
  const context = await import(`../../src/services/cabbageAssistantContextService.js?startup-metadata=${crypto.randomUUID()}`);
  const { aiService } = await import('../../src/services/aiService.js');
  const task = { taskKey: 'saved-task', title: 'Previous task', status: 'active', type: 'goal' };
  context.publishCabbageAssistantContext({ worldId: 'World', activeTasks: [task], selectedTaskKey: task.taskKey,
    graphRevision: 'unsaved-graph', graphExcerpt: { nodes: ['start'] }, projectContext: { actor: 'Probe' } });
  t.mock.method(aiService, 'loadCabbageContext', async () => ({ success: true,
    context: { worldId: 'World', updatedAt: 1, activeTasks: [{ ...task, title: 'Loaded task' }] } }));
  const snapshot = await context.loadCurrentWorld();
  assert.equal(snapshot.activeTasks[0].title, 'Loaded task');
  assert.equal(snapshot.selectedTaskKey, task.taskKey);
  assert.equal(snapshot.graphRevision, 'unsaved-graph');
  assert.deepEqual(snapshot.graphExcerpt, { nodes: ['start'] });
  assert.deepEqual(snapshot.projectContext, { actor: 'Probe' });
});

test('a delayed backend load cannot replace a newer backend context', async t => {
  const { main } = surfaces(t);
  globalThis.window = main;
  const previous = { ...worldModeState };
  Object.assign(worldModeState, { activeProjectPath: 'D:/worlds/World', revision: 1 });
  t.after(() => Object.assign(worldModeState, previous));
  const context = await import(`../../src/services/cabbageAssistantContextService.js?backend-order=${crypto.randomUUID()}`);
  const { aiService } = await import('../../src/services/aiService.js');
  let release;
  let calls = 0;
  const old = new Promise(resolve => { release = resolve; });
  t.mock.method(aiService, 'loadCabbageContext', () => ++calls === 1 ? old : Promise.resolve({ success: true,
    context: { worldId: 'World', updatedAt: 200, activeTasks: [{ taskKey: 'new-task', type: 'goal', status: 'active' }] } }));
  const store = useCabbageAssistantStore(createPinia());
  t.after(context.subscribeCabbageAssistantContext(snapshot => store.hydrateContext(snapshot)));
  const pending = context.loadCurrentWorld();
  await context.loadCurrentWorld();
  release({ success: true, context: { worldId: 'World', updatedAt: 100,
    activeTasks: [{ taskKey: 'old-task', type: 'goal', status: 'active' }] } });
  const settled = await pending;
  assert.equal(store.activeTasks[0].taskKey, 'new-task');
  assert.equal(settled.activeTasks[0].taskKey, 'new-task');
  assert.equal(context.readCabbageAssistantContext().activeTasks[0].taskKey, 'new-task');
});

test('reopening the same project resets backend ordering and rejects the previous session load', async t => {
  const { main } = surfaces(t);
  globalThis.window = main;
  const previous = { ...worldModeState };
  Object.assign(worldModeState, { activeProjectPath: 'D:/worlds/World', revision: 1 });
  t.after(() => Object.assign(worldModeState, previous));
  const context = await import(`../../src/services/cabbageAssistantContextService.js?backend-session=${crypto.randomUUID()}`);
  const { aiService } = await import('../../src/services/aiService.js');
  const response = (taskKey, updatedAt) => ({ success: true, context: { worldId: 'World', updatedAt,
    activeTasks: [{ taskKey, type: 'goal', status: 'active' }] } });
  let release;
  let calls = 0;
  const previousLoad = new Promise(resolve => { release = resolve; });
  t.mock.method(aiService, 'loadCabbageContext', () => {
    calls++;
    return calls === 1 ? Promise.resolve(response('previous', 200))
      : calls === 2 ? previousLoad : Promise.resolve(response('reopened', 100));
  });
  await context.loadCurrentWorld();
  const retired = context.loadCurrentWorld();
  worldModeState.revision++;
  const reopened = await context.loadCurrentWorld();
  assert.equal(reopened.activeTasks[0].taskKey, 'reopened');
  release(response('retired', 300));
  assert.equal(await retired, null);
  assert.equal(context.readCabbageAssistantContext().activeTasks[0].taskKey, 'reopened');
});

test('assistant preserves reactive task fields and nested context in published DTOs', async t => {
  const { dock, mainMessages, dockMessages } = surfaces(t);
  globalThis.window = dock;
  const context = await import(`../../src/services/cabbageAssistantContextService.js?reactive=${crypto.randomUUID()}`);
  const source = reactive({ projectScopeId: 'world', selectedTaskKey: 'task',
    activeTasks: [{ taskKey: 'task', type: 'tutorial', status: 'active', title: 'Task title',
      details: { bytes: new Uint8Array([7, 255]) } }],
    projectContext: { selection: reactive({ actor: 'Probe' }) },
    chatMessages: [{ id: 'message', content: 'Keep this text', role: 'user' }],
  });
  const received = [];
  t.after(mainMessages.on('cabbage-assistant-context', value => received.push(value)));
  const snapshot = context.publishCabbageAssistantContext(source);
  assert.equal(snapshot.activeTasks[0].type, 'tutorial');
  assert.equal(snapshot.activeTasks[0].status, 'active');
  assert.equal(snapshot.activeTasks[0].title, 'Task title');
  assert.deepEqual(snapshot.activeTasks[0].details.bytes, new Uint8Array([7, 255]));
  assert.deepEqual(snapshot.projectContext, { selection: { actor: 'Probe' } });
  assert.equal(snapshot.chatMessages[0].content, 'Keep this text');
  source.activeTasks[0].title = 'Changed after publication';
  await contextBarrier(t, dockMessages, mainMessages);
  assert.equal(received[0].activeTasks[0].title, 'Task title');
});

test('assistant timestamps are scoped to the current project', async t => {
  const { dock, mainMessages, dockMessages } = surfaces(t);
  globalThis.window = dock;
  const context = await import(`../../src/services/cabbageAssistantContextService.js?project-clock=${crypto.randomUUID()}`);
  let scope = 'first';
  const received = [];
  t.after(context.subscribeCabbageAssistantContext(value => received.push(value), {
    projectScopeId: () => scope, emitCurrent: false,
  }));
  await contextBarrier(t, mainMessages, dockMessages, { projectScopeId: scope, updatedAt: 200, activeTasks: [{ taskKey: 'first' }] });
  scope = 'second';
  await contextBarrier(t, mainMessages, dockMessages, { projectScopeId: scope, updatedAt: 100, activeTasks: [{ taskKey: 'second' }] });
  await contextBarrier(t, mainMessages, dockMessages, { projectScopeId: 'first', updatedAt: 300, activeTasks: [{ taskKey: 'wrong-world' }] });
  await contextBarrier(t, mainMessages, dockMessages, { projectScopeId: scope, updatedAt: 90, activeTasks: [{ taskKey: 'stale-second' }] });
  assert.deepEqual(received.map(value => value.activeTasks[0].taskKey), ['first', 'second']);
  assert.equal(context.readCabbageAssistantContext(scope)?.activeTasks[0]?.taskKey, 'second');
});

test('assistant accepts a replacement owner without inheriting its predecessor clock', async t => {
  const { main, dock, mainMessages, dockMessages } = surfaces(t);
  globalThis.window = dock;
  const context = await import(`../../src/services/cabbageAssistantContextService.js?owner-clock=${crypto.randomUUID()}`);
  const received = [];
  const store = useCabbageAssistantStore(createPinia());
  t.after(context.subscribeCabbageAssistantContext((value, origin) => {
    received.push(value);
    store.hydrateContext(value, origin);
  }, { projectScopeId: 'world', emitCurrent: false }));
  await contextBarrier(t, mainMessages, dockMessages, { projectScopeId: 'world', updatedAt: 200, activeTasks: [{ taskKey: 'old-owner' }] });
  const replacement = createWebMessages({ scope: main.sessionStorage.getItem('corona.editorUi.owner'), role: 'main' });
  t.after(() => replacement.dispose());
  await contextBarrier(t, replacement, dockMessages, { projectScopeId: 'world', updatedAt: 100, activeTasks: [{ taskKey: 'new-owner' }] });
  await mainMessages.emit('cabbage-assistant-context', { projectScopeId: 'world', updatedAt: 900, activeTasks: [{ taskKey: 'retired-owner' }] });
  await contextBarrier(t, replacement, dockMessages);
  assert.deepEqual(received.map(value => value.activeTasks[0].taskKey), ['old-owner', 'new-owner']);
  assert.equal(store.activeTasks[0].taskKey, 'new-owner', 'the actual consumer must accept the new owner clock');
  assert.equal(store.contextUpdatedAt, 100);
});

test('remounted assistant queries the replacement owner instead of hydrating retired cache', async t => {
  const { main, dock, mainMessages, dockMessages } = surfaces(t);
  globalThis.window = dock;
  const context = await import(`../../src/services/cabbageAssistantContextService.js?owner-cache=${crypto.randomUUID()}`);
  const stop = context.subscribeCabbageAssistantContext(() => {}, { projectScopeId: 'world', emitCurrent: false });
  t.after(stop);
  await contextBarrier(t, mainMessages, dockMessages, { projectScopeId: 'world', updatedAt: 200, activeTasks: [{ taskKey: 'old-owner' }] });
  stop();
  const replacement = createWebMessages({ scope: main.sessionStorage.getItem('corona.editorUi.owner'), role: 'main' });
  t.after(() => replacement.dispose());
  replacement.handle('cabbage-assistant-context.read', () => ({
    projectScopeId: 'world', updatedAt: 100, activeTasks: [{ taskKey: 'new-owner' }],
  }));
  await contextBarrier(t, replacement, dockMessages);
  assert.equal(context.readCabbageAssistantContext('world'), null, 'retired owner cache cannot seed a remount');
  const received = [];
  t.after(context.subscribeCabbageAssistantContext(value => received.push(value), { projectScopeId: 'world' }));
  await dockMessages.request('main', 'cabbage-assistant-context.read', { projectScopeId: 'world' });
  assert.deepEqual(received.map(value => value.activeTasks[0].taskKey), ['new-owner']);
});

test('node graph review reaches the shared topic without losing typed data', async t => {
  const { dock, mainMessages } = surfaces(t);
  globalThis.window = dock;
  const review = await import(`../../src/services/nodeGraphReviewService.js?owner=${crypto.randomUUID()}`);
  const received = [];
  t.after(mainMessages.on('node-graph-review-result', payload => received.push(payload)));
  review.publishNodeGraphReview({ issues: [], bytes: new Uint8Array([9]) });
  for (let i = 0; i < 30 && !received.length; i++) await delay(5);
  assert.equal(received.length, 1);
  assert.deepEqual(received[0].bytes, new Uint8Array([9]));
});


test('node graph review snapshots nested Vue proxies without changing live graph state', async () => {
  const review = await import('../../src/services/nodeGraphReviewService.js');
  const graph = reactive({ nodes: [{ id: 'a', x: 40, blocks: { selected: true, type: 'start' } }], edges: [] });
  const workspace = { version: 1, nodes: graph.nodes, edges: graph.edges };
  const expected = { version: 1, nodes: [{ id: 'a', blocks: { type: 'start' } }], edges: [] };
  assert.equal(review.graphRevision(workspace, 'world'), review.graphRevision(expected, 'world'));
  assert.equal(graph.nodes[0].x, 40);
  assert.equal(graph.nodes[0].blocks.selected, true);
  graph.nodes[0].blocks.type = 'end';
  assert.notEqual(review.graphRevision(workspace, 'world'), review.graphRevision(expected, 'world'));
});
