import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { ref, reactive, computed } from 'vue';
import { babelParse, parse } from 'vue/compiler-sfc';
import { cameraMovementKey, createViewportCameraController } from '../../src/utils/viewportCameraController.js';
import { normalizeVisionRenderMode, visionAccumulationFromCamera, visionDenoiseFromCamera, visionStablePlanesFromCamera, visionDenoiserFromCamera } from '../../src/utils/visionRenderModes.js';

const source = fs.readFileSync(new URL('../../src/views/layout/MainPage.vue', import.meta.url), 'utf8');
const { descriptor } = parse(source);
const declarations = babelParse(descriptor.scriptSetup.content, { sourceType: 'module' }).program.body;
// Execute the real creative camera host declarations with unrelated services stubbed.
// No duplicate handlers or movement algorithms live in this test.
const names = new Set([
  'cameraState', 'cameraBindingState', 'cameraSpeed', 'mouseSensitivity', 'viewportPickSurfaceRef',
  'cameraMovementGestures', 'movementAxisGroups', 'mouseRotateStartForward', 'mouseRotateMoved',
  'cameraControls', 'isRealtimeCameraInputActive', 'scheduleCameraUpdate',
  'vectorDistance', 'scratchMouseButton', 'sendScratchPointerEvent', 'handleWheel',
  'handleKeyDown', 'handleKeyUp', 'isEditorInputLocked', 'resetRealtimeCameraInput',
  'setEditorCameraInputLock',
  'viewportCursorShape', 'handleMainViewportBlur', 'handleMainViewportVisibility',
  'onMouseDown', 'onMouseMove', 'onMouseUp', 'sendCameraUpdateFast', 'handleCameraMove',
  'coerceNumber', 'setCameraSpeedFromPanel', 'isVector3', 'sceneGridEnabledFromSnapshot', 'applySceneSnapshot',
  'currentMainCamera', 'currentMainCameraId', 'mainVisionDenoise', 'mainVisionDenoiseError',
  'pendingMainDenoiseSelection',
  'mainVisionDenoiser', 'mainVisionDenoiserError', 'pendingMainDenoiserSelection',
  'mainVisionStablePlanes', 'mainVisionStablePlanesError', 'pendingMainStablePlanesSelection',
  'mainVisionAccumulation', 'mainVisionAccumulationError', 'pendingMainAccumulationSelection',
]);
const hostSource = declarations.filter(node => node.type === 'VariableDeclaration'
  && node.declarations.some(declaration => names.has(declaration.id.name)))
  .map(node => descriptor.scriptSetup.content.slice(node.start, node.end)).join('\n');
const makeHost = new Function('deps', `
  const { ref, reactive, cameraMovementKey, createViewportCameraController, window, document,
    editorApi, cabbageContextService, viewCurrent, viewportGizmoController,
    refreshSceneCameraBinding, syncSceneCameraBinding, broadcastViewportControlsState,
    getEditorControlsState, normalizeVisionRenderMode, visionAccumulationFromCamera, visionDenoiseFromCamera, visionStablePlanesFromCamera, visionDenoiserFromCamera } = deps;
  const DEFAULT_SCENE_NAME = 'scene.ini';
  const currentSceneId = ref(DEFAULT_SCENE_NAME);
  const getViewportRenderRect = () => ({ left: 0, top: 0, width: 800, height: 600 });
  const indexActorsByHandle = () => new Map();
  const sceneGridEnabled = ref(true), sceneLightSettings = reactive({ direction: {} });
  const mainRenderBackend = ref('native'), mainVisionRenderMode = ref('path_tracing');
  let actorPickIndex, lastCameraViewportSignature = '', pendingMainRenderSelection = null;
  const scheduleCameraViewportSync = () => {}, syncViewportUiMode = () => {};
  ${hostSource}
  return { ${[...names].join(', ')} };
`);
const viewportTarget = {};
const input = (props = {}) => ({ target: viewportTarget, preventDefault() {}, stopPropagation() {}, ...props });
const snapshot = (handle = 12, position = [0, 0, 0]) => ({ status: 'success', scene: 'scene.ini', active_camera_name: 'main', cameras: [
  { handle, name: 'main', position, forward: [0, 0, 1], world_up: [0, 1, 0], fov: 60 },
] });
function mountCreative(t, { native = true } = {}) {
  let current = true, time = 0, id = 0;
  const frames = new Map(), calls = [], records = [], scratch = [];
  const window = native ? { coronaBridge: { cameraMove: (...args) => calls.push(args) } } : {};
  const document = { hidden: false, getElementById: () => null };
  const clock = {
    requestFrame: callback => { frames.set(++id, callback); return id; },
    cancelFrame: id => frames.delete(id), now: () => time,
  };
  let refreshes = 0;
  const page = makeHost({
    ref, reactive, cameraMovementKey, normalizeVisionRenderMode, visionAccumulationFromCamera, visionDenoiseFromCamera, visionStablePlanesFromCamera, visionDenoiserFromCamera,
    createViewportCameraController: options => createViewportCameraController({ ...options, ...clock }),
    window, document, viewCurrent: () => current,
    editorApi: { scratch: Object.fromEntries(['sendKeyEvent', 'sendKeyUpEvent', 'sendMouseEvent']
      .map(name => [name, async (...args) => scratch.push([name, ...args])])) },
    cabbageContextService: { recordEvent: async record => records.push(record) },
    viewportGizmoController: { isDragging: () => false, cancel() {} },
    refreshSceneCameraBinding: () => { refreshes++; }, syncSceneCameraBinding() {},
    broadcastViewportControlsState() {}, getEditorControlsState: () => ({}),
  });
  page.viewportPickSurfaceRef.value = { contains: target => target === viewportTarget };
  page.applySceneSnapshot('scene.ini', snapshot());
  function step(next) {
    time = next;
    const callbacks = [...frames.values()]; frames.clear();
    for (const callback of callbacks) callback(time);
  }
  t.after(() => page.cameraControls.dispose());
  return { page, frames, calls, records, scratch, document, step,
    invalidate: () => { current = false; }, refreshes: () => refreshes };
}

test('creative binds native snapshots with a string scene route and optional envelopes', t => {
  const h = mountCreative(t), p = h.page;
  const native = { ...snapshot(25, [1, 2, 3]), scene: 'Scene/default.scene' };
  for (const payload of [native, { data: native }, { scene: native }, { data: { scene: native } }]) {
    p.applySceneSnapshot(native.scene, payload); h.step(0);
    assert.equal(p.cameraBindingState.value.cameraHandle, 25);
    assert.equal(p.cameraBindingState.value.sceneId, native.scene);
    assert.deepEqual(p.cameraState.value.position, [1, 2, 3]);
    assert.deepEqual(h.calls.at(-1).slice(0, 2), [25, [1, 2, 3]]);
  }
});

test('creative host keeps panel controls, input refresh, analytics and script forwarding', t => {
  const h = mountCreative(t, { native: false }), p = h.page;
  p.setCameraSpeedFromPanel(0.5); p.handleCameraMove('forward');
  assert.equal(p.cameraState.value.position[2], 0.5);
  p.handleWheel(input({ deltaY: -1, shiftKey: true }));
  assert.equal(p.cameraSpeed.value, 0.52);
  p.handleWheel(input({ deltaY: -1 }));
  assert.equal(p.cameraState.value.position[2], 1.02);
  p.handleKeyDown(input({ code: 'KeyD', key: 'd' })); h.step(50);
  p.handleKeyUp(input({ code: 'KeyD', key: 'd' }));
  assert.equal(h.refreshes(), 1);
  assert.ok(h.records.some(item => item.details.interaction === 'wheel'));
  assert.ok(h.records.some(item => item.details.axisGroup === 'left_right'));
  assert.deepEqual(h.scratch.map(call => call[0]), ['sendMouseEvent', 'sendMouseEvent', 'sendKeyEvent', 'sendKeyUpEvent']);
  p.setEditorCameraInputLock('node_graph', true);
  const before = structuredClone(JSON.parse(JSON.stringify(p.cameraState.value)));
  p.handleKeyDown(input({ code: 'KeyW', key: 'w' }));
  p.handleWheel(input({ deltaY: -1 })); p.handleCameraMove('forward'); h.step(100);
  assert.deepEqual(JSON.parse(JSON.stringify(p.cameraState.value)), before);
  assert.equal(h.scratch.at(-2)[0], 'sendKeyEvent');
  assert.equal(h.scratch.at(-1)[0], 'sendMouseEvent');
  p.setCameraSpeedFromPanel(1); assert.equal(p.cameraSpeed.value, 1);
});

test('creative host rebinding, focus loss and invalidation cancel old movement', t => {
  const h = mountCreative(t), p = h.page; h.step(0); h.calls.length = 0;
  p.handleKeyDown(input({ code: 'KeyW', key: 'w' }));
  const late = [...h.frames.values()][0];
  p.applySceneSnapshot('next.ini', snapshot(25, [5, 0, 0]), { preservePose: true });
  late(50); h.step(50);
  assert.deepEqual(h.calls.map(call => call.slice(0, 2)), [[25, [5, 0, 0]]]);
  assert.equal(p.cameraControls.isInputActive(), false);
  for (const stop of [() => p.handleMainViewportBlur(), () => {
    h.document.hidden = true; p.handleMainViewportVisibility();
  }, () => h.invalidate()]) {
    h.document.hidden = false;
    p.handleKeyDown(input({ code: 'KeyW', key: 'w' }));
    p.onMouseDown(input({ button: 2, clientX: 0, clientY: 0 }));
    p.onMouseMove(input({ clientX: 10, clientY: 0, buttons: 2 }));
    const count = h.calls.length; stop(); h.step(100);
    assert.equal(h.calls.length, count); assert.equal(h.frames.size, 0);
  }
});

test('creative same-binding refresh preserves input, but invalid rebinding clears the old handle', t => {
  const h = mountCreative(t), p = h.page; h.step(0);
  p.handleKeyDown(input({ code: 'KeyW', key: 'w' }));
  p.applySceneSnapshot('scene.ini', { data: snapshot(12, [9, 9, 9]) }, { preservePose: true });
  assert.equal(p.cameraControls.isInputActive(), true);
  assert.deepEqual(p.cameraState.value.position, [0, 0, 0]);
  h.step(50);
  assert.ok(Math.abs(p.cameraState.value.position[2] - 0.6) < 1e-8);
  const late = [...h.frames.values()][0], count = h.calls.length;
  p.applySceneSnapshot('missing.ini', null);
  late(100);
  assert.equal(p.cameraBindingState.value.cameraHandle, null);
  assert.equal(p.cameraControls.isInputActive(), false);
  assert.equal(h.frames.size, 0);
  p.handleCameraMove('forward'); h.step(100);
  assert.equal(h.calls.length, count);
});

test('creative right-drag analytics and native key authority remain intact', t => {
  const h = mountCreative(t), p = h.page; h.step(0);
  p.onMouseDown(input({ button: 2, clientX: 0, clientY: 0 }));
  p.onMouseMove(input({ clientX: 100, clientY: 0, buttons: 2 }));
  assert.equal(p.viewportCursorShape(), 'grabbing');
  p.onMouseUp(input({ button: 2 }));
  assert.equal(p.viewportCursorShape(), 'arrow');
  assert.ok(h.records.some(item => item.type === 'camera_rotated'));
  p.handleKeyDown(input({ code: 'KeyW', key: 'w' })); h.step(50);
  p.handleKeyUp(input({ code: 'KeyW', key: 'w' }));
  assert.equal(h.scratch.length, 0);
});
