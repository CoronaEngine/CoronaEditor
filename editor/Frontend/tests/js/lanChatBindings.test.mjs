import assert from 'node:assert/strict';
import test from 'node:test';
import { editorApi } from '../../src/api/editorApi.js';

test('LANChat uses named bindings with direct replies and structured metadata', async () => {
  const previous = globalThis.window;
  const calls = [];
  const reply = { ok: true, history: [{ metadata: { phase: '中文', count: 3 } }] };
  const methods = ['startRoom', 'startLocalRoom', 'stopRoom', 'stopLocalRoom', 'joinRoom',
    'leaveRoom', 'sendMessage', 'listHistoryRooms', 'loadHistoryRoom', 'getLocalIp', 'addAgent', 'removeAgent'];
  const lanChat = Object.fromEntries(methods.map(method => [method, (...args) => {
    calls.push({ method, args });
    return Promise.resolve(reply);
  }]));
  globalThis.window = { corona: { lanChat, editor: { invoke() {
    throw new Error('LANChat must not use generic invoke or manifest lookup');
  } } } };
  try {
    const room = { room: 'Room', nickname: 'Host', restore_history: true };
    const options = { metadata: { phase: '中文', steps: [1, 2] }, correlation_id: 'request' };
    for (const [method, args, expected] of [
      ['startRoom', [room], [room]], ['startLocalRoom', [room], [room]],
      ['joinRoom', [{ ip: '127.0.0.1', port: 27960 }], [{ ip: '127.0.0.1', port: 27960 }]],
      ['stopRoom', [], []], ['stopLocalRoom', [], []], ['leaveRoom', [], []],
      ['listHistoryRooms', [], []], ['loadHistoryRoom', ['Room'], ['Room']],
      ['getLocalIp', [], []], ['addAgent', [{ name: 'Agent' }], [{ name: 'Agent' }]],
      ['removeAgent', ['agent-id'], ['agent-id']],
      ['sendMessage', ['text', options], ['text', options]],
      ['sendMessage', ['text'], ['text', {}]],
    ]) {
      assert.equal(await editorApi.lanChat[method](...args), reply);
      assert.deepEqual(calls.at(-1), { method, args: expected });
    }
    const failure = Object.assign(new Error('Unavailable'), { code: 'NATIVE_UNAVAILABLE' });
    lanChat.startRoom = () => Promise.reject(failure);
    await assert.rejects(editorApi.lanChat.startRoom(room), error => error === failure);
  } finally {
    globalThis.window = previous;
  }
});
