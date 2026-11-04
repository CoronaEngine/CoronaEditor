/** Canonical Blockly and role-script runtime service facade. */

import { saveBlocklyTarget, loadBlocklyTarget } from '@/blockly/targetArchive.js';
import { editorApi } from '../api/editorApi.js';

export const scriptingService = {
  saveBlocklyTarget: (payload) => saveBlocklyTarget(payload),
  loadBlocklyTarget: (payload) => loadBlocklyTarget(payload),
  getScriptStatus: () => editorApi.scripts.getStatus(),
  sendKeyEvent: (key, modifiers, displayKey) =>
    editorApi.scripts.sendKeyEvent(key, modifiers, displayKey),
  sendKeyUpEvent: (key, displayKey) => editorApi.scripts.sendKeyUpEvent(key, displayKey),
  sendMouseEvent: (
    eventType,
    button,
    x,
    y,
    viewportX,
    viewportY,
    viewportWidth,
    viewportHeight,
    pickedActor = ''
  ) =>
    editorApi.scripts.sendMouseEvent(
      eventType,
      button,
      x,
      y,
      viewportX,
      viewportY,
      viewportWidth,
      viewportHeight,
      pickedActor
    ),
};
