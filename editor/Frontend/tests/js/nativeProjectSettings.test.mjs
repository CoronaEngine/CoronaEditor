import assert from 'node:assert/strict';
import test from 'node:test';
import { editorApi } from '../../src/api/editorApi.js';

const install = (window, calls, options = {}) => {
  window.corona = {
    scene: { readActive: () => {
      calls.push(['readActive']);
      return Promise.resolve({ archive_session: 'a', project_path: 'P:/世界', read_only: false, name: '世界' });
    } },
    bridge: { call: envelope => {
      const message = JSON.parse(envelope);
      calls.push([message.service, message.function, message.args]);
      return Promise.resolve(JSON.stringify(message.function === 'project_info'
        ? { name: '世界', mode: 'creative', prompt: '世界观', project_path: 'P:/世界' }
        : options.receipt));
    } },
    projectSettings: { saveActiveProjectInfo: value => {
      calls.push(['save', value]);
      return Promise.resolve(options.receipt);
    } },
  };
};

test('project documents route through the bridge with revision-only identity', async t => {
  const previous = globalThis.window;
  t.after(() => { globalThis.window = previous; });
  const request = { archive_session: 'a', project_path: 'P:/世界', document: 'notes.json',
    revision: 'digest', content: { nested: [null, {}, [], '中文', 2 ** 40] } };
  const receipt = { success: true, revision: 'next', content: request.content };
  const calls = [];
  globalThis.window = {};
  install(globalThis.window, calls, { receipt });
  assert.deepEqual(await editorApi.projectSettings.readProjectDocument(request), receipt);
  assert.deepEqual(await editorApi.projectSettings.commitProjectDocument(request), receipt);
  const documents = calls.filter(call => call[1] === 'read_document' || call[1] === 'commit_document');
  assert.deepEqual(documents.map(call => call[1]), ['read_document', 'commit_document']);
  for (const [service, , args] of documents) {
    assert.equal(service, 'ProjectArchive');
    assert.equal(args[0].archive_session, 'a');
    assert.equal(args[0].project_path, 'P:/世界');
    assert.equal(args[0].document, 'notes.json');
    assert.equal(args[0].revision_only, true);
  }
  assert.deepEqual(documents[1][2][0].content, request.content);
});

test('active project info composes the scene primitive with archive metadata', async t => {
  const previous = globalThis.window;
  t.after(() => { globalThis.window = previous; });
  const calls = [];
  globalThis.window = {};
  install(globalThis.window, calls, { receipt: {} });
  assert.deepEqual(await editorApi.projectSettings.getActiveProjectInfo(), {
    name: '世界', mode: 'creative', prompt: '世界观', project_path: 'P:/世界',
    archive_session: 'a', read_only: false,
  });
  assert.deepEqual(calls[0], ['readActive']);
  assert.deepEqual(calls[1], ['ProjectArchive', 'project_info', [{ path: 'P:/世界' }]]);
});

test('read-only projects keep the synthetic info shape without archive metadata', async t => {
  const previous = globalThis.window;
  t.after(() => { globalThis.window = previous; });
  const calls = [];
  globalThis.window = { corona: {
    scene: { readActive: () => Promise.resolve(
      { archive_session: 'a', project_path: 'P:/外部', read_only: true, name: '外部场景' }) },
    bridge: { call: () => { throw Error('metadata must not be read for read-only scenes'); } },
  } };
  assert.deepEqual(await editorApi.projectSettings.getActiveProjectInfo(), {
    name: '外部场景', mode: 'creative', project_path: 'P:/外部',
    read_only: true, source_path: 'P:/外部', archive_session: 'a',
  });
  assert.deepEqual(calls, []);
});
