/** Project readiness and lifetime. Every loaded project uses the same editor. */
import { shallowReactive } from 'vue';
import { editorApi } from '../api/editorApi.js';
import { isSecondaryWebDocument } from '../api/webDocument.js';

export const LAUNCHER_ROUTES = new Set(['/StartScreen', '/NewGame', '/JoinGame', '/RecentGames']);
// Keep the metadata field compatible with existing archives and callers.
export const normalizeWorldMode = () => 'creative';
export const normalizeProjectPath = (path) => String(path || '').trim()
  .replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();

export function unwrapProjectInfo(response) {
  let info = response;
  for (let i = 0; i < 3 && info?.data && !info?.project_path; i++) info = info.data;
  if (typeof info?.project_path !== 'string' || !info.project_path.trim()) {
    throw new Error('无法读取当前项目，请重新打开世界。');
  }
  return info;
}

export async function readWorldProjectInfo(api) {
  return unwrapProjectInfo(await api.projectSettings.getActiveProjectInfo());
}

export function createWorldModeController({ readProjectInfo, publish = () => {} }) {
  const state = {
    status: 'idle', mode: null, projectPath: '', activeProjectPath: '',
    newProject: false, revision: 0, error: null,
  };
  let pending = null;
  let opening = false;
  let openToken = 0;
  const emit = () => publish({ ...state });
  function invalidate(projectPath = '', { newProject = false } = {}) {
    state.revision += 1;
    Object.assign(state, { status: 'loading', mode: null, projectPath, newProject, error: null });
    pending = null;
    emit();
    return state.revision;
  }
  async function resolve(expectedPath = '', { force = false } = {}) {
    const expected = normalizeProjectPath(expectedPath);
    if (!force && state.status === 'ready' && (!expected || normalizeProjectPath(state.projectPath) === expected)) {
      return { ...state };
    }
    // Initial navigation and project observation describe the same native read.
    // The observer may narrow its expected path without cancelling navigation.
    if (!force && pending && (!expected || !pending.expected || pending.expected === expected)) {
      if (expected) pending.expected = expected;
      return pending.promise;
    }
    // Keep the entry policy through metadata refreshes of this project only.
    // A subsequent beginOpen resets it, even when continuing the same archive.
    const newProjectPath = state.newProject ? normalizeProjectPath(state.projectPath) : '';
    const revision = invalidate(expectedPath);
    const request = { expected, promise: null };
    request.promise = (async () => {
      try {
        const info = unwrapProjectInfo(await readProjectInfo());
        if (revision !== state.revision) return null;
        if (request.expected && normalizeProjectPath(info.project_path) !== request.expected) {
          throw new Error('当前世界已改变，请重新打开目标世界。');
        }
        Object.assign(state, { status: 'ready', mode: normalizeWorldMode(info.mode),
          projectPath: info.project_path, activeProjectPath: info.project_path,
          newProject: Boolean(newProjectPath) && normalizeProjectPath(info.project_path) === newProjectPath,
          error: null });
        emit();
        return { ...state };
      } catch (error) {
        if (revision !== state.revision) return null;
        Object.assign(state, { status: 'error', mode: null, error });
        emit();
        throw error;
      } finally {
        if (pending === request) pending = null;
      }
    })();
    pending = request;
    return request.promise;
  }
  return {
    state, resolve, invalidate,
    commitActiveProject(projectPath) {
      state.activeProjectPath = String(projectPath || '').trim();
      emit();
      return state.activeProjectPath;
    },
    fail(error) {
      pending = null;
      Object.assign(state, { status: 'error', mode: null, newProject: false, error });
      emit();
    },
    get opening() { return opening; },
    beginOpen(path, options = {}) { opening = true; invalidate(path, options); return ++openToken; },
    finishOpen(token) {
      if (token !== openToken) return false;
      opening = false;
      return true;
    },
  };
}

export const worldModeState = shallowReactive({
  status: 'idle', mode: null, projectPath: '', newProject: false, revision: 0, error: null,
});
export const worldModeService = createWorldModeController({
  readProjectInfo: () => readWorldProjectInfo(editorApi),
  publish: (state) => Object.assign(worldModeState, state),
});
export const editorUiAllowed = () => worldModeState.status === 'ready';

/** Injectable guard shared by the real router and lifecycle regression tests. */
export function createWorldModeRouteGuard({ controller, closePanel, notify,
  isStandalone = to => isSecondaryWebDocument(new URLSearchParams(to.query)) }) {
  return async (to) => {
    if (LAUNCHER_ROUTES.has(to.path)) return true;
    if (controller.opening) return false;
    try {
      const session = await controller.resolve();
      if (!session) return false;
      return true;
    } catch (error) {
      if (isStandalone(to)) {
        await closePanel().catch(() => {});
        return false;
      }
      notify(error.message || '读取项目失败', error);
      return '/StartScreen';
    }
  };
}
