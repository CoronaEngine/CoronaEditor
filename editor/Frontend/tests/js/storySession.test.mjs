import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceStory, attack, createStorySession, EQUIPMENT, talkToMerchant, useItem } from '../../src/story/session.mjs';

test('each entry starts a fresh main world and isolate inventories and enemies', () => {
  const first = createStorySession();
  first.player.hp = 10;
  first.enemies[0].hp = 0;
  useItem(first, 'hunter-blade');
  const next = createStorySession();
  assert.equal(next.player.hp, 100);
  assert.equal(next.inventory['hunter-blade'], 1);
  assert.equal(next.enemies[0].hp, 200);
  assert.deepEqual(next.equipped, {});
});

test('movement, facing, timed attacks and boss rewards stay in the current run', () => {
  const game = createStorySession();
  advanceStory(game, 0, 1, 0.1);
  assert.equal(game.player.z, 0.5);
  const boss = game.enemies[0];
  Object.assign(game.player, { x: boss.x, z: boss.z - 1, yaw: Math.PI });
  assert.equal(attack(game), false);
  game.player.yaw = 0;
  useItem(game, 'hunter-blade');
  assert.equal(attack(game), true);
  assert.equal(boss.hp, 100);
  assert.equal(attack(game), false);
  for (let i = 0; i < 5; i++) advanceStory(game, 0, 0, 0.1);
  assert.equal(attack(game), true);
  assert.equal(game.phase, 'victory');
  assert.equal(game.inventory['boss-main'], 1);
  assert.equal(attack(game), false);
  assert.equal(Object.keys(EQUIPMENT).filter(id => id.startsWith('boss-') && game.inventory[id] === 1).length, 5);
});

test('merchant gift, skills and enemy damage work without host services', () => {
  const game = createStorySession();
  Object.assign(game.player, { x: -5, z: 3 });
  talkToMerchant(game); talkToMerchant(game);
  assert.equal(game.inventory.herb, 4);
  useItem(game, 'herb');
  assert.equal(game.player.rage, 30);
  const enemy = game.enemies[1];
  Object.assign(game.player, { x: enemy.x, z: enemy.z - 1, yaw: 0 });
  assert.equal(attack(game, 'heavy'), true);
  assert.equal(game.player.rage, 0);
  assert.equal(enemy.hp, enemy.maxHp - 50);
  game.player.hp = 1;
  for (let i = 0; i < 20; i++) advanceStory(game, 0, 0, 0.1);
  assert.equal(game.phase, 'defeat');
});
