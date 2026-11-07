import assert from 'node:assert/strict';
import test from 'node:test';
import { editorApi } from '../../src/api/editorApi.js';

test('file operations use named V8 bindings with explicit scope and direct values', async t => {
  const previous = globalThis.window;
  t.after(() => { globalThis.window = previous; });
  const request = { archive_session: 'lease', project_path: 'P:/世界', path: '', name: '模板' };
  const receipt = { archive_session: 'lease', path: '模板.actor', name: '模板' };
  const calls = [];
  const methods = ['getFileTree', 'createFolder', 'createActorTemplate', 'renameItem', 'deleteItem', 'openFile'];
  globalThis.window = { corona: { files: Object.fromEntries(methods.map(name => [name, value => {
    calls.push([name, value]); return Promise.resolve(receipt);
  }])) } };
  for (const method of methods) {
    assert.equal(await editorApi.files[method](request), receipt);
    assert.deepEqual(calls.at(-1), [method, request]);
  }
  for (const retired of ['getProjectInfo', 'getFiles', 'createFile']) assert.equal(editorApi.files[retired], undefined);
});
