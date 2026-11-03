import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { createSSRApp } from 'vue';
import { parse } from 'vue/compiler-sfc';
import { compile } from '@vue/compiler-ssr';
import { renderToString } from '@vue/server-renderer';

const { descriptor } = parse(fs.readFileSync(new URL('../../src/views/layout/MainPage.vue', import.meta.url), 'utf8'));
const menu = descriptor.template.ast.children[0].children.find(node => node.type === 1);
const { code } = compile(menu.loc.source, { mode: 'function' });
const ssrRender = new Function('require', code)(createRequire(import.meta.url));

test('creative world exposes its top menus and preview controls', async () => {
  const html = await renderToString(createSSRApp({
    ssrRender,
    setup: () => ({ activeMenu: null, previewRunning: false, previewBusy: false, previewStatusText: '' }),
  }));
  for (const label of ['项目', '视图', '物理', '插件', '运行', '帮助', '开始预览', '结束预览']) {
    assert.ok(html.includes(label), `missing visible menu: ${label}`);
  }
});
