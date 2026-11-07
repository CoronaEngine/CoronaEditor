import assert from 'node:assert/strict';
import test from 'node:test';
import { editorApi } from '../../src/api/editorApi.js';

test('network calls use named V8 bindings and preserve direct replies and errors', async () => {
  const previous = globalThis.window;
  const calls = [];
  const reply = { ok: true, active: true, discovered_peers: [] };
  const methods = ['startSession', 'stopSession', 'getSessionInfo', 'getDiscoveredPeers',
    'clearDiscoveredPeers', 'searchLan', 'connectToPeer', 'setProjectRoot'];
  const network = Object.fromEntries(methods.map(method => [method, (...args) => {
    calls.push({ method, args });
    return Promise.resolve(reply);
  }]));
  globalThis.window = { corona: { network, editor: { invoke() {
    throw new Error('Network must not request a manifest or use generic invoke');
  } } } };
  try {
    for (const [method, args, expected] of [
      ['startSession', ['主机', 0], ['主机', 0, 27960, 'host']],
      ['startSession', ['Guest', 0, 0, 'client'], ['Guest', 0, 0, 'client']],
      ['stopSession', [], []], ['getSessionInfo', [], []],
      ['getDiscoveredPeers', [], []], ['clearDiscoveredPeers', [], []],
      ['searchLan', [], []], ['connectToPeer', ['127.0.0.1', 27960, 'Peer'], ['127.0.0.1', 27960, 'Peer']],
      ['setProjectRoot', ['D:/世界'], ['D:/世界']],
    ]) {
      assert.equal(await editorApi.network[method](...args), reply);
      assert.deepEqual(calls.at(-1), { method, args: expected });
    }
    const failure = Object.assign(new Error('Network unavailable'), { code: 'NATIVE_UNAVAILABLE' });
    network.getSessionInfo = () => Promise.reject(failure);
    await assert.rejects(editorApi.network.getSessionInfo(), error => error === failure);
  } finally {
    globalThis.window = previous;
  }
});
