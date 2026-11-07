const documents = new WeakMap();
export const isSecondaryWebDocument = query => query.get('standalone') === '1' || query.has('uiOwner');

/** Immutable launch identity shared by every service in one CEF document. */
export function getWebDocumentIdentity(surface = window) {
  if (documents.has(surface)) return documents.get(surface);
  const query = new URLSearchParams(surface.location?.search || '');
  for (const [key, value] of new URLSearchParams((surface.location?.hash || '').split('?')[1] || '')) query.set(key, value);
  const peer = isSecondaryWebDocument(query);
  let owner = peer ? query.get('uiOwner') : surface.sessionStorage?.getItem('corona.editorUi.owner');
  if (!owner && !peer) {
    owner = globalThis.crypto.randomUUID();
    surface.sessionStorage?.setItem('corona.editorUi.owner', owner);
  }
  if (!owner) throw Object.assign(new Error('Open this panel from the editor main window: missing launch scope'), { code: 'INVALID_SCOPE' });
  const identity = Object.freeze({ role: peer ? 'peer' : 'main', owner,
    generation: peer ? query.get('uiSession') : null, windowId: query.get('uiWindow'), query: query.toString() });
  documents.set(surface, identity);
  return identity;
}
