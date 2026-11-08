import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { ref, shallowRef, reactive } from 'vue';
import { compileScript, parse } from 'vue/compiler-sfc';
import * as THREE from 'three';
import { createViewLifetime } from '../../src/utils/viewLifetime.js';
import { deferred } from './windowSessionFixtures.mjs';

function compile(path) {
  const { descriptor } = parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'));
  return compileScript(descriptor, { id: 'launcher-animation-lifetime' }).content
    .replace(/^import .*;$/gm, '').replace('export default', 'return');
}
const petSource = compile('../../src/views/tools/Pet.vue');
const startSource = compile('../../src/views/layout/StartScreen.vue');

function pet(t) {
  const tick = deferred(), intervals = new Map();
  let mounted, unmounted;
  const component = new Function('ref', 'reactive', 'onMounted', 'onUnmounted', 'nextTick', 'createViewLifetime',
    'AIHintBubble', 'window', 'clearInterval', petSource)(ref, reactive, fn => { mounted = fn; }, fn => { unmounted = fn; },
    () => tick.promise, createViewLifetime, {},
    { setInterval: fn => { intervals.set(1, fn); return 1; } }, id => intervals.delete(id));
  const state = component.setup({}, { expose() {} });
  t.after(() => unmounted());
  return { state, intervals, tick, mount: () => mounted(), dispose: () => unmounted() };
}

test('Pet retires a hint awaiting nextTick and cannot restart its timer', async t => {
  const p = pet(t); p.mount();
  const hint = p.state.showTimedHint();
  p.dispose(); p.tick.resolve(); await hint;
  assert.deepEqual({ ...p.state.hintState }, { show: false, text: '' });
  p.state.startTimedHints();
  assert.equal(p.intervals.size, 0);
});

test('Pet live hints retain their text and clear their interval on unmount', async t => {
  const p = pet(t); p.mount();
  const hint = p.state.showTimedHint(); p.tick.resolve(); await hint;
  assert.equal(p.state.hintState.show, true);
  assert.equal(p.state.hintState.text, '记得保存当前项目');
  p.dispose(); assert.equal(p.intervals.size, 0);
});

function start(t) {
  const tick = deferred(), tweens = [], frames = new Map(), timers = new Map(), listeners = new Map();
  let mounted, unmounted, closed = 0, sequence = 0, renderedScene, rendererDisposed = false;
  const gsap = {
    to: (target, options) => { const tween = { target, options, killed: false }; tweens.push(tween); return tween; },
    fromTo: (target, from, options) => gsap.to(target, { ...from, ...options }),
    set: (target, options) => gsap.to(target, options),
    context: () => { const owned = []; return {
      add(fn) { const before = tweens.length; fn(); owned.push(...tweens.slice(before)); },
      revert() { for (const tween of owned) tween.killed = true; },
    }; },
  };
  const host = name => ({
    addEventListener: (type, fn) => listeners.set(`${name}:${type}`, fn),
    removeEventListener: (type, fn) => { if (listeners.get(`${name}:${type}`) === fn) listeners.delete(`${name}:${type}`); },
  });
  const surface = { ...host('window'), innerWidth: 800, innerHeight: 600, devicePixelRatio: 1 };
  class Renderer {
    domElement = {};
    setClearColor() {} setSize() {} setPixelRatio() {}
    render(scene) { renderedScene = scene; }
    dispose() { rendererDisposed = true; }
  }
  const component = new Function('ref', 'shallowRef', 'nextTick', 'onMounted', 'onUnmounted', 'createViewLifetime',
    'useI18n', 'useRouter', 'appService', 'THREE', 'gsap', 'NewGame', 'RecentGames', 'JoinGame',
    'window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout', startSource)(
    ref, shallowRef, () => tick.promise, fn => { mounted = fn; }, fn => { unmounted = fn; }, createViewLifetime,
    () => ({ t: text => text }), () => ({}), { closeProcess: () => { closed++; } }, { ...THREE, WebGLRenderer: Renderer },
    gsap, {}, {}, {}, surface, host('document'),
    fn => { frames.set(++sequence, fn); return sequence; }, id => frames.delete(id),
    fn => { timers.set(++sequence, fn); return sequence; }, id => timers.delete(id));
  const state = component.setup({}, { expose() {} });
  const nodes = new Set();
  state.canvasContainer.value = { appendChild: n => nodes.add(n), contains: n => nodes.has(n), removeChild: n => nodes.delete(n) };
  state.panelRef.value = {}; state.navContainer.value = {};
  t.after(() => unmounted());
  return { state, tick, tweens, frames, timers, listeners, nodes, mount: () => mounted(), dispose: () => unmounted(),
    closed: () => closed, rendererDisposed: () => rendererDisposed, scene: () => renderedScene };
}

test('StartScreen cannot start a panel tween after nextTick completes on a retired view', async t => {
  const p = start(t);
  const sliding = p.state.showAndSlidePanel('panel-new', {});
  p.dispose(); p.tick.resolve(); await sliding;
  assert.equal(p.tweens.length, 0);
});

for (const action of ['handleBack', 'confirmExit']) {
  test(`StartScreen ${action} completion is ignored after retirement`, t => {
    const p = start(t); p.state.showPanel.value = true;
    p.state[action](); const tween = p.tweens.at(-1);
    assert.equal(typeof tween.options.onComplete, 'function');
    p.dispose(); tween.options.onComplete();
    assert.equal(p.state.showPanel.value, true);
    assert.equal(p.closed(), 0);
    assert.equal(p.tweens.length, 1);
    assert.equal(tween.killed, true);
  });
}

test('StartScreen current exit and return animations retain their intended behavior', t => {
  const p = start(t);
  p.state.handleBack(); p.tweens.at(-1).options.onComplete();
  assert.equal(p.state.showPanel.value, false);
  assert.equal(p.tweens.length, 2);
  p.state.confirmExit(); p.tweens.at(-1).options.onComplete();
  assert.equal(p.closed(), 1);
});

test('StartScreen releases its own tweens, RAF, timers, listeners and all Three resources', t => {
  const p = start(t); p.mount();
  const resources = [];
  p.scene().traverse(node => {
    for (const resource of [node.geometry, node.material].filter(Boolean)) {
      const record = { count: 0 };
      resource.addEventListener('dispose', () => { record.count++; }); resources.push(record);
    }
  });
  p.listeners.get('window:resize')();
  assert.equal(p.frames.size, 1); assert.equal(p.timers.size, 1);
  p.dispose();
  assert.equal(p.frames.size, 0); assert.equal(p.timers.size, 0); assert.equal(p.listeners.size, 0);
  assert.equal(p.nodes.size, 0); assert.equal(p.rendererDisposed(), true);
  assert.equal(resources.length, 4);
  assert.ok(resources.every(resource => resource.count === 1), 'particle and star geometry/material must all be disposed once');
  assert.ok(p.tweens.every(tween => tween.killed));
});
