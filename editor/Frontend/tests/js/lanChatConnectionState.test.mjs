import assert from 'node:assert/strict';
import test from 'node:test';
import { editorApi } from '../../src/api/editorApi.js';
import { lanchat } from '../../src/stores/lanchat.js';
import { cloneWebDto } from '../../src/utils/cloneWebDto.js';

const event = (name, payload = {}) => lanchat.handleEvent({ channel: 'lanchat', event: name, ...payload });
const snapshot = () => cloneWebDto(lanchat.state);

async function joined(t) {
  event('room_closed');
  t.after(() => event('room_closed'));
  const joins = [];
  t.mock.method(editorApi.lanChat, 'joinRoom', async request => {
    joins.push(request);
    return { ok: true, port: request.port, peer_id: 'guest', you: 'Guest', members: ['Host', 'Guest'] };
  });
  const request = { room: 'fixture-room', ip: '127.0.0.1', port: 27960, nickname: 'Guest' };
  await lanchat.joinRoom(request);
  event('member_update', { members: ['Host', 'Guest'] });
  event('history_snapshot', { history: [{ message_id: 'first', sender_id: 'host', text: 'Existing', seq: 1 }] });
  assert.equal(lanchat.state.connection, 'connected');
  return { joins, request };
}

for (const phase of ['connected', 'closed']) {
  for (const name of ['reconnecting', 'reconnected']) {
    test(`unsupported ${name} event leaves a ${phase} room unchanged`, async t => {
      await joined(t);
      if (phase === 'closed') event('room_closed');
      const before = snapshot();
      event(name, { you: 'Old Guest', members: ['Old Host'],
        history: [{ message_id: 'old', text: 'Old history', seq: 2 }] });
      assert.deepEqual(snapshot(), before);
    });
  }
}

for (const code of ['RECONNECT_FAILED', 'RECONNECT_REJECTED']) {
  test(`${code} has no special partial room-reset transition`, async t => {
    await joined(t);
    const before = snapshot();
    event('error', { code });
    assert.deepEqual(snapshot(), { ...before, error: code });
  });
}

test('native room closure clears the room and explicit join restores it through normal events', async t => {
  const { joins, request } = await joined(t);
  event('room_closed');
  const closed = lanchat.state;
  assert.equal(closed.role, 'none');
  assert.equal(closed.inRoom, false);
  assert.equal(closed.connection, 'idle');
  assert.equal(closed.error, 'ROOM_CLOSED');
  assert.equal(closed.room, '');
  assert.equal(closed.peerId, '');
  assert.equal(closed.nickname, '');
  for (const key of ['members', 'memberDetails', 'messages', 'agents', 'myAgents', 'disclosures']) {
    assert.deepEqual(closed[key], []);
  }
  assert.equal(joins.length, 1, 'closure does not launch an automatic join');
  await lanchat.joinRoom(request);
  assert.equal(lanchat.state.connection, 'connecting');
  assert.equal(lanchat.state.inRoom, false);
  event('member_update', { members: ['Host', 'Guest'] });
  assert.equal(lanchat.state.connection, 'syncing');
  event('history_snapshot', { history: [{ message_id: 'restored', text: 'Restored history', seq: 1 }] });
  assert.equal(lanchat.state.connection, 'connected');
  assert.equal(lanchat.state.inRoom, true);
  assert.equal(lanchat.state.error, '');
  assert.equal(lanchat.state.messages[0].text, 'Restored history');
  assert.equal(joins.length, 2);
});

for (const code of ['ROOM_NOT_FOUND', 'ROOM_MISMATCH', 'JOIN_TIMEOUT', 'HOST_UNREACHABLE']) {
  test(`native ${code} still clears a failed joining room`, async t => {
    const { request } = await joined(t);
    await lanchat.joinRoom(request);
    event('error', { code });
    assert.equal(lanchat.state.connection, 'idle');
    assert.equal(lanchat.state.inRoom, false);
    assert.equal(lanchat.state.role, 'none');
    assert.equal(lanchat.state.room, '');
    assert.equal(lanchat.state.error, code);
  });
}
