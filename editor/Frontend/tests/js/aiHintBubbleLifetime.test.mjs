import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { ref, computed, compile, proxyRefs } from 'vue';
import { compileScript, parse } from 'vue/compiler-sfc';
import { createViewLifetime } from '../../src/utils/viewLifetime.js';

const { descriptor } = parse(fs.readFileSync(new URL('../../src/components/ui/AIHintBubble.vue', import.meta.url), 'utf8'));
const source = compileScript(descriptor, { id: 'hint-lifetime' }).content
  .replace(/^import .*;$/gm, '').replace('export default', 'return');
const render = compile(descriptor.template.content);

function mount(t) {
  const ticks = [], timers = new Map(), intervals = new Map(), watchers = [], events = [];
  const props = { show: true, hintText: 'first', autoHideMs: 6000, anchorEl: null };
  let mounted = () => {}, unmounted, sequence = 0;
  const component = new Function('ref', 'computed', 'watch', 'nextTick', 'onMounted', 'onUnmounted', 'createViewLifetime',
    'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'window', source)(
    ref, computed, (read, callback, options) => { watchers.push({ read, callback }); if (options?.immediate) callback(read()); },
    fn => ticks.push(fn), fn => { mounted = fn; }, fn => { unmounted = fn; }, createViewLifetime,
    (fn, ms) => { timers.set(++sequence, { fn, ms }); return sequence; }, id => timers.delete(id),
    fn => { intervals.set(++sequence, fn); return sequence; }, id => intervals.delete(id), { innerHeight: 800 });
  const state = component.setup(props, { expose() {}, emit: name => events.push(name) });
  t.after(() => unmounted());
  return { state, props, timers, intervals, events, start: () => mounted(), dispose: () => unmounted(),
    flushTick() { for (const fn of ticks.splice(0)) fn(); },
    show(value, text = props.hintText) { props.show = value; props.hintText = text; watchers[0].callback(watchers[0].read()); },
    resizeDuration(ms) { props.autoHideMs = ms; watchers[1].callback(watchers[1].read()); },
    fire(ms) { const [id, timer] = [...timers].find(([, timer]) => timer.ms === ms); timers.delete(id); timer.fn(); },
  };
}

test('hint nextTick cannot restart visibility or timers after unmount', t => {
  const p = mount(t); p.dispose(); p.flushTick();
  assert.equal(p.state.visible.value, false);
  assert.equal(p.timers.size, 0); assert.equal(p.intervals.size, 0);
});

test('only the latest requested hint may start after nextTick', t => {
  const p = mount(t);
  p.show(false); p.flushTick();
  assert.equal(p.state.visible.value, false); assert.equal(p.timers.size, 0);
  p.show(true, 'second'); p.flushTick();
  assert.equal(p.state.visible.value, true); assert.equal(p.timers.size, 1); assert.equal(p.intervals.size, 1);
});

test('unmount cancels the delayed close event and fences an already queued callback', t => {
  const p = mount(t); p.flushTick(); p.state.dismiss();
  const close = [...p.timers.values()].find(timer => timer.ms === 220).fn;
  p.dispose(); assert.equal(p.timers.size, 0);
  close(); assert.deepEqual(p.events, []);
});

test('a close callback from the previous hint cannot dismiss a replacement hint', t => {
  const p = mount(t); p.flushTick(); p.state.dismiss();
  const close = [...p.timers.values()].find(timer => timer.ms === 220).fn;
  p.show(true, 'replacement'); p.flushTick();
  close(); assert.deepEqual(p.events, []);
  assert.equal(p.state.visible.value, true);
  assert.equal([...p.timers.values()].some(timer => timer.ms === 220), false);
});

test('repeated dismissal schedules exactly one close event', t => {
  const p = mount(t); p.flushTick();
  p.state.dismiss(); p.state.dismiss();
  assert.equal(p.timers.size, 1); assert.equal(p.intervals.size, 0);
  p.fire(220); assert.deepEqual(p.events, ['close']);
});

test('hover events from the production template pause and resume auto-hide', t => {
  const p = mount(t); p.flushTick();
  const tree = render(proxyRefs({ ...p.state, hintText: p.props.hintText }), []);
  const bubble = tree.children[0].children.default()[0];
  bubble.props.onMouseenter();
  assert.equal(p.state.isHovering.value, true);
  assert.equal(p.timers.size, 0); assert.equal(p.intervals.size, 0);
  p.resizeDuration(1200); assert.equal(p.timers.size, 0);
  bubble.props.onMouseleave();
  assert.equal(p.state.isHovering.value, false);
  assert.equal([...p.timers.values()][0].ms, 1200);
});

test('normal auto-hide still emits close after its leave transition', t => {
  const p = mount(t); p.start(); p.flushTick();
  assert.equal(p.timers.size, 1); assert.equal(p.intervals.size, 1);
  p.fire(6000); assert.equal(p.state.visible.value, false); assert.deepEqual(p.events, []);
  p.fire(220); assert.deepEqual(p.events, ['close']);
});

test('cancelled auto-hide callbacks cannot close a hint after hover resumes', t => {
  const p = mount(t); p.flushTick();
  const oldHide = [...p.timers.values()][0].fn;
  const oldProgress = [...p.intervals.values()][0];
  p.state.cancelAutoHide(); p.state.startAutoHide();
  p.state.progressPercent.value = 42;
  oldHide(); oldProgress();
  assert.equal(p.state.visible.value, true);
  assert.equal(p.state.progressPercent.value, 42);
  assert.equal(p.timers.size, 1); assert.equal(p.intervals.size, 1);
});

test('duration changes replace live timers and cannot restart them after retirement', t => {
  const p = mount(t); p.flushTick(); p.resizeDuration(1200);
  assert.equal(p.timers.size, 1); assert.equal(p.intervals.size, 1);
  assert.equal([...p.timers.values()][0].ms, 1200);
  p.dispose(); p.state.startAutoHide(); p.resizeDuration(500);
  assert.equal(p.timers.size, 0); assert.equal(p.intervals.size, 0);
});
