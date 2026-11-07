import { getWebMessages } from '../api/webMessages.js';
import { worldModeService } from './worldModeService.js';

export const PROJECT_CHANGED_TOPIC = 'world.project-changed';

const available = () => typeof window !== 'undefined' && typeof window.addEventListener === 'function';

export function publishProjectChanged(projectPath, messages = available() ? getWebMessages() : null) {
  if (!messages) return Promise.resolve();
  return messages.emit(PROJECT_CHANGED_TOPIC, {
    projectPath: String(projectPath || '').trim(),
  });
}

export function subscribeProjectChanged(listener, messages = available() ? getWebMessages() : null) {
  if (!messages) return () => {};
  return messages.on(PROJECT_CHANGED_TOPIC, value => {
    const projectPath = String(value?.projectPath || '').trim();
    worldModeService.commitActiveProject(projectPath);
    listener({ projectPath });
  });
}
