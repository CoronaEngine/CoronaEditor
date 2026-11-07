import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { createWebMessages } from '../../src/api/webMessages.js';
import { createEditorWindowSession } from '../../src/services/editorWindowSession.js';

globalThis.window = {};
const { createEventBus } = await import('../../src/utils/eventBus.js');

test('legacy event subscriptions consume the shared Web transport once and unsubscribe', async t => {
  assert.equal(typeof createEventBus, 'function');
  const scope = crypto.randomUUID();
  const main = createWebMessages({ scope, role: 'main', documentId: 'main' });
  const dock = createWebMessages({ scope, documentId: 'dock' });
  t.after(() => { main.dispose(); dock.dispose(); });
  const bus = createEventBus(dock);
  const received = [];
  const listener = value => received.push(value);
  bus.on('creative-panel-open', listener);
  await main.emit('creative-panel-open', { panelId: 'Object' });
  for (let i = 0; i < 30 && !received.length; i++) await delay(5);
  assert.deepEqual(received, [{ panelId: 'Object' }]);
  bus.off('creative-panel-open', listener);
  await main.emit('creative-panel-open', { panelId: 'ignored' });
  await delay(20);
  assert.equal(received.length, 1);
});

test('window session publishes UI collaboration without issuing a native broadcast', async () => {
  const commands = [], events = [];
  let state = { records: [] };
  const session = createEditorWindowSession({ owner: 'main',
    state: { main: true, read: () => structuredClone(state), write: value => { state = structuredClone(value); } },
    getWorld: () => ({ status: 'ready', mode: 'creative', revision: 1 }), getQuery: () => '',
    send: async command => { commands.push(command); return {}; },
    publish: async (topic, payload) => events.push({ topic, payload }),
  });
  await session.prepare(true);
  commands.length = 0;
  await session.broadcast('creative-panel-open', { panelId: 'Object' });
  assert.deepEqual(commands, []);
  assert.equal(events.length, 1);
  assert.equal(events[0].topic, 'creative-panel-open');
  assert.equal(session.accepts(events[0].payload), true);
});
