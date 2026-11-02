import { trackWorldSessionWork } from './worldSessionLifecycle.js';

// World entry uses Native even when an archive remembers a Vision camera.
// This is an entry policy; explicit editor render selections remain separate.
export async function initializeWorldRenderBackend({ api, sceneId, cameraId = null, isCurrent }) {
  if (!isCurrent()) return false;
  const response = await trackWorldSessionWork(api.sceneTools.setRenderBackend('native', sceneId, cameraId));
  if (!isCurrent()) return false;
  const result = response?.data ?? response;
  if (result?.mode !== 'native') throw new Error('无法启用 Native 渲染管线');
  return true;
}
