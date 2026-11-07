import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createWebMessages } from '../../src/api/webMessages.js';
import {
  publishProjectChanged,
  subscribeProjectChanged,
} from '../../src/services/projectMessages.js';
import { worldModeService, worldModeState } from '../../src/services/worldModeService.js';

test('project changes use the shared Web channel across documents and unsubscribe cleanly', async t => {
  const scope = crypto.randomUUID();
  const main = createWebMessages({ scope, role: 'main', documentId: 'main' });
  const dock = createWebMessages({ scope, documentId: 'dock' });
  t.after(() => { main.dispose(); dock.dispose(); });
  const received = [];
  const unsubscribe = subscribeProjectChanged(value => received.push(value), dock);

  await publishProjectChanged('D:/World/First', main);
  await delay(30);
  assert.deepEqual(received, [{ projectPath: 'D:/World/First' }]);

  unsubscribe();
  await publishProjectChanged('D:/World/Second', main);
  await delay(30);
  assert.deepEqual(received, [{ projectPath: 'D:/World/First' }]);
});

test('a receiving document commits the active project before notifying its subscribers', async t => {
  const previousPath = worldModeState.activeProjectPath;
  const main = createWebMessages({ scope: crypto.randomUUID(), role: 'main', documentId: 'main' });
  t.after(() => {
    main.dispose();
    worldModeService.commitActiveProject(previousPath);
  });
  const received = [];
  const unsubscribe = subscribeProjectChanged(value => {
    received.push([value.projectPath, worldModeState.activeProjectPath]);
  }, main);
  t.after(unsubscribe);

  worldModeService.commitActiveProject('old-world');
  await publishProjectChanged('new-world', main);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(received, [['new-world', 'new-world']]);
});
