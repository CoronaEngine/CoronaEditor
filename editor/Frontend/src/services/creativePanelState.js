import { onMounted, onUnmounted, ref, watch } from 'vue';
import { appService, isCurrentWindowEvent } from './appService.js';
import { coronaEventBus } from '../utils/eventBus.js';

const STATE = 'creative-controls-state';
const REQUEST = 'creative-controls-request';
const ACTION = 'creative-controls-action';
const ERROR = 'creative-controls-error';
let localOwner = null;
const clone = value => JSON.parse(JSON.stringify(value));

// The main page owns the camera. Dock documents edit only the binding they saw.
export function createCreativePanelOwner({ snapshot, actions, isCurrent, publish, reportError }) {
  let disposed = false;
  let pending = Promise.resolve();
  const listeners = new Set();
  const current = () => !disposed && isCurrent();
  const read = () => clone(snapshot());
  function notify() {
    if (!current()) return;
    const state = read();
    for (const listener of listeners) listener(state);
    publish(state);
  }
  async function applyAction(request) {
    if (!current()) return false;
    const state = read();
    if (!state.available || request.sceneId !== state.sceneId || request.cameraId !== state.cameraId
      || request.cameraHandle !== state.cameraHandle) {
      reportError('场景或相机已切换，请等待面板刷新后重试。');
      notify();
      return false;
    }
    if (!Object.hasOwn(actions, request.action) || !Array.isArray(request.args)) return false;
    try {
      await actions[request.action](...request.args);
      return true;
    } catch (error) {
      if (current()) reportError(error?.message || String(error));
      return false;
    } finally { notify(); }
  }
  function act(request) {
    // Serialize asynchronous writes, then recheck the binding at execution time.
    // A camera/world switch must invalidate commands waiting behind a slow write.
    pending = pending.then(() => applyAction(request));
    return pending;
  }
  return {
    notify, act,
    subscribe(listener) { listeners.add(listener); if (current()) listener(read()); return () => listeners.delete(listener); },
    dispose() { disposed = true; listeners.clear(); },
  };
}

export function provideCreativePanelState(snapshot, actions, isCurrent) {
  const send = (event, payload) => { void appService.crossTabBroadcast(event, payload).catch(() => {}); };
  const owner = createCreativePanelOwner({ snapshot, actions, isCurrent,
    publish: state => send(STATE, { state }), reportError: message => send(ERROR, { message }),
  });
  localOwner = owner;
  const requested = payload => { if (isCurrentWindowEvent(payload)) owner.notify(); };
  const acted = payload => { if (isCurrentWindowEvent(payload)) void owner.act(payload); };
  const stop = watch(snapshot, owner.notify, { deep: true });
  onMounted(() => {
    coronaEventBus.on(REQUEST, requested);
    coronaEventBus.on(ACTION, acted);
    owner.notify();
  });
  onUnmounted(() => {
    stop(); owner.dispose();
    if (localOwner === owner) localOwner = null;
    coronaEventBus.off(REQUEST, requested);
    coronaEventBus.off(ACTION, acted);
  });
}

export function useCreativePanelState() {
  const state = ref({});
  const ready = ref(false);
  const error = ref('');
  let timer = null, unsubscribe = null;
  const apply = next => { state.value = clone(next); ready.value = true; clearInterval(timer); timer = null; };
  const receive = payload => { if (isCurrentWindowEvent(payload) && payload.state) apply(payload.state); };
  const failed = payload => { if (isCurrentWindowEvent(payload)) error.value = payload.message; };
  function act(action, ...args) {
    error.value = '';
    const { sceneId, cameraId, cameraHandle } = state.value;
    const request = { action, args, sceneId, cameraId, cameraHandle };
    if (localOwner) return localOwner.act(request);
    return appService.crossTabBroadcast(ACTION, request).catch(failure => { error.value = failure.message; });
  }
  onMounted(() => {
    coronaEventBus.on(STATE, receive);
    coronaEventBus.on(ERROR, failed);
    if (localOwner) unsubscribe = localOwner.subscribe(apply);
    else {
      const request = () => { void appService.crossTabBroadcast(REQUEST, {}).catch(() => {}); };
      timer = setInterval(request, 1000);
      request();
    }
  });
  onUnmounted(() => {
    clearInterval(timer); unsubscribe?.();
    coronaEventBus.off(STATE, receive);
    coronaEventBus.off(ERROR, failed);
  });
  return { state, ready, error, act };
}
