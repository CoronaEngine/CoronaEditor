import assert from 'node:assert/strict';
import test from 'node:test';
import { editorApi } from '../../src/api/editorApi.js';

test('launcher reads use named V8 bindings and return direct snapshots', async t => {
  const previous = globalThis.window;
  t.after(() => { globalThis.window = previous; });
  const calls = [];
  const results = { getAppVersion: '1.2.0', getRecentProjects: [{ name: '世界', path: 'P:/世界' }],
    getProjectLoadStatus: { active: true, archive_service_ready: true, loading: false } };
  globalThis.window = { corona: { project: Object.fromEntries(Object.entries(results).map(([name, value]) =>
    [name, (...args) => { calls.push([name, args]); return Promise.resolve(value); }])) } };
  for (const [name, value] of Object.entries(results)) {
    assert.equal(await editorApi.project[name](), value);
    assert.deepEqual(calls.at(-1), [name, []]);
  }
});

test('project creation calls one named V8 operation with the original request', async t => {
  const previous = globalThis.window;
  t.after(() => { globalThis.window = previous; });
  const calls = [], result = { name: '世界', path: 'P:/世界' };
  globalThis.window = { corona: { project: Object.fromEntries(['createWorldProject', 'createMultiplayerProject']
    .map(name => [name, request => { calls.push([name, request]); return Promise.resolve(result); }])) } };
  for (const [name, request] of [['createWorldProject', { prompt: '夜空' }],
    ['createMultiplayerProject', { role: 'host' }]]) {
    assert.equal(await editorApi.project[name](request), result);
    assert.deepEqual(calls.at(-1), [name, request]);
    assert.equal(calls.at(-1)[1], request);
  }
});
