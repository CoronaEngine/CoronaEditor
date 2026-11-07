import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ref } from 'vue';
import { babelParse, parse } from 'vue/compiler-sfc';

function handler(path, name, deps) {
  const { descriptor } = parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
  const script = descriptor.scriptSetup.content;
  const node = babelParse(script, { sourceType: 'module' }).program.body
    .find(node => node.type === 'VariableDeclaration' && node.declarations.some(item => item.id.name === name));
  return new Function('deps', `const {${Object.keys(deps).join(',')}} = deps; ${script.slice(node.start, node.end)}; return ${name};`)(deps);
}

test('SceneBar screenshot captures the exact selected camera and archive in a single operation', async () => {
  const calls = [], errors = [];
  const take = handler('../../src/views/sidebar/SceneBar.vue', 'TakeScreenshot', {
    editorApi: { scene: { captureScreenshot: async (...args) => { calls.push(args); return { status: 'canceled', path: '' }; } } },
    currentSceneName: ref('scene.ini'), archiveSession: ref('archive'),
    getTargetCamera: () => ({ camera_id: 'camera-guid', name: 'Display camera' }),
    getTargetCameraName: () => 'Display camera', logError: (...args) => errors.push(args),
  });
  await take();
  assert.deepEqual(calls, [['scene.ini', 'camera-guid', { archive_session: 'archive' }]]);
  assert.deepEqual(errors, []);
});

test('CameraView screenshot uses its loaded archive and preserves native errors', async () => {
  const calls = [], errorText = ref('');
  const take = handler('../../src/views/tools/CameraView.vue', 'takeScreenshot', {
    editorApi: { scene: { captureScreenshot: async (...args) => { calls.push(args); throw new Error('capture failed'); } } },
    camera: ref({ archive_session: 'archive' }), sceneId: 'scene.ini', cameraId: 'camera-guid', errorText,
    unwrap: value => value?.data ?? value,
  });
  await take();
  assert.deepEqual(calls, [['scene.ini', 'camera-guid', { archive_session: 'archive' }]]);
  assert.equal(errorText.value, 'capture failed');
});
