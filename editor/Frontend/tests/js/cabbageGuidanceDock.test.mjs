import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { memoryStorage } from './windowSessionFixtures.mjs';
import { worldModeState } from '../../src/services/worldModeService.js';
import { editorApi } from '../../src/api/editorApi.js';
import { getWebMessages } from '../../src/api/webMessages.js';

globalThis.window = {};
const aliases = registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier.startsWith('@/')
      ? new URL(`../../src/${specifier.slice(2)}`, import.meta.url).href
      : specifier, context);
  },
});
const { guidanceService, attachNativeGuidance } = await import('../../src/services/cabbageGuidanceService.js');
const { appService } = await import('../../src/services/appService.js');
aliases.deregister();

const lightingGuidance = {
  panelId: 'SceneControls',
  steps: [{ target: { kind: 'selector', selectorKey: 'scene-light-x' }, action: 'input', text: 'Change light X.' }],
};
const nodeGuidance = {
  panelId: 'NodeGraphPanel',
  steps: [{ target: { kind: 'selector', selectorKey: 'node-canvas' }, action: 'focus', text: 'Inspect nodes.' }],
};

async function fixture(t, panelId = 'MainPage') {
  t.mock.method(editorApi.scene, 'readActive', async () => ({ archive_session: '' }));
  const previous = { window: globalThis.window, document: globalThis.document, mode: { ...worldModeState } };
  const commands = [], events = [];
  const window = Object.assign(new EventTarget(), {
    localStorage: memoryStorage(), sessionStorage: memoryStorage(),
    location: { hash: '#/' },
    corona: { window: { suspendCameraViews: async () => ({ closed: 0 }) } },
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
  await appService.setEditorUiEnabled(true);
  const messages = getWebMessages(window);
  const stopOpen = messages.on('creative-panel-open', payload => events.push({ event: 'creative-panel-open', payload }));
  const detach = attachNativeGuidance(panelId);
  commands.length = 0;
  t.after(async () => {
    detach();
    await guidanceService.stop({ restorePanelState: false });
    stopOpen(); messages.dispose();
    globalThis.window = previous.window;
    globalThis.document = previous.document;
    Object.assign(worldModeState, previous.mode);
  });
  return { commands: events, messages };
}

test('guidance renders the highlight in the target native panel document', async t => {
  await fixture(t, 'SceneControls');
  assert.equal(await guidanceService.start(lightingGuidance), true);
  assert.equal(guidanceService.state.active, true);
  assert.deepEqual(guidanceService.state.targetRect, { left: 100, top: 100, width: 100, height: 30 });
});

test('guidance for an external panel uses a directed handler and opens it once', async t => {
  const { commands, messages } = await fixture(t);
  const shown = [];
  t.after(messages.handle('guidance.panel:NodeGraphPanel', value => { shown.push(value); return true; }));
  assert.equal(await guidanceService.start(nodeGuidance), true);
  assert.equal(guidanceService.state.active, false);
  assert.equal(commands.filter(command => command.event === 'creative-panel-open').length, 1);
  assert.equal(shown[0].panelId, 'NodeGraphPanel');
});

test('a request for another document asks the main surface to open that panel', async t => {
  const { commands, messages } = await fixture(t);
  t.after(messages.handle('guidance.panel:SceneControls', () => true));
  assert.equal(await messages.request('main', 'guidance.show', lightingGuidance), true);
  assert.equal(guidanceService.state.active, false);
  assert.ok(commands.some(command => command.event === 'creative-panel-open'
    && command.payload.panelId === 'SceneControls'));
});
