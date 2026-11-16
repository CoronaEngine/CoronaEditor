import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { setImmediate } from 'node:timers';
import { compile, ref } from 'vue';
import { babelParse, compileScript, parse } from 'vue/compiler-sfc';
import { editorApi } from '../../src/api/editorApi.js';
import * as launcher from '../../src/services/projectLauncherService.js';
import * as worldMode from '../../src/services/worldModeService.js';
import * as lifecycle from '../../src/services/worldSessionLifecycle.js';
import { createViewLifetime } from '../../src/utils/viewLifetime.js';

// Compile the real creation page rather than duplicating its orchestration here.
// Only lifecycle/router/UI dependencies are injected; the launcher is production code.
const { descriptor } = parse(fs.readFileSync(new URL('../../src/views/layout/NewGame.vue', import.meta.url), 'utf8'));
const compiled = compileScript(descriptor, { id: 'world-create-regression', genDefaultAs: 'NewGame' });
const imports = babelParse(compiled.content, { sourceType: 'module' }).program.body
  .filter(node => node.type === 'ImportDeclaration');
let setupSource = compiled.content;
for (const node of [...imports].reverse()) {
  const bindings = node.specifiers.map(specifier => {
    const key = specifier.type === 'ImportDefaultSpecifier' ? 'default' : specifier.imported.name;
    return `${JSON.stringify(key)}: ${specifier.local.name}`;
  }).join(', ');
  setupSource = setupSource.slice(0, node.start)
    + `const { ${bindings} } = modules[${JSON.stringify(node.source.value)}];`
    + setupSource.slice(node.end);
}
const makeComponent = new Function('modules', `${setupSource}; return NewGame;`);
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

async function mountCreationPage(t, { networkError, createGate } = {}) {
  const calls = [], alerts = [], saves = [], mounted = [], unmounted = [];
  let activePath = 'creative-world';
  let route = '/NewGame';
  let sequence = 0;
  const previous = { window: globalThis.window, CustomEvent: globalThis.CustomEvent, alert: globalThis.alert };
  const timers = new Map();
  globalThis.window = {
    localStorage: { setItem: (...args) => saves.push(args) },
    dispatchEvent() {},
    alert: message => alerts.push(message),
    setInterval: callback => { const id = timers.size + 1; timers.set(id, callback); return id; },
    clearInterval: id => timers.delete(id),
  };
  globalThis.alert = globalThis.window.alert;
  globalThis.CustomEvent = class { constructor(type, options) { Object.assign(this, { type }, options); } };
  t.after(() => {
    for (const hook of unmounted) hook();
    assert.equal(timers.size, 0);
    Object.assign(globalThis, previous);
    worldMode.worldModeService.invalidate();
  });
  t.mock.method(console, 'error', () => {});
  t.mock.method(editorApi.project, 'get_project_load_status', async () => ({ archive_service_ready: true }));
  t.mock.method(editorApi.projectSettings, 'getActiveProjectInfo', async () => ({ project_path: activePath, mode: 'creative' }));
  t.mock.method(editorApi.project, 'create_world_project', async payload => {
    calls.push(['create', payload]);
    if (createGate) await createGate;
    return { name: `创造世界_${++sequence}`, path: `creative-world-${sequence}` };
  });
  const networkStops = [];
  t.mock.method(editorApi.network, 'stop_session', async () => {
    networkStops.push(activePath);
    if (networkError) throw networkError;
    return { ok: true };
  });
  t.mock.method(editorApi.project, 'open_project', async path => {
    calls.push(['open', path]);
    activePath = path;
    return { ok: true, path };
  });
  worldMode.worldModeService.invalidate();
  await worldMode.worldModeService.resolve(activePath, { force: true });
  const router = {
    push: async path => { calls.push(['route', path]); route = path; },
    replace: async path => { calls.push(['replace', path]); route = path; },
  };
  const component = makeComponent({
    vue: { ref, onMounted: hook => mounted.push(hook), onUnmounted: hook => unmounted.push(hook) },
    'vue-router': { useRouter: () => router },
    '@/api/editorApi.js': { editorApi },
    '@/services/worldModeService.js': worldMode,
    '@/services/projectLauncherService.js': launcher,
    '@/services/worldSessionLifecycle.js': lifecycle,
    '@/services/cabbageAssistantContextService.js': { initializeWorldTasks: async () => {} },
    '@/i18n/domTranslator.js': { translateUiText: text => text },
    '@/utils/viewLifetime.js': { createViewLifetime },
  });
  const page = component.setup({}, { expose() {} });
  for (const hook of mounted) hook();
  await page.refreshArchiveReady();
  assert.match(descriptor.template.content, /@click="handleCreate"/);
  return {
    page, calls, alerts, saves, networkStops,
    activePath: () => activePath,
    route: () => route,
  };
}

test('home offers project creation without a separate story world entry', () => {
  const home = parse(fs.readFileSync(new URL('../../src/views/layout/StartScreen.vue', import.meta.url), 'utf8'));
  const routes = [];
  const tree = compile(home.descriptor.template.content)({
    t: key => key,
    navItems: [{ id: 'panel-new', label: 'start.newGame' }],
    activeNav: null, showPanel: false, handleNavClick: assert.fail,
    router: { push: path => routes.push(path) },
  }, []);
  const nav = tree.children.find(child => child.props?.class === 'nav-container');
  const buttons = nav.children.flatMap(child => Array.isArray(child.children) ? child.children : [child])
    .filter(child => child.type === 'button');
  assert.deepEqual(buttons.map(button => button.children), ['start.newGame']);
  assert.equal(worldMode.LAUNCHER_ROUTES.has('/Story'), false);
  const routerSource = fs.readFileSync(new URL('../../src/router/index.js', import.meta.url), 'utf8');
  assert.doesNotMatch(routerSource, /StoryWorld|WorldEntry|path: '\/Story'/);
});

test('creation stops native networking before replacing the old project', async t => {
  const h = await mountCreationPage(t);
  await h.page.handleCreate();
  assert.deepEqual(h.networkStops, ['creative-world']);
  assert.equal(h.activePath(), 'creative-world-1');
  assert.equal(h.route(), '/');
});

test('network cleanup failure prevents project replacement', async t => {
  const h = await mountCreationPage(t, { networkError: new Error('native stop failed') });
  await h.page.handleCreate();
  assert.deepEqual(h.networkStops, ['creative-world']);
  assert.equal(h.calls.some(([name]) => name === 'open'), false);
  assert.equal(h.activePath(), 'creative-world');
  assert.equal(h.alerts.length, 1);
});

test('creation waits for service readiness, disables duplicate requests, and routes home', async t => {
  const gate = deferred();
  const h = await mountCreationPage(t, { createGate: gate.promise });
  h.page.archiveReady.value = false;
  await h.page.handleCreate();
  assert.deepEqual(h.calls, []);
  h.page.archiveReady.value = true;
  const creation = h.page.handleCreate();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.page.creating.value, true);
  assert.deepEqual(h.calls, [['create', { prompt: '' }]]);
  await h.page.handleCreate();
  assert.equal(h.calls.filter(([call]) => call === 'create').length, 1);
  gate.resolve();
  await creation;
  assert.equal(h.route(), '/');
  assert.equal(h.page.creating.value, false);
});
