import { trackWorldSessionWork } from './worldSessionLifecycle.js';

// World entry uses Vision ray tracing while preserving the saved tracing mode.
// This is an entry policy; explicit editor render selections remain separate.
export async function initializeWorldRenderBackend({ api, sceneId, cameraId = null, isCurrent }) {
  if (!isCurrent()) return false;
  const response = await trackWorldSessionWork(api.sceneTools.setRenderBackend('vision', sceneId, cameraId));
  if (!isCurrent()) return false;
  const result = response?.data ?? response;
  if (result?.mode !== 'vision') throw new Error('无法启用 Vision 光线追踪管线');
  return true;
}
