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

test('creative sessions start empty and clear requested panels when retired', t => {
  const store = session(t);
  assert.deepEqual(openPanels(store), []);
  store.togglePanel('SceneTools');
  store.openPanel('EditorSettings');
  store.closePanel('SceneTools');
  assert.deepEqual(openPanels(store), ['EditorSettings']);
  store.clearSession();
  assert.deepEqual(openPanels(store), []);
});

test('legacy story metadata does not restrict editor panels', t => {
  const store = session(t, 'story');
  store.openPanel('SceneControls');
  store.togglePanel('SceneTools');
  assert.deepEqual(openPanels(store), ['SceneControls', 'SceneTools']);
});

test('a project must be ready before editor panels can open', t => {
  const store = session(t);
  for (const status of ['idle', 'loading', 'error']) {
    worldModeState.status = status;
    store.openPanel('SceneControls');
    store.togglePanel('SceneTools');
    assert.deepEqual(openPanels(store), []);
  }
});
