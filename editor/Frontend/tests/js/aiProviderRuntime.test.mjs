import test from 'node:test';
import assert from 'node:assert/strict';
import { createModelRuntime, readModelResponse } from '../../src/services/aiProviderRuntime.js';
import { createAiSession } from '../../src/services/aiSessionService.js';

const messages = [
  { role: 'system', content: '世界 🌱' },
  { role: 'user', content: 'hello' },
];
const jsonResponse = (content = 'answer') =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    headers: { 'Content-Type': 'application/json' },
  });
async function finished(runtime, id) {
  for (let i = 0; i < 100; i++) {
    const result = runtime.invoke('model.status', id);
    if (['completed', 'cancelled', 'error'].includes(result.status)) return result;
    await new Promise((r) => setTimeout(r, 2));
  }
  assert.fail('Model task did not finish');
}
const configured = (options) => {
  const runtime = createModelRuntime(options);
  runtime.invoke('settings.set', { api_key: 'fixture-secret' });
  return runtime;
};
for (const [options, expect] of [
  [
    { format: 'text', max_tokens: 1400, temperature: 0.25 },
    { temperature: 0.25, max_tokens: 1400, stream: true },
  ],
  [
    { format: 'json' },
    { temperature: 0.1, max_tokens: 1200, response_format: { type: 'json_object' } },
  ],
  [
    { format: 'json', profile: 'node_graph' },
    { temperature: 0.05, max_tokens: 12000, response_format: { type: 'json_object' } },
  ],
]) {
  test('Web transport preserves provider request ' + JSON.stringify(options), async () => {
    const requests = [];
    const runtime = configured({
      fetchImpl: async (url, request) => {
        requests.push({ url, request });
        return jsonResponse(' answer ');
      },
    });
    const task = runtime.invoke('model.start', { messages, options });
    assert.equal((await finished(runtime, task.taskId)).content, 'answer');
    const body = JSON.parse(requests[0].request.body);
    assert.equal(requests[0].url, 'https://api.deepseek.com/v1/chat/completions');
    assert.equal(requests[0].request.headers.Authorization, 'Bearer fixture-secret');
    assert.deepEqual(body.messages, messages);
    assert.deepEqual(body.thinking, { type: 'disabled' });
    for (const [key, value] of Object.entries(expect)) assert.deepEqual(body[key], value, key);
    assert.equal(Object.hasOwn(body, 'stream'), options.format === 'text');
    runtime.dispose();
  });
}
test('SSE handles split UTF-8, CRLF, keepalive, malformed events, multiple chunks and DONE', async () => {
  const encoder = new TextEncoder(),
    wire = encoder.encode(
      ':keepalive\r\n\r\ndata: bad\n\ndata: {"choices":[{"delta":{"content":"🌱 first "}}]}\r\n\r\ndata: {"choices":[{"message":{"content":" next "}}]}\n\ndata: [DONE]\n\ndata: {"choices":[{"delta":{"content":"late"}}]}\n\n'
    );
  let index = 0;
  const response = new Response(
    new ReadableStream({
      pull(controller) {
        if (index === wire.length) {
          controller.close();
          return;
        }
        controller.enqueue(wire.slice(index, index + 1));
        index++;
      },
    }),
    { headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } }
  );
  let result = '';
  await readModelResponse(
    response,
    (value) => {
      result += value;
    },
    new AbortController().signal
  );
  assert.equal(result, '🌱 first next');
});
for (const partial of ['', 'first ']) {
  test('cancel aborts the HTTP request and ignores late data: ' + partial, async () => {
    let append;
    const runtime = configured({
      fetchImpl: async (_url, { signal }) =>
        new Response(
          new ReadableStream({
            start(controller) {
              append = (value) =>
                controller.enqueue(
                  new TextEncoder().encode(
                    'data: ' + JSON.stringify({ choices: [{ delta: { content: value } }] }) + '\n\n'
                  )
                );
              if (partial) append(partial);
              signal.addEventListener('abort', () =>
                controller.error(new DOMException('Cancelled', 'AbortError'))
              );
            },
          }),
          { headers: { 'Content-Type': 'text/event-stream' } }
        ),
    });
    const task = runtime.invoke('model.start', { messages });
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(runtime.invoke('model.cancel', task.taskId).status, 'cancelling');
    const status = await finished(runtime, task.taskId);
    assert.equal(status.status, 'cancelled');
    assert.equal(status.content, partial);
    assert.equal(runtime.invoke('model.cancel', task.taskId).status, 'cancelled');
    assert.throws(() => append('late'));
    runtime.dispose();
  });
}
test('requests keep credential snapshots and updated credentials are masked', async () => {
  const calls = [];
  let release;
  const runtime = configured({
    concurrency: 1,
    fetchImpl: async (_url, request) => {
      calls.push(request);
      if (calls.length === 1)
        await new Promise((r) => {
          release = r;
        });
      return jsonResponse();
    },
  });
  const first = runtime.invoke('model.start', { messages });
  runtime.invoke('settings.set', { api_key: 'new-fixture-key' });
  const second = runtime.invoke('model.start', { messages });
  release();
  await finished(runtime, first.taskId);
  await finished(runtime, second.taskId);
  assert.equal(calls[0].headers.Authorization, 'Bearer fixture-secret');
  assert.equal(calls[1].headers.Authorization, 'Bearer new-fixture-key');
  const status = runtime.invoke('settings.get');
  assert(status.configured);
  assert(!JSON.stringify(status).includes('new-fixture-key'));
  runtime.dispose();
  assert.equal(runtime.invoke('settings.get').configured, false);
});
test('one global queue bounds concurrent requests and queued cancellation performs no HTTP', async () => {
  let active = 0,
    max = 0,
    calls = 0;
  const releases = [];
  const runtime = configured({
    concurrency: 2,
    fetchImpl: async () => {
      calls++;
      active++;
      max = Math.max(active, max);
      await new Promise((r) => releases.push(r));
      active--;
      return jsonResponse();
    },
  });
  const tasks = Array.from({ length: 5 }, () => runtime.invoke('model.start', { messages }));
  assert.equal(calls, 2);
  assert.equal(runtime.invoke('model.cancel', tasks[4].taskId).status, 'cancelled');
  while (calls < 4 || active) {
    for (const release of releases.splice(0)) release();
    await new Promise((r) => setTimeout(r, 2));
  }
  assert.equal(max, 2);
  assert.equal(calls, 4);
  assert.equal((await finished(runtime, tasks[4].taskId)).content, '');
  runtime.dispose();
});
for (const payload of [
  {},
  { messages: [] },
  { messages: [{ role: 'tool', content: 'x' }] },
  { messages, options: [] },
  { messages, options: { format: 'xml' } },
  { messages, options: { timeout: NaN } },
]) {
  test('invalid envelopes never call fetch ' + JSON.stringify(payload), () => {
    const runtime = configured({ fetchImpl: () => assert.fail('HTTP must not run') });
    assert.equal(runtime.invoke('model.start', payload).success, false);
    runtime.dispose();
  });
}
test('HTTP and malformed replies finish as errors and never expose credential text', async () => {
  for (const response of [
    new Response('fixture-secret', { status: 401 }),
    new Response('bad'),
    jsonResponse(''),
  ]) {
    const runtime = configured({ fetchImpl: async () => response });
    const task = runtime.invoke('model.start', { messages });
    const result = await finished(runtime, task.taskId);
    assert.equal(result.status, 'error');
    assert(!JSON.stringify(result).includes('fixture-secret'));
    runtime.dispose();
  }
});
function channelHub({ duplicate = false } = {}) {
  const groups = new Map();
  return (name) => {
    const members = groups.get(name) || new Set();
    groups.set(name, members);
    const listeners = new Set();
    const channel = {
      addEventListener: (_type, handler) => listeners.add(handler),
      removeEventListener: (_type, handler) => listeners.delete(handler),
      postMessage(message) {
        for (const other of members)
          if (other !== channel)
            queueMicrotask(() => {
              for (const handler of other.listeners) handler({ data: structuredClone(message) });
              if (duplicate)
                for (const handler of other.listeners) handler({ data: structuredClone(message) });
            });
      },
      close: () => members.delete(channel),
      listeners,
    };
    members.add(channel);
    return channel;
  };
}
test('settings, request status and cancellation are shared by detached panels without Python', async () => {
  const channelFactory = channelHub({ duplicate: true });
  let calls = 0;
  const owner = createAiSession({
    scope: 'launch',
    owner: true,
    channelFactory,
    fetchImpl: async () => {
      calls++;
      return jsonResponse('shared answer');
    },
  });
  const settingsPanel = createAiSession({ scope: 'launch', owner: false, channelFactory });
  await settingsPanel.invoke('settings.set', { api_key: 'fixture-secret' });
  settingsPanel.dispose();
  const chatPanel = createAiSession({ scope: 'launch', owner: false, channelFactory });
  assert.equal((await chatPanel.invoke('settings.get')).configured, true);
  const task = await chatPanel.invoke('model.start', { messages });
  let status;
  for (let i = 0; i < 100; i++) {
    status = await chatPanel.invoke('model.status', task.taskId);
    if (status.status === 'completed') break;
    await new Promise((r) => setTimeout(r, 2));
  }
  assert.equal(status.content, 'shared answer');
  assert.equal(calls, 1);
  chatPanel.dispose();
  const nodePanel = createAiSession({ scope: 'launch', owner: false, channelFactory });
  assert.equal((await nodePanel.invoke('model.status', task.taskId)).content, 'shared answer');
  nodePanel.dispose();
  owner.dispose();
  const next = createAiSession({ scope: 'next-launch', owner: true, channelFactory });
  assert.equal((await next.invoke('settings.get')).configured, false);
  next.dispose();
});

test('timeout aborts a stalled response and returns a terminal error', async () => {
  let aborted = false;
  const runtime = configured({
    fetchImpl: async (_url, { signal }) =>
      new Response(
        new ReadableStream({
          start(controller) {
            signal.addEventListener('abort', () => {
              aborted = true;
              controller.error(new DOMException('Timeout', 'AbortError'));
            });
          },
        }),
        { headers: { 'Content-Type': 'text/event-stream' } }
      ),
  });
  const task = runtime.invoke('model.start', { messages, options: { timeout: 1 } });
  await new Promise((r) => setTimeout(r, 1050));
  const result = runtime.invoke('model.status', task.taskId);
  assert.equal(result.status, 'error');
  assert.equal(result.error, 'MODEL_REQUEST_TIMEOUT');
  assert(aborted);
  runtime.dispose();
});
test('session shutdown aborts active HTTP and rejects further starts', async () => {
  let aborted = false;
  const runtime = configured({
    fetchImpl: async (_url, { signal }) =>
      new Response(
        new ReadableStream({
          start(controller) {
            signal.addEventListener('abort', () => {
              aborted = true;
              controller.error(new DOMException('Closed', 'AbortError'));
            });
          },
        }),
        { headers: { 'Content-Type': 'text/event-stream' } }
      ),
  });
  const task = runtime.invoke('model.start', { messages });
  await new Promise((r) => setTimeout(r, 2));
  runtime.dispose();
  assert(aborted);
  assert.equal((await finished(runtime, task.taskId)).status, 'cancelled');
  assert.equal(runtime.invoke('model.start', { messages }).error, 'MODEL_SERVICE_STOPPED');
});
test('settings keep independent model profiles and never retain unknown secret fields', async () => {
  let body;
  const runtime = configured({
    fetchImpl: async (_url, request) => {
      body = JSON.parse(request.body);
      return jsonResponse();
    },
  });
  runtime.invoke('settings.set', {
    model: 'shared-model',
    node_graph: {
      model: 'node-model',
      max_tokens: 7777,
      temperature: 0.03,
      thinking: true,
      api_key: 'must-not-leak',
    },
  });
  assert(!JSON.stringify(runtime.invoke('settings.get')).includes('must-not-leak'));
  const task = runtime.invoke('model.start', {
    messages,
    options: { profile: 'node_graph', format: 'json' },
  });
  await finished(runtime, task.taskId);
  assert.equal(body.model, 'node-model');
  assert.equal(body.max_tokens, 7777);
  assert.equal(body.temperature, 0.03);
  assert.deepEqual(body.thinking, { type: 'enabled' });
  runtime.dispose();
});

test('invalid option values are rejected before HTTP, including null format and options', () => {
  const runtime = configured({ fetchImpl: () => assert.fail('HTTP must not run') });
  for (const options of [null, { format: null }, { format: '' }]) {
    assert.equal(
      runtime.invoke('model.start', { messages, options }).error,
      'INVALID_MODEL_OPTIONS'
    );
  }
  runtime.dispose();
});
test('a panel rejects data that cannot cross the channel without leaving retry timers', async () => {
  const client = createAiSession({
    scope: 'invalid-data',
    owner: false,
    channelFactory: () => ({
      addEventListener() {},
      removeEventListener() {},
      close() {},
      postMessage() {
        throw new DOMException('Cannot clone', 'DataCloneError');
      },
    }),
  });
  await assert.rejects(client.invoke('model.start', { messages, extra() {} }), /请求无法传递/);
  client.dispose();
});
