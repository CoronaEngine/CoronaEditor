// Each mounted story page owns exactly one session.
export const LEVEL = { width: 64, depth: 88, asset: 'scene/01_山门神殿_平地版.glb' };
export const PLAYER_MODEL = 'player/E3D-Assassin.glb';
export const MERCHANT = { name: '商人', x: -30, z: -15 };
const cast = [
  ['boss', '守门巨兽', 'boss/Em001_00.glb', 11, 16, 200, 8],
  ['wyvern', '地龙', 'monster/landwyvern.fbx', -9, -5, 180, 3.0],
  ['huntress', '蜥蜴女猎手', 'monster/lizardf.fbx', -7, 8, 120, 3.5],
  ['warrior', '蜥蜴战士', 'monster/lizardm.fbx', 10, 6, 120, 3.1],
  ['lion', '荒原狮兽', 'monster/lion.fbx', 0, -12, 160, 3.7],
  ['mantis', '刀螳', 'monster/mantis.fbx', -12, 2, 80, 2.3],
  ['larva', '沙原幼虫', 'monster/larva.fbx', 6, -11, 90, 2.4],
];
export const EQUIPMENT = {
  'hunter-blade': { name: '猎人长刃', slot: 'weapon', attack: 80 },
  'hunter-helm': { name: '兽骨轻盔', slot: 'helm', armor: 66 },
  'hunter-chest': { name: '兽皮护甲', slot: 'chest', armor: 94 },
  'hunter-boots': { name: '猎风战靴', slot: 'boots', armor: 58, haste: 0.07 },
  'boss-main': { name: '守门者之刃', slot: 'weapon', attack: 148 },
  'boss-helm': { name: '守门者头盔', slot: 'helm', armor: 150 },
  'boss-chest': { name: '守门者胸甲', slot: 'chest', armor: 210 },
  'boss-legs': { name: '守门者护腿', slot: 'legs', armor: 168 },
  'boss-boots': { name: '守门者战靴', slot: 'boots', armor: 112, haste: 0.1 },
};
export const SKILLS = {
  strike: { name: '攻击', range: 3.2, angle: Math.PI / 3, cost: 0, multiplier: 1, cooldown: 0.4 },
  heavy: { name: '重斩', range: 3.5, angle: Math.PI / 3, cost: 30, multiplier: 2.5, cooldown: 1.2 },
  sweep: { name: '横扫', range: 4, angle: Math.PI, cost: 50, multiplier: 4, cooldown: 3 },
};

export function createStorySession() {
  return {
    elapsed: 0, phase: 'playing', message: '山门已开。寻找并击败守门巨兽。',
    player: { x: 0, y: 0, z: 0, yaw: 0, grounded: true, motion: 'idle', hp: 100, rage: 0 },
    enemies: cast.map(([id, name, asset, x, z, hp, size]) =>
      ({ id, name, asset, x, z, hp, maxHp: hp, size, nextHit: 1 })),
    inventory: { 'hunter-blade': 1, 'hunter-chest': 1, herb: 3 },
    equipped: {}, cooldown: {}, attackReady: 0, merchantGift: false,
  };
}

export function useItem(game, id) {
  if (game.phase === 'defeat' || !(game.inventory[id] > 0)) return;
  if (id === 'herb') {
    if (game.player.rage === 100) return;
    game.player.rage = Math.min(100, game.player.rage + 30);
    game.message = '服用回气草，恢复 30 怒气。';
  } else {
    const item = EQUIPMENT[id];
    if (!item || game.equipped[item.slot] === id) return;
    const previous = game.equipped[item.slot];
    if (previous) game.inventory[previous] = (game.inventory[previous] || 0) + 1;
    game.equipped[item.slot] = id;
    game.message = '已装备' + item.name;
  }
  game.inventory[id]--;
}

function bonus(game, attribute) {
  return Object.values(game.equipped).reduce((sum, id) => sum + (EQUIPMENT[id]?.[attribute] || 0), 0);
}

export function nearestTarget(game, skill = SKILLS.strike) {
  const player = game.player;
  let nearest = null, best = Infinity;
  for (const enemy of game.enemies) {
    const dx = enemy.x - player.x, dz = enemy.z - player.z;
    const distance = Math.hypot(dx, dz);
    if (enemy.hp <= 0 || distance > skill.range + enemy.size / 2 || distance >= best) continue;
    const facing = Math.sin(player.yaw) * dx + Math.cos(player.yaw) * dz;
    if (distance > 0.01 && facing < distance * Math.cos(skill.angle)) continue;
    nearest = enemy;
    best = distance;
  }
  return nearest;
}

export function attack(game, id = 'strike', random = Math.random) {
  const skill = SKILLS[id];
  if (!skill || !game.player.grounded || game.player.motion === 'dodging' || game.phase !== 'playing' || game.elapsed < game.attackReady ||
      game.elapsed < (game.cooldown[id] || 0)) return false;
  if (game.player.rage < skill.cost) { game.message = '怒气不足'; return false; }
  const target = nearestTarget(game, skill);
  if (!target) { game.message = '靠近并面向目标后攻击'; return false; }
  game.attackReady = game.elapsed + 0.4;
  game.cooldown[id] = game.elapsed + skill.cooldown * (1 - bonus(game, 'haste'));
  game.player.rage = Math.min(100, game.player.rage - skill.cost + (skill.cost ? 0 : 10));
  const damage = Math.floor((20 + bonus(game, 'attack')) * skill.multiplier);
  target.hp = Math.max(0, target.hp - damage);
  game.message = skill.name + '命中' + target.name + '，伤害 ' + damage;
  if (target.hp === 0) {
    const drops = target.id === 'boss' ? Object.keys(EQUIPMENT).filter(key => key.startsWith('boss-'))
      : ['herb', Object.keys(EQUIPMENT)[Math.floor(random() * 4)]];
    for (const item of drops) game.inventory[item] = (game.inventory[item] || 0) + 1;
    game.message = target.name + '已击败，战利品已放入行囊。';
    if (target.id === 'boss') game.phase = 'victory';
  }
  return true;
}

export function talkToMerchant(game) {
  if (Math.hypot(game.player.x - MERCHANT.x, game.player.z - MERCHANT.z) > 3.5) {
    game.message = '靠近商人后按 F 交谈。';
    return;
  }
  if (game.merchantGift) { game.message = '商人：一路平安。'; return; }
  game.merchantGift = true;
  game.inventory.herb++;
  game.message = '商人赠送了一份回气草。';
}

export function advanceStory(game, seconds) {
  if (game.phase !== 'playing') return;
  const dt = Math.max(0, Math.min(0.1, seconds));
  game.elapsed += dt;
  const player = game.player;
  for (const enemy of game.enemies) {
    if (!enemy.hp) continue;
    const x = player.x - enemy.x, z = player.z - enemy.z;
    const distance = Math.hypot(x, z);
    if (distance >= 8) continue;
    if (distance > 1.9) {
      enemy.x += 1.35 * dt * x / distance;
      enemy.z += 1.35 * dt * z / distance;
    } else if (game.elapsed >= enemy.nextHit) {
      enemy.nextHit = game.elapsed + 1.5;
      player.hp = Math.max(0, player.hp - Math.max(1, (enemy.id === 'boss' ? 12 : 5) - Math.floor(bonus(game, 'armor') / 30)));
      if (!player.hp) { game.phase = 'defeat'; game.message = '本局结束。可以重新挑战山门。'; break; }
    }
  }
}
