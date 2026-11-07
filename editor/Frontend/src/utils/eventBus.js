import { isCurrentWindowEvent } from '../services/appService.js';
import { getWebMessages } from '../api/webMessages.js';

/** UI event adapter; cross-document routing belongs to webMessages. */
export function createEventBus(messages, accepts = () => true) {
  const listeners = new Map();
  const subscriptions = new Map();
  const emit = (event, ...args) => {
    for (const handler of [...(listeners.get(event) || [])]) {
      try { handler(...args); }
      catch (error) { console.error(`[coronaEventBus] ${event}`, error); }
    }
  };
  return {
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(handler);
      if (!subscriptions.has(event)) {
        subscriptions.set(event, messages.on(event, payload => {
          if (accepts(payload)) emit(event, payload);
        }));
      }
    },
    off(event, handler) {
      if (handler) listeners.get(event)?.delete(handler);
      else listeners.delete(event);
      if (!listeners.get(event)?.size) {
        listeners.delete(event);
        subscriptions.get(event)?.();
        subscriptions.delete(event);
      }
    },
    // Native events and local object references stay in their document.
    // Explicit cross-document publishing goes through appService/webMessages.
    emit,
  };
}

const buses = new WeakMap();
function currentBus() {
  if (!buses.has(window)) {
    buses.set(window, createEventBus(getWebMessages(window), payload =>
      payload?.uiGeneration === undefined || isCurrentWindowEvent(payload)));
  }
  return buses.get(window);
}

export const coronaEventBus = {
  on: (...args) => currentBus().on(...args),
  off: (...args) => currentBus().off(...args),
  emit: (...args) => currentBus().emit(...args),
};
