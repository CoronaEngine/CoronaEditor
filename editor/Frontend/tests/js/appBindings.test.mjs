import assert from 'node:assert/strict';
import test from 'node:test';
import { editorApi } from '../../src/api/editorApi.js';

test('application exit uses the named binding without manifest discovery or JSON', async () => {
  const previous = globalThis.window;
  const stringify = JSON.stringify, parse = JSON.parse;
  const calls = [];
  globalThis.window = { corona: { app: { closeProcess: (...args) => {
    calls.push(args);
    return Promise.resolve(null);
  } } } };
  JSON.stringify = JSON.parse = () => { throw Error('JSON transport forbidden'); };
  try {
    assert.equal(await editorApi.app.closeProcess(), null);
    assert.deepEqual(calls, [[]]);
    const failure = Object.assign(Error('Unable to queue engine exit'), { code: 'NATIVE_FAILURE' });
    window.corona.app.closeProcess = () => Promise.reject(failure);
    await assert.rejects(editorApi.app.closeProcess(), error => error === failure);
  } finally {
    globalThis.window = previous;
    JSON.stringify = stringify; JSON.parse = parse;
  }
});
