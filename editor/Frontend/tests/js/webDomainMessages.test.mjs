import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { getWebMessages } from '../../src/api/webMessages.js';
import { memoryStorage } from './windowSessionFixtures.mjs';

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
