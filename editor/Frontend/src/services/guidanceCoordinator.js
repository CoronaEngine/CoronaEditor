/** Guidance owns panel intent and display; webMessages owns all request state. */
export function createGuidanceCoordinator({ messages, panelId, show, open = () => {},
  isCurrent = () => true, readyTimeoutMs = 15_000, timeoutMs = 10_000 }) {
  const lifetime = new AbortController();
  const stops = [];
  let disposed = false;
  const current = () => {
    if (disposed || !isCurrent()) throw Object.assign(new Error('Guidance world was replaced'), { code: 'CONTEXT_CHANGED' });
  };
  const options = { readyTimeoutMs, timeoutMs, waitForHandler: true, signal: lifetime.signal };
  try {
    stops.push(messages.handle(`guidance.panel:${panelId}`, async value => {
      current();
      if (value?.panelId !== panelId) throw Object.assign(new Error('Wrong guidance panel'), { code: 'INVALID_ARGUMENT' });
      const shown = await show(value);
      current();
      if (shown !== true) throw Object.assign(new Error('Guidance target is unavailable'), { code: 'GUIDANCE_UNAVAILABLE' });
      return true;
    }));
    if (panelId === 'MainPage') stops.push(messages.handle('guidance.show', async value => {
      current();
      if (typeof value?.panelId !== 'string' || !value.panelId) {
        throw Object.assign(new Error('Guidance panel is required'), { code: 'INVALID_ARGUMENT' });
      }
      if (value.panelId !== panelId) await open(value.panelId);
      current();
      return messages.requestHandler(`guidance.panel:${value.panelId}`, value, options);
    }));
  } catch (error) {
    for (const stop of stops) stop();
    throw error;
  }
  return {
    request(value) { current(); return messages.request('main', 'guidance.show', value,
      { ...options, timeoutMs: readyTimeoutMs + timeoutMs }); },
    dispose() {
      if (disposed) return;
      disposed = true;
      lifetime.abort();
      for (const stop of stops) stop();
    },
  };
}
