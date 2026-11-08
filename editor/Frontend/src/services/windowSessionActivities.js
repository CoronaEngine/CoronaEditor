const METHOD = 'windowSession.activitySnapshot';
const uniqueId = () => globalThis.crypto.randomUUID();

export function createWindowSessionActivities(messages, {
  timeoutMs = 30_000,
  wait = ms => new Promise(resolve => setTimeout(resolve, ms)),
  makeId = uniqueId,
} = {}) {
  const active = new Map();
  const stop = messages.handle(METHOD, () => [...active.values()]);

  return {
    begin(activity) {
      const id = makeId();
      active.set(id, { ...activity, id });
      return id;
    },
    end(id) {
      active.delete(id);
    },
    async drain(predicate = () => true) {
      const started = Date.now();
      while (true) {
        let snapshots;
        try {
          snapshots = await messages.requestAll(METHOD, null, {
            timeoutMs: Math.min(timeoutMs, Math.max(1, timeoutMs - (Date.now() - started))),
          });
        } catch (error) {
          // A normally closing Dock can leave during this read-only snapshot.
          // Recollect from the remaining participants; never retry native work,
          // saves, world changes, or an unresponsive participant's timeout.
          if (error.code !== 'CONTEXT_CHANGED' || error.details?.reason !== 'PEER_LEFT'
            || Date.now() - started >= timeoutMs) throw error;
          await wait(20);
          continue;
        }
        if (!snapshots.flat().some(predicate)) return;
        if (Date.now() - started >= timeoutMs) throw new Error('等待旧窗口请求结束超时，已取消切换世界，请重试。');
        await wait(20);
      }
    },
    dispose() {
      stop();
      active.clear();
    },
  };
}
