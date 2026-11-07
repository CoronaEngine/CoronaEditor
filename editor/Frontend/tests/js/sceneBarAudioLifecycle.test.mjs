import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { babelParse, parse } from 'vue/compiler-sfc';

function fixture(operation) {
  const script = parse(readFileSync(new URL('../../src/views/sidebar/SceneBar.vue', import.meta.url), 'utf8')).descriptor.scriptSetup.content;
  const node = babelParse(script, { sourceType: 'module' }).program.body
    .flatMap(node => (node.declarations || []).map(item => ({ ...item.init, name: item.id.name })))
    .find(node => node.name === 'handlePlayToggle');
  const calls = [], errors = [], deps = {
    playingStates: {}, pendingAudioRows: new WeakSet(),
    currentSceneName: { value: 'scene.ini' }, archiveSession: { value: 'archive' },
    viewLifetime: { current: () => true }, logWarn: () => {}, logError: (...args) => errors.push(args),
    editorApi: { audio: Object.fromEntries(['playActor', 'stopActor', 'playResource', 'stopResource']
      .map(method => [method, (...args) => { calls.push([method, ...args]); return operation(); }])) },
  };
  const run = new Function('deps', `with(deps){return (${script.slice(node.start, node.end)});}`)(deps);
  return { run, deps, calls, errors };
}

for (const playing of [false, true]) {
  test(`failed ${playing ? 'stop' : 'play'} keeps the acknowledged audio state`, async () => {
    const f = fixture(async () => { throw new Error('native rejected'); });
    const row = { name: 'Sound', type: 'audio', handle: '1', actor_guid: 'guid', _playing: playing };
    f.deps.playingStates.Sound = playing;
    await f.run(row);
    assert.equal(f.deps.playingStates.Sound, playing);
    assert.equal(row._playing, playing);
    assert.equal(f.errors.length, 1);
  });
}

for (const change of ['archive', 'scene', 'unmount']) {
  test(`late audio reply is ignored after ${change}`, async () => {
    let resolve;
    const pending = new Promise(r => { resolve = r; });
    const f = fixture(() => pending);
    const row = { name: 'Sound', type: 'audio', handle: '1', actor_guid: 'guid', _playing: false };
    const work = f.run(row);
    if (change === 'archive') f.deps.archiveSession.value = 'new-archive';
    if (change === 'scene') f.deps.currentSceneName.value = 'other.ini';
    if (change === 'unmount') f.deps.viewLifetime.current = () => false;
    resolve({ status: 'success' });
    await work;
    assert.equal(row._playing, false);
    assert.equal(f.deps.playingStates.Sound, undefined);
  });
}

test('duplicate clicks share one pending native operation and success updates once', async () => {
  let resolve;
  const pending = new Promise(r => { resolve = r; });
  const f = fixture(() => pending), row = { name: 'Sound', type: 'audio', handle: '1', actor_guid: 'guid' };
  const first = f.run(row), second = f.run(row);
  assert.equal(f.calls.length, 1);
  resolve({ status: 'success' });
  await Promise.all([first, second]);
  assert.equal(f.deps.playingStates.Sound, true);
  assert.deepEqual(f.calls[0], ['playActor', 'scene.ini', 'guid', { archive_session: 'archive' }, false]);
});
