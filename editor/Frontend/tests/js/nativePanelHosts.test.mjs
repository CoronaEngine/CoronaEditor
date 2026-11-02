import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers';
import { createNativePanelHosts } from '../../src/services/nativePanelHosts.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
test('layout and title updates retain the same browser; closing disposes it once', async () => {
  const opened = [], closed = [];
  const hosts = createNativePanelHosts({
    open: async panel => { opened.push(panel.id); return { tab_id: 12 }; },
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
  hosts.reconcile([{ id: 'LogTool' }]);
  await tick();
  hosts.dispose();
  reply({ data: { tab_id: 19 } });
  await tick();
  assert.deepEqual(closed, [[19, 'LogTool']]);
});
test('an old close event cannot close a replacement panel', async () => {
  let id = 0;
  const hosts = createNativePanelHosts({ open: async () => ({ tab_id: ++id }), close: async () => {} });
  hosts.reconcile([{ id: 'Object' }]); await tick();
  hosts.reconcile([]);
  hosts.reconcile([{ id: 'Object' }]); await tick();
  assert.equal(hosts.closed('Object', 1), false);
  assert.equal(hosts.closed('Object', 2), true);
});
