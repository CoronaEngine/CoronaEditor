import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { createPinia } from 'pinia';
import { worldModeState } from '../../src/services/worldModeService.js';

// Resolve the same source alias Vite supplies without replacing store behavior.
const aliases = registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier.startsWith('@/')
      ? new URL(`../../src/${specifier.slice(2)}`, import.meta.url).href
      : specifier, context);
  },
});
const { useDockStore } = await import('../../src/stores/dockStore.js');
aliases.deregister();

function session(t, mode = 'creative') {
  const previous = { ...worldModeState };
  Object.assign(worldModeState, { status: 'ready', mode });
  t.after(() => Object.assign(worldModeState, previous));
  return useDockStore(createPinia());
}

const openPanels = store => Object.entries(store.panels)
  .filter(([, panel]) => panel.open).map(([id]) => id).sort();

test('creative entry opens scene controls and scene management by default', t => {
  const store = session(t);
  store.initDefaultLayout();
  assert.deepEqual(openPanels(store), ['SceneControls', 'SceneTools']);
  assert.equal(store.panels.SceneControls.mode, 'docked');
  assert.equal(store.panels.SceneTools.mode, 'docked');
});

test('reinitializing a session preserves panels the user closed', t => {
  const store = session(t);
  store.initDefaultLayout();
  store.closePanel('SceneControls');
  store.initDefaultLayout();
  assert.deepEqual(openPanels(store), ['SceneTools']);
});

test('clearing a session allows the next creative session to seed its defaults', t => {
  const store = session(t);
  store.initDefaultLayout();
  store.closePanel('SceneControls');
  store.setExternal('NodeGraphPanel', 7);
  store.clearSession();
  assert.deepEqual(openPanels(store), []);
  assert.equal(store.panels.NodeGraphPanel.mode, 'docked');
  assert.equal(store.panels.NodeGraphPanel.externalTabId, null);
  store.initDefaultLayout();
  assert.deepEqual(openPanels(store), ['SceneControls', 'SceneTools']);
});

test('story entry cannot seed or open editor panels', t => {
  const store = session(t, 'story');
  store.initDefaultLayout();
  store.openPanel('SceneControls');
  store.togglePanel('SceneTools');
  store.movePanel('Object', 'right');
  store.setExternal('NodeGraphPanel', 7);
  assert.deepEqual(openPanels(store), []);

  worldModeState.mode = 'creative';
  store.initDefaultLayout();
  assert.deepEqual(openPanels(store), ['SceneControls', 'SceneTools']);
});
