import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { createPinia, setActivePinia } from 'pinia';
import { memoryStorage } from './windowSessionFixtures.mjs';
import { worldModeState } from '../../src/services/worldModeService.js';
import { Bridge } from '../../src/api/editorApi.js';

globalThis.window = {};
const aliases = registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier.startsWith('@/')
      ? new URL(`../../src/${specifier.slice(2)}`, import.meta.url).href
      : specifier, context);
  },
});
const { guidanceService, attachNativeGuidance } = await import('../../src/services/cabbageGuidanceService.js');
const { useDockStore } = await import('../../src/stores/dockStore.js');
const { appService } = await import('../../src/services/appService.js');
const { coronaEventBus } = await import('../../src/utils/eventBus.js');
aliases.deregister();

const lightingGuidance = {
  panelId: 'SceneControls',
  steps: [{ target: { kind: 'selector', selectorKey: 'scene-light-x' }, action: 'input', text: 'Change light X.' }],
};
const nodeGuidance = {
  panelId: 'NodeGraphPanel',
  steps: [{ target: { kind: 'selector', selectorKey: 'node-canvas' }, action: 'focus', text: 'Inspect nodes.' }],
};

async function fixture(t) {
  const previous = { window: globalThis.window, document: globalThis.document, mode: { ...worldModeState } };
  const commands = [];
  const window = Object.assign(new EventTarget(), {
    localStorage: memoryStorage(), sessionStorage: memoryStorage(),
    location: { hash: '#/' }, coronaBridge: { dockCommand() {} },
    innerWidth: 1536, innerHeight: 825,
    setTimeout, clearTimeout, setInterval, clearInterval,
  });
  globalThis.window = window;
  globalThis.document = {
    querySelector: selector => selector === '[data-guidance="scene-light-x"]' ? {
      getBoundingClientRect: () => ({ left: 100, top: 100, width: 100, height: 30, right: 200, bottom: 130 }),
    } : null,
  };
  Object.assign(worldModeState, { status: 'ready', mode: 'creative', revision: 1 });
  setActivePinia(createPinia());
  const store = useDockStore();
  t.mock.method(Bridge, 'callDockCommand', async command => { commands.push(command); return {}; });
  await appService.setEditorUiEnabled(true);
  const detach = attachNativeGuidance('MainPage');
  commands.length = 0;
  t.after(async () => {
    detach();
    await guidanceService.stop({ restorePanelState: false });
    globalThis.window = previous.window;
    globalThis.document = previous.document;
    Object.assign(worldModeState, previous.mode);
  });
  return { store, commands };
}

test('guidance opens a DOM dock and highlights it in the main CEF document', async t => {
  const { store, commands } = await fixture(t);
  assert.equal(await guidanceService.start(lightingGuidance), true);
  assert.equal(store.panels.SceneControls.open, true);
  assert.equal(guidanceService.state.active, true);
  assert.equal(guidanceService.state.guidance.panelId, 'SceneControls');
  assert.deepEqual(guidanceService.state.targetRect, { left: 100, top: 100, width: 100, height: 30 });
  assert.equal(commands.some(command => command.event === 'creative-guidance-request'), false);
});

test('guidance for an external panel still requests its native document', async t => {
  const { store, commands } = await fixture(t);
  store.setExternal('NodeGraphPanel', 7);
  assert.equal(await guidanceService.start(nodeGuidance), true);
  assert.equal(guidanceService.state.active, false);
  assert.equal(store.panels.NodeGraphPanel.mode, 'external');
  const request = commands.find(command => command.event === 'creative-guidance-request');
  assert.equal(request?.payload.guidance.panelId, 'NodeGraphPanel');
});

test('a native document can request guidance for a DOM dock on the main surface', async t => {
  const { store, commands } = await fixture(t);
  const policy = await appService.readEditorUiPolicy();
  coronaEventBus.emit('creative-guidance-request', {
    requestId: 'external-to-dom', guidance: lightingGuidance, uiGeneration: policy.generation,
  });
  await new Promise(resolve => setTimeout(resolve, 500));
  assert.equal(store.panels.SceneControls.open, true);
  assert.equal(guidanceService.state.active, true);
  assert.equal(guidanceService.state.guidance.panelId, 'SceneControls');
  assert.ok(commands.some(command => command.event === 'creative-guidance-accepted'
    && command.payload.requestId === 'external-to-dom'));
});
