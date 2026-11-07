import { createModelRuntime } from './aiProviderRuntime.js';
import { createWebMessages, getWebMessages } from '../api/webMessages.js';
import { getWebDocumentIdentity } from '../api/webDocument.js';
export const AI_SETTINGS_CHANGED = 'corona-ai-settings-changed';

/** One AI runtime in the main document, using the shared Web transport. */
export function createAiSession({
  scope,
  owner,
  channelFactory,
  messages,
  fetchImpl,
  surface,
} = {}) {
  if (!scope) throw new Error('AI 会话标识缺失');
  const ownsMessages = !messages;
  messages ||= createWebMessages({ scope, role: owner ? 'main' : 'peer', channelFactory });
  const runtime = owner ? createModelRuntime({ fetchImpl }) : null;
  const lifetime = new globalThis.AbortController();
  let closed = false;
  const stopSettings = messages.on(AI_SETTINGS_CHANGED, result => {
    surface?.dispatchEvent(new globalThis.CustomEvent(AI_SETTINGS_CHANGED, { detail: result }));
  });
  const execute = (operation, value) => {
    const result = runtime.invoke(operation, value);
    if (operation === 'settings.set' && result.success) {
      // The provider returns a masked summary; credentials never become events.
      void messages.emit(AI_SETTINGS_CHANGED, result).catch(error => console.warn('[AiSession]', error.message));
    }
    return result;
  };
  const unregister = runtime ? messages.handle('ai.session', ({ operation, value }) => execute(operation, value)) : null;
  const api = {
    async invoke(operation, value) {
      if (closed) throw new Error('AI 会话已关闭');
      let result;
      try {
        result = await messages.request('main', 'ai.session', { operation, value },
          { signal: lifetime.signal });
      } catch (error) {
        if (error.code === 'INVALID_MESSAGE') throw Object.assign(new Error('AI 请求无法传递，请检查请求数据'), { code: error.code });
        throw error;
      }
      if (result?.success !== true) {
        const error = new Error(result?.message || result?.error || 'AI 请求失败');
        error.code = result?.error || 'AI_SESSION_ERROR';
        throw error;
      }
      return result;
    },
    dispose() {
      if (closed) return;
      closed = true;
      lifetime.abort();
      runtime?.dispose();
      unregister?.();
      stopSettings();
      if (ownsMessages) messages.dispose();
      surface?.removeEventListener('pagehide', api.dispose);
    },
  };
  surface?.addEventListener('pagehide', api.dispose);
  return api;
}

const sessions = new WeakMap();
export function initializeAiSession(surface = window) {
  if (sessions.has(surface)) return sessions.get(surface);
  const identity = getWebDocumentIdentity(surface);
  const session = createAiSession({ scope: identity.owner, owner: identity.role === 'main', surface, messages: getWebMessages(surface) });
  sessions.set(surface, session);
  return session;
}
export const aiSettings = {
  get: () => initializeAiSession().invoke('settings.get'),
  saveApiKey: (api_key) => initializeAiSession().invoke('settings.set', { api_key }),
};
