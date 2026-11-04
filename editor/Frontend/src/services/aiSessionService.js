import { createModelRuntime } from './aiProviderRuntime.js';
export const AI_SETTINGS_CHANGED = 'corona-ai-settings-changed';

/** One Web owner per editor launch; detached panels share it through BroadcastChannel. */
export function createAiSession({
  scope,
  owner,
  channelFactory = (name) => new BroadcastChannel(name),
  fetchImpl,
  surface,
} = {}) {
  if (!scope) throw new Error('AI 会话标识缺失');
  const instance = crypto.randomUUID(),
    channel = channelFactory('corona-ai-session-v1:' + scope);
  const pending = new Map(),
    replies = new Map();
  const runtime = owner ? createModelRuntime({ fetchImpl }) : null;
  let closed = false;
  const announce = (result) => {
    const notification = { kind: 'settings', scope, sender: instance, result };
    channel.postMessage(notification);
    surface?.dispatchEvent(new CustomEvent(AI_SETTINGS_CHANGED, { detail: result }));
  };
  const execute = (operation, value) => {
    const result = runtime.invoke(operation, value);
    if (operation === 'settings.set' && result.success) announce(result);
    return result;
  };
  const receive = (event) => {
    const message = event.data;
    if (!message || message.scope !== scope || message.sender === instance) return;
    if (message.kind === 'settings') {
      surface?.dispatchEvent(new CustomEvent(AI_SETTINGS_CHANGED, { detail: message.result }));
      return;
    }
    if (message.kind === 'response' && message.target === instance) {
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      clearTimeout(request.deadline);
      clearInterval(request.retry);
      request.resolve(message.result);
    } else if (message.kind === 'request' && runtime) {
      // Retried bridge deliveries must not start another billable model request.
      for (const [key, reply] of replies) if (Date.now() - reply.at > 30000) replies.delete(key);
      const key = message.sender + ':' + message.id;
      const mutating = ['model.start', 'model.cancel', 'settings.set'].includes(message.operation);
      let reply = mutating ? replies.get(key) : null;
      if (!reply) {
        reply = { at: Date.now(), result: execute(message.operation, message.value) };
        if (mutating) replies.set(key, reply);
      }
      channel.postMessage({
        kind: 'response',
        scope,
        sender: instance,
        target: message.sender,
        id: message.id,
        result: reply.result,
      });
    }
  };
  channel.addEventListener('message', receive);
  const api = {
    async invoke(operation, value) {
      if (closed) throw new Error('AI 会话已关闭');
      let result;
      if (runtime) result = execute(operation, value);
      else
        result = await new Promise((resolve, reject) => {
          const id = crypto.randomUUID();
          const request = { kind: 'request', scope, sender: instance, id, operation, value };
          const send = () => {
            try {
              channel.postMessage(request);
            } catch {
              clearInterval(retry);
              clearTimeout(deadline);
              pending.delete(id);
              reject(new Error('AI 请求无法传递，请检查请求数据'));
            }
          };
          const retry = setInterval(send, 250);
          const deadline = setTimeout(() => {
            clearInterval(retry);
            pending.delete(id);
            reject(new Error('AI 主会话未响应，请重新打开编辑器主窗口'));
          }, 10000);
          pending.set(id, { resolve, reject, retry, deadline });
          send();
        });
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
      runtime?.dispose();
      for (const request of pending.values()) {
        clearInterval(request.retry);
        clearTimeout(request.deadline);
        request.reject(new Error('AI 会话已关闭'));
      }
      pending.clear();
      replies.clear();
      channel.removeEventListener('message', receive);
      channel.close();
      surface?.removeEventListener('pagehide', api.dispose);
    },
  };
  surface?.addEventListener('pagehide', api.dispose);
  return api;
}

const sessions = new WeakMap();
export function initializeAiSession(surface = window) {
  if (sessions.has(surface)) return sessions.get(surface);
  const query = new URLSearchParams(surface.location?.search || '');
  for (const [key, value] of new URLSearchParams(
    (surface.location?.hash || '').split('?')[1] || ''
  ))
    query.set(key, value);
  const detached = query.get('standalone') === '1' || query.has('uiOwner');
  let scope = detached
    ? query.get('uiOwner')
    : surface.sessionStorage?.getItem('corona.editorUi.owner');
  if (!scope && !detached) {
    scope = crypto.randomUUID();
    surface.sessionStorage?.setItem('corona.editorUi.owner', scope);
  }
  if (!scope) throw new Error('AI 面板缺少启动会话，请通过编辑器主窗口打开');
  const session = createAiSession({ scope, owner: !detached, surface });
  sessions.set(surface, session);
  return session;
}
export const aiSettings = {
  get: () => initializeAiSession().invoke('settings.get'),
  saveApiKey: (api_key) => initializeAiSession().invoke('settings.set', { api_key }),
};
