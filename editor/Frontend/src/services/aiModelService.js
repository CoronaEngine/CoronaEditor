import { initializeAiSession } from './aiSessionService.js';

export const modelService = {
  sessionId: async () => (await initializeAiSession().invoke('session.get')).sessionId,
  start: (payload) => initializeAiSession().invoke('model.start', payload),
  status: (taskId) => initializeAiSession().invoke('model.status', taskId),
  cancel: (taskId) => initializeAiSession().invoke('model.cancel', taskId),
};

export function parseModelJson(text) {
  const clean = String(text)
    .trim()
    .replace(/^\x60\x60\x60(?:json)?\s*/i, '')
    .replace(/\s*\x60\x60\x60$/, '');
  try {
    return JSON.parse(clean);
  } catch {
    const first = clean.indexOf('{');
    const last = clean.lastIndexOf('}');
    if (first < 0 || last < first) throw new Error('模型未返回 JSON 对象');
    return JSON.parse(clean.slice(first, last + 1));
  }
}

export async function completeModel(messages, options, signal, onStarted) {
  if (signal?.aborted) throw new Error('已取消 AI 请求');
  const started = await modelService.start({ messages, options });
  try {
    await onStarted?.(started.taskId);
    return await waitForModel(started.taskId, options, signal);
  } catch (error) {
    void modelService.cancel(started.taskId).catch(() => {});
    throw error;
  }
}

export async function waitForModel(taskId, options, signal) {
  const cancel = () => {
    void modelService.cancel(taskId).catch(() => {});
  };
  signal?.addEventListener('abort', cancel, { once: true });
  const deadline = Date.now() + (options.timeout || 45) * 1000 + 10000;
  try {
    while (Date.now() < deadline) {
      if (signal?.aborted) throw new Error('已取消 AI 请求');
      const status = await modelService.status(taskId);
      if (signal?.aborted) throw new Error('已取消 AI 请求');
      if (status.status === 'completed') return status.content;
      if (status.status === 'cancelled') throw new Error('已取消 AI 请求');
      if (status.status === 'error') throw new Error(status.message || status.error);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error('AI 请求超时');
  } finally {
    signal?.removeEventListener('abort', cancel);
    cancel();
  }
}
