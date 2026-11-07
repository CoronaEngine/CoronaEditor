import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { editorApi } from '../../src/api/editorApi.js';

const source = fs.readFileSync(new URL('../../src/api/editorApi.js', import.meta.url), 'utf8');

test('audio operations use explicit typed resource and actor bindings', () => {
  assert.match(source, /audio:\s*\{[\s\S]*playResource:/);
  assert.match(source, /audio:\s*\{[\s\S]*playActor:/);
  assert.doesNotMatch(source, /call_manifest_editor_api\('sceneTools\.(?:playAudio|stopAudio|actorPlayAudio|actorStopAudio)'/);
});

test('audio preserves opaque resource IDs, actor scope and native failures without JSON', async t => {
  const previous = globalThis.window, stringify = JSON.stringify, parse = JSON.parse;
  t.after(() => { globalThis.window = previous; JSON.stringify = stringify; JSON.parse = parse; });
  const calls = [], result = { status: 'success' };
  const capture = method => async (...args) => { calls.push([method, ...args]); return result; };
  globalThis.window = { corona: { audio: {
    playResource: capture('playResource'), stopResource: capture('stopResource'),
    playActor: capture('playActor'), stopActor: capture('stopActor'),
  } } };
  JSON.stringify = JSON.parse = () => { throw new Error('JSON transport forbidden'); };
  const id = '18446744073709551615', scope = { archive_session: 'archive' };
  assert.equal(await editorApi.audio.playResource(id), result);
  assert.equal(await editorApi.audio.stopResource(id), result);
  assert.equal(await editorApi.audio.playActor('scene', 'actor-guid', scope), result);
  assert.equal(await editorApi.audio.stopActor('scene', 'actor-guid', scope), result);
  assert.deepEqual(calls, [
    ['playResource', id, false], ['stopResource', id],
    ['playActor', 'scene', 'actor-guid', { ...scope, loop: false }],
    ['stopActor', 'scene', 'actor-guid', scope],
  ]);
  const failure = Object.assign(new Error('old archive'), { code: 'PROJECT_CONTEXT_CHANGED' });
  window.corona.audio.playActor = async () => { throw failure; };
  await assert.rejects(editorApi.audio.playActor('scene', 'actor-guid', scope), e => e === failure);
  for (const name of ['playAudio', 'stopAudio', 'actorPlayAudio', 'actorStopAudio']) {
    assert.equal(editorApi.sceneTools?.[name], undefined);
  }
});
