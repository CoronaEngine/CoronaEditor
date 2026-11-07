import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { createWebMessages } from '../../src/api/webMessages.js';
const url = new URL('../../src/services/nodeGraphSaves.js', import.meta.url);
const saves = existsSync(url) ? await import(url) : {};
function fixture(t) {
  assert.equal(typeof saves.createNodeGraphSaves, 'function');
  const scope = crypto.randomUUID();
  const main = createWebMessages({ scope, documentId: 'main', role: 'main' });
  const dock = createWebMessages({ scope, documentId: 'dock' });
  t.after(() => { main.dispose(); dock.dispose(); });
  return { main, dock, owner: saves.createNodeGraphSaves({ messages: main }), panel: saves.createNodeGraphSaves({ messages: dock }) };
}

test('an archive flush saves matching workspaces across documents and coalesces concurrent owners', async t => {
  const { owner, panel } = fixture(t);
  const calls = [];
  owner.register({ getSession: () => 'archive-A', flush: async session => { calls.push(['main',session]); return true; } });
  panel.register({ getSession: () => 'archive-A', flush: async session => { calls.push(['dock',session]); return { revision: 1 }; } });
  panel.register({ getSession: () => 'archive-B', flush: () => assert.fail('another archive must not be written') });
  const first = owner.flush('archive-A');
  assert.equal(owner.flush('archive-A'), first);
  const results = await first;
  assert.equal(results.reduce((sum,value) => sum + value.saved,0), 2);
  assert.deepEqual(calls.sort(), [['dock','archive-A'],['main','archive-A']]);
  await assert.rejects(owner.flush(''), { code: 'INVALID_ARGUMENT' });
});

test('unmount keeps failed graph state registered until a later explicit flush succeeds', async t => {
  const { owner, panel } = fixture(t);
  let succeed = false, calls = 0;
  const registration = panel.register({ getSession: () => 'archive-A', flush: async () => { calls++; return succeed; } });
  await assert.rejects(registration.retire(), { code: 'GRAPH_SAVE_FAILED' });
  await assert.rejects(owner.flush('archive-A'), { code: 'GRAPH_SAVE_FAILED' });
  succeed = true;
  assert.equal((await owner.flush('archive-A'))[0].saved, 1);
  const savedCalls = calls;
  assert.deepEqual(await owner.flush('archive-A'), []);
  assert.equal(calls, savedCalls, 'successfully retired workspaces must not be saved again');
});

test('an unmount and remote flush share a native save that is already in progress', async t => {
  const { owner, panel } = fixture(t);
  let release, calls = 0;
  const registration = panel.register({ getSession: () => 'archive-A', flush: () => { calls++; return new Promise(resolve => { release = resolve; }); } });
  const retiring = registration.retire();
  const flushing = owner.flush('archive-A');
  await delay(80);
  assert.equal(calls, 1);
  release(true);
  await retiring; await flushing;
  assert.deepEqual(await owner.flush('archive-A'), []);
});

test('a flusher that changes archives while saving rejects the old world result', async t => {
  const { owner, panel } = fixture(t);
  let session = 'archive-A', release;
  panel.register({ getSession: () => session, flush: () => new Promise(resolve => { release = resolve; }) });
  const flushing = owner.flush('archive-A');
  const rejected = assert.rejects(flushing, { code: 'CONTEXT_CHANGED' });
  while (!release) await delay(5);
  session = 'archive-B'; release(true); await rejected;
});

test('an unloaded workspace can retire without saving or leaving a phantom handler', async t => {
  const { owner, panel } = fixture(t);
  const registration = panel.register({ getSession: () => '', flush: () => assert.fail('no archive has loaded') });
  await registration.retire();
  assert.deepEqual(await owner.flush('archive-A'), []);
});
