export const resolveOpenedProjectScene = (payload = {}) => {
  // 同时兼容单场景契约（scene.path）与多场景契约（scenes + active_index）；
  // 原生 on_init 目前返回后者，只读 scene.path 会让调用方退回默认场景。
  const scenes = Array.isArray(payload?.scenes) ? payload.scenes : [];
  const index = Math.min(Math.max(Number(payload?.active_index) || 0, 0),
    Math.max(0, scenes.length - 1));
  const route = payload?.scene?.path || scenes[index]?.path || payload?.path;
  return typeof route === 'string' ? route.trim() : '';
};
