import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

const moduleUrl = new URL('../../src/api/webMessages.js', import.meta.url);
const messages = existsSync(moduleUrl) ? await import(moduleUrl) : {};
const deadline = (promise, ms = 1500) => Promise.race([
  promise,
  delay(ms).then(() => { throw new Error('message was not delivered'); }),
]);

function pair(t, options = {}) {
  assert.equal(typeof messages.createWebMessages, 'function', 'the single Web message owner must exist');
  const scope = crypto.randomUUID();
  const main = messages.createWebMessages({ scope, documentId: 'owner', role: 'main', ...options });
  const dock = messages.createWebMessages({ scope, documentId: 'dock', ...options });
  t.after(() => { main.dispose(); dock.dispose(); });
  return { main, dock, scope };
}

test('real BroadcastChannel sends typed data to the owning document and returns a result', async t => {
  const { main, dock } = pair(t);
  main.handle('camera.speed', (value, context) => {
    assert.equal(context.sender, 'dock');
    assert.ok(value.bytes instanceof Uint8Array);
    assert.equal(value.id, '18446744073709551615');
    return { accepted: true, bytes: value.bytes, id: value.id };
  });
  const result = await deadline(dock.request('main', 'camera.speed', {
    bytes: new Uint8Array([1, 2, 255]), id: '18446744073709551615',
  }));
  assert.deepEqual(result, { accepted: true, bytes: new Uint8Array([1, 2, 255]), id: '18446744073709551615' });
});

test('local notification is delivered once as a snapshot and unsubscribe works', async t => {
  const { main } = pair(t);
  const received = [];
  const stop = main.on('changed', value => received.push(value));
  const original = { speed: 2 };
  await main.emit('changed', original, { target: '*' });
  original.speed = 9;
  await delay(30);
  assert.deepEqual(received, [{ speed: 2 }]);
  stop();
  await main.emit('changed', { speed: 3 }, { target: '*' });
  assert.equal(received.length, 1);
});

test('the public owner epoch follows replacement while capability announcements retain it', async t => {
  const { main, dock, scope } = pair(t);
  main.handle('identity', () => true);
  await dock.request('main', 'identity', null);
  assert.equal(typeof main.ownerEpoch, 'string');
  assert.equal(dock.ownerEpoch, main.ownerEpoch);
  const previous = dock.ownerEpoch;
  const replacement = messages.createWebMessages({ scope, role: 'main' });
  t.after(() => replacement.dispose());
  const announced = new Promise(resolve => t.after(dock.on('replacement-ready', resolve)));
  replacement.handle('identity', () => true);
  await replacement.emit('replacement-ready', true);
  await announced;
  assert.equal(dock.ownerEpoch, replacement.ownerEpoch);
  assert.notEqual(dock.ownerEpoch, previous);
  replacement.handle('another-capability', () => true);
  await dock.request('main', 'another-capability', null);
  assert.equal(dock.ownerEpoch, replacement.ownerEpoch);
});

test('directed notifications do not reach another dock or the sender', async t => {
  const { main, dock, scope } = pair(t);
  const other = messages.createWebMessages({ scope, documentId: 'other' });
  t.after(() => other.dispose());
  const leaked = [];
  main.on('focus', value => leaked.push(value));
  other.on('focus', value => leaked.push(value));
  const received = new Promise(resolve => dock.on('focus', resolve));
  await main.emit('focus', { panel: 'settings' }, { target: 'dock' });
  assert.deepEqual(await deadline(received), { panel: 'settings' });
  await delay(30);
  assert.deepEqual(leaked, []);
});

test('request IDs isolate concurrent out of order replies and preserve remote errors', async t => {
  const { main, dock } = pair(t);
  main.handle('read', async value => { await delay(value === 1 ? 30 : 1); return value; });
  main.handle('fail', () => { throw Object.assign(new Error('camera changed'), { code: 'STALE_CAMERA', details: { camera: 'old' } }); });
  assert.deepEqual(await Promise.all([dock.request('main', 'read', 1), dock.request('main', 'read', 2)]), [1, 2]);
  await assert.rejects(dock.request('main', 'fail', null), error =>
    error.code === 'STALE_CAMERA' && error.message === 'camera changed' && error.details.camera === 'old');
  await assert.rejects(dock.request('main', 'missing', null), { code: 'METHOD_NOT_FOUND' });
});

test('timeout and cancellation never replay side effects', async t => {
  const { main, dock } = pair(t);
  let calls = 0;
  main.handle('slow', async () => { calls++; await delay(80); return true; });
  await assert.rejects(dock.request('main', 'slow', null, { timeoutMs: 30 }), { code: 'MESSAGE_TIMEOUT' });
  await delay(100);
  assert.equal(calls, 1);
  const controller = new AbortController();
  const request = dock.request('main', 'slow', null, { signal: controller.signal });
  controller.abort();
  await assert.rejects(request, { code: 'ABORTED' });
  await delay(100);
  assert.ok(calls <= 2);
});

test('world changes reject in-flight requests and discard stale notifications', async t => {
  let generation = 'world-1';
  const { main, dock } = pair(t, { getGeneration: () => generation });
  let release;
  main.handle('slow', () => new Promise(resolve => { release = resolve; }));
  const request = dock.request('main', 'slow', null, { timeoutMs: 300 });
  for (let i = 0; i < 50 && !release; i++) await delay(5);
  assert.equal(typeof release, 'function');
  generation = 'world-2';
  release('old value');
  await assert.rejects(request, { code: 'CONTEXT_CHANGED' });
});

test('dispose rejects pending calls and removes the channel listener', async t => {
  const { main, dock } = pair(t);
  main.handle('wait', () => new Promise(() => {}));
  const request = dock.request('main', 'wait', null);
  const rejected = assert.rejects(request, { code: 'MESSAGES_CLOSED' });
  dock.dispose();
  await rejected;
  await assert.rejects(dock.request('main', 'wait', null), { code: 'MESSAGES_CLOSED' });
});

test('same topic in another launch cannot receive messages', async t => {
  const { main } = pair(t);
  const isolated = messages.createWebMessages({ scope: crypto.randomUUID(), role: 'main' });
  t.after(() => isolated.dispose());
  const received = [];
  isolated.on('changed', value => received.push(value));
  await main.emit('changed', { secret: 'scope-local' }, { target: '*' });
  await delay(40);
  assert.deepEqual(received, []);
});

test('uncloneable payload fails immediately and leaves subsequent calls usable', async t => {
  const { main, dock } = pair(t);
  main.handle('echo', value => value);
  await assert.rejects(dock.request('main', 'echo', { callback() {} }), { code: 'INVALID_MESSAGE' });
  assert.deepEqual(await dock.request('main', 'echo', { value: 4 }), { value: 4 });
});

test('main reload invalidates old work and new requests reach the replacement once', async t => {
  const { main, dock, scope } = pair(t);
  let release;
  main.handle('wait', () => new Promise(resolve => { release = resolve; }));
  const request = dock.request('main', 'wait', null);
  const rejected = assert.rejects(request, { code: 'CONTEXT_CHANGED' });
  for (let i = 0; i < 50 && !release; i++) await delay(5);
  main.dispose();
  const replacement = messages.createWebMessages({ scope, role: 'main', documentId: 'owner' });
  t.after(() => replacement.dispose());
  replacement.handle('wait', () => 'new owner');
  await rejected;
  await delay(20);
  release('late old owner');
  assert.equal(await dock.request('main', 'wait', null), 'new owner');
});

test('duplicate handlers are rejected and disposal allows a fresh registration', async t => {
  const { main } = pair(t);
  const remove = main.handle('unique', () => 1);
  assert.throws(() => main.handle('unique', () => 2), { code: 'DUPLICATE_HANDLER' });
  remove();
  main.handle('unique', () => 3);
  assert.equal(await main.request('main', 'unique', null), 3);
});

test('all consumers of one surface share one transport and immutable launch identity', async t => {
  assert.equal(typeof messages.getWebMessages, 'function');
  const storage = new Map();
  const surface = { location: { hash: '#/MainPage' },
    sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    addEventListener() {}, removeEventListener() {} };
  const first = messages.getWebMessages(surface);
  t.after(() => first.dispose());
  surface.location.hash = '#/EditorSettings?standalone=1&uiOwner=other';
  assert.equal(messages.getWebMessages(surface), first);
  assert.ok(storage.get('corona.editorUi.owner'));
});

test('readiness handshake waits for a late main handler without resending the operation', async t => {
  const { main, dock } = pair(t);
  let calls = 0;
  const request = dock.request('main', 'mounted.later', null, { waitForHandler: true, timeoutMs: 300 });
  await delay(30);
  main.handle('mounted.later', () => ++calls);
  assert.equal(await request, 1);
  await delay(30);
  assert.equal(calls, 1);
});

test('handler discovery selects one Dock and never broadcasts the side effect', async t => {
  const { main, dock, scope } = pair(t);
  const other = messages.createWebMessages({ scope, documentId: 'other' });
  t.after(() => other.dispose());
  dock.handle('graph.apply', value => ({ applied: value }));
  assert.equal(typeof main.requestHandler, 'function');
  assert.deepEqual(await main.requestHandler('graph.apply', 'graph'), { applied: 'graph' });
  other.handle('graph.apply', () => assert.fail('ambiguous owner must not execute'));
  await assert.rejects(main.requestHandler('graph.apply', 'graph'), { code: 'AMBIGUOUS_HANDLER' });
});

test('reloaded documents get new identities even when the native window identity stays fixed', t => {
  const scope = crypto.randomUUID();
  const makeSurface = () => ({ location: { hash: `#/NodeGraph?uiOwner=${scope}&uiWindow=stable-tab&uiSession=world` },
    addEventListener() {}, removeEventListener() {} });
  const oldDocument = messages.getWebMessages(makeSurface());
  const newDocument = messages.getWebMessages(makeSurface());
  t.after(() => { oldDocument.dispose(); newDocument.dispose(); });
  assert.notEqual(oldDocument.documentId, newDocument.documentId);
  assert.notEqual(oldDocument.documentId, 'stable-tab');
});

test('a failed departure notification still closes the channel and rejects pending calls', async t => {
  let failSends = false, closes = 0;
  const errors = [];
  const main = messages.createWebMessages({ scope: crypto.randomUUID(), role: 'main',
    channelFactory: () => ({ postMessage() { if (failSends) throw new Error('channel unavailable'); },
      addEventListener() {}, removeEventListener() {}, close() { closes++; } }),
    onError: error => errors.push(error),
  });
  main.handle('wait', () => new Promise(() => {}));
  const pending = main.request('main', 'wait', null);
  const rejected = assert.rejects(pending, { code: 'MESSAGES_CLOSED' });
  t.after(async () => { failSends = false; main.dispose(); await rejected; });
  failSends = true;
  assert.doesNotThrow(() => main.dispose());
  await rejected;
  assert.equal(closes, 1);
  assert.equal(errors.length, 1);
  await assert.rejects(main.request('main', 'wait', null), { code: 'MESSAGES_CLOSED' });
});

test('handler readiness waits for registration, then sends the operation exactly once', async t => {
  const { main, dock } = pair(t);
  let calls = 0;
  const request = main.requestHandler('late.save', { archive: 'world' },
    { waitForHandler: true, readyTimeoutMs: 500, timeoutMs: 500 });
  await delay(100);
  dock.handle('late.save', payload => { calls++; return payload; });
  assert.deepEqual(await request, { archive: 'world' });
  assert.equal(calls, 1);
});

test('readiness and execution deadlines are separate and missing owners fail explicitly', async t => {
  const { main, dock } = pair(t);
  const request = main.requestHandler('late.slow', null,
    { waitForHandler: true, readyTimeoutMs: 400, timeoutMs: 100 });
  await delay(120);
  dock.handle('late.slow', async () => { await delay(40); return 'saved'; });
  assert.equal(await request, 'saved');
  await assert.rejects(main.requestHandler('absent', null,
    { waitForHandler: true, readyTimeoutMs: 80, timeoutMs: 500 }), { code: 'METHOD_NOT_FOUND' });
});

test('discovery does not route to a crashed document advertised by an earlier request', async t => {
  const scope = crypto.randomUUID();
  const factory = name => {
    const channel = new BroadcastChannel(name);
    return channel;
  };
  const main = messages.createWebMessages({ scope, role: 'main', channelFactory: factory });
  const oldChannel = new BroadcastChannel(`corona-web-messages-v1:${scope}`);
  const old = messages.createWebMessages({ scope, documentId: 'old', channelFactory: () => oldChannel });
  t.after(() => { main.dispose(); oldChannel.close(); });
  old.handle('save', value => value);
  assert.equal(await main.requestHandler('save', 1), 1);
  oldChannel.close(); // Simulate renderer death without a departure notification.
  const replacement = messages.createWebMessages({ scope, documentId: 'replacement' });
  t.after(() => replacement.dispose());
  replacement.handle('save', value => value + 1);
  assert.equal(await main.requestHandler('save', 1), 2);
});

test('async subscriber failures are reported without interrupting subsequent notifications', async t => {
  const errors = [];
  const { main } = pair(t, { onError: error => errors.push(error) });
  main.on('changed', async () => { throw new Error('subscriber failed'); });
  const received = [];
  main.on('changed', value => received.push(value));
  await main.emit('changed', 1);
  await delay(10);
  assert.deepEqual(received, [1]);
  assert.equal(errors[0]?.message, 'subscriber failed');
});

test('replacement owner rejects late events and announcements from the retired main document', async t => {
  const { main, dock, scope } = pair(t);
  const received = [];
  dock.on('state', value => received.push(value));
  await main.emit('state', 'old-before-reload');
  await delay(30);
  const replacement = messages.createWebMessages({ scope, role: 'main' });
  t.after(() => replacement.dispose());
  replacement.handle('identity', () => 'replacement');
  await replacement.emit('state', 'new-state');
  await delay(30);
  await main.emit('state', 'late-old-state');
  // Re-announcing capabilities from the retired document must not reclaim ownership.
  main.handle('identity', () => 'retired');
  await delay(30);
  assert.deepEqual(received, ['old-before-reload', 'new-state']);
  assert.equal(await dock.request('main', 'identity'), 'replacement');
  assert.equal(await dock.requestHandler('identity'), 'replacement');
});

test('owner replacement removes stale discovery candidates before routing the operation', async t => {
  const { main, dock, scope } = pair(t);
  let oldCalls = 0;
  main.handle('apply', () => { oldCalls++; return 'old'; });
  await delay(20);
  const request = dock.requestHandler('apply');
  await delay(15);
  const replacement = messages.createWebMessages({ scope, role: 'main' });
  t.after(() => replacement.dispose());
  replacement.handle('apply', () => 'new');
  assert.equal(await request, 'new');
  assert.equal(oldCalls, 0);
});

test('owner replacement rejects an in-flight request discovered at that owner', async t => {
  const { main, dock, scope } = pair(t);
  let release;
  main.handle('apply', () => new Promise(resolve => { release = resolve; }));
  const request = dock.requestHandler('apply', null, { timeoutMs: 180 });
  const rejected = assert.rejects(request, { code: 'CONTEXT_CHANGED' });
  for (let i = 0; i < 40 && !release; i++) await delay(5);
  assert.equal(typeof release, 'function');
  const replacement = messages.createWebMessages({ scope, role: 'main' });
  t.after(() => replacement.dispose());
  await rejected;
  release('retired');
});


test('requestAll flushes every current document once, including local handlers, with structured data', async t => {
  const { main, dock, scope } = pair(t);
  const other = messages.createWebMessages({ scope, documentId: 'second-dock' });
  t.after(() => other.dispose());
  const calls = [];
  for (const document of [main, dock, other]) document.handle('graph.flush', async value => {
    calls.push(document.documentId);
    assert.ok(value.bytes instanceof Uint8Array);
    return { document: document.documentId, archiveSession: value.archiveSession };
  });
  const result = await main.requestAll('graph.flush', { archiveSession: 'old-archive', bytes: new Uint8Array([1,255]) });
  assert.deepEqual(calls.sort(), ['dock','owner','second-dock']);
  assert.deepEqual(result.map(x => x.document).sort(), calls);
  assert.ok(result.every(x => x.archiveSession === 'old-archive'));
  assert.deepEqual(await main.requestAll('not-registered', {}), []);
});

test('requestAll rejects stale or failed participants and never replays the operation', async t => {
  let generation = 'old';
  const { main, dock } = pair(t, { getGeneration: () => generation });
  let release;
  let calls = 0;
  dock.handle('graph.flush', async () => { calls++; await new Promise(resolve => { release = resolve; }); return true; });
  const pending = main.requestAll('graph.flush', {}, { timeoutMs: 500 });
  const rejected = assert.rejects(pending, { code: 'CONTEXT_CHANGED' });
  await deadline((async () => { while (!release) await delay(5); })());
  generation = 'new'; release(); await rejected;
  assert.equal(calls, 1);
  dock.handle('graph.fail', () => { throw Object.assign(new Error('save failed'), { code: 'GRAPH_SAVE_FAILED' }); });
  await assert.rejects(main.requestAll('graph.fail', {}), { code: 'GRAPH_SAVE_FAILED' });
});

test('requestAll rejects a participant leaving during save without replaying other saves', async t => {
  const { main, dock } = pair(t);
  let release, calls = 0;
  main.handle('graph.flush', () => { calls++; return true; });
  dock.handle('graph.flush', () => new Promise(resolve => { release = resolve; }));
  const pending = main.requestAll('graph.flush', {}, { timeoutMs: 500 });
  const rejected = assert.rejects(pending, { code: 'CONTEXT_CHANGED' });
  await deadline((async () => { while (!release) await delay(5); })());
  dock.dispose(); await rejected;
  release(true);
  await delay(20);
  assert.equal(calls, 1);
  assert.deepEqual(await main.requestAll('graph.flush', {}), [true]);
  assert.equal(calls, 2, 'only a new explicit flush may save again');
});

test('requestAll cancellation rejects waiting without restarting in-flight side effects', async t => {
  const { main, dock } = pair(t);
  let release, calls = 0;
  dock.handle('graph.flush', () => { calls++; return new Promise(resolve => { release = resolve; }); });
  const controller = new AbortController();
  const pending = main.requestAll('graph.flush', {}, { signal: controller.signal, timeoutMs: 500 });
  const rejected = assert.rejects(pending, { code: 'ABORTED' });
  await deadline((async () => { while (!release) await delay(5); })());
  controller.abort(); await rejected;
  release(true); await delay(20);
  assert.equal(calls, 1);
  await assert.rejects(main.requestAll('graph.flush', {}, { signal: controller.signal }), { code: 'ABORTED' });
  assert.equal(calls, 1);
});

function controlledDiscovery(t) {
  const channels = new Set(), held = [];
  let hold = false;
  const factory = () => {
    const listeners = new Set();
    const channel = { addEventListener: (_, fn) => listeners.add(fn),
      removeEventListener: (_, fn) => listeners.delete(fn), close: () => channels.delete(channel),
      deliver: data => { for (const listener of listeners) listener({ data }); },
      postMessage(data) {
        const deliver = () => { for (const peer of channels) if (peer !== channel) peer.deliver(structuredClone(data)); };
        if (hold && data.sender === 'dock' && data.kind === 'presence' && data.discoveryId) held.push(deliver);
        else queueMicrotask(deliver);
      } };
    channels.add(channel);
    return channel;
  };
  const { main, dock } = pair(t, { channelFactory: factory });
  return { main, dock, hold: () => { hold = true; }, release: () => { hold = false; held.splice(0).forEach(fn => fn()); } };
}

test('requestAll waits for every known participant to confirm discovery before any side effect', async t => {
  const { main, dock, hold, release } = controlledDiscovery(t);
  const calls = [];
  main.handle('flush', () => { calls.push('main'); return 'main'; });
  dock.handle('flush', () => { calls.push('dock'); return 'dock'; });
  await main.request('dock', 'flush'); // Ensure the initial capability announcement was received.
  calls.length = 0;
  hold();
  const result = main.requestAll('flush', null, { readyTimeoutMs: 500 });
  await delay(90);
  assert.deepEqual(calls, [], 'a slow known participant must not become a partial successful save');
  release();
  assert.deepEqual((await result).sort(), ['dock', 'main']);
  assert.deepEqual(calls.sort(), ['dock', 'main']);
});

test('requestAll fails discovery of a silent known participant without writing a partial result', async t => {
  const { main, dock, hold } = controlledDiscovery(t);
  let writes = 0;
  main.handle('flush', () => ++writes);
  dock.handle('flush', () => ++writes);
  await main.request('dock', 'flush'); writes = 0;
  hold();
  await assert.rejects(main.requestAll('flush', null, { readyTimeoutMs: 110 }), { code: 'MESSAGE_TIMEOUT' });
  assert.equal(writes, 0);
});

test('requestAll rejects a known participant leaving during discovery before other saves execute', async t => {
  const { main, dock, hold } = controlledDiscovery(t);
  let writes = 0;
  main.handle('flush', () => ++writes);
  dock.handle('flush', () => ++writes);
  await main.request('dock', 'flush'); writes = 0;
  hold();
  const rejected = assert.rejects(main.requestAll('flush', null, { readyTimeoutMs: 300 }), { code: 'CONTEXT_CHANGED' });
  dock.dispose();
  await rejected;
  assert.equal(writes, 0);
});
