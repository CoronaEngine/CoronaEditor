import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers';
import { createNativePanelHosts } from '../../src/services/nativePanelHosts.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
test('layout and title updates retain the same browser; closing disposes it once', async () => {
  const opened = [], closed = [];
  const hosts = createNativePanelHosts({
    open: async panel => { opened.push(panel.id); return { window_token: 12 }; },
    close: async (...args) => closed.push(args),
  });
  hosts.reconcile([{ id: 'Object', dockZone: 'left' }]);
  await tick();
  hosts.reconcile([{ id: 'Object', dockZone: 'right', title: 'Objects' }]);
  await tick();
  assert.deepEqual(opened, ['Object']);
  hosts.reconcile([]); hosts.dispose();
  await tick();
  assert.deepEqual(closed, [[12, 'Object']]);
});
test('world teardown closes a browser whose create reply arrives late', async () => {
  let reply;
  const closed = [];
  const hosts = createNativePanelHosts({ open: () => new Promise(resolve => { reply = resolve; }),
    close: async (...args) => closed.push(args) });
  hosts.reconcile([{ id: 'FileManager' }]);
  await tick();
  hosts.dispose();
  reply({ window_token: 19 });
  await tick();
  assert.deepEqual(closed, [[19, 'FileManager']]);
});

test('a retired envelope cannot focus or register a native panel', async () => {
  const errors = [], focused = [];
  const hosts = createNativePanelHosts({
    open: async () => ({ data: { window_token: 19 } }), close: async () => {},
    focus: async id => focused.push(id), onError: error => errors.push(error),
  });
  hosts.reconcile([{ id: 'FileManager' }]);
  await tick();
  assert.equal(await hosts.focusPanel('FileManager'), false);
  assert.equal(hosts.closed('FileManager', 19), false);
  assert.deepEqual(focused, []);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /Missing window_token/);
  hosts.dispose();
});
test('an old close event cannot close a replacement panel', async () => {
  let id = 0;
  const hosts = createNativePanelHosts({ open: async () => ({ window_token: ++id }), close: async () => {} });
  hosts.reconcile([{ id: 'Object' }]); await tick();
  hosts.reconcile([]);
  hosts.reconcile([{ id: 'Object' }]); await tick();
  assert.equal(hosts.closed('Object', 1), false);
  assert.equal(hosts.closed('Object', 2), true);
});

test('focusing a newly opened dock waits for its browser without recreating it', async () => {
  let reply, opens = 0;
  const focused = [];
  const hosts = createNativePanelHosts({ open: () => { opens++; return new Promise(resolve => { reply = resolve; }); },
    close: async () => {}, focus: async id => focused.push(id) });
  hosts.reconcile([{ id: 'CabbageChatPanel' }]);
  const focus = hosts.focusPanel('CabbageChatPanel');
  await tick(); reply({ window_token: 22 });
  assert.equal(await focus, true);
  assert.deepEqual(focused, ['CabbageChatPanel']);
  assert.equal(opens, 1);
});
test('a late focus request cannot revive a closed world', async () => {
  let reply;
  const focused = [], closed = [];
  const hosts = createNativePanelHosts({ open: () => new Promise(resolve => { reply = resolve; }),
    close: async id => closed.push(id), focus: async id => focused.push(id) });
  hosts.reconcile([{ id: 'SceneControls' }]);
  const focus = hosts.focusPanel('SceneControls');
  await tick(); hosts.dispose(); reply({ window_token: 23 });
  assert.equal(await focus, false);
  assert.deepEqual(focused, []);
  assert.deepEqual(closed, [23]);
});

test('reopening waits until the old native tab has closed', async () => {
  let finishClose;
  const opened = [];
  const hosts = createNativePanelHosts({
    open: async panel => ({ window_token: opened.push(panel.id) }),
    close: () => new Promise(resolve => { finishClose = resolve; }),
  });
  const wanted = [{ id: 'Object' }];
  hosts.reconcile(wanted);
  await tick();
  hosts.reconcile([]);
  hosts.reconcile(wanted);
  await tick();
  assert.deepEqual(opened, ['Object']);
  finishClose();
  await tick();
  assert.deepEqual(opened, ['Object', 'Object']);
  assert.equal(hosts.closed('Object', 1), false);
  assert.equal(hosts.closed('Object', 2), true);
});

for (const reopenDuringClose of [false, true]) {
  test(`failed graph closure retains the same host for explicit retry (reopenDuringClose=${reopenDuringClose})`, async () => {
    let rejectClose, attempts = 0;
    const opened = [], focused = [], errors = [];
    const hosts = createNativePanelHosts({
      open: async panel => ({ window_token: opened.push(panel.id) }),
      close: () => ++attempts === 1 ? new Promise((resolve, reject) => { rejectClose = reject; }) : Promise.resolve(),
      focus: async id => focused.push(id), onError: (error, id) => errors.push([error.message, id]),
    });
    const wanted = [{ id: 'NodeGraphPanel' }];
    hosts.reconcile(wanted); await tick();
    hosts.reconcile([]); await tick();
    if (reopenDuringClose) hosts.reconcile(wanted);
    rejectClose(new Error('graph save failed')); await tick();
    hosts.reconcile(wanted); await tick();
    assert.deepEqual(opened, ['NodeGraphPanel'], 'the failed native close left the original document alive');
    assert.deepEqual(errors.map(([message]) => message), ['graph save failed']);
    assert.equal(await hosts.focusPanel('NodeGraphPanel'), true);
    assert.deepEqual(focused, ['NodeGraphPanel']);
    hosts.reconcile([]); await tick();
    assert.equal(attempts, 2, 'a new close intent explicitly retries the same host');
    assert.equal(hosts.closed('NodeGraphPanel', 1), false, 'successful close retired the original host');
  });
}
