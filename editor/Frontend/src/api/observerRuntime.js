// Explicit owner of the single scene read chain per renderer. The native
// facade stays import-clean: constructing the runtime registers no DOM
// listeners and starts no polling until start() runs from the application
// bootstrap (main.js). pagehide/pageshow drive BFCache recovery; the reader's
// generation guard drops results sampled before a pause or dispose.
import { createSceneReader } from './sceneReader.js';
import { editorApi } from './editorApi.js';

let instance = null;

function editorQuery(method, payload) {
  return method === 'readActive'
    ? editorApi.scene.readActive()
    : editorApi.scene.readTransforms(payload.archive_session, payload.actors);
}

export function createObserverRuntime({ query = editorQuery, intervalMs = 180 } = {}) {
  const reader = createSceneReader(query, intervalMs);
  // The chain stays inert until the explicit bootstrap starts it.
  reader.pause();
  const registrations = [];
  let started = false;
  const onVisibilityChange = () => reader.visibilityChanged();
  const onPageHide = () => reader.pause();
  const onPageShow = () => reader.resume();
  const listen = (target, type, handler) => {
    if (!target || typeof target.addEventListener !== 'function') return;
    target.addEventListener(type, handler);
    registrations.push({ target, type, handler });
  };
  const unlisten = () => {
    for (const registration of registrations) {
      registration.target?.removeEventListener?.(registration.type, registration.handler);
    }
    registrations.length = 0;
  };
  return {
    start() {
      if (started) return;
      started = true;
      if (typeof document !== 'undefined') listen(document, 'visibilitychange', onVisibilityChange);
      if (typeof window !== 'undefined') {
        listen(window, 'pagehide', onPageHide);
        listen(window, 'pageshow', onPageShow);
      }
      reader.resume();
    },
    dispose() {
      started = false;
      unlisten();
      reader.pause();
    },
    observe(kind, receive) {
      return reader.observe(kind, receive);
    },
    off(token) {
      reader.off(token);
    },
  };
}

export function getObserverRuntime() {
  if (!instance) instance = createObserverRuntime();
  return instance;
}

export function startObserverRuntime() {
  getObserverRuntime().start();
}
