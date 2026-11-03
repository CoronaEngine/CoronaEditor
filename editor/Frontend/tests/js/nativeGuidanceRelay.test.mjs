import test from 'node:test';
import assert from 'node:assert/strict';
import { createNativeGuidanceRelay } from '../../src/services/nativeGuidanceRelay.js';

test('guidance survives creation of a new dock document, focuses once and deduplicates delivery', async () => {
  const events = [], opened = [], shown = [];
  const send = (event, payload) => events.push({ event, payload });
  const main = createNativeGuidanceRelay({ panelId: 'MainPage', send, open: id => opened.push(id), show: () => {} });
  const target = createNativeGuidanceRelay({ panelId: 'SceneControls', send, show: value => shown.push(value) });
  const guidance = { panelId: 'SceneControls', steps: [{ target: { selectorKey: 'scene-light-x' } }] };
  main.request(guidance);
  const request = events.pop().payload;
  await main.receiveRequest(request);
  target.ready();
  main.receiveReady(events.pop().payload);
  const replay = events.pop().payload;
  await main.receiveRequest(replay);
  await target.receiveRequest(replay);
  main.receiveAccepted(events.pop().payload);
  await target.receiveRequest(replay);
  main.receiveReady({ panelId: 'SceneControls' });
  assert.deepEqual(opened, ['SceneControls']);
  assert.deepEqual(shown, [guidance]);
  assert.deepEqual(events, []);
});
test('guidance does not leak into other panels or outlive its world', async () => {
  const events = [], shown = [];
  const relay = createNativeGuidanceRelay({ panelId: 'CabbageChatPanel',
    send: (...event) => events.push(event), show: value => shown.push(value) });
  await relay.receiveRequest({ requestId: '1', guidance: { panelId: 'SceneControls' } });
  relay.dispose();
  await relay.receiveRequest({ requestId: '2', guidance: { panelId: 'CabbageChatPanel' } });
  relay.ready();
  assert.deepEqual(shown, []);
  assert.deepEqual(events, []);
});
