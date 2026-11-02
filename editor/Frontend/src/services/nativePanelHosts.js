// One browser per panel. Geometry and docking live in ImGui; this controller only
// reconciles Web-owned open/close intent and protects asynchronous world teardown.
export function createNativePanelHosts({ open, close, onError = console.error }) {
  const hosts = new Map();
  let disposed = false;
  function reconcile(panels) {
    const wanted = new Map(panels.map(panel => [panel.id, panel]));
    for (const [id, host] of hosts) {
      host.wanted = wanted.has(id);
      if (!host.wanted && host.tabId !== undefined) {
        hosts.delete(id);
        void close(host.tabId, id).catch(onError);
      }
    }
    if (disposed) return;
    for (const [id, panel] of wanted) {
      if (hosts.has(id)) continue;
      const host = { wanted: true };
      hosts.set(id, host);
      host.pending = Promise.resolve().then(() => open(panel)).then(async result => {
        const tabId = result?.tab_id ?? result?.data?.tab_id;
        if (!Number.isInteger(tabId)) throw new Error(`Missing tab_id for ${id}`);
        host.tabId = tabId;
        if (disposed || !host.wanted) {
          hosts.delete(id);
          await close(tabId, id);
        }
      }).catch(error => {
        if (hosts.get(id) === host) hosts.delete(id);
        onError(error, id);
      });
    }
  }
  function closed(id, tabId) {
    const host = hosts.get(id);
    if (!host || host.tabId !== tabId) return false;
    hosts.delete(id);
    return true;
  }
  function dispose() { disposed = true; reconcile([]); }
  return { reconcile, closed, dispose };
}
