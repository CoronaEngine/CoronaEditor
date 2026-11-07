import assert from 'node:assert/strict';
import test from 'node:test';
import { createWebMessages } from '../../src/api/webMessages.js';

const moduleUrl = new URL('../../src/services/viewportCalibrationService.js', import.meta.url);

test('calibration has a domain owner using the public Web message module', async () => {
  const domain = await import(moduleUrl).catch(() => null);
  assert.equal(typeof domain?.createViewportCalibrationService, 'function', 'calibration domain owner is missing');
});

async function setup(t) {
  // Node lazily initializes MessageEvent/undici using JSON internally. Warm the
  // host before forbidding JSON in the application communication under test.
  new MessageEvent('warmup');
  const { createViewportCalibrationService } = await import(moduleUrl);
  const owner = crypto.randomUUID(), scope = owner;
  const mainMessages = createWebMessages({ scope, role: 'main' });
  const peerMessages = createWebMessages({ scope });
  let reads = 0;
  const stored = { pe: 20, angle: 0.2, offset: 14, parallaxScale: 19 };
  const main = createViewportCalibrationService(mainMessages, { owner, main: true,
    store: { get: () => { reads++; return stored; }, set: () => { throw new Error('storage disabled'); } },
  });
  const peer = createViewportCalibrationService(peerMessages, { owner });
  t.after(() => { main.dispose(); peer.dispose(); mainMessages.dispose(); peerMessages.dispose(); });
  return { main, peer, mainMessages, peerMessages, stored, reads: () => reads };
}

test('new Dock hydrates from the main owner and synchronizes payloads when storage is disabled', async t => {
  const { main, peer, stored, reads } = await setup(t);
  assert.equal(peer.ready, false);
  const stringify = JSON.stringify, parse = JSON.parse;
  t.after(() => { JSON.stringify = stringify; JSON.parse = parse; });
  JSON.stringify = JSON.parse = () => { throw new Error('JSON communication is forbidden'); };
  await peer.hydrate();
  assert.equal(peer.ready, true);
  assert.deepEqual(peer.read(), stored);
  const observed = [];
  const stop = peer.subscribe(value => observed.push(value));
  const next = { ...stored, pe: 22 };
  await peer.set(next);
  assert.deepEqual(main.read(), next);
  assert.deepEqual(peer.read(), next);
  assert.deepEqual(observed.at(-1), next);
  assert.equal(reads(), 1, 'persistence is read once by the owner, never as an active message channel');
  stop();
});

test('closing a Dock during its initial request cannot install late calibration state', async t => {
  const { peer } = await setup(t);
  const pending = peer.hydrate();
  peer.dispose();
  assert.equal(await pending, null);
  assert.equal(peer.ready, false);
});

test('a failing view listener cannot reject an accepted calibration update or block other views', async t => {
  const { main, peer, stored } = await setup(t);
  const warnings = [];
  t.mock.method(console, 'warn', (...args) => warnings.push(args));
  main.subscribe(() => { throw new Error('retired view'); });
  const observed = [];
  main.subscribe(value => observed.push(value));
  await peer.hydrate();
  await peer.set({ ...stored, pe: 26 });
  assert.equal(main.read().pe, 26);
  assert.equal(peer.read().pe, 26);
  assert.equal(observed.at(-1).pe, 26);
  assert.equal(warnings.length, 1);
});

test('stale calibration versions and other owners cannot replace the active value', async t => {
  const { main, peer, mainMessages, stored } = await setup(t);
  await peer.hydrate();
  await peer.set({ ...stored, pe: 23 });
  await mainMessages.emit('viewportUi.calibrationChanged', { owner: 'other', revision: 100, calibration: { ...stored, pe: 50 } });
  await mainMessages.emit('viewportUi.calibrationChanged', { owner: main.owner, revision: 0, calibration: stored });
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(peer.read().pe, 23);
});

test('concurrent updates have one owner version order and disposed listeners receive no more values', async t => {
  const { peer, main, stored } = await setup(t);
  await peer.hydrate();
  const observed = [];
  const stop = peer.subscribe(value => observed.push(value));
  await Promise.all([peer.set({ ...stored, pe: 24 }), peer.set({ ...stored, pe: 25 })]);
  assert.equal(main.read().pe, 25);
  assert.equal(peer.read().pe, 25);
  stop();
  const count = observed.length;
  await main.set(stored);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(observed.length, count);
  peer.dispose();
  await assert.rejects(peer.set(stored), error => error.code === 'CONTEXT_CHANGED');
});
