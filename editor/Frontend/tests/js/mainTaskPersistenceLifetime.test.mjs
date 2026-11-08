import assert from 'node:assert/strict';
import test from 'node:test';
import { mountMainPage } from './mainPageFixtures.mjs';
import { deferred } from './windowSessionFixtures.mjs';

const actions = [{ action: 'upsert', task: { id: 'first' } }, { action: 'upsert', task: { id: 'second' } }];

async function mount(t) {
  const h = mountMainPage(t);
  await h.mount();
  h.worldMode.activeProjectPath = 'D:/world/first';
  const writes = [], scores = [], warnings = [];
  h.cabbageContext.updateTask = async action => { writes.push(action); };
  h.cabbageContext.requestProfileScoreUpdate = async () => { scores.push('score'); };
  t.mock.method(console, 'warn', (...args) => warnings.push(args));
  return { ...h, writes, scores, warnings };
}

for (const retirement of ['unmount', 'world', 'path', 'archive', 'scene', 'archive ABA']) {
  for (const outcome of ['success', 'failure']) {
    test(`task batch stops after ${retirement} and late ${outcome}`, async t => {
      const h = await mount(t), pending = deferred();
      h.cabbageContext.updateTask = action => { h.writes.push(action); return pending.promise; };
      const saving = h.page.persistCabbageTaskActions(actions);
      assert.equal(h.writes.length, 1);
      if (retirement === 'unmount') h.unmount();
      if (retirement === 'world') h.worldMode.revision++;
      if (retirement === 'path') h.worldMode.activeProjectPath = 'D:/world/second';
      if (retirement === 'scene') h.page.currentSceneId.value = 'other.xml';
      if (retirement.startsWith('archive')) {
        h.page.environmentArchiveSession.value = 'replacement';
        if (retirement === 'archive ABA') h.page.environmentArchiveSession.value = 'main-archive';
      }
      if (outcome === 'success') pending.resolve({});
      else pending.reject(Error('old task write failed'));
      await saving;
      assert.equal(h.writes.length, 1, 'do not submit remaining tasks into a replacement context');
      assert.deepEqual(h.scores, []);
      assert.deepEqual(h.warnings, []);
    });
  }
}

test('retired task persistence cannot start writes or scoring', async t => {
  const h = await mount(t); h.unmount();
  await h.page.persistCabbageTaskActions(actions);
  assert.deepEqual(h.writes, []);
  assert.deepEqual(h.scores, []);
});

test('current batch continues after a failed task and scores once', async t => {
  const h = await mount(t);
  h.cabbageContext.updateTask = async action => {
    h.writes.push(action);
    if (action === actions[0]) throw Error('current task write failed');
  };
  await h.page.persistCabbageTaskActions(actions);
  assert.deepEqual(h.writes, actions);
  assert.equal(h.warnings.length, 1);
  assert.deepEqual(h.scores, ['score']);
});

test('independent current batches both finish without superseding each other', async t => {
  const h = await mount(t), pending = deferred();
  const initialOperations = [...h.page.mainSceneOperations];
  h.cabbageContext.updateTask = async action => {
    h.writes.push(action);
    if (h.writes.length === 1) await pending.promise;
  };
  const first = h.page.persistCabbageTaskActions(actions);
  await h.page.persistCabbageTaskActions([{ action: 'upsert', task: { id: 'third' } }]);
  pending.resolve({}); await first;
  assert.deepEqual(h.writes.map(value => value.task.id), ['first', 'third', 'second']);
  assert.equal(h.scores.length, 2);
  assert.deepEqual([...h.page.mainSceneOperations], initialOperations);
});

test('empty and invalid task batches do not request scores', async t => {
  const h = await mount(t);
  for (const input of [[], null, [null, {}]]) await h.page.persistCabbageTaskActions(input);
  assert.deepEqual(h.writes, []);
  assert.deepEqual(h.scores, []);
});
