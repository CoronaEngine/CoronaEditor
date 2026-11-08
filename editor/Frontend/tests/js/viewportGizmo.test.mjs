import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { setImmediate } from 'node:timers';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createViewportGizmoController } from '../../src/utils/viewportGizmo.js';
import * as viewportGizmoModule from '../../src/utils/viewportGizmo.js';

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const pointerDownHandler = (source) => {
  const start = source.indexOf('const handleViewportPointerDown = (event) => {');
  const end = source.indexOf('\n};', start);
  assert.notEqual(start, -1, 'viewport pointerdown handler must exist');
  assert.notEqual(end, -1, 'viewport pointerdown handler must terminate');
  return source.slice(start, end);
};

test('both viewport surfaces capture the pointer synchronously on pointerdown', () => {
  for (const relativePath of ['src/views/layout/MainPage.vue', 'src/views/tools/CameraView.vue']) {
    const source = readFileSync(join(frontendRoot, relativePath), 'utf8');
    const handler = pointerDownHandler(source);
    assert.notEqual(
      handler.indexOf('setPointerCapture'),
      -1,
      `${relativePath} must capture pointerdown`
    );
    assert.ok(
      handler.indexOf('setPointerCapture') < handler.indexOf('viewportUiPointerController.send'),
      `${relativePath} must capture before forwarding other pointer work`
    );
    assert.ok(
      handler.indexOf('setPointerCapture') < handler.indexOf('viewportGizmoController.pointer'),
      `${relativePath} must capture before forwarding the gizmo pointerdown`
    );
  }
});

test('main viewport pointerdown does not refresh the scene camera binding', () => {
  const source = readFileSync(join(frontendRoot, 'src/views/layout/MainPage.vue'), 'utf8');
  const handler = pointerDownHandler(source);
  assert.equal(
    handler.includes('refreshSceneCameraBinding'),
    false,
    'scene camera binding must not refresh during the native pointerdown sequence'
  );
});

test('viewport pointercancel only cancels the active gizmo pointer', () => {
  for (const relativePath of ['src/views/layout/MainPage.vue', 'src/views/tools/CameraView.vue']) {
    const source = readFileSync(join(frontendRoot, relativePath), 'utf8');
    const start = source.indexOf('const handleViewportPointerCancel = (event) => {');
    const end = source.indexOf('\n};', start);
    assert.notEqual(start, -1, `${relativePath} pointercancel handler must exist`);
    assert.notEqual(end, -1, `${relativePath} pointercancel handler must terminate`);
    const handler = source.slice(start, end);
    assert.match(
      handler,
      /event\.pointerId\s*!==\s*gizmoDownPointerId/,
      `${relativePath} must ignore cancellation from another pointer`
    );
  }
});

test('main viewport pointerdown does not force a focus transition during drag start', () => {
  const source = readFileSync(join(frontendRoot, 'src/views/layout/MainPage.vue'), 'utf8');
  const handler = pointerDownHandler(source);
  assert.equal(
    handler.includes('focusViewportInput'),
    false,
    'pointerdown must not force a CEF focus transition while starting a drag'
  );
});

test('sets and clears a GUID target through the scoped V8 API', () => {
  const calls = [];
  const api = { gizmo: {
    setTarget: (...args) => calls.push(args),
    pointer: (...args) => calls.push(args),
  } };
  const controller = createViewportGizmoController({
    getApi: () => api,
    getCameraBinding: () => ({ sceneId: 'Scene/default.scene', cameraId: 'camera/main', archiveSession: 'session-1' }),
  });
  controller.setTarget({ actor_guid: 'actor-guid-1', name: 'Cube' });
  controller.clearTarget();
  assert.deepEqual(calls, [
    ['Scene/default.scene', 'camera/main', { archive_session: 'session-1', actor_guid: 'actor-guid-1' }],
    ['Scene/default.scene', 'camera/main', { archive_session: 'session-1', actor_guid: null }],
  ]);
});

test('viewport gizmo uses scoped typed V8 operations without numeric native handles or result polling', () => {
  const source = readFileSync(join(frontendRoot, 'src/utils/viewportGizmo.js'), 'utf8');
  assert.match(source, /api\.gizmo\.setTarget/);
  assert.match(source, /api\.gizmo\.pointer/);
  assert.doesNotMatch(source, /cameraHandle|actorHandle|setViewportGizmoTarget|viewportGizmoPointer/);
  assert.doesNotMatch(source, /Number\(.*handle/);

  const sceneReader = readFileSync(join(frontendRoot, 'src/api/sceneReader.js'), 'utf8');
  const api = readFileSync(join(frontendRoot, 'src/api/editorApi.js'), 'utf8');
  assert.doesNotMatch(sceneReader, /viewportGizmoPointerResult|takeViewportResults/);
  assert.doesNotMatch(api, /onViewportGizmoPointerResult|takeViewportResults/);
});

test('forwards viewport-local pointer coordinates and tracks the direct Promise result', async () => {
  const calls = [];
  const api = { gizmo: { setTarget() {}, pointer: (...args) => { calls.push(args); return Promise.resolve({ consumed: true, dragging: true, axis: 'x' }); } } };
  const controller = createViewportGizmoController({
    getApi: () => api,
    getCameraBinding: () => ({ sceneId: 'Scene/default.scene', cameraId: 'camera/main', archiveSession: 'session-1' }),
    getHitRect: () => ({ left: 10, top: 20, width: 200, height: 100 }),
    getRenderRect: () => ({ left: 0, top: 0, width: 220, height: 140 }),
    makeRequestId: () => 'gizmo-1',
  });

  const requestId = controller.pointer(
    { clientX: 60, clientY: 70, button: 0, buttons: 1 },
    'pointerdown'
  );
  assert.equal(requestId, 'gizmo-1');
  assert.deepEqual(calls[0].slice(0, 3), ['Scene/default.scene', 'camera/main', {
    archive_session: 'session-1', request_id: 'gizmo-1', event: 'pointerdown',
    x: 60, y: 70, width: 220, height: 140, button: 0, buttons: 1, modifiers: 0,
  }]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(controller.isDragging(), true);
});

test('drag end is reported once for persistence', async () => {
  const ended = [];
  const controller = createViewportGizmoController({
    getApi: () => ({ gizmo: { setTarget() {}, pointer: () => Promise.resolve({ consumed: true, dragging: true, ended: true }) } }),
    getCameraBinding: () => ({ sceneId: 'Scene/default.scene', cameraId: 'camera/main', archiveSession: 'session-1' }),
    getHitRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    getRenderRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    onDragEnd: (payload) => ended.push(payload),
    makeRequestId: () => 'gizmo-end',
  });
  controller.pointer({ clientX: 10, clientY: 10, button: 0, buttons: 1 }, 'pointerdown');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ended.length, 1);
});

test('pointercancel result clears the active drag once', async () => {
  const calls = [];
  const cancelled = [];
  const controller = createViewportGizmoController({
    getApi: () => ({ gizmo: { setTarget() {}, pointer: (...args) => { calls.push(args); const cancel = args[2].event === 'pointercancel'; return Promise.resolve(cancel ? { consumed: true, dragging: false, cancelled: true, axis: 'x' } : { consumed: true, dragging: true, axis: 'x' }); } } }),
    getCameraBinding: () => ({ sceneId: 'Scene/default.scene', cameraId: 'camera/main', archiveSession: 'session-1' }),
    getHitRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    getRenderRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    onDragCancel: (payload) => cancelled.push(payload),
    makeRequestId: (() => {
      let index = 0;
      return () => `gizmo-cancel-${++index}`;
    })(),
  });

  controller.pointer(
    { clientX: 10, clientY: 10, button: 0, buttons: 1 },
    'pointerdown'
  );
  await new Promise(resolve => setImmediate(resolve));

  const cancelRequest = controller.cancel('pointercancel');
  assert.equal(calls.at(-1)[2].event, 'pointercancel');
  assert.equal(cancelRequest, 'gizmo-cancel-2');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(controller.isDragging(), false);

  assert.equal(controller.cancel('pointercancel'), false);
  assert.equal(cancelled.length, 1);
});

test('coalesces active drag moves to one animation frame', async () => {
  const calls = [];
  const frames = [];
  let request = 0;
  const controller = createViewportGizmoController({
    getApi: () => ({ gizmo: { setTarget() {}, pointer: (...args) => { calls.push(args); return Promise.resolve({ consumed: true, dragging: true, axis: 'x' }); } } }),
    getCameraBinding: () => ({ sceneId: 'Scene/default.scene', cameraId: 'camera/main', archiveSession: 'session-1' }),
    getHitRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    getRenderRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    makeRequestId: () => `request-${++request}`,
    scheduleFrame: (callback) => frames.push(callback),
  });
  controller.pointer(
    { clientX: 10, clientY: 10, button: 0, buttons: 1 },
    'pointerdown'
  );
  await new Promise(resolve => setImmediate(resolve));
  controller.pointer({ clientX: 20, clientY: 10, buttons: 1 }, 'pointermove');
  controller.pointer({ clientX: 30, clientY: 10, buttons: 1 }, 'pointermove');

  assert.equal(calls.length, 1);
  assert.equal(frames.length, 1);
  frames[0]();
  assert.equal(calls.length, 2);
  assert.equal(calls[1][2].y, 10);
});

test('resolves the main viewport gizmo target from a successful pick GUID', () => {
  assert.equal(
    typeof viewportGizmoModule.resolveViewportGizmoTarget,
    'function',
    'main viewport selection resolver must exist'
  );
  const target = viewportGizmoModule.resolveViewportGizmoTarget({
    sceneId: 'scene.ini',
    selection: { scene: 'scene.ini', actor: 'Ball', actor_type: 'model' },
    pickResult: { actor: { guid: 'actor-guid-1', name: 'Ball', type: 'model' } },
    actorIndex: new Map(),
  });
  assert.deepEqual(target, {
    actor_guid: 'actor-guid-1',
    name: 'Ball',
    type: 'model',
  });
});

test('resolves a scene-tree selection through the GUID index', () => {
  assert.equal(typeof viewportGizmoModule.resolveViewportGizmoTarget, 'function');
  const target = viewportGizmoModule.resolveViewportGizmoTarget({
    sceneId: 'scene.ini',
    selection: { scene: 'scene.ini', actor: 'Ball', actor_type: 'model' },
    actorIndex: new Map([['actor-guid-1', { actor_guid: 'actor-guid-1', name: 'Ball', type: 'model' }]]),
  });
  assert.equal(target?.actor_guid, 'actor-guid-1');
});

test('routes a gizmo selection only to its source viewport', () => {
  assert.equal(
    typeof viewportGizmoModule.isViewportGizmoSelectionOwner,
    'function',
    'viewport ownership resolver must exist'
  );

  const fromCameraView = {
    source_viewport: 'cameraView',
    source_camera_id: 'camera/22',
  };
  assert.equal(
    viewportGizmoModule.isViewportGizmoSelectionOwner({
      viewportScope: 'main',
      cameraId: 'camera/11',
      selection: fromCameraView,
    }),
    false
  );
  assert.equal(
    viewportGizmoModule.isViewportGizmoSelectionOwner({
      viewportScope: 'cameraView',
      cameraId: 'camera/22',
      selection: fromCameraView,
    }),
    true
  );
  assert.equal(
    viewportGizmoModule.isViewportGizmoSelectionOwner({
      viewportScope: 'cameraView',
      cameraId: 'camera/33',
      selection: fromCameraView,
    }),
    false
  );

  assert.equal(
    viewportGizmoModule.isViewportGizmoSelectionOwner({
      viewportScope: 'main',
      cameraId: 'camera/11',
      selection: {},
    }),
    true
  );
  assert.equal(
    viewportGizmoModule.isViewportGizmoSelectionOwner({
      viewportScope: 'cameraView',
      cameraId: 'camera/22',
      selection: {},
    }),
    false
  );
});
