import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { ref, nextTick } from 'vue';
import { parse, compileScript } from 'vue/compiler-sfc';
import { createViewLifetime } from '../../src/utils/viewLifetime.js';

const { descriptor } = parse(fs.readFileSync(new URL('../../src/views/sidebar/FileManager.vue', import.meta.url), 'utf8'));
const compiled = compileScript(descriptor, { id: 'file-manager-test' }).content
  .replace(/^import .*;$/gm, '').replace('export default', 'return');
const scope = { project_path: 'P:/world', archive_session: 'a' };
const tree = name => ({ archive_session: 'a', path: '', name, children: [] });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function mount(t, overrides = {}, project = { revision: 1 }) {
  let mounted, unmounted;
  const listeners = new Map(), calls = [];
  const previous = globalThis.window, oldConfirm = globalThis.confirm, oldAlert = globalThis.alert;
  globalThis.window = { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  globalThis.confirm = () => true;
  globalThis.alert = () => {};
  t.after(() => { unmounted?.(); globalThis.window = previous; globalThis.confirm = oldConfirm; globalThis.alert = oldAlert; });
  const files = Object.fromEntries(['getFileTree', 'createFolder', 'createActorTemplate', 'renameItem', 'deleteItem', 'openFile']
    .map(name => [name, async request => { calls.push([name, request]); return name === 'getFileTree' ? tree('root') : { archive_session: 'a', ok: true }; }]));
  Object.assign(files, overrides.files);
  const component = new Function('ref', 'nextTick', 'onMounted', 'onUnmounted', 'createViewLifetime', 'worldModeState', 'editorApi', 'FileTreeNode', 'translateUiText', compiled)(
    ref, nextTick, fn => { mounted = fn; }, fn => { unmounted = fn; }, createViewLifetime, project,
    { files,
      // Opening a document reloads the native scene, so this route lives in `project`,
      // not in the bridge-backed `files` namespace.
      project: { openDocument: async request => { calls.push(['openDocument', request]); return { ok: true }; } },
      projectSettings: { getActiveProjectInfo: overrides.readInfo || (async () => ({ ...scope, name: 'World' })) } },
    {}, value => value);
  const state = component.setup({}, { expose() {} });
  const ready = mounted();
  return { state, calls, listeners, ready, dispose: () => unmounted?.() };
}
test('file browser shares project metadata and scopes its tree read', async t => {
  const page = mount(t); await page.ready;
  assert.equal(page.state.projectName.value, 'World');
  assert.deepEqual(page.calls[0], ['getFileTree', { ...scope, path: '' }]);
  page.dispose(); assert.equal(page.listeners.size, 0);
});
test('retirement while metadata is pending starts no tree read or listener', async t => {
  const pending = deferred(), page = mount(t, { readInfo: () => pending.promise });
  page.dispose(); pending.resolve({ ...scope, name: 'late' }); await page.ready;
  assert.equal(page.calls.length, 0); assert.equal(page.listeners.size, 0);
});
test('out of order tree reads cannot overwrite the latest refresh', async t => {
  let read = 0; const pending = deferred();
  const page = mount(t, { files: { getFileTree: () => ++read === 2 ? pending.promise : Promise.resolve(tree(String(read))) } });
  await page.ready; const old = page.state.loadFileTree(); await page.state.loadFileTree();
  pending.resolve(tree('old')); await old;
  assert.equal(page.state.fileTree.value.name, '3');
});
test('one captured dialog owns a mutation and late completion cannot close another dialog', async t => {
  const pending = deferred(), calls = [];
  const page = mount(t, { files: { createFolder: value => { calls.push(value); return pending.promise; } } });
  await page.ready;
  page.state.contextMenu.value = { scope, item: null };
  page.state.handleNewFolder(); page.state.dialog.value.value = 'first';
  const first = page.state.handleDialogConfirm(), duplicate = page.state.handleDialogConfirm();
  page.state.handleNewActor(); page.state.dialog.value.value = 'next';
  pending.resolve({ ok: true }); await Promise.all([first, duplicate]);
  assert.deepEqual(calls, [{ ...scope, path: '', name: 'first' }]);
  assert.equal(page.state.dialog.value.show, true); assert.equal(page.state.dialog.value.value, 'next');
});
test('context open uses the selected item and captured scope', async t => {
  const page = mount(t); await page.ready;
  page.state.contextMenu.value = { scope, item: { path: 'Hero.actor', name: 'Hero.actor', isDirectory: false } };
  await page.state.handleOpenFile();
  assert.deepEqual(page.calls.at(-1), ['openDocument', { ...scope, path: 'Hero.actor', file_type: 'actor' }]);
});
test('project replacement prevents dialog writes and late nextTick menu revival', async t => {
  const project = { revision: 1 }, page = mount(t, {}, project); await page.ready;
  page.state.handleContextMenu({ preventDefault() {}, stopPropagation() {}, clientX: 1, clientY: 2 }, null);
  project.revision++; await nextTick();
  assert.equal(page.state.contextMenu.value.show, false);
  page.state.dialog.value = { show: true, type: 'newFolder', value: 'old', targetPath: '', scope };
  await page.state.handleDialogConfirm();
  assert.equal(page.calls.filter(([name]) => name === 'createFolder').length, 0);
});
test('failed mutation keeps dialog open for retry and reports error', async t => {
  const page = mount(t, { files: { createFolder: async () => { throw new Error('permission denied'); } } }); await page.ready;
  page.state.contextMenu.value = { scope, item: null }; page.state.handleNewFolder(); page.state.dialog.value.value = 'folder';
  await page.state.handleDialogConfirm();
  assert.equal(page.state.dialog.value.show, true); assert.match(page.state.errorMsg.value, /permission denied/);
});
