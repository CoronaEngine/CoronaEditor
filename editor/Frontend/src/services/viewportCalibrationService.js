import { normalizeLightFieldCalibration } from '../utils/viewportUiMode.js';

const METHOD = 'viewportUi.calibration';
const EVENT = 'viewportUi.calibrationChanged';
const retired = () => Object.assign(new Error('Calibration document was retired'), { code: 'CONTEXT_CHANGED' });

/** Display calibration is a main-document preference; persistence is only a startup seed. */
export function createViewportCalibrationService(messages, { owner, main = false, store } = {}) {
  if (!owner) throw new Error('Calibration requires the document owner');
  let disposed = false;
  let revision = main ? 0 : -1;
  let calibration = normalizeLightFieldCalibration(main ? store?.get({}) : null);
  const listeners = new Set();
  const read = () => ({ ...calibration });
  const snapshot = () => ({ owner, revision, calibration: read() });
  const notify = () => {
    const report = error => console.warn('[ViewportCalibration] View update failed', error);
    for (const listener of [...listeners]) {
      try { Promise.resolve(listener(read())).catch(report); } catch (error) { report(error); }
    }
  };
  const accept = value => {
    if (disposed || value?.owner !== owner || !Number.isSafeInteger(value.revision) || value.revision <= revision) return;
    revision = value.revision;
    calibration = normalizeLightFieldCalibration(value.calibration);
    notify();
  };
  const write = async value => {
    if (disposed) throw retired();
    calibration = normalizeLightFieldCalibration(value);
    revision++;
    try { store?.set({}, calibration); } catch { /* Persistence cannot block active synchronization. */ }
    const next = snapshot();
    notify();
    await messages.emit(EVENT, next);
    return next;
  };
  const stopEvent = main ? () => {} : messages.on(EVENT, accept);
  const stopRequest = main ? messages.handle(METHOD, payload => {
    if (disposed) throw retired();
    if (payload?.action === 'get') return snapshot();
    if (payload?.action === 'set') return write(payload.calibration);
    throw Object.assign(new Error('Unknown calibration action'), { code: 'INVALID_ARGUMENT' });
  }) : () => {};
  return {
    owner,
    get ready() { return !disposed && revision >= 0; },
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
