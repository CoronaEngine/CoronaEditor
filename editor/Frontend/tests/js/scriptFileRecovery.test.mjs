import assert from 'node:assert/strict';
import test from 'node:test';
import { editorApi } from '../../src/api/editorApi.js';
import { readScriptProject, startScriptFile } from '../../src/services/scriptFileService.js';

const request = { requestId: 'panel-click-1', archive_session: 'first-A', project_path: '/A' };
const timeout = () => Object.assign(new Error('lost acknowledgement'), { code: 504 });

test('a retry after reopening the same project keeps the session captured at the click', async t => {
  let session = 'first-A';
  t.mock.method(editorApi.scene, 'readActive', async () => ({ data: { project_path: '/A', archive_session: session } }));
  const start = { requestId: 'delayed', ...await readScriptProject() };
  let attempts = 0;
  await assert.rejects(startScriptFile(start, {
    getRun: async () => ({ data: { status: 'unknown' } }),
    runFile: async payload => {
      assert.equal(payload.archive_session, 'first-A');
      if (++attempts === 1) { session = 'second-A'; throw timeout(); }
      throw new Error('PROJECT_CONTEXT_CHANGED');
    },
  }), /PROJECT_CONTEXT_CHANGED/);
  assert.equal(attempts, 2);
  assert.equal((await readScriptProject()).archive_session, 'second-A');
});

test('a lost acknowledgement recovers the existing Python run', async () => {
  let starts = 0;
  const receipt = { data: { status: 'running', runId: 'run-1' } };
  const result = await startScriptFile(request, {
    runFile: async () => { starts++; throw timeout(); },
    getRun: async id => { assert.equal(id, request.requestId); return receipt; },
  });
  assert.equal(result, receipt);
  assert.equal(starts, 1);
});

test('a request that never arrived is retried with the original identity', async () => {
  const calls = [];
  await startScriptFile(request, {
    runFile: async payload => {
      calls.push(payload);
      if (calls.length === 1) throw timeout();
      return { data: { status: 'started', runId: 'run-2' } };
    },
    getRun: async () => ({ data: { status: 'unknown' } }),
  });
  assert.deepEqual(calls, [request, request]);
});

test('an unavailable receipt keeps the request cancellable', async () => {
  await assert.rejects(startScriptFile(request, {
    runFile: async () => { throw timeout(); },
    getRun: async () => { throw new Error('host busy'); },
  }), { scriptRunUnconfirmed: true });
});
