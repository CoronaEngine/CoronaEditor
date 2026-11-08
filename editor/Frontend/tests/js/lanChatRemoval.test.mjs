import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { editorApi } from '../../src/api/editorApi.js';

test('LANChat facade and store are retired while named network bindings remain', async () => {
  assert.equal(editorApi.lanChat, undefined);
  assert.equal(fs.existsSync(new URL('../../src/stores/lanchat.js', import.meta.url)), false);
  const previous = globalThis.window;
  const reply = { active: false, local_ip: '192.0.2.1' };
  globalThis.window = { corona: { network: { getSessionInfo: async () => reply } } };
  try {
    assert.equal(await editorApi.network.getSessionInfo(), reply);
  } finally {
    globalThis.window = previous;
  }
});

test('world entry and local IP lookup have no chat dependency', () => {
  for (const file of ['App.vue', 'views/layout/NewGame.vue', 'views/layout/JoinGame.vue',
    'services/projectLauncherService.js']) {
    assert.doesNotMatch(fs.readFileSync(new URL(`../../src/${file}`, import.meta.url), 'utf8'), /lan_?chat/i);
  }
  const join = fs.readFileSync(new URL('../../src/views/layout/JoinGame.vue', import.meta.url), 'utf8');
  assert.match(join, /editorApi\.network\.getSessionInfo\(\)/);
  assert.match(join, /result\.local_ip/);
});

test('retired LAN chat panel labels are removed from both locales', () => {
  for (const locale of ['en-US', 'zh-CN']) {
    const source = fs.readFileSync(new URL(`../../src/i18n/messages/${locale}.js`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /局域网聊天|LAN Chat/);
  }
});
