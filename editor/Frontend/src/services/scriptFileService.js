import { editorApi } from '../api/editorApi.js';

export async function readScriptProject() {
  const state = await editorApi.scene.read_active();
  if (!state.archive_session || !state.project_path) throw new Error('没有活动项目');
  if (state.read_only) throw new Error('当前项目为只读');
  return { project_path: state.project_path, archive_session: state.archive_session };
}
