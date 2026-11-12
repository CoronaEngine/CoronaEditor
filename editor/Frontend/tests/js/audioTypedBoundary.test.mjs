import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { editorApi } from '../../src/api/editorApi.js';

const source = fs.readFileSync(new URL('../../src/api/editorApi.js', import.meta.url), 'utf8');

test('audio operations use one typed play/stop per action', () => {
  assert.match(source, /audio:\s*\{[\s\S]*play:/);
  assert.match(source, /audio:\s*\{[\s\S]*stop:/);
  assert.doesNotMatch(source, /call_manifest_editor_api\('sceneTools\.(?:playAudio|stopAudio|actorPlayAudio|actorStopAudio)'/);
});

test('audio preserves opaque resource IDs, actor scope and native failures without JSON', async t => {
  const previous = globalThis.window, stringify = JSON.stringify, parse = JSON.parse;
  t.after(() => { globalThis.window = previous; JSON.stringify = stringify; JSON.parse = parse; });
  const calls = [], result = { status: 'success' };
  const capture = method => async (...args) => { calls.push([method, ...args]); return result; };
  globalThis.window = { corona: { audio: { play: capture('play'), stop: capture('stop') } } };
  JSON.stringify = JSON.parse = () => { throw new Error('JSON transport forbidden'); };
  const id = '18446744073709551615', scope = { archive_session: 'archive' };
  assert.equal(await editorApi.audio.play({ resource: id }, { loop: false }), result);
  assert.equal(await editorApi.audio.stop({ resource: id }), result);
  assert.equal(await editorApi.audio.play({ scene: 'scene', actor: 'actor-guid', ...scope }, { loop: false }), result);
  assert.equal(await editorApi.audio.stop({ scene: 'scene', actor: 'actor-guid', ...scope }), result);
  assert.deepEqual(calls, [
    ['play', { resource: id, loop: false }], ['stop', { resource: id }],
    ['play', { scene: 'scene', actor: 'actor-guid', archive_session: 'archive', loop: false }],
    ['stop', { scene: 'scene', actor: 'actor-guid', archive_session: 'archive' }],
  ]);
  const failure = Object.assign(new Error('old archive'), { code: 'PROJECT_CONTEXT_CHANGED' });
  window.corona.audio.play = async () => { throw failure; };
  await assert.rejects(editorApi.audio.play({ scene: 'scene', actor: 'actor-guid', ...scope }), e => e === failure);
  for (const name of ['playAudio', 'stopAudio', 'actorPlayAudio', 'actorStopAudio']) {
    assert.equal(editorApi.sceneTools?.[name], undefined);
  }
});
