import { onMounted, onUnmounted, ref, watch } from 'vue';
import { getWebMessages } from '../api/webMessages.js';

const METHOD = 'creative.controls';
const STATE = 'creative-controls-state';
const fail = (code, message) => Object.assign(new Error(message), { code });

/** Only camera business state and serialized writes live here. */
export function createCreativePanelProvider(messages, { snapshot, actions, isCurrent }) {
  let disposed = false, revision = 0;
  let writes = Promise.resolve();
  const current = () => {
    if (disposed || !isCurrent()) throw fail('CONTEXT_CHANGED', 'Creative controls document is no longer current');
  };
  const read = () => {
    current();
    return { owner: messages.documentId, revision, state: structuredClone(snapshot()) };
  };
  const notify = async () => { current(); revision++; await messages.emit(STATE, read()); };
  const apply = async request => {
    const state = read().state;
    if (!state.available || ['sceneId', 'cameraId', 'cameraHandle'].some(key => request[key] !== state[key])) {
      throw fail('STALE_CAMERA', '场景或相机已切换，请等待面板刷新后重试。');
    }
    if (!Object.hasOwn(actions, request.action) || !Array.isArray(request.args)) {
      throw fail('INVALID_ARGUMENT', 'Unknown creative control action or arguments');
    }
    try {
      if (await actions[request.action](...request.args) === false) throw fail('CREATIVE_UPDATE_FAILED', 'Creative control update failed');
      current();
      return read();
    } finally {
      if (!disposed && isCurrent()) await notify();
    }
  };
  const unregister = messages.handle(METHOD, (request = {}) => {
    if (request.action === 'getState') return read();
    const operation = writes.then(() => apply(request));
    writes = operation.catch(() => {});
    return operation;
  });
  return { notify, dispose() { disposed = true; unregister(); } };
}

/** Snapshot versions prevent a late initial reply from replacing newer state. */
export function createCreativePanelClient(messages, { receive = () => {}, readyTimeoutMs = 15_000 } = {}) {
  const lifetime = new AbortController();
  let latest = null;
  const accept = value => {
    if (lifetime.signal.aborted || !value?.state) return;
    if (latest?.owner === value.owner && value.revision < latest.revision) return;
    latest = structuredClone(value);
    receive(structuredClone(value.state));
  };
  const unsubscribe = messages.on(STATE, accept);
  const ready = messages.request('main', METHOD, { action: 'getState' },
    { waitForHandler: true, readyTimeoutMs, signal: lifetime.signal }).then(value => { accept(value); return latest.state; });
  return {
    ready,
    async act(action, ...args) {
      await ready;
      const { sceneId, cameraId, cameraHandle } = latest.state;
      const result = await messages.request('main', METHOD, { action, args, sceneId, cameraId, cameraHandle },
        { signal: lifetime.signal });
      accept(result);
      return latest.state;
    },
    dispose() { lifetime.abort(); unsubscribe(); },
  };
}

export function provideCreativePanelState(snapshot, actions, isCurrent) {
  const provider = createCreativePanelProvider(getWebMessages(), { snapshot, actions, isCurrent });
  const notify = () => { void provider.notify().catch(error => console.warn('[creative controls]', error)); };
  const stop = watch(snapshot, notify, { deep: true });
  onMounted(notify);
  onUnmounted(() => { stop(); provider.dispose(); });
}

export function useCreativePanelState() {
  const state = ref({}), ready = ref(false), error = ref('');
  let client;
  onMounted(() => {
    client = createCreativePanelClient(getWebMessages(), { receive: value => { state.value = value; ready.value = true; } });
    client.ready.catch(failure => { if (failure.code !== 'ABORTED') error.value = failure.message; });
  });
  onUnmounted(() => client?.dispose());
  return { state, ready, error, async act(action, ...args) {
    error.value = '';
    try { await client.act(action, ...args); return true; }
    catch (failure) { if (failure.code !== 'ABORTED') error.value = failure.message; return false; }
  } };
}
