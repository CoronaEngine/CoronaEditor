/** Canonical Blockly and role-script runtime service facade. */

import { saveBlocklyTarget, loadBlocklyTarget } from '@/blockly/targetArchive.js';
import { editorApi } from '../api/editorApi.js';

export const scriptingService = {
  saveBlocklyTarget: (payload) => saveBlocklyTarget(payload),
  loadBlocklyTarget: (payload) => loadBlocklyTarget(payload),
  getScriptStatus: () => editorApi.scripts.getStatus(),
};
