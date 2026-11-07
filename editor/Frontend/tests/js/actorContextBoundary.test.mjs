import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');

test('actor selection does not use the retired localStorage actor context channel', () => {
  const mainPage = read('src/views/layout/MainPage.vue');
  const sceneBar = read('src/views/sidebar/SceneBar.vue');
  assert.doesNotMatch(mainPage, /useActorContext/);
  assert.doesNotMatch(sceneBar, /useActorContext/);
  assert.equal(fs.existsSync(new URL('src/blockly/composables/useActorContext.js', root)), false);
});
