import assert from 'node:assert/strict';
import test from 'node:test';
import { editorApi } from '../../src/api/editorApi.js';

test('project settings forwards owned values to named V8 methods without envelopes or JSON', async () => {
  const request = { archive_session: 'a', project_path: 'P:/世界', document: 'notes.json',
    revision: 'digest', content: { nested: [null, {}, [], '中文\0', 2 ** 40] } };
  const receipt = { success: true, revision: 'next', content: request.content };
  const calls = [];
  const previous = globalThis.window;
  globalThis.window = { corona: { projectSettings: Object.fromEntries(
    ['readProjectDocument', 'commitProjectDocument', 'getActiveProjectInfo', 'saveActiveProjectInfo']
      .map(method => [method, (...args) => { calls.push([method, args]); return Promise.resolve(receipt); }])) } };
  try {
    for (const method of ['readProjectDocument', 'commitProjectDocument', 'saveActiveProjectInfo']) {
      assert.equal(await editorApi.projectSettings[method](request), receipt);
      assert.equal(calls.at(-1)[1][0], request);
    }
    assert.equal(await editorApi.projectSettings.getActiveProjectInfo(), receipt);
    assert.deepEqual(calls.at(-1)[1], []);
  } finally { globalThis.window = previous; }
});
