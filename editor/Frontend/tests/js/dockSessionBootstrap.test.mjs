import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { getWebMessages } from '../../src/api/webMessages.js';
import { appService, isCurrentWindowEvent } from '../../src/services/appService.js';
import { createWindowSessionState } from '../../src/services/windowSessionState.js';
import { worldModeState } from '../../src/services/worldModeService.js';
import { memoryStorage } from './windowSessionFixtures.mjs';

for (const storedOwner of [null, 'another-surface-owner']) {
  test(`a new Dock joins its tagged owner and generation with stored owner ${storedOwner}`, async t => {
    const owner = crypto.randomUUID();
    const generation = crypto.randomUUID();
    const main = { location: { hash: '#/' }, sessionStorage: memoryStorage() };
    main.sessionStorage.setItem('corona.editorUi.owner', owner);
    const mainMessages = getWebMessages(main);
    const mainState = createWindowSessionState(mainMessages, { owner, main: true });
    mainMessages.setGeneration(() => mainState.read().generation);
    const record = { owner, id: 'dock-1', generation, status: 'ready', kind: 'panel', tabId: 2 };
    mainState.write({ owner, generation, revision: 1, enabled: true, records: [record] });

    let nativeCloses = 0;
    const dock = {
      location: { hash: `#/SceneControls?standalone=1&uiOwner=${owner}&uiSession=${generation}&uiWindow=dock-1` },
      sessionStorage: memoryStorage(),
      corona: { window: { close: async () => { nativeCloses++; } } },
    };
    if (storedOwner) dock.sessionStorage.setItem('corona.editorUi.owner', storedOwner);
    const previousWindow = globalThis.window;
    globalThis.window = dock;
    const previousWorld = { ...worldModeState };
    Object.assign(worldModeState, { status: 'ready', revision: 1 });
    t.after(() => {
      getWebMessages(dock).dispose();
      mainState.dispose();
      mainMessages.dispose();
      globalThis.window = previousWindow;
      Object.assign(worldModeState, previousWorld);
    });

    const policy = await appService.readEditorUiPolicy();
    assert.equal(policy.enabled, true, 'initial policy hydration must not reject a valid Dock');
    assert.equal(policy.owner, owner);
    assert.equal(policy.generation, generation);
    assert.equal(nativeCloses, 0);
    assert.equal(isCurrentWindowEvent({ uiGeneration: generation }), true);

    mainState.write({ ...mainState.read(), records: [{ ...record, status: 'closing' }] });
    await delay(30);
    assert.equal(isCurrentWindowEvent({ uiGeneration: generation }), false,
      'owner notifications must update the Dock without another hydrate');
    await appService.closeThisTab('');
    await delay(30);
    assert.equal(nativeCloses, 1);
    assert.equal(mainState.read().owner, owner);
    assert.deepEqual(mainState.read().records, []);
  });
}
