import assert from 'node:assert/strict';
import test from 'node:test';
import { editorApi } from '../../src/api/editorApi.js';

test('file operations reach the Python archive service through the bridge', async t => {
  const previous = globalThis.window;
  t.after(() => { globalThis.window = previous; });
  const request = { archive_session: 'lease', project_path: 'P:/世界', path: '', name: '模板' };
  const tree = { name: '', path: '', isDirectory: true, level: 0, children: [], archive_session: 'lease' };
  const calls = [];
  globalThis.window = { corona: {
    bridge: { call: envelope => {
      const message = JSON.parse(envelope);
      calls.push(message);
      return Promise.resolve(JSON.stringify(message.function === 'file_manager' && message.args[0].op === 'get_file_tree'
        ? tree : true));
    } },
    // Opening a scene reloads the native scene, so this route stays in C++.
    project: { openDocument: value => { calls.push(['openDocument', value]); return Promise.resolve({ ok: true }); } },
  } };
  assert.deepEqual(await editorApi.files.getFileTree(request), { ...tree, project_path: 'P:/世界' });
  assert.equal(await editorApi.files.createFolder(request), true);
  assert.equal(await editorApi.files.createActorTemplate(request), true);
  assert.equal(await editorApi.files.renameItem(request), true);
  assert.equal(await editorApi.files.deleteItem(request), true);
  assert.deepEqual(await editorApi.project.openDocument(request), { ok: true });
  assert.deepEqual(calls.at(-1), ['openDocument', request]);
  const ops = calls.filter(call => call.service === 'ProjectArchive').map(call => call.args[0].op);
  assert.deepEqual(ops, ['get_file_tree', 'create_folder', 'create_file', 'rename_item', 'delete_item']);
  for (const message of calls.filter(call => call.service === 'ProjectArchive')) {
    assert.equal(message.args[0].archive_session, 'lease');
    assert.equal(message.args[0].project_path, 'P:/世界');
  }
  for (const retired of ['getProjectInfo', 'getFiles', 'createFile']) assert.equal(editorApi.files[retired], undefined);
});

test('file operation refusals surface as rejections with the service code', async t => {
  const previous = globalThis.window;
  t.after(() => { globalThis.window = previous; });
  const request = { archive_session: 'lease', project_path: 'P:/世界', path: 'scene.ini' };
  globalThis.window = { corona: {
    // The bridge rejects a service refusal; the facade does not inspect payloads.
    bridge: { call: () => Promise.reject(Object.assign(
      new Error('Cannot change the archive root or scene.ini'), { code: 'PERMISSION_DENIED' })) },
    project: { openDocument: () => Promise.resolve({ ok: true }) },
  } };
  await assert.rejects(editorApi.files.deleteItem(request), error => {
    assert.equal(error.code, 'PERMISSION_DENIED');
    assert.equal(error.message, 'Cannot change the archive root or scene.ini');
    return true;
  });
  await assert.rejects(editorApi.files.getFileTree(request), error => error.code === 'PERMISSION_DENIED');
});
