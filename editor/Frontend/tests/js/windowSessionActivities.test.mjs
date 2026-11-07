import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createWebMessages } from '../../src/api/webMessages.js';
import { createWindowSessionActivities } from '../../src/services/windowSessionActivities.js';

test('main window drains live activities reported by every Web document', async t => {
  const scope = crypto.randomUUID();
  const mainMessages = createWebMessages({ scope, role: 'main', getGeneration: () => 'world' });
  const dockMessages = createWebMessages({ scope, getGeneration: () => 'world' });
  const main = createWindowSessionActivities(mainMessages, { wait: () => delay(1) });
  const dock = createWindowSessionActivities(dockMessages, { wait: () => delay(1) });
  t.after(() => { main.dispose(); dock.dispose(); mainMessages.dispose(); dockMessages.dispose(); });

  const id = dock.begin({ source: 'tab-17', kind: 'operation' });
  let drained = false;
  const draining = main.drain().then(() => { drained = true; });
  await delay(25);
  assert.equal(drained, false);
  dock.end(id);
  await draining;
  assert.equal(drained, true);
});

test('main window can drain activities for one closing tab without blocking another', async t => {
  const scope = crypto.randomUUID();
  const mainMessages = createWebMessages({ scope, role: 'main', getGeneration: () => 'world' });
  const dockMessages = createWebMessages({ scope, getGeneration: () => 'world' });
  const main = createWindowSessionActivities(mainMessages, { wait: () => delay(1) });
  const dock = createWindowSessionActivities(dockMessages, { wait: () => delay(1) });
  t.after(() => { main.dispose(); dock.dispose(); mainMessages.dispose(); dockMessages.dispose(); });

  const closingTab = dock.begin({ source: 'tab-17', kind: 'operation' });
  const otherTab = dock.begin({ source: 'tab-22', kind: 'operation' });
  dock.end(otherTab);
  await main.drain(activity => activity.source === 'tab-22');
  dock.end(closingTab);
});
