import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { parse, babelParse } from 'vue/compiler-sfc';
import { deferred } from './windowSessionFixtures.mjs';
import { createViewLifetime } from '../../src/utils/viewLifetime.js';

const script = parse(fs.readFileSync(new URL('../../src/views/tools/CameraView.vue', import.meta.url), 'utf8'))
  .descriptor.scriptSetup.content;
const ast = babelParse(script, { sourceType: 'module' });
function action(name, scope) {
  const node = ast.program.body.flatMap(entry => entry.declarations || []).find(entry => entry.id.name === name).init;
  return new Function('scope', `with (scope) { return (${script.slice(node.start, node.end)}); }`)(scope);
}

for (const outcome of ['success', 'failure']) {
  test(`CameraView discards a settings ${outcome} received after retirement`, async () => {
    const pending = deferred();
    const resized = [];
    const scope = {
      viewLifetime: createViewLifetime(), sceneId: 'scene', cameraId: 'camera',
      renderWidth: { value: 960 }, renderHeight: { value: 540 }, moveSpeed: { value: 1 },
      camera: { value: { archive_session: 'original', width: 960, height: 540 } },
      errorText: { value: '' },
      editorApi: { scene: { updateCamera: () => pending.promise } },
      appService: { resizeThisCameraView: async (...args) => resized.push(args) },
    };
    const saving = action('saveSettings', scope)();
    await scope.viewLifetime.dispose();
    if (outcome === 'success') pending.resolve({ camera: { width: 1200, height: 800 } });
    else pending.reject(new Error('retired world'));
    await saving;
    assert.deepEqual(resized, [], 'a retired view must not resize a native window');
    assert.equal(scope.camera.value.width, 960);
    assert.equal(scope.renderWidth.value, 960);
    assert.equal(scope.errorText.value, '');
  });
}

test('CameraView applies a settings reply and resizes its live window', async () => {
  const resized = [];
  const scope = {
    viewLifetime: createViewLifetime(), sceneId: 'scene', cameraId: 'camera',
    renderWidth: { value: 960 }, renderHeight: { value: 540 }, moveSpeed: { value: 1 },
    camera: { value: { archive_session: 'original' } }, errorText: { value: '' },
    editorApi: { scene: { updateCamera: async () => ({ camera: { width: 1200, height: 800 } }) } },
    appService: { resizeThisCameraView: async (...args) => resized.push(args) },
  };
  await action('saveSettings', scope)();
  assert.deepEqual(resized, [[1200, 800, 'scene', 'camera']]);
  assert.equal(scope.camera.value.width, 1200);
});

for (const outcome of ['success', 'failure']) {
  test(`CameraView ignores a script status ${outcome} received after retirement`, async () => {
    const pending = deferred();
    let resets = 0;
    const scope = {
      viewLifetime: createViewLifetime(), nodeGraphInputLocked: { value: false },
      editorApi: { scripts: { getStatus: () => pending.promise } },
      resetCameraInput: () => { resets++; },
    };
    const polling = action('pollScriptInputLock', scope)();
    await scope.viewLifetime.dispose();
    scope.nodeGraphInputLocked.value = true;
    if (outcome === 'success') pending.resolve({ inputLocked: true });
    else pending.reject(new Error('retired world'));
    await polling;
    assert.equal(resets, 0, 'late status cannot restart input cleanup');
    assert.equal(scope.nodeGraphInputLocked.value, true);
  });
}
