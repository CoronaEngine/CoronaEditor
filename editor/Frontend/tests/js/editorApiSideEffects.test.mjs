import assert from 'node:assert/strict';
import { test } from 'node:test';

// WNC-002 failing cases: the native facade must be import-clean and must not
// own the scene reader (targets WNC-007 / WNC-008).

function fakeHost() {
  const registrations = [];
  const document = {
    hidden: false,
    addEventListener: (type, fn) => { registrations.push(['document', type, fn]); },
    removeEventListener: () => {},
  };
  const window = {
    addEventListener: (type, fn) => { registrations.push(['window', type, fn]); },
    removeEventListener: () => {},
  };
  return { document, window, registrations };
}

test('importing the native facade registers no DOM listeners', async t => {
  const host = fakeHost();
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  globalThis.document = host.document;
  globalThis.window = host.window;
  t.after(() => {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  });
  await import(`../../src/api/editorApi.js?side-effects=${Date.now()}`);
  assert.deepEqual(host.registrations, []);
});

test('the facade exports no scene reader, off handle or scene.observe', async () => {
  const { editorApi } = await import(`../../src/api/editorApi.js?ownership=${Date.now()}`);
  assert.equal('sceneReader' in editorApi, false);
  assert.equal('off' in editorApi, false);
  assert.equal('observe' in editorApi.scene, false);
});
