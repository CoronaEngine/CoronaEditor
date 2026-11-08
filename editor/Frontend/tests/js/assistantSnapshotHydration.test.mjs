import test from 'node:test';
import assert from 'node:assert/strict';
import { createPinia } from 'pinia';
import { useCabbageAssistantStore } from '../../src/stores/cabbageAssistantStore.js';

const tasks = [
  { taskKey: 'first', title: 'First task', status: 'active', type: 'goal' },
  { taskKey: 'second', title: 'Second task', status: 'active', type: 'goal' },
];

test('assistant hydrates shared task selection and explicit deselection', () => {
  const store = useCabbageAssistantStore(createPinia());
  const snapshot = { projectScopeId: 'world', activeTasks: tasks, selectedTaskKey: 'first', updatedAt: 100 };
  assert.equal(store.hydrateContext(snapshot), true);
  assert.equal(store.selectedTaskKey, 'first');
  store.hydrateContext({ ...snapshot, selectedTaskKey: 'second', updatedAt: 101 });
  assert.equal(store.selectedTaskKey, 'second');
  store.hydrateContext({ ...snapshot, selectedTaskKey: '', updatedAt: 102 });
  assert.equal(store.selectedTaskKey, '');
});

test('backend snapshots without selection preserve a valid local selection', () => {
  const store = useCabbageAssistantStore(createPinia());
  store.hydrateContext({ projectScopeId: 'world', activeTasks: tasks, updatedAt: 100 });
  store.selectTask('first');
  store.hydrateContext({ projectScopeId: 'world', activeTasks: tasks, updatedAt: 101 });
  assert.equal(store.selectedTaskKey, 'first');
  store.hydrateContext({ projectScopeId: 'world', activeTasks: [tasks[1]], selectedTaskKey: 'missing', updatedAt: 102 });
  assert.equal(store.selectedTaskKey, '');
});

test('stale shared selection cannot overwrite a newer accepted context', () => {
  const store = useCabbageAssistantStore(createPinia());
  store.hydrateContext({ projectScopeId: 'world', activeTasks: tasks, updatedAt: 200 });
  store.selectTask('second');
  assert.equal(store.hydrateContext({ projectScopeId: 'world', activeTasks: tasks, selectedTaskKey: 'first', updatedAt: 100 }), false);
  assert.equal(store.selectedTaskKey, 'second');
});

test('owner replacement resets the store clock while same-owner stale values remain rejected', () => {
  const store = useCabbageAssistantStore(createPinia());
  store.hydrateContext({ projectScopeId: 'world', activeTasks: tasks, selectedTaskKey: 'first', updatedAt: 200 },
    { ownerEpoch: 'previous' });
  assert.equal(store.hydrateContext({ projectScopeId: 'world', activeTasks: [tasks[1]], selectedTaskKey: 'second', updatedAt: 100 },
    { ownerEpoch: 'replacement' }), true);
  assert.equal(store.selectedTaskKey, 'second');
  assert.equal(store.contextUpdatedAt, 100);
  assert.equal(store.hydrateContext({ projectScopeId: 'world', activeTasks: tasks, updatedAt: 90 },
    { ownerEpoch: 'replacement' }), false);
  assert.deepEqual(store.activeTasks.map(task => task.taskKey), ['second']);
});
