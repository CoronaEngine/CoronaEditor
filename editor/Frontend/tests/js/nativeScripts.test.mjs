import assert from 'node:assert/strict';
import test from 'node:test';
import { editorApi } from '../../src/api/editorApi.js';

test('file scripts use only named V8 bindings and direct receipts with JSON disabled', async t => {
  const calls = [];
  const receipt = { status: 'running', runId: 'run-1', requestId: 'click-1' };
  globalThis.window = { corona: { scripts: Object.fromEntries(['runFile', 'getRun', 'stop', 'getStatus'].map(name =>
    [name, (...args) => { calls.push([name, ...args]); return Promise.resolve(receipt); }])) } };
  t.after(() => { delete globalThis.window; });
  const request = { requestId: 'click-1', archive_session: 'one', project_path: '/world', path: 'run.py' };
  const stringify = JSON.stringify;
  const parse = JSON.parse;
  try {
    JSON.stringify = JSON.parse = () => { throw Error('JSON transport forbidden'); };
    assert.equal(await editorApi.scripts.runFile(request), receipt);
    assert.equal(await editorApi.scripts.getRun('click-1'), receipt);
    assert.equal(await editorApi.scripts.stop('run-1', false, 'click-1'), receipt);
    assert.equal(await editorApi.scripts.getStatus(), receipt);
  } finally { JSON.stringify = stringify; JSON.parse = parse; }
  assert.deepEqual(calls, [['runFile', request], ['getRun', 'click-1'], ['stop', 'run-1', false, 'click-1'], ['getStatus']]);
});
