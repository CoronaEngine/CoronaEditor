import { editorApi } from '../api/editorApi.js';

export async function readScriptProject() {
  const state = await editorApi.scene.readActive();
  if (!state.archive_session || !state.project_path) throw new Error('没有活动项目');
  if (state.read_only) throw new Error('当前项目为只读');
  return { project_path: state.project_path, archive_session: state.archive_session };
}

export async function startScriptFile(request, scripts = editorApi.scripts) {
  try {
    return await scripts.runFile(request);
  } catch (error) {
    if (error.code !== 'EDITOR_API_TIMEOUT' && error.code !== 504 && error.code !== '504') throw error;
    try {
      const receipt = await scripts.getRun(request.requestId);
      if (receipt.status !== 'unknown') return receipt;
      return await scripts.runFile(request);
    } catch (recoveryError) {
      recoveryError.scriptRunUnconfirmed = true;
      throw recoveryError;
    }
  }
}
