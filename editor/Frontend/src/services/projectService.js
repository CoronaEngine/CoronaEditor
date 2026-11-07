/** Canonical project and main-view service facade. */

import { editorApi } from '../api/editorApi.js';
import { appService } from './appService.js';
import { worldModeState } from './worldModeService.js';

export const projectService = {
  OnInit: (projectPath = worldModeState.activeProjectPath || '') =>
    editorApi.main.onInit(projectPath),
  importResourceFileByDialog: (sceneName, fileType) =>
    editorApi.main.importResourceFile(sceneName, fileType),
  sceneSave: (sceneName, session) => editorApi.main.sceneSave(sceneName, session),
  setDragRegions: appService.setDragRegions,
  setCurrentTabDragRegions: appService.setCurrentTabDragRegions,
};
