/** The only transport owner for collaboration between Web documents.
 * Payloads use structured clone; this module never calls the native bridge.
 */
import { getWebDocumentIdentity } from './webDocument.js';
const failure = (code, message = code, details) => Object.assign(new Error(message), { code, details });
const uniqueId = () => globalThis.crypto.randomUUID();

export function createWebMessages({ scope, documentId = uniqueId(), role = 'peer',
  getGeneration = () => null, channelFactory = name => new globalThis.BroadcastChannel(name),
  onError = error => console.error('[webMessages]', error) } = {}) {
  if (!scope) throw new Error('Web messages require a launch scope');
  const epoch = uniqueId();
  const channel = channelFactory(`corona-web-messages-v1:${scope}`);
  const subscriptions = new Map();
  const handlers = new Map();
  const pending = new Map();
  const peers = new Map();
  const seen = new Set();
  const retiredOwners = new Set();
  let closed = false;
  let ownerEpoch = role === 'main' ? epoch : null;
  let ownerMethods = new Set();

  const clone = value => {
    try { return globalThis.structuredClone(value); }
    catch { throw failure('INVALID_MESSAGE', 'Message data cannot be cloned'); }
  };
  const finish = (id, error, result) => {
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    clearTimeout(entry.timer);
    clearTimeout(entry.discoveryTimer);
    entry.signal?.removeEventListener('abort', entry.abort);
    if (error) entry.reject(error);
    else entry.resolve(result);
  };
  const invalidateOwner = next => {
    if (ownerEpoch && ownerEpoch !== next) {
      retiredOwners.add(ownerEpoch);
      for (const [id, entry] of pending) {
        if (entry.target === 'main' || entry.recipientEpoch === ownerEpoch ||
            (!entry.sent && [...entry.expected.values()].some(peer => peer.epoch === ownerEpoch))) {
          finish(id, failure('CONTEXT_CHANGED', 'Main document was replaced'));
        }
      }
    }
    ownerEpoch = next;
  };
  const send = message => {
    if (closed) throw failure('MESSAGES_CLOSED');
    const envelope = clone({ ...message, version: 1, scope, sender: documentId, epoch });
    try { channel.postMessage(envelope); }
    catch { throw failure('INVALID_MESSAGE', 'Message could not be sent'); }
    receive(envelope);
  };
  const announce = () => send({ kind: 'owner', ownerEpoch: epoch, methods: [...handlers.keys()] });
  const presence = discoveryId => send({ kind: 'presence', discoveryId,
    methods: [...handlers.keys()], generation: getGeneration() });
  const armDeadline = (id, entry, delay, code) => {
    clearTimeout(entry.timer);
    entry.timer = setTimeout(() => finish(id, failure(
      entry.generation === getGeneration() ? code : 'CONTEXT_CHANGED')), delay);
  };
  const dispatch = (id, entry) => {
    if (entry.sent) return;
    if (entry.target === 'handler') return;
    if (entry.generation !== getGeneration()) { finish(id, failure('CONTEXT_CHANGED')); return; }
    if (entry.waitForHandler && entry.target === 'main' &&
        !(role === 'main' ? handlers.has(entry.method) : ownerMethods.has(entry.method))) return;
    if (entry.target === 'main' && role !== 'main' && !ownerEpoch) return;
    entry.sent = true;
    clearTimeout(entry.discoveryTimer);
    armDeadline(id, entry, entry.timeoutMs, 'MESSAGE_TIMEOUT');
    entry.ownerEpoch = entry.target === 'main' ? ownerEpoch : null;
    try { send({ kind: 'request', id, target: entry.target, method: entry.method,
      payload: entry.payload, generation: entry.generation, ownerEpoch: entry.ownerEpoch,
      recipientEpoch: entry.recipientEpoch }); }
    catch (error) { finish(id, error); }
  };
  const collectHandler = (id, entry) => {
    if (entry.discoveryTimer || entry.sent) return;
    entry.discoveryTimer = setTimeout(() => {
      entry.discoveryTimer = null;
      if (!pending.has(id)) return;
      if (entry.generation !== getGeneration()) { finish(id, failure('CONTEXT_CHANGED')); return; }
      // A bounded collection window may find new peers, but cannot silently
      // omit a known participant just because its renderer responded slowly.
      if (entry.allHandlers && [...entry.expected.values()].some(peer =>
        entry.confirmed.get(peer.documentId) !== peer.epoch)) return;
      const owners = [...entry.candidates.values()].filter(peer =>
        !retiredOwners.has(peer.epoch) && peer.generation === entry.generation && peer.methods.includes(entry.method));
      if (!owners.length && entry.waitForHandler) return;
      if (entry.allHandlers) {
        entry.sent = true;
        armDeadline(id, entry, entry.timeoutMs, 'MESSAGE_TIMEOUT');
        // Discovery is shared; each operation still has one recipient and one
        // ordinary request lifecycle. No broadcast request or first-reply wins.
        Promise.all(owners.map(peer => api.request(peer.documentId, entry.method, entry.payload, {
          timeoutMs: entry.timeoutMs, signal: entry.signal, recipientEpoch: peer.epoch,
        }))).then(results => finish(id, null, results), error => finish(id, error));
        return;
      }
      if (owners.length !== 1) {
        finish(id, failure(owners.length ? 'AMBIGUOUS_HANDLER' : 'METHOD_NOT_FOUND'));
        return;
      }
      entry.target = owners[0].documentId;
      entry.recipientEpoch = owners[0].epoch;
      dispatch(id, entry);
    }, 50);
  };
  const contextMatches = message => message.generation === getGeneration();
  const addressed = message => message.target === '*' || message.target === documentId ||
    (message.target === 'main' && role === 'main');

  async function answer(message) {
    const handler = handlers.get(message.method);
    try {
      if (!contextMatches(message) || (message.recipientEpoch && message.recipientEpoch !== epoch) ||
          (message.ownerEpoch && message.target === 'main' && message.ownerEpoch !== epoch)) {
        throw failure('CONTEXT_CHANGED');
      }
      if (!handler) throw failure('METHOD_NOT_FOUND', `Unknown Web method: ${message.method}`);
      const value = await handler(message.payload, { sender: message.sender, generation: message.generation });
      if (closed) return;
      if (!contextMatches(message)) throw failure('CONTEXT_CHANGED');
      send({ kind: 'reply', id: message.id, target: message.sender, requestEpoch: message.epoch,
        generation: message.generation, payload: value });
    } catch (error) {
      if (closed) return;
      try {
        send({ kind: 'reply', id: message.id, target: message.sender, requestEpoch: message.epoch,
          generation: message.generation, error: {
            code: error.code || 'REMOTE_ERROR', message: error.message || String(error), details: error.details,
          } });
      } catch (sendError) { onError(sendError); }
    }
  }
  function receive(message) {
    if (closed || !message || message.version !== 1 || message.scope !== scope) return;
    if (retiredOwners.has(message.epoch)) return;
    if (message.kind === 'discover') { presence(message.id); return; }
    if (message.kind === 'presence') {
      const peer = { documentId: message.sender, epoch: message.epoch,
        methods: message.methods || [], generation: message.generation };
      peers.set(message.sender, peer);
      for (const [id, entry] of pending) {
        const expected = entry.expected.get(message.sender);
        if (!entry.sent && expected && (expected.epoch !== peer.epoch ||
            peer.generation !== entry.generation || !peer.methods.includes(entry.method))) {
          finish(id, failure('CONTEXT_CHANGED'));
          continue;
        }
        if (entry.target !== 'handler' || (message.discoveryId && message.discoveryId !== id)) continue;
        entry.candidates.set(message.sender, peer);
        if (message.discoveryId === id) entry.confirmed.set(message.sender, message.epoch);
        collectHandler(id, entry);
      }
      return;
    }
    if (message.kind === 'left') {
      if (peers.get(message.sender)?.epoch === message.epoch) peers.delete(message.sender);
      for (const [id, entry] of pending) {
        if (entry.candidates?.get(message.sender)?.epoch === message.epoch) entry.candidates.delete(message.sender);
        if (entry.recipientEpoch === message.epoch || entry.expected.get(message.sender)?.epoch === message.epoch) {
          finish(id, failure('CONTEXT_CHANGED'));
        }
      }
      return;
    }
    if (message.kind === 'hello') {
      if (role === 'main' && message.epoch !== epoch) announce();
      return;
    }
    if (message.kind === 'owner') {
      if (role !== 'main') {
        if (retiredOwners.has(message.ownerEpoch)) return;
        invalidateOwner(message.ownerEpoch);
        ownerMethods = new Set(message.methods || []);
      }
      for (const [id, entry] of pending) dispatch(id, entry);
      return;
    }
    if (message.kind === 'owner-left') {
      if (message.epoch === ownerEpoch && role !== 'main') invalidateOwner(null);
      return;
    }
    if (!addressed(message)) return;
    // A main event can arrive before the reply to this peer's initial hello.
    // It establishes the first owner, but a retired document can never return.
    if (message.kind === 'event' && message.ownerEpoch && !ownerEpoch &&
        !retiredOwners.has(message.ownerEpoch)) invalidateOwner(message.ownerEpoch);
    if (message.kind === 'reply') {
      const entry = pending.get(message.id);
      if (!entry || message.requestEpoch !== epoch ||
          (entry.target !== 'main' && message.sender !== entry.target) ||
          (entry.ownerEpoch && message.epoch !== entry.ownerEpoch) ||
          (entry.recipientEpoch && message.epoch !== entry.recipientEpoch)) return;
      if (entry.generation !== getGeneration()) finish(message.id, failure('CONTEXT_CHANGED'));
      else if (message.error) finish(message.id, failure(message.error.code, message.error.message, message.error.details));
      else finish(message.id, null, message.payload);
      return;
    }
    const key = `${message.epoch}:${message.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (seen.size > 4096) seen.delete(seen.values().next().value);
    if (message.kind === 'request') { void answer(message); return; }
    if (message.kind !== 'event' || !contextMatches(message) ||
        (message.ownerEpoch && message.ownerEpoch !== ownerEpoch)) return;
    for (const handler of [...(subscriptions.get(message.topic) || [])]) {
      try { Promise.resolve(handler(message.payload, { sender: message.sender, generation: message.generation })).catch(onError); }
      catch (error) { onError(error); }
    }
  }
  const receiveEvent = event => receive(event.data);
  if (channel.addEventListener) channel.addEventListener('message', receiveEvent);
  else channel.onmessage = receiveEvent;
  if (role === 'main') announce();
  else send({ kind: 'hello' });

  const api = {
    documentId,
    role,
    setGeneration(provider) {
      if (typeof provider !== 'function') throw failure('INVALID_ARGUMENT', 'Generation provider must be a function');
      getGeneration = provider;
    },
    on(topic, handler) {
      if (closed) throw failure('MESSAGES_CLOSED');
      if (!subscriptions.has(topic)) subscriptions.set(topic, new Set());
      subscriptions.get(topic).add(handler);
      return () => {
        subscriptions.get(topic)?.delete(handler);
        if (!subscriptions.get(topic)?.size) subscriptions.delete(topic);
      };
    },
    handle(method, handler) {
      if (closed) throw failure('MESSAGES_CLOSED');
      if (handlers.has(method)) throw failure('DUPLICATE_HANDLER', `Already registered: ${method}`);
      handlers.set(method, handler);
      presence();
      if (role === 'main') announce();
      return () => {
        if (handlers.get(method) === handler) handlers.delete(method);
        if (!closed) presence();
        if (!closed && role === 'main') announce();
      };
    },
    async emit(topic, payload, { target = '*' } = {}) {
      send({ kind: 'event', id: uniqueId(), target, topic, payload, generation: getGeneration(),
        ownerEpoch: role === 'main' ? epoch : null });
    },
    requestHandler(method, payload, options) { return api.request('handler', method, payload, options); },
    requestAll(method, payload, options) { return api.request('handler', method, payload, { ...options, allHandlers: true }); },
    request(target, method, payload, { timeoutMs = 10_000, readyTimeoutMs = timeoutMs,
      signal, waitForHandler = false, allHandlers = false, recipientEpoch } = {}) {
      if (closed) return Promise.reject(failure('MESSAGES_CLOSED'));
      if (signal?.aborted) return Promise.reject(failure('ABORTED'));
      return new Promise((resolve, reject) => {
        const id = uniqueId();
        const generation = getGeneration();
        let snapshot;
        try { snapshot = clone(payload); } catch (error) { reject(error); return; }
        const entry = { resolve, reject, target, generation, signal, method, payload: snapshot,
          timeoutMs, waitForHandler, allHandlers, recipientEpoch, sent: false, candidates: new Map(),
          expected: new Map(allHandlers ? [...peers].filter(([, peer]) =>
            peer.generation === generation && !retiredOwners.has(peer.epoch) && peer.methods.includes(method)) : []),
          confirmed: new Map(),
          ownerEpoch: target === 'main' ? ownerEpoch : null,
          abort: () => finish(id, failure('ABORTED')) };
        pending.set(id, entry);
        armDeadline(id, entry, readyTimeoutMs, entry.expected.size ? 'MESSAGE_TIMEOUT' :
          waitForHandler || target === 'handler' ? 'METHOD_NOT_FOUND' : 'MESSAGE_TIMEOUT');
        signal?.addEventListener('abort', entry.abort, { once: true });
        if (target === 'handler') {
          // Discover only capabilities, then send the operation to exactly one
          // document. The bounded collection is never a retry of the operation.
          collectHandler(id, entry);
          try { send({ kind: 'discover', id }); } catch (error) { finish(id, error); }
          return;
        }
        dispatch(id, entry);
        if (!entry.sent && target === 'main') {
          try { send({ kind: 'hello' }); } catch (error) { finish(id, error); }
        }
      });
    },
    dispose() {
      if (closed) return;
      try {
        send({ kind: 'left' });
        if (role === 'main') send({ kind: 'owner-left' });
      } catch (error) { onError(error); }
      finally {
        closed = true;
        for (const id of pending.keys()) finish(id, failure('MESSAGES_CLOSED'));
        subscriptions.clear();
        handlers.clear();
        peers.clear();
        if (channel.removeEventListener) channel.removeEventListener('message', receiveEvent);
        else channel.onmessage = null;
        channel.close();
      }
    },
  };
  return api;
}

const surfaces = new WeakMap();

/** Resolve identity once. Navigation must not turn a Dock into a main owner. */
export function getWebMessages(surface = window) {
  if (surfaces.has(surface)) return surfaces.get(surface);
  const { owner, role, generation } = getWebDocumentIdentity(surface);
  const messages = createWebMessages({ scope: owner, role,
    documentId: uniqueId(),
    getGeneration: () => generation,
  });
  const dispose = messages.dispose;
  messages.dispose = () => {
    dispose();
    surface.removeEventListener?.('pagehide', messages.dispose);
  };
  surface.addEventListener?.('pagehide', messages.dispose);
  surfaces.set(surface, messages);
  return messages;
}
