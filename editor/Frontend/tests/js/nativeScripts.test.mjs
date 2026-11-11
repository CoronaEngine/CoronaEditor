import assert from 'node:assert/strict';
import test from 'node:test';
import { editorApi } from '../../src/api/editorApi.js';

test('file scripts reach the Python file host through the bridge', async t => {
  const previous = globalThis.window;
  t.after(() => { globalThis.window = previous; });
  const calls = [];
  const receipt = { status: 'running', runId: 'run-1', requestId: 'click-1' };
  globalThis.window = { corona: { bridge: { call: envelope => {
    calls.push(JSON.parse(envelope));
    return Promise.resolve(JSON.stringify(receipt));
  } } } };
  const request = { requestId: 'click-1', archive_session: 'one', project_path: '/world',
    path: 'run.py', revision: 'a'.repeat(64), target_type: 'actor', scene_name: 'scene.ini', actor_name: '角色' };
  assert.deepEqual(await editorApi.scripts.runFile(request), receipt);
  assert.deepEqual(await editorApi.scripts.getRun('click-1'), receipt);
  assert.deepEqual(await editorApi.scripts.stop('run-1', false, 'click-1'), receipt);
  assert.deepEqual(await editorApi.scripts.getStatus(), receipt);
  assert.deepEqual(calls, [
    { service: 'FileScripts', function: 'run_file', args: [request] },
    { service: 'FileScripts', function: 'get_file_run', args: [{ requestId: 'click-1' }] },
    { service: 'FileScripts', function: 'stop_file', args: [{ runId: 'run-1', requestId: 'click-1', restore_state: false }] },
    { service: 'FileScripts', function: 'get_script_status', args: [] },
  ]);
  // The archive identity and revision travel untouched; Python verifies them.
  assert.equal(calls[0].args[0].archive_session, 'one');
  assert.equal(calls[0].args[0].project_path, '/world');
  assert.equal(calls[0].args[0].revision.length, 64);
});
