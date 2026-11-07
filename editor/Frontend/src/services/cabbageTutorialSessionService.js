import { getWebMessages } from '../api/webMessages.js';

const restorers = new Map();
let lifetime = new globalThis.AbortController();

export function registerTutorialRestorer(name, handler) {
  const key = String(name || '').trim();
  if (!key || typeof handler !== 'function') return () => {};
  if (restorers.has(key)) throw new Error(`Tutorial restorer ${key} is already registered`);
  const unregister = getWebMessages().handle(`tutorial.restore:${key}`, async payload => {
    const result = await handler(payload);
    if (result === false || result?.success === false) throw new Error(result?.error || `Tutorial restorer ${key} failed`);
    return result ?? { success: true };
  });
  restorers.set(key, unregister);
  return () => { if (restorers.get(key) === unregister) { unregister(); restorers.delete(key); } };
}

export async function requestTutorialRestore(name, payload = {}, { timeoutMs = 5000 } = {}) {
  const key = String(name || '').trim();
  if (!key) throw new Error('Tutorial restorer name is required');
  return getWebMessages().requestHandler(`tutorial.restore:${key}`, payload,
    { timeoutMs, signal: lifetime.signal });
}

export function closeTutorialSessionChannel() {
  lifetime.abort();
  lifetime = new globalThis.AbortController();
  for (const unregister of restorers.values()) unregister();
  restorers.clear();
}
