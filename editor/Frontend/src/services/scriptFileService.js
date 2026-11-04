import { editorApi } from '../api/editorApi.js';

export async function startScriptFile(request, scripts = editorApi.scripts) {
  try {
    return await scripts.runFile(request);
  } catch (error) {
    if (error.code !== 'EDITOR_API_TIMEOUT' && error.code !== 504) throw error;
    try {
      const receipt = await scripts.getRun(request.requestId);
      if (receipt.data.status !== 'unknown') return receipt;
      return await scripts.runFile(request);
    } catch (recoveryError) {
      recoveryError.scriptRunUnconfirmed = true;
      throw recoveryError;
    }
  }
}
