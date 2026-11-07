import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { editorApi } from '../../src/api/editorApi.js';

const source = fs.readFileSync(new URL('../../src/api/editorApi.js', import.meta.url), 'utf8');

test('resource import uses the scoped typed scene binding', () => {
  assert.match(source, /importResourceFile:\s*\(sceneName, fileType = 'model', scope\)\s*=>\s*window\.corona\.scene\.importResourceFile/);
  assert.doesNotMatch(source, /call_manifest_editor_api\('main\.importResourceFile'/);
});

test('typed import preserves selection, media metadata, cancellation and native errors without JSON', async t => {
  const previous = globalThis.window, stringify = JSON.stringify, parse = JSON.parse;
  t.after(() => { globalThis.window = previous; JSON.stringify = stringify; JSON.parse = parse; });
  const calls = [], scope = { archive_session: 'archive' };
  let result;
  globalThis.window = { corona: { scene: { importResourceFile: async (...args) => {
    calls.push(args); return result;
  } } } };
  JSON.stringify = JSON.parse = () => { throw new Error('JSON import transport forbidden'); };
  for (const type of ['model', 'actor', 'ui_image', 'multimedia']) {
    result = { status: 'success', archive_session: 'archive', scene: 'scene.ini', path: 'asset',
      ...(type === 'multimedia' ? { media: { resource_id: '18446744073709551615', type: 'audio' } } : {}) };
    assert.equal(await editorApi.scene.importResourceFile('scene.ini', type, scope), result);
    assert.deepEqual(calls.at(-1), ['scene.ini', { archive_session: 'archive', file_type: type }]);
  }
  result = { status: 'canceled' };
  assert.equal(await editorApi.scene.importResourceFile('scene.ini', 'model', scope), result);
  const error = Object.assign(new Error('old archive'), { code: 'PROJECT_CONTEXT_CHANGED' });
  window.corona.scene.importResourceFile = async () => { throw error; };
  await assert.rejects(editorApi.scene.importResourceFile('scene.ini', 'model', scope), e => e === error);
  assert.equal(editorApi.main, undefined);
});
