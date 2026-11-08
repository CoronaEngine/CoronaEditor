import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { createPinia } from 'pinia';
import { reactive } from 'vue';
import { useCabbageAssistantStore } from '../../src/stores/cabbageAssistantStore.js';
import { applyEvent, normalizeContext } from '../../src/services/cabbageDomain.js';

registerHooks({
  load(url, context, next) {
    if (url.endsWith('?raw')) return {
      format: 'module', shortCircuit: true,
      source: 'export default ' + JSON.stringify(readFileSync(new URL(url.split('?')[0]), 'utf8')),
    };
    return next(url, context);
  },
});
const { compactProjectContext, normalizeGenerationRequest } = await import('../../src/services/aiGraphDomain.js');

function withoutJsonCopy(operation) {
  const stringify = JSON.stringify;
  JSON.stringify = () => { throw Error('DTO copies must not serialize through JSON'); };
  try { return operation(); } finally { JSON.stringify = stringify; }
}

test('assistant hydration copies reactive message context without JSON', () => {
  const store = useCabbageAssistantStore(createPinia());
  const snapshot = reactive({ projectScopeId: 'world', updatedAt: 100,
    graphExcerpt: { nodes: [{ id: 'first' }] },
    projectContext: { actors: [{ name: 'Probe', transform: { position: [1, 2, 3] } }] },
    metrics: { modelImports: 2 }, tutorialSession: { status: 'active', bindings: { modelActorId: 'probe' } },
  });
  assert.equal(withoutJsonCopy(() => store.hydrateContext(snapshot)), true);
  assert.deepEqual(store.graphExcerpt, snapshot.graphExcerpt);
  assert.deepEqual(store.projectContext, snapshot.projectContext);
  assert.equal(store.metrics.modelImports, 2);
  store.projectContext.actors[0].transform.position[0] = 9;
  store.graphExcerpt.nodes[0].id = 'changed';
  assert.equal(snapshot.projectContext.actors[0].transform.position[0], 1);
  assert.equal(snapshot.graphExcerpt.nodes[0].id, 'first');
});

test('assistant snapshot copy retains structured values and shared references', () => {
  const store = useCabbageAssistantStore(createPinia());
  const bytes = new Uint8Array([1, 2, 3]), details = { bytes, sameBytes: bytes, optional: undefined };
  store.hydrateContext({ projectScopeId: 'world', updatedAt: 100, projectContext: details });
  assert(store.projectContext.bytes instanceof Uint8Array);
  assert.equal(store.projectContext.bytes, store.projectContext.sameBytes);
  assert(Object.hasOwn(store.projectContext, 'optional'));
  store.projectContext.bytes[0] = 9;
  assert.equal(bytes[0], 1);
});

test('unsupported snapshot values retain the store fallback', () => {
  const store = useCabbageAssistantStore(createPinia());
  store.hydrateContext({ projectScopeId: 'world', updatedAt: 100,
    projectContext: { unsupported: () => {} } });
  assert.deepEqual(store.projectContext, {});
});

test('context normalization copies reactive context without JSON', () => {
  const raw = reactive({ metrics: { modelImports: 2 }, worldGoal: { status: 'ready', prompt: 'Build' } });
  const context = withoutJsonCopy(() => normalizeContext(raw, 'D:/world/Probe', 100));
  assert.equal(context.metrics.modelImports, 2);
  assert.equal(context.worldGoal.prompt, 'Build');
  context.worldGoal.prompt = 'Changed';
  assert.equal(raw.worldGoal.prompt, 'Build');
});

test('project context projection copies actor state without JSON', () => {
  const context = reactive({ assistanceProfile: { score: 2 }, actors: [{ name: 'Probe',
    transform: { position: [1, 2, 3] }, mesh: { positions: [0, 1] } }] });
  const compact = withoutJsonCopy(() => compactProjectContext(context));
  assert.deepEqual(compact.actors[0].transform.position, [1, 2, 3]);
  assert(!Object.hasOwn(compact.actors[0], 'mesh'));
  compact.actors[0].transform.position[0] = 9;
  assert.equal(context.actors[0].transform.position[0], 1);
});

test('generation request copies a reactive workspace without JSON', () => {
  const workspace = reactive({ nodes: [{ id: 'first', type: 'start' }], edges: [] });
  const request = withoutJsonCopy(() => normalizeGenerationRequest({
    requestId: 'request', projectScopeId: 'world', baseGraphRevision: 'rev',
    instruction: 'Build', workspace, projectContext: {},
  }));
  assert.deepEqual(request.workspace.nodes, [{ id: 'first', type: 'start' }]);
  request.workspace.nodes[0].id = 'changed';
  assert.equal(workspace.nodes[0].id, 'first');
});

test('unused tutorial baseline string cannot mutate current tutorial state', () => {
  const context = normalizeContext(null, 'D:/world/Probe', 100);
  context.tutorialSession.baseline = { preserved: true };
  const result = applyEvent(context, { type: 'tutorial_baseline_captured', success: true,
    timestamp: 101, details: { baselineJson: '{"injected":true}' } });
  assert.deepEqual(context.tutorialSession.baseline, { preserved: true });
  assert.deepEqual(result.completedTaskKeys, []);
});

test('recorded operation owns its details after the caller changes a reactive payload', () => {
  const context = normalizeContext(null, 'D:/world/Probe', 100);
  const payload = reactive({ type: 'lighting_changed', timestamp: 101,
    details: { source: 'viewport', direction: { x: 1, y: 2, z: 3 } } });
  withoutJsonCopy(() => applyEvent(context, payload));
  payload.details.direction.x = 9;
  assert.equal(context.recentOperationEvents[0].details.direction.x, 1);
  assert.equal(context.tutorialSession.modificationLog[0].details.direction.x, 1);
});
