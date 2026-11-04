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
