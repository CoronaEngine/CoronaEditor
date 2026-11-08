import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createObserverRuntime } from '../../src/api/observerRuntime.js';

// WNC-002 failing cases: the explicit Web observer runtime owns the unique
// scene read chain with idempotent start/dispose and hidden/BFCache recovery
// (targets WNC-007 / WNC-009). Contract fixed here:
//   createObserverRuntime({ query, intervalMs }) -> { start, dispose, observe, off }
//   query('readActive') -> active snapshot; query('readTransforms', scope) -> { actors }

function host() {
  const listeners = new Map();
  const document = {
    hidden: false,
    addEventListener: (type, fn) => listeners.set(`document:${type}`, fn),
    removeEventListener: type => listeners.delete(`document:${type}`),
  };
  const window = {
    addEventListener: (type, fn) => listeners.set(`window:${type}`, fn),
    removeEventListener: type => listeners.delete(`window:${type}`),
  };
  return { document, window, listeners };
}

function installHost(t, h) {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  globalThis.document = h.document;
  globalThis.window = h.window;
  t.after(() => {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  });
}

async function until(predicate) {
  for (let i = 0; i < 200; i++) {
    if (predicate()) return;
    await delay(5);
  }
  assert.fail('observer runtime timed out');
}

function trackingQuery() {
  const state = { calls: 0, inFlight: 0, maxInFlight: 0, active: { archive_session: 'A' } };
  const query = async () => {
    state.calls++;
    state.inFlight++;
    state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
    await delay(1);
    state.inFlight--;
    return state.active;
  };
  return { state, query };
}

test('start is idempotent and registers each DOM listener exactly once', async t => {
  const h = host();
  installHost(t, h);
  const { query } = trackingQuery();
  const runtime = createObserverRuntime({ query, intervalMs: 4 });
  runtime.start();
  runtime.start();
  assert.deepEqual([...h.listeners.keys()].sort(),
    ['document:visibilitychange', 'window:pagehide', 'window:pageshow']);
  runtime.dispose();
});

test('observe before start issues no queries until start', async t => {
  const h = host();
  installHost(t, h);
  const { state, query } = trackingQuery();
  const runtime = createObserverRuntime({ query, intervalMs: 4 });
  const token = runtime.observe('project', () => {});
  t.after(() => { runtime.off(token); runtime.dispose(); });
  await delay(20);
  assert.equal(state.calls, 0);
  runtime.start();
  await until(() => state.calls >= 1);
});

test('pagehide pauses and pageshow resumes exactly one query chain', async t => {
  const h = host();
  installHost(t, h);
  const { state, query } = trackingQuery();
  const runtime = createObserverRuntime({ query, intervalMs: 4 });
  const token = runtime.observe('project', () => {});
  t.after(() => { runtime.off(token); runtime.dispose(); });
  runtime.start();
  await until(() => state.calls >= 2);
  h.listeners.get('window:pagehide')();
  const callsWhileHidden = state.calls;
  await delay(20);
  assert.equal(state.calls, callsWhileHidden);
  h.listeners.get('window:pageshow')();
  await until(() => state.calls > callsWhileHidden);
  assert.equal(state.maxInFlight, 1);
});

test('dispose is idempotent, cancels the chain and drops late results', async t => {
  const h = host();
  installHost(t, h);
  let finish;
  const state = { calls: 0 };
  const query = async () => {
    state.calls++;
    return new Promise(resolve => { finish = resolve; });
  };
  const runtime = createObserverRuntime({ query, intervalMs: 4 });
  const received = [];
  runtime.observe('project', value => received.push(value));
  runtime.start();
  await until(() => state.calls >= 1);
  runtime.dispose();
  runtime.dispose();
  const callsAtDispose = state.calls;
  await delay(25);
  assert.equal(state.calls, callsAtDispose);
  assert.deepEqual(h.listeners.size, 0);
  finish({ archive_session: 'B' });
  await delay(10);
  assert.deepEqual(received, []);
});

test('a restarted runtime re-registers listeners and runs a single new chain', async t => {
  const h = host();
  installHost(t, h);
  const { state, query } = trackingQuery();
  const runtime = createObserverRuntime({ query, intervalMs: 4 });
  runtime.start();
  runtime.dispose();
  runtime.start();
  await delay(20);
  assert.equal(state.calls, 0);
  const token = runtime.observe('project', () => {});
  t.after(() => { runtime.off(token); runtime.dispose(); });
  await until(() => state.calls >= 1);
  assert.equal(state.maxInFlight, 1);
  assert.deepEqual([...h.listeners.keys()].sort(),
    ['document:visibilitychange', 'window:pagehide', 'window:pageshow']);
});
