import assert from 'node:assert/strict';
import test from 'node:test';
import { startScriptFile } from '../../src/services/scriptFileService.js';

const request = { requestId: 'panel-click-1' };
const timeout = () => Object.assign(new Error('lost acknowledgement'), { code: 504 });

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
