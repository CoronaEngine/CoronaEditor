import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { ref } from 'vue';
import { parse, compileScript } from 'vue/compiler-sfc';

const { descriptor } = parse(fs.readFileSync(new URL('../../src/views/sidebar/ProjectSettings.vue', import.meta.url), 'utf8'));
const compiled = compileScript(descriptor, { id: 'project-settings-test' }).content
  .replace(/^import .*;$/gm, '').replace('export default', 'return');
function mount(response, saved = { status: 'success', data: {} }) {
  let mounted;
  const writes = [];
  const component = new Function('ref', 'onMounted', 'useI18n', 'editorApi', compiled)(
    ref, fn => { mounted = fn; }, () => ({ t: key => key }),
    { projectSettings: { getActiveProjectInfo: async () => response,
      saveActiveProjectInfo: async value => { writes.push(value); return saved; } } },
  );
  const state = component.setup({}, { expose() {} });
  return { state, writes, ready: mounted() };
}
test('project settings accepts the current V8 status envelope and preserves archive scope on save', async () => {
  const page = mount({ status: 'success', data: { name: 'Fixture', archive_session: 'archive-a' } });
  await page.ready;
  assert.equal(page.state.errorMsg.value, '');
  assert.equal(page.state.form.value.name, 'Fixture');
  await page.state.handleSave();
  assert.equal(page.writes[0].archive_session, 'archive-a');
  assert.equal(page.state.statusOk.value, true);
  assert.equal(page.state.statusMsg.value, 'projectSettings.saveSuccess');
});
test('project settings displays failed reads', async () => {
  const page = mount({ status: 'error', error: 'unavailable' });
  await page.ready;
  assert.equal(page.state.errorMsg.value, 'unavailable');
  assert.equal(page.state.loading.value, false);
});
test('project settings reports failed saves', async () => {
  const page = mount({ status: 'success', data: { archive_session: 'archive-a' } },
    { status: 'error', error: 'stale archive' });
  await page.ready;
  await page.state.handleSave();
  assert.equal(page.state.statusOk.value, false);
  assert.equal(page.state.statusMsg.value, 'stale archive');
});
