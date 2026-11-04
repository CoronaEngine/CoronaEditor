/** Session-local DeepSeek transport. No native bridge, Python host, or persistent secrets. */
const endpoint = 'https://api.deepseek.com/v1/chat/completions';
const terminal = (state) => ['completed', 'cancelled', 'error'].includes(state.status);
const failure = (error, message = error) => ({ success: false, error, message });
const text = (value) => (typeof value === 'string' ? value.trim() : '');
const mask = (key) =>
  key.length <= 8 ? '*'.repeat(key.length) : key.slice(0, 4) + '...' + key.slice(-4);
const defaults = {
  model: 'deepseek-v4-flash',
  node_graph: { temperature: 0.05, max_tokens: 12000, thinking: false },
};

function choiceText(choice) {
  return typeof choice?.delta?.content === 'string'
    ? choice.delta.content
    : text(choice?.message?.content);
}

/** A network chunk may contain half a UTF-8 character or multiple SSE events. */
export async function readModelResponse(response, append, signal) {
  if (
    !String(response.headers.get('Content-Type') || '')
      .toLowerCase()
      .includes('text/event-stream')
  ) {
    const data = await response.json();
    const value = text(data?.choices?.[0]?.message?.content);
    if (!value) throw new Error('AI_EMPTY_RESPONSE');
    if (!signal.aborted) append(value);
    return;
  }
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = '',
    fragments = [],
    done = false;
  const line = (raw) => {
    const value = raw.replace(/\r$/, '');
    if (!value) {
      fragments = [];
      return;
    }
    if (!value.startsWith('data:')) return;
    const data = value.slice(5).trim();
    if (data === '[DONE]') {
      done = true;
      return;
    }
    // Accept complete data lines as well as standard multi-line SSE data events.
    let parsed;
    try {
      parsed = JSON.parse(data);
      fragments = [];
    } catch {
      fragments.push(data);
      try {
        parsed = JSON.parse(fragments.join('\n'));
        fragments = [];
      } catch {
        return;
      }
    }
    if (!signal.aborted) append(choiceText(parsed?.choices?.[0]));
  };
  try {
    while (!done && !signal.aborted) {
      const chunk = await reader.read();
      buffer += decoder.decode(chunk.value || new Uint8Array(), { stream: !chunk.done });
      let end;
      while (!done && (end = buffer.indexOf('\n')) >= 0) {
        line(buffer.slice(0, end));
        buffer = buffer.slice(end + 1);
      }
      if (chunk.done) {
        if (buffer && !done) line(buffer);
        break;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function createModelRuntime({
  fetchImpl = globalThis.fetch,
  concurrency = 4,
  capacity = 128,
} = {}) {
  const tasks = new Map(),
    queue = [],
    sessionId = crypto.randomUUID();
  let active = 0,
    closed = false,
    apiKey = '',
    options = structuredClone(defaults);

  const settingsStatus = () => ({
    configured: Boolean(apiKey),
    masked_key: mask(apiKey),
    options: structuredClone(options),
  });
  function configure(payload) {
    if (closed) return failure('MODEL_SERVICE_STOPPED');
    if (!payload || typeof payload !== 'object') return failure('INVALID_MODEL_SETTINGS');
    if (Object.hasOwn(payload, 'api_key')) {
      let key = String(payload.api_key || '').trim();
      if (key.length >= 2 && ['"', "'"].includes(key[0]) && key.at(-1) === key[0])
        key = key.slice(1, -1);
      if (!key || /[\r\n]/.test(key))
        return failure('INVALID_API_KEY', 'DeepSeek API Key 格式无效');
      apiKey = key;
    }
    if (text(payload.model)) options.model = text(payload.model);
    if (payload.node_graph && typeof payload.node_graph === 'object') {
      for (const key of ['model', 'temperature', 'max_tokens', 'thinking'])
        if (Object.hasOwn(payload.node_graph, key))
          options.node_graph[key] = payload.node_graph[key];
    }
    return { success: true, ...settingsStatus() };
  }

  function prepare(payload) {
    if (!payload || typeof payload !== 'object') throw new Error('INVALID_MODEL_REQUEST');
    const { messages } = payload,
      input = payload.options === undefined ? {} : payload.options;
    if (
      !Array.isArray(messages) ||
      !messages.length ||
      messages.length > 64 ||
      messages.some(
        (m) =>
          !m || !['system', 'user', 'assistant'].includes(m.role) || typeof m.content !== 'string'
      )
    )
      throw new Error('INVALID_MODEL_MESSAGES');
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      !['text', 'json'].includes(input.format === undefined ? 'text' : input.format)
    )
      throw new Error('INVALID_MODEL_OPTIONS');
    if (messages.reduce((sum, m) => sum + m.content.length, 0) > 4_000_000)
      throw new Error('MODEL_INPUT_TOO_LARGE');
    const profile =
      input.profile === 'node_graph'
        ? options.node_graph
        : { temperature: 0.1, max_tokens: 1200, thinking: false };
    const numeric = (name, fallback, min, max, integer = false) => {
      const value = input[name] === undefined ? fallback : input[name];
      if (value === null || value === '' || !Number.isFinite(Number(value)))
        throw new Error('INVALID_MODEL_OPTIONS');
      const number = integer ? Math.trunc(Number(value)) : Number(value);
      return Math.max(min, Math.min(max, number));
    };
    const format = input.format === undefined ? 'text' : input.format;
    const body = {
      model: profile.model || options.model,
      temperature: numeric('temperature', profile.temperature, 0, 2),
      max_tokens: numeric('max_tokens', profile.max_tokens, 1, 32000, true),
    };
    if (format === 'json') body.response_format = { type: 'json_object' };
    body.thinking = {
      type:
        (Object.hasOwn(input, 'thinking') ? input.thinking : profile.thinking) === true
          ? 'enabled'
          : 'disabled',
    };
    if (format === 'text') body.stream = true;
    body.messages = messages.map((m) => ({ role: m.role, content: m.content }));
    const headers = { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' };
    if (format === 'text') headers.Accept = 'text/event-stream';
    return { body, headers, timeout: numeric('timeout', 45, 1, 180) * 1000 };
  }

  const status = (taskId) => {
    const state = tasks.get(taskId);
    return state
      ? {
          success: true,
          taskId,
          status: state.status,
          content: state.content,
          error: state.error,
          message: state.message,
        }
      : failure('TASK_NOT_FOUND');
  };
  function finish(state, values) {
    Object.assign(state, values, { updatedAt: Date.now() });
  }
  async function run(state, request) {
    state.status = 'running';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      state.controller.abort();
    }, request.timeout);
    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify(request.body),
        signal: state.controller.signal,
        credentials: 'omit',
        mode: 'cors',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
      });
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        finish(state, {
          status: 'error',
          error: 'HTTP_' + response.status,
          message: 'DeepSeek 请求失败（HTTP ' + response.status + '）',
        });
        return;
      }
      await readModelResponse(
        response,
        (chunk) => {
          if (!state.cancelled) state.content += chunk;
        },
        state.controller.signal
      );
      if (!state.cancelled)
        finish(
          state,
          state.content.trim()
            ? { status: 'completed' }
            : { status: 'error', error: 'AI_EMPTY_RESPONSE', message: 'DeepSeek 返回了空内容' }
        );
    } catch (error) {
      if (!state.cancelled)
        finish(state, {
          status: 'error',
          error: timedOut
            ? 'MODEL_REQUEST_TIMEOUT'
            : error.message === 'AI_EMPTY_RESPONSE'
              ? 'AI_EMPTY_RESPONSE'
              : 'MODEL_REQUEST_FAILED',
          message: timedOut
            ? 'DeepSeek 请求超时'
            : error.message === 'AI_EMPTY_RESPONSE'
              ? 'DeepSeek 返回了空内容'
              : '无法连接 DeepSeek，请检查网络和浏览器跨域设置',
        });
    } finally {
      clearTimeout(timer);
      if (state.cancelled) finish(state, { status: 'cancelled', error: '', message: '' });
      else if (timedOut)
        finish(state, {
          status: 'error',
          error: 'MODEL_REQUEST_TIMEOUT',
          message: 'DeepSeek 请求超时',
        });
      active--;
      pump();
    }
  }
  function pump() {
    while (!closed && active < concurrency && queue.length) {
      const next = queue.shift();
      if (next.state.cancelled) continue;
      active++;
      void run(next.state, next.request);
    }
  }
  function start(payload) {
    if (closed) return failure('MODEL_SERVICE_STOPPED');
    let request;
    try {
      request = prepare(payload);
    } catch (error) {
      return failure(error.message);
    }
    if (!apiKey)
      return failure('AI_NOT_CONFIGURED', '请在设置中配置本次启动使用的 DeepSeek API Key');
    for (const [id, state] of tasks) {
      if (terminal(state) && (Date.now() - state.updatedAt > 600000 || tasks.size >= capacity))
        tasks.delete(id);
    }
    if (tasks.size >= capacity) return failure('MODEL_QUEUE_FULL', 'AI 请求过多，请稍后重试');
    const taskId = 'model_' + crypto.randomUUID();
    const state = {
      status: 'pending',
      content: '',
      error: '',
      message: '',
      controller: new AbortController(),
      cancelled: false,
      updatedAt: Date.now(),
    };
    tasks.set(taskId, state);
    queue.push({ state, request });
    pump();
    return { success: true, status: 'accepted', taskId };
  }
  function cancel(taskId) {
    const state = tasks.get(taskId);
    if (!state) return failure('TASK_NOT_FOUND');
    if (!terminal(state)) {
      const pending = state.status === 'pending';
      state.cancelled = true;
      state.controller.abort();
      finish(state, { status: pending ? 'cancelled' : 'cancelling' });
    }
    return { success: true, taskId, status: state.status };
  }
  return {
    invoke(operation, value) {
      if (operation === 'model.start') return start(value);
      if (operation === 'model.status') return status(value);
      if (operation === 'model.cancel') return cancel(value);
      if (operation === 'session.get') return { success: true, sessionId };
      if (operation === 'settings.get') return { success: true, ...settingsStatus() };
      if (operation === 'settings.set') return configure(value);
      return failure('UNSUPPORTED_MODEL_OPERATION');
    },
    dispose() {
      closed = true;
      apiKey = '';
      for (const state of tasks.values())
        if (!terminal(state)) {
          state.cancelled = true;
          state.controller.abort();
          finish(state, { status: 'cancelled' });
        }
      queue.length = 0;
    },
  };
}
