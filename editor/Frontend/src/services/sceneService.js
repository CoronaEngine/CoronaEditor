/** Canonical scene and scene-tools service facade. */

import { editorApi } from '../api/editorApi.js';

export const sceneService = {
  removeActor: (sceneName, actorName) => editorApi.sceneTools.removeActor(sceneName, actorName),
  renameActor: (sceneName, actorName, name) =>
    editorApi.sceneTools.renameActor(sceneName, actorName, name),
  getEnvironment: (sceneName, scope) => editorApi.scene.getEnvironment(sceneName, scope),
  setEnvironment: (sceneName, patch) => editorApi.scene.setEnvironment(sceneName, patch),
  captureScreenshot: (sceneName, cameraId, options) =>
    editorApi.scene.captureScreenshot(sceneName, cameraId, options),
  setOutputMode: (sceneName, cameraName, mode) =>
    editorApi.sceneTools.setOutputMode(sceneName, cameraName, mode),
  getOutputMode: (sceneName, cameraName) =>
    editorApi.sceneTools.getOutputMode(sceneName, cameraName),
  isVisionAvailable: () => editorApi.sceneTools.isVisionAvailable(),
  setRenderBackend: (mode, sceneName = null, cameraId = null) =>
    editorApi.sceneTools.setRenderBackend(mode, sceneName, cameraId),
  getRenderBackend: (sceneName = null, cameraId = null) =>
    editorApi.sceneTools.getRenderBackend(sceneName, cameraId),
  setVisionRenderMode: (sceneName, cameraId = null, mode = 'path_tracing') =>
    editorApi.sceneTools.setVisionRenderMode(sceneName, cameraId, mode),
  getVisionRenderMode: (sceneName, cameraId = null) =>
    editorApi.sceneTools.getVisionRenderMode(sceneName, cameraId),
  createCameraView: (sceneName, name = null) =>
    editorApi.sceneTools.createCameraView(sceneName, name),
  openCameraView: (sceneName, cameraId) => editorApi.sceneTools.openCameraView(sceneName, cameraId),
  closeCameraView: (sceneName, cameraId) =>
    editorApi.sceneTools.closeCameraView(sceneName, cameraId),
  renameCameraView: (sceneName, cameraId, name) =>
    editorApi.sceneTools.renameCameraView(sceneName, cameraId, name),
  listCameraViews: (sceneName) => editorApi.sceneTools.listCameraViews(sceneName),
  deleteCamera: (sceneName, cameraId) => editorApi.sceneTools.deleteCamera(sceneName, cameraId),
  reloadScene: (sceneName, projectPath = '') =>
    editorApi.sceneTools.reloadScene(sceneName, projectPath),
  rebindActorResource: (sceneName, actorGuid, path) =>
    editorApi.sceneTools.rebindActorResource(sceneName, actorGuid, path),
  openSceneActor: (sceneName, actorName) => editorApi.sceneTools.openActor(sceneName, actorName),
  setActorProperties: (sceneName, actorName, patch) =>
    editorApi.scene.setActorProperties(sceneName, actorName, patch),
  selectModelFileDialog: (sceneName, actorName, fileType = 'model') =>
    editorApi.sceneTools.selectModelFile(sceneName, actorName, fileType),
  playAudio: (resourceId, loop) => editorApi.sceneTools.playAudio(resourceId, loop),
  stopAudio: (resourceId) => editorApi.sceneTools.stopAudio(resourceId),
  actorPlayAudio: (actorName, loop = false) => editorApi.sceneTools.actorPlayAudio(actorName, loop),
  actorStopAudio: (actorName) => editorApi.sceneTools.actorStopAudio(actorName),
  getScene: (sceneId) => editorApi.scene.getSnapshot(sceneId),
};
