/** Canonical Blockly and role-script runtime service facade. */

import { editorApi } from '../api/editorApi.js';

export const scriptingService = {
  saveBlocklyTarget: (payload) => editorApi.scratch.saveBlocklyTarget(payload),
  loadBlocklyTarget: (payload) => editorApi.scratch.loadBlocklyTarget(payload),
  getScriptStatus: () => editorApi.scratch.getScriptStatus(),
  sendKeyEvent: (key, modifiers, displayKey) =>
    editorApi.scratch.sendKeyEvent(key, modifiers, displayKey),
  sendKeyUpEvent: (key, displayKey) => editorApi.scratch.sendKeyUpEvent(key, displayKey),
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
    editorApi.scratch.sendMouseEvent(
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
