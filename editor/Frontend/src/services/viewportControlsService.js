import { getWebMessages } from '../api/webMessages.js';

const METHOD = 'viewport.controls';
const STATE = 'viewport-controls-state';
const fail = (code, message) => Object.assign(new Error(message), { code });

/** Viewport business contract; routing and request lifecycle belong to webMessages. */
export function createViewportControlsService(messages) {
  return {
    request: (payload, options) => messages.request('main', METHOD, payload,
      { waitForHandler: payload?.action === 'getState', ...options }),
    subscribe: listener => messages.on(STATE, listener),
    publish: state => messages.emit(STATE, state),
    provide({ snapshot, actions, isCurrent }) {
      let disposed = false;
      let writes = Promise.resolve();
      const current = () => {
        if (disposed || !isCurrent()) throw fail('CONTEXT_CHANGED', 'Viewport document is no longer current');
      };
      const read = () => { current(); return snapshot(); };
      const apply = async payload => {
        const state = read();
        if (!state.available || ['sceneId', 'cameraId', 'cameraHandle'].some(key => payload[key] !== state[key])) {
          throw fail('STALE_CAMERA', 'Scene or camera changed; refresh the viewport controls');
        }
        if (!Object.hasOwn(actions, payload.action)) throw fail('METHOD_NOT_FOUND', 'Unknown viewport action');
        const result = await actions[payload.action](payload);
        current();
        if (result === false) throw fail('VIEWPORT_UPDATE_FAILED', 'Viewport update failed');
        const next = read();
        await messages.emit(STATE, next);
        return next;
      };
      const unregister = messages.handle(METHOD, (payload = {}) => {
        if (payload.action === 'getState') return read();
        // Camera/world identity is checked when the write executes, not when queued.
        const operation = writes.then(() => apply(payload));
        writes = operation.catch(() => {});
        return operation;
      });
      return () => { disposed = true; unregister(); };
    },
  };
}

// Lazy access keeps document identity independent of Vue routes and test imports.
export const viewportControlsService = {
  request: (...args) => createViewportControlsService(getWebMessages()).request(...args),
  subscribe: (...args) => createViewportControlsService(getWebMessages()).subscribe(...args),
  publish: (...args) => createViewportControlsService(getWebMessages()).publish(...args),
  provide: (...args) => createViewportControlsService(getWebMessages()).provide(...args),
};
