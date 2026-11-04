import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { createSSRApp } from 'vue';
import { parse } from 'vue/compiler-sfc';
import { compile } from '@vue/compiler-ssr';
import { renderToString } from '@vue/server-renderer';

const { descriptor } = parse(fs.readFileSync(new URL('../../src/views/layout/MainPage.vue', import.meta.url), 'utf8'));
const shortcuts = descriptor.template.ast.children[0].children.find(node => node.type === 1 && node.tag === 'nav');
const { code } = compile(shortcuts.loc.source, { mode: 'function' });
const ssrRender = new Function('require', code)(createRequire(import.meta.url));

test('creative viewport offers panel shortcuts without permanent menu chrome', async () => {
  assert.doesNotMatch(descriptor.template.content, /activeMenu|toggleMenu|global-center-overlay/);
  const html = await renderToString(createSSRApp({
    ssrRender,
    setup: () => ({ dockShortcuts: [{ id: 'SceneControls', label: '场景控制' }],
      isShortcutOpen: () => false, toggleDockShortcut() {} }),
  }));
  assert.match(html, /场景控制/);
});
