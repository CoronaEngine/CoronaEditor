/** Archive-scoped graph persistence. webMessages owns discovery and requests. */
import { editorApi } from '../api/editorApi.js';
import { getWebMessages } from '../api/webMessages.js';

const failure = (code, message) => Object.assign(new Error(message || code), { code });
const METHOD = 'nodeGraph.flush';

export function createNodeGraphSaves({ messages, timeoutMs = 30_000 }) {
  const workspaces = new Set();
  const flushes = new Map();
  let stopHandler;
  function remove(workspace) {
    workspaces.delete(workspace);
    if (!workspaces.size) { stopHandler?.(); stopHandler = null; }
  }
  function save(workspace, session) {
    if (workspace.pending) return workspace.pending;
    const work = Promise.resolve().then(async () => {
      if (workspace.getSession() !== session) throw failure('CONTEXT_CHANGED', '节点图存档已切换');
      const result = await workspace.flush(session);
      if (workspace.getSession() !== session) throw failure('CONTEXT_CHANGED', '节点图存档已切换');
      if (!result) throw failure('GRAPH_SAVE_FAILED', '节点图保存失败，已取消切换世界');
      if (workspace.retired) remove(workspace);
      return result;
    }).finally(() => { if (workspace.pending === work) workspace.pending = null; });
    workspace.pending = work;
    return work;
  }
  async function flushLocal({ archiveSession } = {}) {
    if (typeof archiveSession !== 'string' || !archiveSession) throw failure('INVALID_ARGUMENT', '保存需要存档会话');
    const selected = [...workspaces].filter(workspace => workspace.getSession() === archiveSession);
    await Promise.all(selected.map(workspace => save(workspace, archiveSession)));
    return { archiveSession, saved: selected.length };
  }
  return {
    register({ getSession, flush }) {
      if (typeof getSession !== 'function' || typeof flush !== 'function') throw failure('INVALID_ARGUMENT');
      if (!stopHandler) stopHandler = messages.handle(METHOD, flushLocal);
      const workspace = { getSession, flush, retired: false, pending: null };
      workspaces.add(workspace);
      return {
        retire() {
          if (!workspaces.has(workspace)) return Promise.resolve(true);
          workspace.retired = true;
          const session = getSession();
          if (!session) { remove(workspace); return Promise.resolve(true); }
          // On failure, retain the old graph closure for an explicit retry.
          return save(workspace, session);
        },
      };
    },
    flush(archiveSession) {
      if (typeof archiveSession !== 'string' || !archiveSession) return Promise.reject(failure('INVALID_ARGUMENT'));
      if (flushes.has(archiveSession)) return flushes.get(archiveSession);
      const work = messages.requestAll(METHOD, { archiveSession }, { timeoutMs })
        .finally(() => { if (flushes.get(archiveSession) === work) flushes.delete(archiveSession); });
      flushes.set(archiveSession, work);
      return work;
    },
  };
}

const coordinators = new WeakMap();
const activeFlushes = new WeakMap();
export function getNodeGraphSaves(surface = window) {
  if (!coordinators.has(surface)) coordinators.set(surface,
    createNodeGraphSaves({ messages: getWebMessages(surface) }));
  return coordinators.get(surface);
}

export function flushActiveNodeGraphs(surface = window) {
  if (activeFlushes.has(surface)) return activeFlushes.get(surface);
  const work = (async () => {
    const scope = await editorApi.scene.readActive();
    if (!scope.archive_session) return [];
    const results = await getNodeGraphSaves(surface).flush(scope.archive_session);
    const after = await editorApi.scene.readActive();
    if (after.archive_session !== scope.archive_session) {
      throw failure('CONTEXT_CHANGED', '保存期间原生存档已切换');
    }
    return results;
  })().finally(() => { if (activeFlushes.get(surface) === work) activeFlushes.delete(surface); });
  activeFlushes.set(surface, work);
  return work;
}
