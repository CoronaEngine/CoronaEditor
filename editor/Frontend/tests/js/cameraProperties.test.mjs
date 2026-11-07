import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ref } from 'vue';
import { babelParse, parse } from 'vue/compiler-sfc';

const { descriptor } = parse(readFileSync(new URL('../../src/views/tools/CameraView.vue', import.meta.url), 'utf8'));
const script = descriptor.scriptSetup.content;
const declarations = babelParse(script, { sourceType: 'module' }).program.body;
function handler(name, deps) {
  const node = declarations.find(node => node.type === 'VariableDeclaration' && node.declarations.some(item => item.id.name === name));
  return new Function('deps', `const {${Object.keys(deps).join(',')}} = deps; let posePublishTimer = 1, lastPosePublishTime = 0; ${script.slice(node.start, node.end)}; return ${name};`)(deps);
}

test('CameraView settings share scoped properties and preserve camera metadata omitted by a partial reply', async () => {
  const calls = [], camera = ref({ archive_session: 'archive', camera_id: 'camera-id', handle: 42,
    position: [1, 2, 3], render_backend: 'vision', vision_denoise: true });
  const save = handler('saveSettings', {
    camera, sceneId: 'scene.ini', cameraId: 'camera-id', renderWidth: ref(640), renderHeight: ref(480), moveSpeed: ref(0.5),
    errorText: ref(''), unwrap: value => value,
    editorApi: { scene: { setCameraProperties: async (...args) => {
      calls.push(args); return { camera: { width: 640, height: 480, move_speed: 0.5 } };
    } } }, appService: { resizeThisCameraView: async (...args) => calls.push(['resize', ...args]) },
  });
  await save();
  assert.deepEqual(calls, [['scene.ini', 'camera-id', { archive_session: 'archive',
    move_speed: 0.5, width: 640, height: 480, view_width: 640, view_height: 480 }], ['resize', 640, 480, 'scene.ini', 'camera-id']]);
  assert.equal(camera.value.handle, 42);
  assert.equal(camera.value.render_backend, 'vision');
  assert.equal(camera.value.vision_denoise, true);
  assert.deepEqual(camera.value.position, [1, 2, 3]);
});

test('CameraView pose publisher submits copied vectors through the same scoped interface', async () => {
  const calls = [], camera = ref({ archive_session: 'archive', position: [1, 2, 3], forward: [0, 0, 1], world_up: [0, 1, 0], fov: 45 });
  const flush = handler('flushPose', { camera, sceneId: 'scene.ini', cameraId: 'camera-id', errorText: ref(''),
    isEditorInputLocked: () => false, performance: { now: () => 100 },
    editorApi: { scene: { setCameraProperties: async (...args) => calls.push(args) } },
  });
  flush();
  camera.value.position[0] = 9;
  assert.deepEqual(calls, [['scene.ini', 'camera-id', { archive_session: 'archive', position: [1, 2, 3],
    forward: [0, 0, 1], world_up: [0, 1, 0], fov: 45 }]]);
});

test('camera size synchronization cannot reopen a retiring window', async () => {
  const calls = [], camera = ref({ archive_session: 'archive', camera_id: 'camera-id' });
  const { descriptor } = parse(readFileSync(new URL('../../src/views/tools/CameraView.vue', import.meta.url), 'utf8'));
  const source = descriptor.scriptSetup.content;
  const node = babelParse(source, { sourceType: 'module' }).program.body.find(node =>
    node.type === 'VariableDeclaration' && node.declarations.some(item => item.id.name === 'syncWindowSize'));
  const deps = { camera, sceneId: 'scene.ini', cameraId: 'camera-id',
    window: { innerWidth: 800, innerHeight: 600 }, renderWidth: ref(640), renderHeight: ref(480), moveSpeed: ref(0.5),
    errorText: ref(''), unwrap: value => value,
    editorApi: { scene: { setCameraProperties: async (...args) => { calls.push(args); return { camera: {} }; } } },
  };
  const sync = new Function('deps', `const {${Object.keys(deps).join(',')}} = deps; let lastSyncedWidth = 0, lastSyncedHeight = 0; ${source.slice(node.start, node.end)}; return syncWindowSize;`)(deps);
  await sync();
  assert.deepEqual(calls, [['scene.ini', 'camera-id', { archive_session: 'archive', width: 800, height: 600,
    view_width: 800, view_height: 600, move_speed: 0.5 }]]);
});

test('CameraView pose publisher respects runtime input ownership and surfaces native rejections', async () => {
  let locked = true;
  const errorText = ref(''), calls = [], camera = ref({ archive_session: 'archive', position: [1, 2, 3], forward: [0, 0, 1], world_up: [0, 1, 0], fov: 45 });
  const flush = handler('flushPose', { camera, sceneId: 'scene.ini', cameraId: 'camera-id', errorText,
    isEditorInputLocked: () => locked, performance: { now: () => 100 },
    editorApi: { scene: { setCameraProperties: async (...args) => { calls.push(args); throw new Error('EDITOR_INPUT_LOCKED'); } } },
  });
  flush(); assert.equal(calls.length, 0);
  locked = false; flush(); await Promise.resolve();
  assert.equal(calls.length, 1);
  assert.equal(errorText.value, 'EDITOR_INPUT_LOCKED');
});
