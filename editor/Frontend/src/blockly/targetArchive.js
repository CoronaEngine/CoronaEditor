import { editorApi } from '../api/editorApi.js';

async function accessTarget(payload, save) {
  const { archive_session, project_path, code, workspace } = payload;
  const target_type = payload.target_type === 'model' ? 'actor' : payload.target_type || 'actor';
  const scene_name = target_type === 'project' ? '' : payload.scene_name;
  const actor_name = target_type === 'project' ? '' : payload.actor_name;
  const script_kind = payload.script_kind || 'blockly';
  if (!['actor', 'project'].includes(target_type) || (target_type === 'actor' && (!scene_name || !actor_name))) {
    throw new Error('Invalid Blockly target');
  }
  const identity = [script_kind, target_type, scene_name, actor_name];
  const prefix = script_kind === 'node_graph' ? 'node_graph:' : '';
  const id = prefix + (target_type === 'project' ? 'project:global' : `actor:${scene_name}:${actor_name}`);
  const target = { id, script_kind, target_type, scene_name, actor_name,
    enabled: payload.enabled ?? true, runnable: payload.runnable ?? true,
    validation_errors: payload.validation_errors || [] };
  const scope = { identity, project_path, archive_session };
  const result = save
    ? await editorApi.projectFiles.save({ ...scope, code, document: { target, workspace } })
    : await editorApi.projectFiles.load(scope);
  if (result?.status === 'error') return result;
  return { status: result.status, workspace: result.document?.workspace || {},
    target: { ...(result.document?.target || target), code_path: result.code_path,
      workspace_path: result.document_path, revision: result.revision }, project_path };
}

export const saveBlocklyTarget = payload => accessTarget(payload, true);
export const loadBlocklyTarget = payload => accessTarget(payload, false);
