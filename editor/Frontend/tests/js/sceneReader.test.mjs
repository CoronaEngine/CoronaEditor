import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createSceneReader } from '../../src/api/sceneReader.js';

async function until(predicate) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await delay(5);
  }
  assert.fail('scene reader timed out');
}

test('paused windows issue no queries and resume independently', async t => {
  globalThis.document = { hidden: false };
  t.after(() => { delete globalThis.document; });
  let position = 1;
  const readers = [];
  for (let i = 0; i < 2; i++) {
    const calls = [], seen = [];
    const reader = createSceneReader(async (method, scope) => {
      calls.push(method);
      if (method === 'readActive') return { archive_session: 'A', selection: { actor_guid: 'g' } };
      assert.deepEqual(scope, { archive_session: 'A', actors: ['g'] });
      return { actors: [{ actor_guid: 'g', position: [position, 0, 0] }] };
    }, 4);
    const token = reader.observe('transform', value => seen.push(value.position[0]));
    t.after(() => reader.off(token));
    readers.push({ reader, seen, calls });
  }
  await until(() => readers.every(r => r.seen.length === 1));
  for (const { reader, calls } of readers) { reader.pause(); calls.length = 0; }
  position = 8;
  await delay(25);
  for (const { calls, seen } of readers) { assert.deepEqual(calls, []); assert.deepEqual(seen, [1]); }
  readers[0].reader.resume();
  await until(() => readers[0].seen.length === 2);
  assert.deepEqual(readers[1].calls, []);
  readers[1].reader.resume();
  await until(() => readers[1].seen.length === 2);
  for (const { seen } of readers) assert.deepEqual(seen, [1, 8]);
});

test('a reply issued before pause cannot publish into a resumed project', async t => {
  globalThis.document = { hidden: false };
  t.after(() => { delete globalThis.document; });
  let finish, first = true;
  const seen = [];
  const reader = createSceneReader(async () => {
    if (first) {
      first = false;
      return new Promise(resolve => { finish = resolve; });
    }
    return { archive_session: 'B', project_path: 'second' };
  }, 3);
  const token = reader.observe('project', state => seen.push(state.path));
  t.after(() => reader.off(token));
  await until(() => finish);
  reader.pause();
  reader.resume();
  finish({ archive_session: 'A', project_path: 'first' });
  await until(() => seen.length > 0);
  assert.deepEqual(seen, ['second']);
});

test('scene reader deduplicates typed snapshots without JSON serialization', async t => {
  globalThis.document = { hidden: false };
  t.after(() => { delete globalThis.document; });
  const source = await import('../../src/api/sceneReader.js?typed-key-check');
  const readerSource = source.createSceneReader.toString();
  assert.equal(readerSource.includes('JSON.stringify'), false);
});

test('the production observer chain samples transforms through the direct scene V8 binding', async t => {
  const previousWindow = globalThis.window, previousDocument = globalThis.document;
  let directReads = 0, manifestReads = 0;
  globalThis.document = { hidden: false };
  globalThis.window = { corona: {
    scene: {
      readActive: async () => ({ archive_session: 'A', selection: { actor_guid: 'actor' } }),
      readTransforms: async scope => {
        directReads++;
        assert.deepEqual(scope, { archive_session: 'A', actors: ['actor'] });
        return { actors: [{ actor_guid: 'actor', position: [1, 2, 3] }] };
      },
    },
    editor: { invoke: async () => { manifestReads++; throw new Error('unexpected manifest path'); } },
  } };
  t.mock.method(console, 'warn', () => {});
  const { getObserverRuntime, startObserverRuntime } = await import('../../src/api/observerRuntime.js');
  const runtime = getObserverRuntime();
  startObserverRuntime();
  const received = [];
  const token = runtime.observe('transform', value => received.push(value));
  t.after(() => {
    runtime.off(token);
    runtime.dispose();
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  });
  await until(() => received.length);
  assert.equal(directReads, 1);
  assert.equal(manifestReads, 0);
});
