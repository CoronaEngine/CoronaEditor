import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { setImmediate } from 'node:timers';
import { ref } from 'vue';
import { compileScript, parse } from 'vue/compiler-sfc';
import { createViewLifetime } from '../../src/utils/viewLifetime.js';
import { deferred } from './windowSessionFixtures.mjs';

const { descriptor } = parse(fs.readFileSync(new URL('../../src/views/layout/JoinGame.vue', import.meta.url), 'utf8'));
const compiled = compileScript(descriptor, { id: 'join-game-lifetime' }).content
  .replace(/^import .*;$/gm, '').replace('export default', 'return');
const settle = () => new Promise(resolve => setImmediate(resolve));

function mount(t, overrides = {}) {
  const timers = new Map(), intervals = new Map(), calls = [], routes = [];
  let mounted, unmounted, sequence = 0;
  const network = Object.fromEntries(['clearDiscoveredPeers', 'searchLan', 'getDiscoveredPeers'].map(name => [name, async () => {
    calls.push(name);
    return name === 'getDiscoveredPeers' ? { peers: [{ role: 'host', stable_id: 'host', name: 'Host', ip: '127.0.0.1', port: 27960 },
      { role: 'client', stable_id: 'client' }] } : {};
  }]));
  const component = new Function('ref', 'onMounted', 'onUnmounted', 'createViewLifetime', 'useRouter', 'editorApi',
    'projectLauncherService', 'isProjectOpenSuperseded', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', compiled)(
    ref, fn => { mounted = fn; }, fn => { unmounted = fn; }, createViewLifetime,
    () => ({ push: path => routes.push(path) }),
    { network: { ...network, getSessionInfo: async () => ({ local_ip: '127.0.0.1' }), ...overrides.network }, project: overrides.project },
    overrides.launcher || {}, result => result?.status === 'superseded',
    callback => { timers.set(++sequence, callback); return sequence; }, id => timers.delete(id),
    callback => { intervals.set(++sequence, callback); return sequence; }, id => intervals.delete(id));
  const state = component.setup({}, { expose() {} });
  const dispose = () => unmounted();
  t.after(dispose);
  return { state, timers, intervals, calls, routes, start: () => mounted(), dispose,
    finishDelay() { const [id, callback] = timers.entries().next().value; timers.delete(id); callback(); } };
}

for (const stage of ['clearDiscoveredPeers', 'searchLan']) {
  test(`JoinGame retirement during ${stage} stops later discovery work`, async t => {
    const pending = deferred();
    const page = mount(t, { network: { [stage]: () => pending.promise } });
    page.state.handleRefresh();
    await settle();
    page.dispose(); pending.resolve({}); await settle();
    assert.equal(page.timers.size, 0, 'retired search must not schedule discovery delay');
    assert.deepEqual(page.calls, stage === 'clearDiscoveredPeers' ? [] : ['clearDiscoveredPeers']);
    assert.deepEqual(page.state.rooms.value, []);
  });
}

test('JoinGame cancels its discovery delay and never reads peers after unmount', async t => {
  const page = mount(t);
  page.state.handleRefresh(); await settle();
  assert.equal(page.timers.size, 1);
  page.dispose(); await settle();
  assert.equal(page.timers.size, 0, 'unmount must clear the pending one-shot timer too');
  assert.deepEqual(page.calls, ['clearDiscoveredPeers', 'searchLan']);
});

for (const outcome of ['success', 'failure']) {
  test(`JoinGame ignores a peer list ${outcome} received after retirement`, async t => {
    const pending = deferred();
    const page = mount(t, { network: { getDiscoveredPeers: () => pending.promise } });
    page.state.handleRefresh(); await settle(); page.finishDelay(); await settle();
    page.dispose();
    if (outcome === 'success') pending.resolve({ peers: [{ role: 'host', stable_id: 'late' }] });
    else pending.reject(new Error('retired search'));
    await settle();
    assert.deepEqual(page.state.rooms.value, []);
    assert.equal(page.state.selectedRoom.value, null);
    assert.equal(page.state.errorMsg.value, '');
    assert.equal(page.state.scanning.value, true, 'late completion must not mutate a retired component');
  });
}

test('JoinGame ignores a local address received after retirement', async t => {
  const pending = deferred();
  const page = mount(t, { network: { getSessionInfo: () => pending.promise } });
  const loading = page.state.loadLocalIp(); page.dispose();
  pending.resolve({ local_ip: '192.0.2.1' }); await loading;
  assert.equal(page.state.localIp.value, '--');
});

test('JoinGame live discovery lists hosts, prevents overlapping scans and retires its interval', async t => {
  const page = mount(t); page.start(); await settle();
  page.state.handleRefresh();
  assert.equal(page.intervals.size, 1); assert.equal(page.timers.size, 1);
  page.finishDelay(); await settle();
  assert.deepEqual(page.state.rooms.value, [{ id: 'host', name: 'Host', host: '127.0.0.1', port: 27960, hostName: 'Host' }]);
  assert.equal(page.state.selectedRoom.value, 'host');
  assert.equal(page.state.scanning.value, false);
  assert.deepEqual(page.calls, ['clearDiscoveredPeers', 'searchLan', 'getDiscoveredPeers']);
  page.dispose(); assert.equal(page.intervals.size, 0);
});

function roomFlow(t, stage, pending) {
  const calls = [];
  const invoke = (name, value) => async () => { calls.push(name); return name === stage ? pending.promise : value; };
  const page = mount(t, {
    network: {
      getSessionInfo: invoke('getSessionInfo', { active: stage === 'stopSession' }),
      stopSession: invoke('stopSession', {}), setProjectRoot: invoke('setProjectRoot', { ok: true }),
      startSession: invoke('startSession', { ok: true, local_ip: '127.0.0.1' }),
      connectToPeer: invoke('connectToPeer', { ok: true }),
    },
    project: { createMultiplayerProject: invoke('createMultiplayerProject', { path: 'fixture' }) },
    launcher: { openProject: invoke('openProject', { ok: true }) },
  });
  return { ...page, flowCalls: calls };
}

for (const role of ['host', 'guest']) {
  for (const stage of ['getSessionInfo', 'stopSession', 'createMultiplayerProject', 'openProject', 'setProjectRoot', 'startSession',
    ...(role === 'guest' ? ['connectToPeer'] : [])]) {
    test(`JoinGame ${role} stops after a ${stage} reply received after retirement`, async t => {
      const pending = deferred(), page = roomFlow(t, stage, pending);
      if (role === 'host') page.state.handleCreateRoom();
      else page.state.joinHost({ ip: '127.0.0.1', port: 27960 });
      await settle();
      assert.equal(page.flowCalls.at(-1), stage, 'the actual workflow must reach the delayed boundary');
      const before = [...page.flowCalls];
      const address = page.state.localIp.value;
      page.dispose(); page.state.busyText.value = 'retired';
      pending.resolve({ ok: true, active: true, path: 'fixture', local_ip: '192.0.2.1' });
      await settle();
      assert.deepEqual(page.flowCalls, before, 'retired launcher cannot begin the next native operation');
      assert.deepEqual(page.routes, []);
      assert.equal(page.state.busyText.value, 'retired');
      assert.equal(page.state.localIp.value, address);
      assert.equal(page.state.errorMsg.value, '');
    });
  }
}

test('JoinGame ignores a room failure received after retirement', async t => {
  const pending = deferred(), page = roomFlow(t, 'createMultiplayerProject', pending);
  page.state.handleCreateRoom(); await settle(); page.dispose();
  pending.reject(new Error('late create failure')); await settle();
  assert.equal(page.state.errorMsg.value, ''); assert.deepEqual(page.routes, []);
});

for (const role of ['host', 'guest']) {
  test(`JoinGame live ${role} completes its workflow and enters the world`, async t => {
    const page = roomFlow(t);
    if (role === 'host') page.state.handleCreateRoom();
    else page.state.joinHost({ ip: '127.0.0.1', port: 27960 });
    await settle();
    assert.deepEqual(page.flowCalls, ['getSessionInfo', 'createMultiplayerProject', 'openProject', 'setProjectRoot', 'startSession',
      ...(role === 'guest' ? ['connectToPeer'] : [])]);
    assert.deepEqual(page.routes, ['/']); assert.equal(page.state.busy.value, false);
  });
}
