import { trackWorldSessionWork } from './worldSessionLifecycle.js';

// World entry uses Vision ray tracing while preserving the saved tracing mode.
// This is an entry policy; explicit editor render selections remain separate.
export async function initializeWorldRenderBackend({ api, sceneId, cameraId, archiveSession, isCurrent }) {
  if (!archiveSession) throw new Error('启用渲染后端需要存档会话');
  if (!isCurrent()) return false;
  const result = await trackWorldSessionWork(api.scene.setCameraRenderSettings(sceneId, cameraId, {
    archive_session: archiveSession,
    render_backend: 'vision',
  }));
  if (!isCurrent()) return false;
  if (result?.render_backend !== 'vision') throw new Error('无法启用 Vision 光线追踪管线');
  return true;
}
