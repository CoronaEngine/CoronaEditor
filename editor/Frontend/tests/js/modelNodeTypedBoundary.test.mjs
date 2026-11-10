import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { editorApi } from '../../src/api/editorApi.js';

const engineRoot = new URL('../../../../../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, engineRoot), 'utf8');
const binding = read('src/systems/ui/cef/cef_v8_binding.cpp');
const manifest = read('src/systems/ui/editor_api/cef_editor_api.cpp');
const component = fs.readFileSync(new URL('../../src/components/ui/ModelNodeHierarchy.vue', import.meta.url), 'utf8');

test('model node operations use the typed scene surface with archive and actor identity', () => {
  assert.match(binding, /scene->SetValue\("readModelNodes"/);
  assert.match(binding, /scene->SetValue\("setModelNodeState"/);
  assert.match(component, /editorApi\.scene\.readModelNodes/);
  assert.match(component, /editorApi\.scene\.setModelNodeState/);
  assert.match(component, /archive_session:\s*archiveSession/);
  assert.match(component, /actor_guid:\s*actorGuid/);
  assert.match(component, /actor_version/);
  assert.equal(editorApi.sceneTools?.getModelNodes, undefined);
  assert.equal(editorApi.sceneTools?.setModelNodeState, undefined);
});

test('model node manifest routes are unavailable to CEF callers', () => {
  const routes = manifest.split('\n').filter(line =>
    line.includes('(SceneTools, get_model_nodes,') || line.includes('(SceneTools, set_model_node_state,'));
  assert.equal(routes.length, 2);
  for (const route of routes) {
    assert.match(route, /WRAPPED_CALLERS/);
    assert.doesNotMatch(route, /caller_mask\(EditorApiCaller::Cef\)/);
    assert.doesNotMatch(route, /js_wrapper/, 'the retired Web wrapper column must not return');
  }
});
