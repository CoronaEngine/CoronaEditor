import assert from 'node:assert/strict';
import test from 'node:test';
import { memoryStorage } from './windowSessionFixtures.mjs';

test('document identity is captured once from search and hash and survives navigation', async () => {
  const { getWebDocumentIdentity } = await import('../../src/api/webDocument.js');
  const surface = { sessionStorage: memoryStorage(), location: {
    search: '?standalone=1&uiOwner=outer', hash: '#/Object?uiOwner=main&uiSession=world&uiWindow=panel',
  } };
  const identity = getWebDocumentIdentity(surface);
  assert.equal(identity.role, 'peer');
  assert.equal(identity.owner, 'main');
  assert.equal(identity.generation, 'world');
  assert.equal(identity.windowId, 'panel');
  surface.location = { hash: '#/' };
  assert.equal(getWebDocumentIdentity(surface), identity);
});

test('tagged documents are peers even without standalone and cannot create their own owner', async () => {
  const { getWebDocumentIdentity } = await import('../../src/api/webDocument.js');
  const surface = { sessionStorage: memoryStorage(), location: { hash: '#/Object?uiOwner=main&uiSession=world' } };
  assert.equal(getWebDocumentIdentity(surface).role, 'peer');
  assert.equal(surface.sessionStorage.length, 0);
  assert.throws(() => getWebDocumentIdentity({ location: { hash: '#/Object?standalone=1' } }), /scope|会话/i);
});

test('the main identity reuses one stored owner for all Web services', async () => {
  const { getWebDocumentIdentity } = await import('../../src/api/webDocument.js');
  const surface = { sessionStorage: memoryStorage(), location: { hash: '#/StartScreen' } };
  const identity = getWebDocumentIdentity(surface);
  assert.equal(identity.role, 'main');
  assert.equal(identity.owner, surface.sessionStorage.getItem('corona.editorUi.owner'));
});
