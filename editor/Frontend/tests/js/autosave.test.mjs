// Autosave policy: the renderer decides when to write, C++ only produces the scene.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PERSISTENT_SCENE_METHODS,
  createAutosavePolicy,
  saveActiveScene,
  withAutosave,
} from '../../src/services/autosave.js';

/** A clock and timer pair a test can step through. */
function fakeClock() {
  let current = 0;
  const queued = new Map();
  let nextId = 1;
  return {
    now: () => current,
    setTimer(fn, ms) {
      const id = nextId++;
      queued.set(id, { at: current + ms, fn });
      return id;
    },
    clearTimer(id) {
      queued.delete(id);
    },
    advance(ms) {
      const target = current + ms;
      for (;;) {
        const due = [...queued.entries()]
          .filter(([, item]) => item.at <= target)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        queued.delete(due[0]);
        current = due[1].at;
        due[1].fn();
      }
      current = target;
    },
    pending: () => queued.size,
  };
}

/** Let a multi-step async save chain finish before asserting on its effects. */
const settle = async () => {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
};

function policyWith(clock, overrides = {}) {
  const saves = [];
  const policy = createAutosavePolicy({
    save: async () => {
      saves.push(clock.now());
    },
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    debounceMs: 1000,
    maxIntervalMs: 5000,
    ...overrides,
  });
  return { policy, saves };
}

test('a dirty scene is written once, after the debounce', async () => {
  const clock = fakeClock();
  const { policy, saves } = policyWith(clock);

  policy.markDirty();
  policy.markDirty();
  assert.equal(saves.length, 0, 'nothing is written while the debounce runs');

  clock.advance(1000);
  await Promise.resolve();
  assert.deepEqual(saves, [1000]);
  assert.equal(policy.state().dirty, false);
});

test('a continuous edit stream still hits the maximum interval', async () => {
  const clock = fakeClock();
  const { policy, saves } = policyWith(clock);

  for (let elapsed = 0; elapsed < 6000; elapsed += 400) {
    policy.markDirty();
    clock.advance(400);
    await Promise.resolve();
  }

  assert.ok(saves.length >= 1, 'the deadline timer fires even though the debounce keeps moving');
  assert.ok(saves[0] <= 5000, `first write at ${saves[0]}ms, deadline was 5000ms`);
});

test('a failed save keeps the scene dirty and retries', async () => {
  const clock = fakeClock();
  let attempts = 0;
  const policy = createAutosavePolicy({
    save: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('archive service starting');
    },
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    debounceMs: 1000,
    maxIntervalMs: 5000,
  });

  policy.markDirty();
  clock.advance(1000);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(attempts, 1);
  assert.equal(policy.state().dirty, true, 'a failure must not look like a save');
  assert.match(String(policy.state().failure), /archive service starting/);

  clock.advance(1000);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(attempts, 2);
  assert.equal(policy.state().dirty, false);
});

test('flush writes immediately and dispose cancels pending work', async () => {
  const clock = fakeClock();
  const { policy, saves } = policyWith(clock);

  policy.markDirty();
  await policy.flush();
  assert.deepEqual(saves, [0]);

  policy.markDirty();
  policy.dispose();
  clock.advance(60000);
  await Promise.resolve();
  assert.deepEqual(saves, [0], 'dispose leaves nothing armed');
  assert.equal(policy.state().armed, false);
});

test('only persistent scene methods mark the scene dirty', async () => {
  const clock = fakeClock();
  const calls = [];
  const scene = {
    readActive: async () => ({ archive_session: 'lease', scene: 'scene.ini', read_only: false }),
    readScene: () => calls.push('readScene'),
    save: async () => {
      calls.push('save');
      return { status: 'saved' };
    },
  };
  for (const name of PERSISTENT_SCENE_METHODS) scene[name] = () => calls.push(name);

  const api = withAutosave(
    { scene, files: { getFileTree: () => { calls.push('getFileTree'); return 'forwarded'; } } },
    { now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer, debounceMs: 1000, notify: () => {} },
  );

  api.scene.readScene();
  api.scene.deleteActor('scene.ini', 'actor');
  assert.equal(api.autosave.state().dirty, true);

  clock.advance(1000);
  await settle();
  assert.ok(calls.includes('save'), 'the write went through the native save');

  api.scene.readScene();
  assert.equal(api.autosave.state().dirty, false, 'reads alone never dirty the scene');
  assert.equal(api.files.getFileTree(), 'forwarded', 'other namespaces are forwarded untouched');
});

test('a read-only scene is never autosaved', async () => {
  const clock = fakeClock();
  const saved = [];
  const scene = {
    readActive: async () => ({ archive_session: 'lease', scene: 'scene.ini', read_only: true }),
    save: async () => {
      saved.push('save');
      return { status: 'saved' };
    },
    updateActor: () => {},
  };
  const api = withAutosave(
    { scene },
    { now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer, debounceMs: 1000, notify: () => {} },
  );

  api.scene.updateActor('scene.ini', 'actor', { visible: false });
  clock.advance(1000);
  await settle();

  assert.deepEqual(saved, [], 'a read-only project is not written');
  assert.equal(api.autosave.state().dirty, false, 'the attempt counts as handled');
});

test('saveActiveScene reports what it did', async () => {
  const ok = await saveActiveScene({
    readActive: async () => ({ archive_session: 'lease', scene: 'scene.ini' }),
    save: async () => ({ status: 'saved' }),
  });
  assert.deepEqual(ok, { saved: true, reason: 'saved', result: { status: 'saved' } });

  const empty = await saveActiveScene({ readActive: async () => ({ archive_session: '' }) });
  assert.deepEqual(empty, { saved: false, reason: 'no_scene' });

  const readOnly = await saveActiveScene({
    readActive: async () => ({ archive_session: 'lease', read_only: true }),
  });
  assert.deepEqual(readOnly, { saved: false, reason: 'read_only' });
});

test('a manual save settles the scene instead of writing it again', async () => {
  const clock = fakeClock();
  const saved = [];
  const scene = {
    readActive: async () => ({ archive_session: 'lease', scene: 'scene.ini' }),
    save: async () => {
      saved.push('save');
      return { status: 'saved' };
    },
    updateActor: () => {},
  };
  const api = withAutosave(
    { scene },
    { now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer, debounceMs: 1000, notify: () => {} },
  );

  api.scene.updateActor('scene.ini', 'actor', { visible: false });
  assert.equal(api.autosave.state().dirty, true);

  await api.scene.save('scene.ini', { archive_session: 'lease' });   // the user presses save
  assert.equal(api.autosave.state().dirty, false, 'a manual save settles the scene');
  assert.equal(api.autosave.state().armed, false);

  clock.advance(60000);
  await settle();
  assert.deepEqual(saved, ['save'], 'the autosave must not repeat a manual save');
});
