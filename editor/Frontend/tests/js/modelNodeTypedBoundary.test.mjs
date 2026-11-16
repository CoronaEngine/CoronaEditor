import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { editorApi } from '../../src/api/editorApi.js';

const engineRoot = new URL('../../../../../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, engineRoot), 'utf8');
// The scene names are table rows now; the binding installs them, it does not spell them.
const table = read('src/systems/ui/cef/editor_operation_table.h');
const component = fs.readFileSync(new URL('../../src/components/ui/ModelNodeHierarchy.vue', import.meta.url), 'utf8');

test('model node operations use the typed scene surface with archive and actor identity', () => {
  assert.match(table, /\{"scene", "read_model_nodes", SceneMethod::ReadModelNodes,/);
  assert.match(table, /\{"scene", "set_model_node_state", SceneMethod::SetModelNodeState,/);
  assert.match(component, /editorApi\.scene\.read_model_nodes/);
  assert.match(component, /editorApi\.scene\.set_model_node_state/);
  assert.match(component, /archive_session:\s*archiveSession/);
  assert.match(component, /actor_guid:\s*actorGuid/);
  assert.match(component, /actor_version/);
  assert.equal(editorApi.sceneTools?.getModelNodes, undefined);
  assert.equal(editorApi.sceneTools?.set_model_node_state, undefined);
});
