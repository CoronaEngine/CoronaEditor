import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlayerControls } from '../../src/story/controls.mjs';
import { createStorySession } from '../../src/story/session.mjs';
import { createPlayerAnimationSwitcher } from '../../src/story/playerAnimation.mjs';
import { createLevelCollision } from '../../src/story/collision.mjs';
import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three';

function fixture() {
  const player = createStorySession().player;
  let time = 0;
  const controls = createPlayerControls(player, { now: () => time });
  function run(frames) {
    for (let i = 0; i < frames; i++) {
      time += 10;
      controls.step(0.01);
    }
  }
  return { player, controls, run };
}
test('main-world walking and sprint use the original speeds and camera-relative axes', () => {
  const { player, controls, run } = fixture();
  controls.down('KeyD');
  run(100);
  assert.ok(Math.abs(player.x - 3) < 1e-8);
  controls.up('KeyD');
  controls.down('ShiftLeft');
  controls.down('KeyW');
  run(20);
  const z = player.z;
  run(100);
  assert.ok(Math.abs(player.z - z - 4.5) < 1e-8);
  controls.resetInput();
  controls.pointerMove({ movementX: Math.PI / 2 / 0.005, movementY: 0 }, null, true);
  controls.down('KeyW');
  const x = player.x;
  run(100);
  assert.ok(Math.abs(player.x - x - 3) < 1e-8);
});
test('Space jumps along the original heading; tapping Shift dodges backwards without WASD', () => {
  const { player, controls, run } = fixture();
  controls.down('Space');
  run(34);
  assert.ok(player.y > 1.1);
  assert.equal(player.motion, 'jumping');
  run(40);
  assert.equal(player.grounded, true);
  assert.ok(player.z > 3.8 && player.z < 4.2);
  const z = player.z;
  controls.down('ShiftLeft');
  run(5);
  controls.up('ShiftLeft');
  run(30);
  assert.ok(Math.abs(player.z - (z - 3)) < 1e-7);
});
test('V cycles three camera poses and scroll zoom leaves the first-person eye fixed', () => {
  const { controls } = fixture(),
    original = controls.pose();
  assert.equal(controls.cycle(), 'first');
  const eye = controls.pose().position;
  assert.deepEqual(eye, [0, 1.6, 0]);
  controls.zoom(300);
  assert.deepEqual(controls.pose().position, eye);
  assert.equal(controls.cycle(), 'top');
  assert.ok(controls.pose().position[1] > 16);
  assert.equal(controls.cycle(), 'third');
  controls.zoom(-300);
  assert.notDeepEqual(controls.pose().position, original.position);
});
test('a wall in the original level blocks lateral motion and supports landing', () => {
  const wall = new Mesh(new BoxGeometry(0.4, 3, 5), new MeshBasicMaterial());
  wall.position.set(1, 1.5, 0);
  const constrain = createLevelCollision(wall);
  const result = constrain({ x: 0.7, y: 0, z: 0 });
  assert.ok(result.x < 0.55 && result.x >= 0.52);
  wall.geometry.dispose();
  wall.material.dispose();
});
test('character switches between original locomotion and combo clips', async () => {
  const clips = [];
  let finish;
  const anim = createPlayerAnimationSwitcher({
    play: (clip) => clips.push(clip),
    schedule: (fn) => {
      finish = fn;
      return 1;
    },
    cancel() {},
  });
  await anim.update('walking');
  await anim.update('sprinting');
  await anim.combo();
  await anim.combo();
  finish();
  await Promise.resolve();
  assert.deepEqual(clips, ['Walk', 'Run', 'AttackA', 'AttackB', 'Run']);
  anim.dispose();
});
