export const indexActorsByHandle = (actors = []) => {
  const index = new Map();
  for (const actor of actors) {
    const guid = String(actor?.actor_guid || actor?.guid || '').trim();
    if (!guid) continue;
    index.set(guid, {
      actor_guid: guid,
      name: actor.name,
      type: actor.type || actor.actor_type || 'actor',
    });
  }
  return index;
};

export const createViewportPickController = ({
  api,
  getCameraBinding,
  getHitRect,
  getRenderRect,
  onPickStart,
  onResult,
  emitActorChange,
  makeRequestId,
} = {}) => {
  let latestRequestId = '';
  let sequence = 0;
  let disposed = false;
  const nextRequestId = makeRequestId || (() => `pick-${Date.now()}-${++sequence}`);
  const currentScope = () => {
    const binding = getCameraBinding?.() || {};
    return { scene: binding.sceneId, camera: binding.cameraId, archive: binding.archiveSession };
  };
  const sameScope = (a, b) => a.scene === b.scene && a.camera === b.camera && a.archive === b.archive;
  const rect = value => {
    if (!value) return null;
    const { left, top, width, height } = value;
    return [left, top, width, height].every(Number.isFinite) && width > 0 && height > 0
      ? { left, top, width, height } : null;
  };
  const contains = (r, x, y) => r && x >= r.left && y >= r.top && x < r.left + r.width && y < r.top + r.height;

  return {
    dispose() { disposed = true; latestRequestId = ''; },
    pickAt(event) {
      if (disposed || typeof api?.viewport?.pick !== 'function') return false;
      const scope = currentScope();
      if (![scope.scene, scope.camera, scope.archive].every(value => typeof value === 'string' && value)) return false;
      const clientX = event?.clientX, clientY = event?.clientY;
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
      const hit = rect(getHitRect?.());
      const render = rect(getRenderRect?.());
      if (!contains(hit, clientX, clientY) || !contains(render, clientX, clientY)) return false;
      const requestId = nextRequestId();
      latestRequestId = requestId;
      const current = () => !disposed && requestId === latestRequestId && sameScope(scope, currentScope());
      const deliver = payload => {
        if (!current()) return;
        const result = { status: payload.status, payload };
        if (payload.status === 'success') {
          result.actor = { handle: payload.actor_handle, guid: payload.actor_guid, name: payload.actor_name, type: payload.actor_type };
          if (!result.actor.name || !result.actor.guid || !result.actor.handle) result.status = 'error';
          else {
            result.status = 'selected';
            Promise.resolve(emitActorChange?.(result.actor.type, scope.scene, result.actor.name, { node_index: payload.node_index }))
              .catch(error => console.warn('[viewport pick] Selection failed', error));
          }
        }
        onResult?.(payload, result);
      };
      let promise;
      try {
        promise = api.viewport.pick(scope.scene, scope.camera, { archive_session: scope.archive,
          x: clientX - render.left, y: clientY - render.top, width: render.width, height: render.height });
      } catch (_) { return false; }
      onPickStart?.(requestId);
      Promise.resolve(promise).then(payload => {
        if (!payload || payload.scene !== scope.scene || payload.camera_id !== scope.camera || payload.archive_session !== scope.archive) return;
        deliver({ ...payload, requestId });
      }, error => deliver({ status: 'error', code: error?.code, message: error?.message, scene: scope.scene, requestId }))
        .catch(error => console.warn('[viewport pick] Result consumer failed', error));
      return requestId;
    },
  };
};
