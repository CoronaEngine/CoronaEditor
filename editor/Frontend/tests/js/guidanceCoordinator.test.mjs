import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createWebMessages } from '../../src/api/webMessages.js';

const url = new URL('../../src/services/guidanceCoordinator.js', import.meta.url);
const guidance = existsSync(url) ? await import(url) : {};
const sample = { panelId: 'SceneControls', steps: [{ text: 'Change light X.' }] };

test('guidance opens once, waits for the new panel handler and displays once', async t => {
  assert.equal(typeof guidance.createGuidanceCoordinator, 'function');
  const scope = crypto.randomUUID();
  const main = createWebMessages({ scope, role: 'main' });
  const chat = createWebMessages({ scope });
  const panel = createWebMessages({ scope });
  t.after(() => { main.dispose(); chat.dispose(); panel.dispose(); });
  const opened = [], shown = [];
  const owner = guidance.createGuidanceCoordinator({ messages: main, panelId: 'MainPage',
    show: () => true, open: async id => {
      opened.push(id);
      await delay(90);
      panel.handle('guidance.panel:SceneControls', value => { shown.push(value); return true; });
    },
  });
  const requester = guidance.createGuidanceCoordinator({ messages: chat, panelId: 'CabbageChatPanel', show: () => true });
  t.after(() => { owner.dispose(); requester.dispose(); });
  assert.equal(await requester.request(sample), true);
  assert.deepEqual(opened, ['SceneControls']);
  assert.deepEqual(shown, [sample]);
});

test('guidance errors are propagated and the display action is never retried', async t => {
  assert.equal(typeof guidance.createGuidanceCoordinator, 'function');
  const messages = createWebMessages({ scope: crypto.randomUUID(), role: 'main' });
  let calls = 0;
  const owner = guidance.createGuidanceCoordinator({ messages, panelId: 'MainPage',
    show: () => { calls++; throw new Error('target disappeared'); } });
  t.after(() => { owner.dispose(); messages.dispose(); });
  await assert.rejects(owner.request({ ...sample, panelId: 'MainPage' }), /target disappeared/);
  await delay(30);
  assert.equal(calls, 1);
});

test('disposing a guidance coordinator aborts waiting for a panel without leaving handlers', async t => {
  assert.equal(typeof guidance.createGuidanceCoordinator, 'function');
  const messages = createWebMessages({ scope: crypto.randomUUID(), role: 'main' });
  const owner = guidance.createGuidanceCoordinator({ messages, panelId: 'MainPage', show: () => true, open: () => {} });
  t.after(() => messages.dispose());
  const pending = owner.request(sample);
  const rejected = assert.rejects(pending, { code: 'ABORTED' });
  owner.dispose();
  await rejected;
  assert.doesNotThrow(() => messages.handle('guidance.show', () => true));
  assert.doesNotThrow(() => messages.handle('guidance.panel:MainPage', () => true));
});
