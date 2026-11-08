import assert from 'node:assert/strict';
import test from 'node:test';
import * as Vue from 'vue';
import { mountMainPage } from './mainPageFixtures.mjs';

test('world entry retains the initialized scene controls and scene manager', async t => {
  const h = mountMainPage(t);
  await h.mount();
  assert.equal(h.dock.panels.SceneControls.open, false);
  assert.equal(h.dock.panels.SceneTools.open, false);
  assert.deepEqual(h.errors, []);
});

for (const retiredBy of ['archive', 'unmount']) {
  test(`world entry does not select a backend after ${retiredBy} retires the initial camera read`, async t => {
    const h = mountMainPage(t);
    const read = h.api.scene.readCameras;
    h.api.scene.readCameras = async (...args) => {
      const result = await read(...args);
      if (retiredBy === 'archive') h.page.environmentArchiveSession.value = 'replacement';
      else h.unmount();
      return result;
    };
    await h.mount();
    assert.ok(h.calls.some(call => call[0] === 'cameras'), 'the initial scoped camera read must run');
    assert.deepEqual(h.calls.filter(call => call[0] === 'backend'), []);
    assert.deepEqual(h.observed, []);
  });
}

test('backend completion from a replaced archive cannot continue viewport initialization', async t => {
  const h = mountMainPage(t);
  await h.mount();
  h.calls.length = 0;
  h.api.scene.setCameraRenderSettings = async () => {
    h.page.environmentArchiveSession.value = 'replacement';
    return { render_backend: 'vision' };
  };
  assert.equal(await h.page.initializeCreativeRenderMode(), false);
  assert.deepEqual(h.calls, []);
  assert.equal(h.page.creativeRenderDefaultsError.value, '');
});

test('applied focus synchronizes only the matching native camera without resubmitting a pose', async t => {
  const h = mountMainPage(t);
  await h.mount();
  h.flushFrames();
  assert.equal(typeof h.page.onCameraPoseApplied, 'function');
  const binding = { ...h.page.cameraBindingState.value };
  const pose = { archive_session: 'main-archive', scene: binding.sceneId, camera: {
    camera_id: binding.cameraId, position: [4, 5, -8], forward: [0, 0, 1], world_up: [0, 1, 0], fov: 55,
  } };
  const submissions = h.calls.filter(call => call[0] === 'cameraWrite').length;
  // An actual pending movement frame must also be canceled by an applied pose.
  h.page.scheduleCameraUpdate();
  assert.equal(h.page.onCameraPoseApplied(pose), true);
  h.flushFrames();
  assert.equal(h.calls.filter(call => call[0] === 'cameraWrite').length, submissions);
  assert.deepEqual(h.page.cameraState.value.position, [4, 5, -8]);
  assert.deepEqual(h.page.cameraBindingState.value, binding);
  for (const changed of [{ archive_session: 'old' }, { scene: 'other.ini' },
    { camera: { ...pose.camera, camera_id: 'other-camera' } }]) {
    assert.equal(h.page.onCameraPoseApplied({ ...pose, ...changed }), false);
    assert.deepEqual(h.page.cameraState.value.position, [4, 5, -8]);
  }
  assert.equal(h.bus.listenerCount('camera-pose-request'), 0);
  assert.equal(h.bus.listenerCount('camera-pose-applied'), 1);
});

test('main controls use the same scoped environment patch for light, grid and physics', async t => {
  const h = mountMainPage(t);
  await h.mount();
  h.calls.length = 0;
  assert.deepEqual(await h.page.setSceneGridEnabledFromPanel(false), h.page.getEditorControlsState());
  assert.equal(h.page.sceneGridEnabled.value, false);
  assert.equal(await h.page.updateSceneLight(), true);
  assert.equal(await h.page.handleApplyPhysics(), true);
  const writes = h.calls.filter(call => call[0] === 'environmentWrite');
  assert.equal(writes.length, 3);
  assert.deepEqual(writes[0], ['environmentWrite', 'scene_v3.xml', { archive_session: 'main-archive', grid: { enabled: false } }]);
  assert.deepEqual(writes[1][2], { archive_session: 'main-archive', sun: { enabled: true, direction: [1, 1, 1] } });
  assert.equal(writes[2][2].archive_session, 'main-archive');
  assert.ok(Array.isArray(writes[2][2].physics.gravity));
  assert.equal(await h.page.loadPhysicsParams(), true);
  assert.equal(h.page.physicsParams.value.gravityY, -8);
  assert.equal(h.page.physicsParams.value.floorY, 4);
  const environmentReads = h.calls.filter(call => call[0] === 'environmentRead');
  assert.ok(environmentReads.length >= 1);
  for (const read of environmentReads) assert.deepEqual(read, ['environmentRead', 'scene_v3.xml', { archive_session: 'main-archive' }]);
});

test('a delayed environment result cannot update controls after the observed archive changes', async t => {
  const h = mountMainPage(t);
  await h.mount();
  let release;
  h.api.scene.getEnvironment = () => new Promise(resolve => { release = resolve; });
  const old = h.page.loadPhysicsParams();
  assert.equal(typeof release, 'function');
  h.page.environmentArchiveSession.value = 'replacement';
  release({ archive_session: 'main-archive', physics: { gravity: [99, 99, 99] } });
  assert.equal(await old, false);
  assert.notEqual(h.page.physicsParams.value.gravityY, 99);
});

test('light actions return native failures to the shared Web request owner', async t => {
  const h = mountMainPage(t);
  await h.mount();
  h.api.scene.setEnvironment = async () => { throw Object.assign(new Error('old archive'), { code: 'PROJECT_CONTEXT_CHANGED' }); };
  assert.equal(await h.creativeActions.setSceneLightEnabled(false), false);
  assert.equal(await h.creativeActions.setSceneLightDirection('x', 2), false);
  assert.equal(await h.creativeActions.setSceneLightDirection('unknown', 2), false);
});

test('right dragging a DOM panel does not rotate the viewport camera', async t => {
  const h = mountMainPage(t);
  await h.mount();
  const forward = [...h.page.cameraState.value.forward];
  h.page.onMouseDown({ target: {}, button: 2, clientX: 10, clientY: 10 });
  h.page.onMouseMove({ buttons: 2, clientX: 80, clientY: 40 });
  assert.deepEqual(h.page.cameraState.value.forward, forward);
});

test('right dragging from the viewport still rotates the camera', async t => {
  const h = mountMainPage(t);
  await h.mount();
  const forward = [...h.page.cameraState.value.forward];
  h.page.onMouseDown({ target: h.surface, button: 2, clientX: 10, clientY: 10 });
  h.page.onMouseMove({ buttons: 2, clientX: 80, clientY: 40 });
  assert.notDeepEqual(h.page.cameraState.value.forward, forward);
});

for (const visionMode of ['path_tracing', 'restir']) {
test(`external scene entry defaults to Vision and preserves saved ${visionMode}`, async t => {
  const h = mountMainPage(t, visionMode);
  assert.equal(h.page.currentMainSceneId(), 'scene.ini', 'the unopened page starts at the default scene');
  assert.equal(h.page.cameraBindingState.value.cameraHandle, null);
  await h.mount();

  const cameraRead = h.calls.findIndex(call => call[0] === 'cameras');
  const backendWrite = h.calls.findIndex(call => call[0] === 'backend');
  assert.ok(cameraRead >= 0 && backendWrite > cameraRead, 'bind the archive and exact camera before selecting its backend');
  assert.deepEqual(h.calls[backendWrite], ['backend', 'vision', 'scene_v3.xml', 'camera-1', {
    archive_session: 'main-archive', render_backend: 'vision',
  }]);
  assert.equal(h.page.cameraBindingState.value.sceneId, 'scene_v3.xml');
  assert.equal(h.page.cameraBindingState.value.cameraHandle, '42');
  assert.equal(h.page.mainRenderBackend.value, 'vision');
  assert.equal(h.page.mainVisionRenderMode.value, visionMode);
  assert.deepEqual(h.observed, [h.surface]);
  h.flushFrames();
  assert.ok(h.calls.some(call => call[0] === 'viewport' && call[1] === 'scene_v3.xml' && call[2] === 'camera-1'
    && call[3].archive_session === 'main-archive' && call[3].bounds?.width === 1536
    && call[3].bounds?.height === 825), 'the mounted page must send scoped camera viewport bounds');
  assert.deepEqual(h.errors, []);
});
}


test('a native scene panel reports import progress and closing it clears the overlay', async t => {
  const h = mountMainPage(t);
  await h.mount();
  h.dock.panels.SceneTools.open = true;
  const progress = { active: true, message: '创建对象', progress: 55 };
  h.bus.emit('scene-import-progress', progress);
  assert.deepEqual(h.page.importProgress.value, progress);
  h.bus.emit('scene-import-progress', { active: false });
  assert.equal(h.page.importProgress.value, null);

  h.bus.emit('scene-import-progress', progress);
  h.dock.panels.SceneTools.open = false;
  await Vue.nextTick();
  h.bus.emit('scene-import-progress', progress);
  assert.equal(h.page.importProgress.value, null);
});

test('calibration edits from a native panel update only an active stereo main viewport', async t => {
  const h = mountMainPage(t);
  await h.mount();
  const values = { pe: 24, angle: 0.5, offset: 1, parallaxScale: 2 };
  const changes = () => h.calls.filter(([kind, , , patch]) => kind === 'viewport' && patch.calibration);
  await h.messages.request('main', 'viewportUi.calibration', { action: 'set', calibration: values });
  assert.equal(changes().length, 0);
  h.page.viewportUiMode.value = 'stereo3d';
  await h.messages.emit('viewportUi.otherChanged', {});
  assert.equal(changes().length, 0);
  await h.messages.request('main', 'viewportUi.calibration', { action: 'set', calibration: values });
  await Vue.nextTick();
  assert.deepEqual(changes(), [['viewport', 'scene_v3.xml', 'camera-1', { archive_session: 'main-archive', calibration: values }]]);
});

test('viewport bounds deduplicate per archive and retry explicitly after native rejection', async t => {
  const h = mountMainPage(t);
  await h.mount();
  h.flushFrames();
  await Vue.nextTick();
  const writes = () => h.calls.filter(call => call[0] === 'viewport' && call[3].bounds);
  const initial = writes().length;
  assert.equal(await h.page.syncCameraViewportRect(), true);
  assert.equal(writes().length, initial);
  h.page.cameraBindingState.value.archiveSession = 'replacement';
  h.page.cameraBindingState.value.cameraId = '18446744073709551615';
  assert.equal(await h.page.syncCameraViewportRect(), true);
  assert.equal(writes().length, initial + 1);
  assert.equal(writes().at(-1)[2], '18446744073709551615');
  assert.equal(writes().at(-1)[3].archive_session, 'replacement');
  const configure = h.api.viewport.configure;
  let attempts = 0;
  h.api.viewport.configure = async (...args) => {
    attempts++;
    if (attempts === 1) throw Object.assign(new Error('rejected'), { code: 'PROJECT_CONTEXT_CHANGED' });
    return configure(...args);
  };
  h.page.cameraBindingState.value.archiveSession = 'next';
  const warn = console.warn;
  t.after(() => { console.warn = warn; });
  console.warn = () => {};
  assert.equal(await h.page.syncCameraViewportRect(), false);
  assert.equal(attempts, 1, 'a rejection must not automatically replay the operation');
  assert.equal(await h.page.syncCameraViewportRect(), true);
  assert.equal(attempts, 2);
});

test('main viewport blur and pointer cancellation retire the native cursor through the same scoped patch', async t => {
  const h = mountMainPage(t, 'path_tracing', { nativeCursor: true });
  await h.mount(); h.flushFrames();
  h.page.viewportUiMode.value = 'stereo3d';
  const pointerWrites = () => h.calls.filter(call => call[0] === 'viewport' && call[3].pointer);
  for (const handler of ['handleMainViewportBlur', 'handleViewportPointerCancel']) {
    h.page.handleViewportPointerDown({ type: 'pointerdown', clientX: 20, clientY: 30, pointerId: 7, button: 0 });
    assert.notEqual(pointerWrites().at(-1)?.[3].pointer.cursor, 'hidden');
    h.page[handler]({ pointerId: 7 });
    assert.deepEqual(pointerWrites().at(-1), ['viewport', 'scene_v3.xml', 'camera-1', {
      archive_session: 'main-archive', pointer: { cursor: 'hidden' },
    }], handler);
  }
});


test('world entry reads the active scene without the retired main facade', async t => {
  const h = mountMainPage(t);
  delete h.api.main;
  let reads = 0;
  const read = h.api.scene.readActive;
  h.api.scene.readActive = async () => { reads++; return read(); };
  await h.mount();
  assert.equal(reads, 1);
  assert.equal(h.page.currentSceneId.value, 'scene_v3.xml');
  assert.deepEqual(h.errors, []);
});
for (const active of [{ archive_session: '', scene: '' }, { archive_session: 'main-archive', scene: '' }]) {
  test(`world entry does not invent a default scene for ${JSON.stringify(active)}`, async t => {
    const h = mountMainPage(t);
    h.api.scene.readActive = async () => active;
    await h.mount();
    assert.deepEqual(h.calls, []);
    assert.deepEqual(h.observed, []);
  });
}
test('unmounted world entry ignores an active-scene response', async t => {
  const h = mountMainPage(t);
  h.api.scene.readActive = async () => { h.unmount(); return { archive_session: 'main-archive', scene: 'scene_v3.xml' }; };
  await h.mount();
  assert.deepEqual(h.calls, []);
});
test('old project notification cannot replace the current archive', async t => {
  const h = mountMainPage(t);
  await h.mount();
  h.calls.length = 0;
  await h.page.onProjectOpenedEvent({ archive_session: 'retired', path: 'old-world', scene: { path: 'old.ini' } });
  assert.equal(h.page.environmentArchiveSession.value, 'main-archive');
  assert.equal(h.page.currentSceneId.value, 'scene_v3.xml');
  assert.deepEqual(h.calls, []);
});
test('interleaved project notifications discard the earlier active-scene reply', async t => {
  const h = mountMainPage(t);
  await h.mount();
  let release;
  h.api.scene.readActive = () => new Promise(resolve => { release = resolve; });
  const earlier = h.page.onProjectOpenedEvent({ archive_session: 'retired', scene: { path: 'old.ini' } });
  assert.equal(typeof release, 'function');
  h.api.scene.readActive = async () => ({ archive_session: 'main-archive', scene: 'scene_v3.xml' });
  await h.page.onProjectOpenedEvent({ archive_session: 'main-archive', scene: { path: 'scene_v3.xml' } });
  release({ archive_session: 'retired', scene: 'old.ini' });
  await earlier;
  assert.equal(h.page.environmentArchiveSession.value, 'main-archive');
  assert.equal(h.page.currentSceneId.value, 'scene_v3.xml');
});


test('a rejected stale notification cannot cancel a valid project refresh already in flight', async t => {
  const h = mountMainPage(t);
  await h.mount();
  h.calls.length = 0;
  let release;
  h.api.scene.readActive = () => new Promise(resolve => { release = resolve; });
  const current = h.page.onProjectOpenedEvent({ archive_session: 'main-archive' });
  h.api.scene.readActive = async () => ({ archive_session: 'main-archive', scene: 'scene_v3.xml' });
  await h.page.onProjectOpenedEvent({ archive_session: 'retired' });
  release({ archive_session: 'main-archive', scene: 'scene_v3.xml' });
  await current;
  assert.ok(h.calls.some(call => call[0] === 'cameras'), 'valid refresh must still bind its camera');
});
