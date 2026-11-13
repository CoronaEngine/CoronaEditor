// Shared viewport coordinate adapter; transport belongs to the native V8 object.
export const createScriptInputSender = ({ api, getBinding, getRenderRect }) => {
  let disposed = false;
  const sender = (type, event, pickedActor = '') => sender.capture(type, event)(pickedActor);
  sender.dispose = () => { disposed = true; };
  sender.capture = (eventType, event) => {
    const { sceneId, cameraId, archiveSession } = getBinding() || {};
    if (disposed || ![sceneId, cameraId, archiveSession].every(value => typeof value === 'string' && value)) return async () => false;
    const rect = getRenderRect();
    const x = event?.clientX, y = event?.clientY;
    if (!rect || ![x, y, rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) return async () => false;
    const input = { archive_session: archiveSession, type: 'mouse',
      event: eventType, button: { 0: 'LeftButton', 1: 'MiddleButton', 2: 'RightButton' }[event.button] || '',
      x, y, viewport_x: x - rect.left, viewport_y: y - rect.top, viewport_width: rect.width, viewport_height: rect.height };
    return async (pickedActor = '') => {
      const current = getBinding() || {};
      if (disposed || current.sceneId !== sceneId || current.cameraId !== cameraId || current.archiveSession !== archiveSession) return false;
      return api.input.dispatch(sceneId, cameraId, { ...input, picked_actor: pickedActor });
    };
  };
  return sender;
};
