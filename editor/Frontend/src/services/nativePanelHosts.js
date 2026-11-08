// One browser per panel. Geometry and docking live in ImGui; this controller only
// reconciles Web-owned open/close intent and protects asynchronous world teardown.
export function createNativePanelHosts({ open, close, focus = async () => {}, onError = console.error }) {
  const hosts = new Map();
  const closing = new Map();
  let disposed = false;
  let latestPanels = [];
  function retire(id, host) {
    if (closing.has(id)) return closing.get(id);
    const pending = Promise.resolve().then(() => close(host.tabId, id)).then(() => {
      if (hosts.get(id) === host) hosts.delete(id);
      if (!disposed && host.wanted) reconcile(latestPanels);
    }).catch(onError).finally(() => {
      if (closing.get(id) === pending) closing.delete(id);
    });
    closing.set(id, pending);
    return pending;
  }
  function reconcile(panels) {
    latestPanels = panels;
    const wanted = new Map(panels.map(panel => [panel.id, panel]));
    for (const [id, host] of hosts) {
      const wasWanted = host.wanted;
      host.wanted = wanted.has(id);
      if (!host.wanted && wasWanted && host.tabId !== undefined) {
        void retire(id, host);
      }
    }
    if (disposed) return;
    for (const [id, panel] of wanted) {
      if (hosts.has(id)) continue;
      const host = { wanted: true };
      hosts.set(id, host);
      host.pending = Promise.resolve(closing.get(id)).then(async () => {
        if (disposed || !host.wanted) {
          hosts.delete(id);
          return;
        }
        const result = await open(panel);
        const tabId = result?.tab_id;
        if (!Number.isInteger(tabId)) throw new Error(`Missing tab_id for ${id}`);
        host.tabId = tabId;
        if (disposed || !host.wanted) {
          await retire(id, host);
        }
      }).catch(error => {
        if (hosts.get(id) !== host) return;
        hosts.delete(id);
        if (!disposed && host.wanted) onError(error, id);
      });
    }
  }
  function closed(id, tabId) {
    const host = hosts.get(id);
    if (!Number.isInteger(tabId) || !host || host.tabId !== tabId || closing.has(id)) return false;
    hosts.delete(id);
    return true;
  }
  function dispose() { disposed = true; reconcile([]); }
  async function focusPanel(id) {
    const host = hosts.get(id);
    if (!host) return false;
    await host.pending;
    if (disposed || hosts.get(id) !== host || !host.wanted || host.tabId === undefined) return false;
    await focus(host.tabId);
    return true;
  }
  return { reconcile, closed, dispose, focusPanel };
}
