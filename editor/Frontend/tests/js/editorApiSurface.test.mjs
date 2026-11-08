import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { editorApi } from '../../src/api/editorApi.js';

const nativeSource = fs.readFileSync(new URL('../../../../../src/systems/ui/editor_api/cef_editor_api.cpp', import.meta.url), 'utf8');
const nativeMethods = nativeSource.split('constexpr auto kEditorApiMethods =')[1].split('\n});')[0];
const nativeEvents = nativeSource.split('constexpr auto kEditorApiEvents =')[1].split('\n});')[0];

test('all Web business methods have retired their manifest wrappers', () => {
  const hasCefCaller = (line) => {
    if (!line.includes('WRAPPED_CALLERS')) return true;
    const declaration = line.trim().replace(/,$/, '');
    const callers = declaration.slice(declaration.lastIndexOf(',') + 1);
    if (callers.includes('non_cef_') || callers.includes('~caller_mask(EditorApiCaller::Cef)')) return false;
    return callers.includes('caller_mask(EditorApiCaller::Cef)') ||
      callers.includes('all_callers()') || callers.includes('animation_callers()') ||
      callers.includes('cef_and_script_runtime_callers()');
  };
  const wrappers = nativeMethods.split('\n').filter(line => line.includes('WRAPPED') && hasCefCaller(line))
    .map(line => line.match(/"([^"]*)"/)?.[1])
    .filter(Boolean);
  assert.deepEqual(wrappers, [], 'Web business methods use named bindings');
});

test('the public event surface exactly matches the remaining native events', () => {
  const expected = nativeEvents.split('\n')
    .filter(line => !line.includes('~caller_mask(EditorApiCaller::Cef)'))
    .map(line => line.match(/"events\.([^"]+)"/)?.[1]).filter(Boolean).sort();
  assert.deepEqual(Object.keys(editorApi.events ?? {}).sort(), expected);
  assert.equal(editorApi.events, undefined, 'all remaining events belong to non-Web callers');
});

test('unknown and retired capabilities are absent without mutating the API surface', () => {
  const before = Object.keys(editorApi.scene);
  for (const name of ['setActorState', 'setActorPhysics', 'setActorCameraLock', 'notARealMethod']) {
    assert.equal(editorApi.scene[name], undefined, name);
    assert.equal(Object.hasOwn(editorApi.scene, name), false, name);
  }
  assert.equal(editorApi.notARealNamespace, undefined);
  assert.equal(editorApi.sceneTools?.getFrameTiming, undefined);
  assert.deepEqual(Object.keys(editorApi.scene), before);
});

test('generic native callback and manifest discovery are absent', () => {
  assert.equal(editorApi.editor, undefined);
  assert.equal(editorApi.off, undefined);
  assert.equal(editorApi.scene.observe, undefined);
  assert.equal(editorApi.listMethods, undefined);
  assert.equal(editorApi.listEvents, undefined);
});
