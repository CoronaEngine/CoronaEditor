/** Single-scene project creation and opening facade. */

import { nextTick } from 'vue';
import { appService } from './appService.js';
import { editorApi } from '../api/editorApi.js';
import { worldModeService, worldModeState } from './worldModeService.js';
import { drainWorldSession, withWorldTimeout } from './worldSessionLifecycle.js';
import { publishProjectChanged } from './projectMessages.js';

let projectOpenQueue = Promise.resolve();
let selectionVersion = 0;
let runtimeCleanupRequired = false;
const superseded = () => ({ ok: false, status: 'superseded' });
export const isProjectOpenSuperseded = (result) => result?.status === 'superseded';

export const resolveOpenedProjectScene = (payload = {}) => {
  const route = payload?.scene?.path;
  return typeof route === 'string' ? route.trim() : '';
};

// Consumers may recover a failed open only while its selection still owns the launcher.
export const getProjectSelectionVersion = () => selectionVersion;

export function cancelPendingProjectOpen() {
  ++selectionVersion;
  const token = worldModeService.beginOpen();
  worldModeService.finishOpen(token);
}

function worldRuntimeCleanupError(kind, result) {
  const details = [result?.restoreError, result?.restore_error, result?.message, result?.error]
    .filter(value => typeof value === 'string' && value.trim());
  if (Array.isArray(result?.pendingThreads) && result.pendingThreads.length) {
    details.push(`未停止的线程：${result.pendingThreads.join('、')}`);
  }
  if (result?.threadAlive) details.push('脚本线程仍在运行');
  if (result?.snapshotCaptured) details.push('运行快照尚未恢复');
  if (result?.restoreStatus && !['idle', 'restored'].includes(result.restoreStatus)) {
    details.push(`恢复状态：${result.restoreStatus}`);
  }
  if (!details.length && result?.status) details.push(`运行状态：${result.status}`);
  const reason = [...new Set(details)].join('；');
  return new Error(`旧世界${kind}尚未停止或恢复失败，已取消切换世界。${reason ? ` 原因：${reason}` : ''}`);
}

// Finish restoring the OLD scene before native open replaces it. Never run a
// stop/restore against the new scene, and fail closed if workers persist.
export async function stopWorldRuntimeBeforeOpen(api = editorApi) {
  const status = await api.scripts.getStatus();
  if ((typeof status?.status !== 'string' && typeof status?.runId !== 'string') || Object.hasOwn(status, 'data'))
    throw new Error('无法读取旧世界脚本状态，已取消切换世界。');
  if (!status.runId || !(status.threadAlive || status.snapshotCaptured || status.inputLocked)) return;
  const script = await api.scripts.stop(status.runId, true);
  if (typeof script?.status !== 'string' || Object.hasOwn(script, 'data'))
    throw new Error('无法确认旧世界脚本已停止，已取消切换世界。');
  // restored=false is normal when no script ever ran or a prior stop already
  // consumed the snapshot. Only live work, retained snapshots, and real errors block opening.
  if (['error', 'starting', 'running', 'stopping'].includes(script?.status)
    || script?.threadAlive || script?.pendingThreads?.length || script?.snapshotCaptured
    || ['error', 'restoring'].includes(script?.restoreStatus) || script?.restoreError) {
    throw worldRuntimeCleanupError('脚本', script);
  }
}

export const projectLauncherService = {
  openProject: (projectPath, options = {}) => {
    // Selection ownership starts at submission, NOT when the native queue runs.
    const selection = ++selectionVersion;
    const current = () => selection === selectionVersion;
    runtimeCleanupRequired ||= worldModeState.status === 'ready';
    const token = worldModeService.beginOpen(projectPath, { newProject: options.newProject === true });
    const operation = projectOpenQueue.catch(() => {}).then(async () => {
      if (!current()) return superseded();
      try {
        await nextTick();
        if (editorApi.window.canCloseSceneViews()) {
          await appService.setEditorUiEnabled(false);
        }
        await drainWorldSession();
        await withWorldTimeout(editorApi.network.stopSession(), '关闭旧世界网络会话');
        if (runtimeCleanupRequired) {
          await withWorldTimeout(stopWorldRuntimeBeforeOpen(), '停止旧世界运行');
          runtimeCleanupRequired = false;
        }
        if (!current()) return superseded();
        const loadPolicy = options.loadPolicy || options.load_policy || 'prompt';
        // Native scene replacement is serialized even if this selection becomes stale.
        const result = await editorApi.project.openProject(projectPath, { load_policy: loadPolicy });
        if (!current()) return superseded();
        const opened = result;
        const activeProjectPath = opened?.path || projectPath;
        if (!opened?.ok) {
          worldModeService.fail(new Error(opened?.message || '打开世界失败'));
          return result;
        }
        const session = await worldModeService.resolve(activeProjectPath, { force: true });
        if (!current() || !session) return superseded();
        await publishProjectChanged(activeProjectPath);
        return result;
      } catch (error) {
        if (!current()) return superseded();
        worldModeService.fail(error);
        throw error;
      } finally {
        worldModeService.finishOpen(token);
      }
    });
    projectOpenQueue = operation;
    return operation;
  },
};
