import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { ref } from 'vue';
import { parse, compileScript } from 'vue/compiler-sfc';
import { createViewLifetime } from '../../src/utils/viewLifetime.js';

const { descriptor } = parse(fs.readFileSync(new URL('../../src/views/sidebar/ProjectSettings.vue', import.meta.url), 'utf8'));
const compiled = compileScript(descriptor, { id: 'project-settings-test' }).content
  .replace(/^import .*;$/gm, '').replace('export default', 'return');
const info = { name: 'Fixture', core_version: '1', archive_session: 'archive-a', project_path: 'P:/world' };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function mount(read = async () => info, save = async value => ({ ...info, ...value }), project = { revision: 1 }) {
  let mounted, unmounted;
  const writes = [];
  const component = new Function('ref', 'onMounted', 'onUnmounted', 'createViewLifetime', 'worldModeState', 'useI18n', 'editorApi', compiled)(
    ref, fn => { mounted = fn; }, fn => { unmounted = fn; }, createViewLifetime, project, () => ({ t: key => key }),
    { projectSettings: { getActiveProjectInfo: read,
      saveActiveProjectInfo: async value => { writes.push(value); return save(value); } } },
  );
  const state = component.setup({}, { expose() {} });
  return { state, writes, ready: mounted(), dispose: () => unmounted?.() };
}
test('settings uses direct metadata and both project identities for save', async () => {
  const page = mount();
  try {
    await page.ready;
    assert.equal(page.state.errorMsg.value, '');
    assert.equal(page.state.form.value.name, 'Fixture');
    await page.state.handleSave();
    assert.deepEqual(page.writes[0], { archive_session: 'archive-a', project_path: 'P:/world', name: 'Fixture', core_version: '1' });
    assert.equal(page.state.statusOk.value, true);
  } finally { page.dispose(); }
});
test('settings displays rejected reads and saves', async () => {
  const page = mount(async () => { throw new Error('unavailable'); });
  await page.ready;
  assert.match(page.state.errorMsg.value, /unavailable/);
  assert.equal(page.state.loading.value, false);
  page.dispose();
  const writable = mount(undefined, async () => { throw new Error('stale archive'); });
  await writable.ready;
  await writable.state.handleSave();
  assert.equal(writable.state.statusOk.value, false);
  assert.match(writable.state.statusMsg.value, /stale archive/);
  writable.dispose();
});
test('unmounted settings ignores a late read', async () => {
  const pending = deferred(), page = mount(() => pending.promise);
  page.dispose(); pending.resolve(info); await page.ready;
  assert.equal(page.state.form.value.name, '');
});
test('latest reset owns the form when reads finish in reverse order', async () => {
  const pending = deferred(); let reads = 0;
  const page = mount(() => ++reads === 1 ? pending.promise : Promise.resolve({ ...info, name: 'new' }));
  await page.state.loadSettings(); pending.resolve(info); await page.ready;
  assert.equal(page.state.form.value.name, 'new'); page.dispose();
});
test('duplicate saves are ignored and late results preserve edits', async () => {
  const pending = deferred(), page = mount(undefined, () => pending.promise);
  await page.ready;
  const saving = page.state.handleSave(), duplicate = page.state.handleSave();
  page.state.form.value.name = 'next edit'; pending.resolve({ ...info, name: 'server name' });
  await Promise.all([saving, duplicate]);
  assert.equal(page.writes.length, 1); assert.equal(page.state.form.value.name, 'next edit'); page.dispose();
});
test('late save cannot publish status into a reset or retired panel', async () => {
  for (const retire of [false, true]) {
    const pending = deferred(), page = mount(undefined, () => pending.promise); await page.ready;
    const saving = page.state.handleSave();
    if (retire) page.dispose(); else await page.state.loadSettings();
    pending.reject(new Error('old save')); await saving;
    assert.equal(page.state.statusMsg.value, ''); page.dispose();
  }
});

test('project replacement fences pending reads and prevents old form writes', async () => {
  const pending = deferred(), project = { revision: 1 };
  const page = mount(() => pending.promise, undefined, project);
  project.revision++;
  pending.resolve(info);
  await page.ready;
  await page.state.handleSave();
  assert.equal(page.state.form.value.name, '');
  assert.equal(page.writes.length, 0);
  page.dispose();
});

test('read-only metadata cannot be saved', async () => {
  const page = mount(async () => ({ ...info, read_only: true }));
  await page.ready;
  await page.state.handleSave();
  assert.equal(page.writes.length, 0);
  page.dispose();
});
