// Keep a request on the main surface until a newly created CEF document is ready.
// The caller validates the world/window generation before delivering any event.
export function createNativeGuidanceRelay({ panelId, send, open, show }) {
  let pending = null;
  let lastRequest = null;
  let lastNavigation = null;
  let disposed = false;
  const isMain = panelId === 'MainPage';
  const emit = (event, payload) => { if (!disposed) send(event, payload); };
  return {
    request(guidance) {
      emit('creative-guidance-request', {
        requestId: `${Date.now()}_${Math.random().toString(36).slice(2)}`, guidance,
      });
    },
    async receiveRequest(payload) {
      if (disposed || !payload?.requestId || !payload.guidance?.panelId) return;
      if (isMain && lastNavigation !== payload.requestId) {
        lastNavigation = payload.requestId;
        pending = payload;
        if (payload.guidance.panelId !== 'MainPage') open(payload.guidance.panelId);
      }
      if (payload.guidance.panelId !== panelId || lastRequest === payload.requestId) return;
      lastRequest = payload.requestId;
      await show(payload.guidance);
      emit('creative-guidance-accepted', { requestId: payload.requestId });
    },
    receiveReady(payload) {
      if (isMain && pending?.guidance.panelId === payload?.panelId) {
        emit('creative-guidance-request', pending);
      }
    },
    receiveAccepted(payload) {
      if (pending?.requestId === payload?.requestId) pending = null;
    },
    ready() { emit('creative-guidance-ready', { panelId }); },
    dispose() { disposed = true; pending = null; },
  };
}
