import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { createEditorWindowSession } from '../../src/services/editorWindowSession.js';
import { readWorldProjectInfo } from '../../src/services/worldModeService.js';
import { memoryStorage, deferred } from './windowSessionFixtures.mjs';
import { createWindowSessionState } from '../../src/services/windowSessionState.js';

test('window session state hydrates a detached document through Web messages', async t => {
  const scope = crypto.randomUUID();
  const mainMessages = (await import('../../src/api/webMessages.js')).createWebMessages({ scope, role: 'main', documentId: 'main' });
  const dockMessages = (await import('../../src/api/webMessages.js')).createWebMessages({ scope, documentId: 'dock' });
  t.after(() => { mainMessages.dispose(); dockMessages.dispose(); });
  const mainState = createWindowSessionState(mainMessages, { owner: 'owner', main: true });
  const dockState = createWindowSessionState(dockMessages, { owner: 'owner' });
  mainState.write({ owner: 'owner', revision: 3, generation: 'generation', enabled: true,
    records: [{ owner: 'owner', id: 'panel', status: 'ready' }] });
  await dockState.hydrate();
  assert.deepEqual(dockState.read(), mainState.read());
});

function harness(overrides = {}) {
  const storage = memoryStorage();
  const makeState = () => ({
    read: () => {
      const policy = JSON.parse(storage.getItem('policy') || 'null') || {};
      const records = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key?.startsWith('window:')) records.push({ key, ...JSON.parse(storage.getItem(key)) });
      }
      return { ...policy, records };
    },
    write: next => {
      const { records = [], ...policy } = next;
      storage.setItem('policy', JSON.stringify(policy));
      for (let i = storage.length - 1; i >= 0; i--) {
        const key = storage.key(i);
        if (key?.startsWith('window:')) storage.removeItem(key);
      }
      for (const record of records) storage.setItem(`window:${record.owner}:${record.id}`, JSON.stringify(record));
      return next;
    },
  });
  const world = { status: 'ready', mode: 'creative', revision: 1 };
  const commands = [];
  const events = [];
  const activities = new Map();
  const activityTracker = {
    begin: value => { const id = `activity-${activities.size + 1}`; activities.set(id, value); return id; },
    end: id => activities.delete(id),
    drain: async predicate => {
      while ([...activities.values()].some(predicate || (() => true))) await setImmediate();
    },
  };
  let tabId = 0;
  const send = async command => {
    commands.push(command);
    return command.cmd.startsWith('create') ? { tab_id: ++tabId } : {};
  };
  const sharedState = makeState();
  sharedState.main = true;
  sharedState.saveRecord = record => sharedState.write({ ...sharedState.read(),
    records: [...sharedState.read().records.filter(item => item.id !== record.id), record] });
  sharedState.removeRecord = record => sharedState.write({ ...sharedState.read(),
    records: sharedState.read().records.filter(item => item.id !== record.id) });
  const options = { state: sharedState, storage, activities: activityTracker, getWorld: () => world, send, publish: async (event, payload) => events.push({ event, payload }), getQuery: () => new URLSearchParams(),
    wait: () => setImmediate(), ...overrides };
  const main = createEditorWindowSession(options);
  const child = command => createEditorWindowSession({ ...options,
    getQuery: () => new URLSearchParams(command.routePath.split('?')[1] + '&standalone=1'),
  });
  return { storage, world, commands, events, main, child, send, options };
}
const panel = { cmd: 'createPanelTab', panelId: 'Object', routePath: '/Object' };
const camera = { cmd: 'createCameraView', sceneId: 'scene.ini', cameraId: 'camera1', archiveSession: 'archive',
  routePath: '/CameraView?scene=scene.ini&camera=camera1' };

test('window sessions reject retired envelope replies instead of recording a ready tab', async () => {
  const h = harness({ send: async command => command.cmd.startsWith('create') ? { data: { tab_id: 9 } } : {} });
  await h.main.prepare(true);
  await assert.rejects(h.main.open(panel), /tab_id/);
  assert.equal(h.main.policy().records.some(record => record.status === 'ready'), false);
});

test('main policy is Web-owned; standalone windows inherit immutable session tokens', async () => {
  const h = harness();
  await h.main.prepare(true);
  h.commands.length = 0;
  const result = await h.main.open(panel);
  const child = h.child(h.commands[0]);
  assert.equal(child.policy().enabled, true);
  await assert.rejects(child.prepare(false), /主窗口/);
  await child.broadcast('panel-redock-request', { panelId: 'Object' });
  const payload = h.events.at(-1).payload;
  assert.equal(payload.tabId, result.tab_id);
  assert.equal(h.main.accepts(payload), true);
  assert.equal(h.main.accepts({ panelId: 'Object' }), false);
  h.world.revision++;
  await h.main.prepare(false);
  assert.equal(child.policy().enabled, false);
  assert.ok(h.commands.some(command => command.cmd === 'closePanelTab' && command.tabId === result.tab_id));
  await h.main.prepare(true);
  assert.equal(h.main.accepts(payload), false);
  await assert.rejects(child.open(panel), /不允许/);
  await assert.rejects(child.broadcast('panel-redock-request', {}), /不允许/);
  assert.ok(h.commands.every(command => !['setEditorUiEnabled', 'getEditorUiPolicy'].includes(command.cmd)));
});

test('rapid policy preparation shares retirement but does not lose a following enable', async () => {
  const barrier = deferred();
  let fences = 0;
  const h = harness({ send: async () => { if (++fences === 1) await barrier.promise; return {}; } });
  const first = h.main.prepare(false);
  assert.equal(h.main.prepare(false), first);
  const enabled = h.main.prepare(true);
  barrier.resolve();
  await first; await enabled;
  assert.equal(h.main.policy().enabled, true);
});

test('retirement waits for late creation, disposes old tab, and fences before a new world', async () => {
  const pending = deferred();
  const h = harness();
  const send = h.options.send;
  h.options.send = async command => command.cmd === 'createDetachedPanel' ? pending.promise : send(command);
  const main = createEditorWindowSession(h.options);
  await main.prepare(true);
  const opening = main.open({ ...panel, cmd: 'createDetachedPanel' });
  const rejected = assert.rejects(opening, /世界已切换/);
  h.world.revision++;
  let retired = false;
  const retirement = main.prepare(false).then(() => { retired = true; });
  await setImmediate();
  assert.equal(retired, false);
  pending.resolve({ tab_id: 17 });
  await rejected; await retirement;
  const closeIndex = h.commands.findIndex(command => command.cmd === 'closePanelTab' && command.tabId === 17);
  assert.ok(closeIndex >= 0);
  assert.equal(h.commands.at(-1).cmd, 'suspendCameraViews');
  assert.equal(h.commands.at(-1).sceneId, '');
  assert.ok(h.commands.length > closeIndex + 1);
  assert.equal(h.commands.filter(command => command.cmd === 'closePanelTab').length, 1);
  assert.equal(h.storage.length, 1); // Only the policy remains, no resurrected window record.
});

test('completed camera creation returns its tab and retirement never writes camera.open', async () => {
  const h = harness();
  h.options.send = async command => {
    h.commands.push(command);
    return command.cmd === 'createCameraView' ? { tab_id: 27, existing: false } : {};
  };
  const main = createEditorWindowSession(h.options);
  await main.prepare(true);
  h.commands.length = 0;
  await main.open(camera);
  const child = h.child(h.commands[0]);
  assert.deepEqual(h.commands.map(command => command.cmd), ['createCameraView']);
  h.world.revision++;
  const retired = main.prepare(false);
  await child.closeThis(''); // Retired camera pages leave suspension to main.
  await retired;
  assert.ok(h.commands.some(command => command.cmd === 'suspendCameraViews' && command.sceneId === 'scene.ini'));
  assert.ok(h.commands.every(command => !['closeCameraView', 'closePanelTab', 'closeThisTab'].includes(command.cmd)));
});

test('camera opened by a secondary window is retired by the main owner', async () => {
  const h = harness();
  await h.main.prepare(true);
  await h.main.open(panel);
  const child = h.child(h.commands.find(command => command.cmd === 'createPanelTab'));
  await child.open(camera);
  h.world.revision++;
  await h.main.prepare(false);
  assert.ok(h.commands.some(command => command.cmd === 'suspendCameraViews' && command.sceneId === 'scene.ini'));
});

test('a close command does not publish an optimistic native completion', async () => {
  const h = harness();
  await h.main.prepare(true);
  const { tab_id } = await h.main.open(panel);
  await h.main.closeTab(tab_id, panel.panelId);
  const close = h.commands.find(command => command.cmd === 'closePanelTab');
  assert.equal(close.panelId, '');
  assert.equal(h.commands.at(-1).cmd, 'closePanelTab');
  assert.ok(h.commands.every(command => command.cmd !== 'broadcast'));
  assert.deepEqual(h.events, []);
});

test('failed close remains registered for retry', async () => {
  let fail = true;
  const h = harness();
  const send = h.options.send;
  h.options.send = async command => {
    if (command.cmd === 'closePanelTab' && fail) throw new Error('close failed');
    return send(command);
  };
  const main = createEditorWindowSession(h.options);
  await main.prepare(true);
  await main.open(panel);
  h.world.revision++;
  await assert.rejects(main.prepare(false), /close failed/);
  fail = false;
  await main.prepare(false);
  assert.equal(h.commands.filter(command => command.cmd === 'closePanelTab').length, 1);
});

test('legacy story metadata allows windows while unready projects remain blocked', async () => {
  const h = harness();
  h.world.mode = 'story';
  await h.main.prepare(true);
  await h.main.open(panel);
  for (const status of ['idle', 'loading', 'error']) {
    h.world.status = status;
    await assert.rejects(h.main.open(panel), /不允许/);
  }
  assert.equal(h.commands.filter(command => command.cmd === panel.cmd).length, 1);
});

test('unreadable session state fails closed before sending window commands', async () => {
  const h = harness();
  await h.main.prepare(true);
  h.storage.getItem = () => { throw new Error('storage unavailable'); };
  await assert.rejects(h.main.open(panel), /storage unavailable/);
  assert.equal(h.commands.filter(command => command.cmd === panel.cmd).length, 0);
});

test('world mode uses authoritative native scene metadata', async () => {
  const info = { project_path: 'D:/world', mode: 'creative' };
  const api = { projectSettings: { getActiveProjectInfo: async () => info } };
  assert.deepEqual(await readWorldProjectInfo(api), info);
  info.mode = 'story';
  assert.equal((await readWorldProjectInfo(api)).mode, 'story');
});

test('a same-revision disable supersedes an enable awaiting retirement', async () => {
  const barrier = deferred();
  let calls = 0;
  const h = harness({ send: async () => { if (++calls === 1) await barrier.promise; return {}; } });
  const enabled = h.main.prepare(true);
  await setImmediate();
  const disabled = h.main.prepare(false);
  barrier.resolve();
  await enabled;
  await disabled;
  assert.equal(h.main.policy().enabled, false);
  await h.main.prepare(true);
  assert.equal(h.main.policy().enabled, true);
});

test('retired children stay alive until their queued operations settle', async () => {
  const h = harness();
  await h.main.prepare(true);
  await h.main.open(panel);
  const child = h.child(h.commands.find(command => command.cmd === panel.cmd));
  h.world.revision++;
  const retirement = h.main.prepare(false);
  await child.closeThis(panel.panelId);
  await retirement;
  assert.ok(h.commands.every(command => command.cmd !== 'closeThisTab'));
  assert.ok(h.commands.some(command => command.cmd === 'closePanelTab'));
});

test('user close waits for native closure instead of broadcasting an optimistic completion', async () => {
  const h = harness();
  await h.main.prepare(true);
  await h.main.open(panel);
  const child = h.child(h.commands.find(command => command.cmd === panel.cmd));
  h.commands.length = 0;
  await child.closeThis(panel.panelId);
  assert.deepEqual(h.commands.map(command => command.cmd), ['closeThisTab']);
  assert.deepEqual(h.events, []);
  assert.equal(h.storage.length, 1);
});

for (const initiatedByMain of [false, true]) {
  test(`a delayed save cannot close a panel retired during its wait (main=${initiatedByMain})`, async () => {
    const pending = deferred();
    const h = harness({ beforeClose: () => pending.promise });
    await h.main.prepare(true);
    const { tab_id } = await h.main.open(panel);
    const child = h.child(h.commands.find(command => command.cmd === panel.cmd));
    const closing = initiatedByMain ? h.main.closeTab(tab_id, '') : child.closeThis('');
    await setImmediate();
    await h.main.prepare(false);
    h.commands.length = 0;
    pending.resolve(true);
    await closing;
    assert.equal(h.commands.length, 0, 'the owner already retired this document');
    assert.equal(h.main.policy().records.length, 0, 'a late close cannot resurrect a retired record');
  });
  test(`panel close preserves the live document until its save succeeds (main=${initiatedByMain})`, async () => {
    const pending = deferred();
    const seen = [];
    let save = pending.promise;
    const h = harness({ beforeClose: record => {
      seen.push(record.panelId);
      return save;
    } });
    await h.main.prepare(true);
    const { tab_id } = await h.main.open({ ...panel, panelId: 'NodeGraph' });
    const child = h.child(h.commands.find(command => command.cmd === panel.cmd));
    h.commands.length = 0;
    const close = () => initiatedByMain ? h.main.closeTab(tab_id, '') : child.closeThis('');
    const closing = close();
    const rejected = assert.rejects(closing, /graph save failed/);
    await setImmediate();
    assert.deepEqual(seen, ['NodeGraph'], 'use the stored panel identity, including title-bar closes');
    assert.equal(h.commands.length, 0, 'a pending graph save must keep its native document alive');
    pending.reject(new Error('graph save failed'));
    await rejected;
    assert.equal(h.commands.length, 0, 'failed saving must not close the document');
    assert.equal(child.policy().enabled, true, 'the document must remain usable for explicit retry');
    assert.equal(h.main.policy().records[0].status, 'ready');
    save = Promise.resolve(true);
    await close();
    assert.deepEqual(seen, ['NodeGraph', 'NodeGraph']);
    assert.equal(h.storage.length, 1);
    assert.deepEqual(h.commands.map(command => command.cmd),
      [initiatedByMain ? 'closePanelTab' : 'closeThisTab']);
  });
}

for (const initiatedByMain of [false, true]) {
  test(`closing a panel drains its outstanding requests (main=${initiatedByMain})`, async () => {
    const pending = deferred();
    const h = harness();
    const send = h.options.send;
    h.options.send = async command => {
      if (command.cmd === 'togglePanelWindowMode') {
        h.commands.push(command);
        return pending.promise;
      }
      return send(command);
    };
    const main = createEditorWindowSession(h.options);
    await main.prepare(true);
    const { tab_id } = await main.open(panel);
    const child = h.child(h.commands.find(command => command.cmd === panel.cmd));
    const toggled = child.open({ cmd: 'togglePanelWindowMode' });
    const rejected = assert.rejects(toggled, /世界已切换/);
    const closed = initiatedByMain ? main.closeTab(tab_id, panel.panelId) : child.closeThis(panel.panelId);
    await setImmediate();
    assert.ok(h.commands.every(command => !['closePanelTab', 'closeThisTab'].includes(command.cmd)));
    await assert.rejects(child.open(panel), /不允许/);
    pending.resolve(true);
    await rejected;
    await closed;
    assert.equal(h.storage.length, 1);
    assert.ok(h.commands.some(command => command.cmd === (initiatedByMain ? 'closePanelTab' : 'closeThisTab')));
  });
}

test('main-page reload retires persisted windows before issuing a fresh generation', async () => {
  const h = harness({ owner: 'main-surface' });
  await h.main.prepare(true);
  const { tab_id } = await h.main.open(panel);
  const child = h.child(h.commands.find(command => command.cmd === panel.cmd));
  const previous = h.main.policy().generation;
  const reloaded = createEditorWindowSession(h.options);
  await reloaded.prepare(true);
  assert.notEqual(reloaded.policy().generation, previous);
  assert.equal(child.policy().enabled, false);
  assert.ok(h.commands.some(command => command.cmd === 'closePanelTab' && command.tabId === tab_id));
  assert.equal(h.storage.length, 1);
});

test('secondary identity survives navigation and closed pages cannot rejoin a session', async () => {
  const h = harness();
  await h.main.prepare(true);
  await h.main.open(panel);
  let query = new URLSearchParams(h.commands.find(command => command.cmd === panel.cmd).routePath.split('?')[1] + '&standalone=1');
  const child = createEditorWindowSession({ ...h.options, getQuery: () => query });
  query = new URLSearchParams(); // A route navigation cannot turn a panel into main.
  await assert.rejects(child.prepare(true), /主窗口/);
  assert.equal(child.policy().enabled, true);
  await child.closeThis(panel.panelId);
  assert.equal(child.policy().enabled, false);
  await assert.rejects(child.open(panel), /不允许/);
});


test('a completed native operation needs no legacy queue barrier', async () => {
  const h = harness();
  const main = createEditorWindowSession(h.options);
  await main.prepare(true);
  h.commands.length = 0;
  await main.open({ cmd: 'focusPanelTab', tabId: 7 });
  assert.deepEqual(h.commands.map(command => command.cmd), ['focusPanelTab']);
  assert.equal(h.storage.length, 1);
});

test('child operations use the Web activity tracker instead of storage records', async () => {
  const pending = deferred();
  const h = harness();
  await h.main.prepare(true);
  const opened = await h.main.open(panel);
  h.options.send = async command => command.cmd === 'togglePanelWindowMode' ? pending.promise : h.send(command);
  const child = h.child(h.commands.find(command => command.cmd === panel.cmd));
  const operation = child.open({ cmd: 'togglePanelWindowMode' });
  await setImmediate();
  assert.equal(h.storage.length, 2, 'only policy and panel records should be persisted');
  h.world.revision++;
  const retirement = h.main.prepare(false);
  await setImmediate();
  assert.equal(h.commands.some(command => command.cmd === 'closePanelTab' && command.tabId === opened.tab_id), false);
  pending.resolve({});
  await assert.rejects(operation, /世界已切换/);
  await retirement;
});


test('retirement flushes the old Web generation before closing native windows and preserves failures for retry', async () => {
  const h = harness();
  const pending = deferred();
  let fail = true, calls = 0;
  const main = createEditorWindowSession({ ...h.options, beforeRetire: async () => {
    calls++;
    if (calls === 1) return; // Initial empty-world preparation.
    if (fail) await pending.promise;
  } });
  await main.prepare(true);
  const oldGeneration = main.policy().generation;
  await main.open(panel);
  h.commands.length = 0;
  h.world.revision++;
  const retirement = main.prepare(false);
  const rejected = assert.rejects(retirement, /graph save failed/);
  await setImmediate();
  assert.equal(main.policy().enabled, false);
  const stored = JSON.parse(h.storage.getItem('policy'));
  assert.equal(stored.generation, oldGeneration, 'flush replies must retain their old transport generation until retirement ends');
  assert.equal(h.commands.length, 0, 'native windows must stay alive while their graph saves are pending');
  pending.reject(new Error('graph save failed'));
  await rejected;
  assert.equal(h.commands.length, 0);
  fail = false;
  await main.prepare(false);
  assert.ok(h.commands.some(command => command.cmd === 'closePanelTab'));
  await main.prepare(true);
  assert.notEqual(main.policy().generation, oldGeneration);
});
