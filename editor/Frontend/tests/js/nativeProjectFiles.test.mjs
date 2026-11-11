import assert from 'node:assert/strict';
import test from 'node:test';
import { editorApi } from '../../src/api/editorApi.js';
import { saveBlocklyTarget, loadBlocklyTarget } from '../../src/blockly/targetArchive.js';

test('project document facades call the Python bridge and parse its records', async t => {
  const calls = [];
  const record = { status: 'saved', document: { workspace: { nested: [null, false, 1.5, '世界'] } } };
  globalThis.window = { corona: { bridge: { call: envelope => {
    calls.push(JSON.parse(envelope));
    return Promise.resolve(JSON.stringify(record));
  } } } };
  t.after(() => { delete globalThis.window; });
  const scope = { archive_session: 'first', project_path: '/world', identity: ['node_graph', 'project', '', ''] };
  assert.deepEqual(await editorApi.projectFiles.save(scope), record);
  assert.deepEqual(await editorApi.projectFiles.load(scope), record);
  assert.deepEqual(calls, [
    { service: 'ProjectFiles', function: 'save', args: [scope] },
    { service: 'ProjectFiles', function: 'load', args: [scope] },
  ]);
});

test('target archives pass identity values and workspace objects with JSON disabled', async t => {
  const calls = [];
  const workspace = { graph: { nodes: [{ id: '中文', state: [null, true, 0] }] } };
  const record = { status: 'saved', revision: 'revision', code_path: 'Scripts/files/run.py', document_path: 'Scripts/files/document.json' };
  t.mock.method(editorApi.projectFiles, 'save', async request => {
    calls.push(['save', request]);
    return { ...record, document: request.document };
  });
  t.mock.method(editorApi.projectFiles, 'load', async request => {
    calls.push(['load', request]);
    return { ...record, status: 'loaded', document: { workspace } };
  });
  const payload = { archive_session: 'first', project_path: '/world', script_kind: 'node_graph',
    target_type: 'model', scene_name: 'scene.ini', actor_name: '角色:"A"', code: '# 代码', workspace };
  const stringify = JSON.stringify;
  const parse = JSON.parse;
  let saved, loaded;
  try {
    JSON.stringify = JSON.parse = () => { throw Error('JSON transport forbidden'); };
    saved = await saveBlocklyTarget(payload);
    loaded = await loadBlocklyTarget(payload);
  } finally { JSON.stringify = stringify; JSON.parse = parse; }
  assert.equal(saved.workspace, workspace);
  assert.equal(loaded.workspace, workspace);
  assert.equal(saved.target.revision, 'revision');
  for (const [, request] of calls) {
    assert.deepEqual(request.identity, ['node_graph', 'actor', 'scene.ini', '角色:"A"']);
    assert.equal('key' in request, false);
    assert.equal(request.archive_session, 'first');
    assert.equal(request.project_path, '/world');
  }
  assert.equal(calls[0][1].document.workspace, workspace);
  assert.equal(calls[0][1].document.target.target_type, 'actor');
  assert.equal(calls[0][1].code, '# 代码');
});
