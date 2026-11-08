import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { babelParse } from 'vue/compiler-sfc';

const source = fs.readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
const registration = babelParse(source, { sourceType: 'module' }).program.body
  .find(node => node.expression?.callee?.object?.name === 'app'
    && node.expression.callee.property?.name === 'directive'
    && node.expression.arguments[0]?.value === 'click-outside');
assert.ok(registration, 'production click-outside directive');
const node = registration.expression.arguments[1];

function fixture() {
  const listeners = new Map(), timers = new Map(), calls = [];
  let timerId = 0;
  const directive = new Function('document', 'setTimeout', 'clearTimeout', `return (${source.slice(node.start, node.end)});`)(
    { addEventListener: (type, fn) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
      removeEventListener: (type, fn) => listeners.get(type)?.delete(fn) },
    fn => { timers.set(++timerId, fn); return timerId; }, id => timers.delete(id));
  const element = { contains: target => target === 'inside' }, binding = { value: event => calls.push(event) };
  return { directive, element, binding, listeners, timers, calls,
    run: () => { for (const [id, fn] of timers) { timers.delete(id); fn(); } },
    count: () => [...listeners.values()].reduce((sum, entries) => sum + entries.size, 0) };
}

test('click-outside retirement cancels its delayed registration', () => {
  const f = fixture();
  f.directive.mounted(f.element, f.binding);
  f.directive.unmounted(f.element);
  assert.equal(f.timers.size, 0);
  f.run();
  assert.equal(f.count(), 0);
});

test('click-outside already queued callback cannot register after retirement', () => {
  const f = fixture();
  f.directive.mounted(f.element, f.binding);
  const queued = [...f.timers.values()][0];
  f.directive.unmounted(f.element); queued();
  assert.equal(f.count(), 0);
});

test('click-outside remount cannot revive an old element registration', () => {
  const f = fixture();
  f.directive.mounted(f.element, f.binding);
  const queued = [...f.timers.values()][0];
  f.directive.unmounted(f.element);
  f.directive.mounted(f.element, f.binding); queued(); f.run();
  assert.equal(f.count(), 2);
  f.directive.unmounted(f.element);
  assert.equal(f.count(), 0);
});

test('live click-outside still ignores inner clicks and unregisters both listeners', () => {
  const f = fixture();
  f.directive.mounted(f.element, f.binding); f.run();
  assert.equal(f.count(), 2);
  const receive = [...f.listeners.get('mousedown')][0];
  receive({ target: 'inside' }); receive({ target: 'outside' });
  assert.equal(f.calls.length, 1);
  f.directive.unmounted(f.element);
  assert.equal(f.count(), 0);
});
