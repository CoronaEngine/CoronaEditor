import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createWebMessages } from '../../src/api/webMessages.js';
import * as locale from '../../src/i18n/index.js';

test('locale joins the main preference and updates both ways through shared Web messages', async t => {
  const scope = crypto.randomUUID();
  const mainMessages = createWebMessages({ scope, role: 'main' });
  const peerMessages = createWebMessages({ scope });
  let mainLocale = 'en-US', peerLocale = 'zh-CN';
  const main = locale.createLocaleSync(mainMessages, { read: () => mainLocale, apply: value => { mainLocale = value; } });
  const peer = locale.createLocaleSync(peerMessages, { read: () => peerLocale, apply: value => { peerLocale = value; } });
  t.after(() => { main.dispose(); peer.dispose(); mainMessages.dispose(); peerMessages.dispose(); });
  await peer.ready;
  assert.equal(peerLocale, 'en-US');
  peerLocale = 'zh-CN';
  await peer.publish(peerLocale);
  await delay(30);
  assert.equal(mainLocale, 'zh-CN');
  mainLocale = 'en-US';
  await main.publish(mainLocale);
  await delay(30);
  assert.equal(peerLocale, 'en-US');
  peer.dispose();
  await main.publish('zh-CN');
  await delay(30);
  assert.equal(peerLocale, 'en-US');
});
