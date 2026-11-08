import { normalizeLightFieldCalibration } from '../utils/viewportUiMode.js';

const METHOD = 'viewportUi.calibration';
const EVENT = 'viewportUi.calibrationChanged';
const retired = () => Object.assign(new Error('Calibration document was retired'), { code: 'CONTEXT_CHANGED' });
const documentStates = new WeakMap();

/** Display calibration is a main-document preference; persistence is only a startup seed. */
export function createViewportCalibrationService(messages, { owner, main = false, store } = {}) {
  if (!owner) throw new Error('Calibration requires the document owner');
  let disposed = false;
  const state = (main && documentStates.get(messages)) || {
    revision: main ? 0 : -1,
    ownerEpoch: main ? messages.ownerEpoch : null,
    calibration: normalizeLightFieldCalibration(main ? store?.get({}) : null),
  };
  if (main) documentStates.set(messages, state);
  const listeners = new Set();
  const read = () => ({ ...state.calibration });
  const snapshot = () => ({ owner, revision: state.revision, calibration: read() });
  const notify = () => {
    const report = error => console.warn('[ViewportCalibration] View update failed', error);
    for (const listener of [...listeners]) {
      try { Promise.resolve(listener(read())).catch(report); } catch (error) { report(error); }
    }
  };
  const accept = (value, sourceEpoch = messages.ownerEpoch) => {
    if (disposed || !sourceEpoch || sourceEpoch !== messages.ownerEpoch || value?.owner !== owner ||
        !Number.isSafeInteger(value.revision) || value.revision < 0 ||
        (sourceEpoch === state.ownerEpoch && value.revision <= state.revision)) return;
    state.ownerEpoch = sourceEpoch;
    state.revision = value.revision;
    state.calibration = normalizeLightFieldCalibration(value.calibration);
    notify();
  };
  const write = async value => {
    if (disposed) throw retired();
    state.calibration = normalizeLightFieldCalibration(value);
    state.revision++;
    try { store?.set({}, state.calibration); } catch { /* Persistence cannot block active synchronization. */ }
    const next = snapshot();
    notify();
    await messages.emit(EVENT, next);
    return next;
  };
  const stopEvent = main ? () => {} : messages.on(EVENT, (value, context) => accept(value, context.ownerEpoch));
  const stopRequest = main ? messages.handle(METHOD, payload => {
    if (disposed) throw retired();
    if (payload?.action === 'get') return snapshot();
    if (payload?.action === 'set') return write(payload.calibration);
    throw Object.assign(new Error('Unknown calibration action'), { code: 'INVALID_ARGUMENT' });
  }) : () => {};
  if (main) void messages.emit(EVENT, snapshot()).catch(error => console.warn('[ViewportCalibration]', error));
  return {
    owner,
    get ready() { return !disposed && state.revision >= 0; },
    read,
    subscribe(listener) {
      if (disposed) throw retired();
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async hydrate() {
      if (disposed) throw retired();
      if (!main) accept(await messages.request('main', METHOD, { action: 'get' }, { waitForHandler: true }));
      return disposed ? null : read();
    },
    async set(value) {
      if (disposed) throw retired();
      if (main) await write(value);
      else accept(await messages.request('main', METHOD, { action: 'set', calibration: value }));
      return disposed ? null : read();
    },
    dispose() { disposed = true; stopEvent(); stopRequest(); listeners.clear(); },
  };
}
