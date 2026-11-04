<script setup>
import { computed, onMounted, onBeforeUnmount, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { advanceStory, attack, createStorySession, EQUIPMENT, LEVEL, MERCHANT, talkToMerchant, useItem } from '../../story/session.mjs';

const router = useRouter();
const game = reactive(createStorySession());
const stageHost = ref(null);
const bag = ref(false), overhead = ref(false), hasStage = ref(false);
const pressed = new Set();
let stage, frame, last = 0, mounted = false;
const bagItems = computed(() => Object.entries(game.inventory).filter(([, count]) => count > 0));
const boss = computed(() => game.enemies.find(e => e.id === 'boss'));
const time = computed(() => Math.floor(game.elapsed));

function exitStory() {
  pressed.clear();
  router.replace('/StartScreen');
}
function reset() {
  pressed.clear();
  bag.value = false;
  Object.assign(game, createStorySession());
}
function command(key) {
  if (key === 'Escape') { if (bag.value) bag.value = false; else exitStory(); return; }
  if (key === 'Tab') { pressed.clear(); bag.value = !bag.value; return; }
  if (bag.value) return;
  if (key === 'KeyV') overhead.value = !overhead.value;
  if (key === 'KeyF') talkToMerchant(game);
  if (key === 'Space' || key === 'KeyJ') attack(game);
  if (key === 'KeyE') attack(game, 'heavy');
  if (key === 'KeyR') attack(game, 'sweep');
}
const movement = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
const shortcuts = ['Escape', 'Tab', 'KeyV', 'KeyF', 'Space', 'KeyJ', 'KeyE', 'KeyR'];
function keyDown(event) {
  if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
  if (!movement.includes(event.code) && !shortcuts.includes(event.code)) return;
  event.preventDefault();
  if (movement.includes(event.code)) pressed.add(event.code);
  else if (!event.repeat) command(event.code);
}
function keyUp(event) { pressed.delete(event.code); }
function clearInput() { pressed.clear(); last = 0; }
function tick(now) {
  if (!mounted) return;
  frame = requestAnimationFrame(tick);
  if (document.hidden || (last && now - last < 1000 / 30)) return;
  const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
  last = now;
  const held = (letter, arrow) => Number(pressed.has(letter) || pressed.has(arrow));
  if (!bag.value) advanceStory(game, held('KeyA', 'ArrowLeft') - held('KeyD', 'ArrowRight'),
    held('KeyW', 'ArrowUp') - held('KeyS', 'ArrowDown'), dt);
  stage?.draw(dt, overhead.value);
}
function dropStage() {
  stage?.dispose();
  stage = null;
  hasStage.value = false;
}
onMounted(async () => {
  mounted = true;
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', clearInput);
  document.addEventListener('visibilitychange', clearInput);
  frame = requestAnimationFrame(tick);
  try {
    const { createStage } = await import('../../story/stage.mjs');
    if (!mounted) return;
    stage = createStage(stageHost.value, game, dropStage);
    hasStage.value = true;
  } catch {
    dropStage(); // CEF without WebGL can play the same session on the tactical map.
  }
});
onBeforeUnmount(() => {
  mounted = false;
  cancelAnimationFrame(frame);
  window.removeEventListener('keydown', keyDown);
  window.removeEventListener('keyup', keyUp);
  window.removeEventListener('blur', clearInput);
  document.removeEventListener('visibilitychange', clearInput);
  dropStage();
});
</script>

<template>
  <main class="story-world" aria-label="剧情模式">
    <div ref="stageHost" class="stage" />
    <svg v-if="!hasStage" class="field" viewBox="-34 -46 68 92" aria-label="主世界战术地图">
      <defs><pattern id="story-grid" width="4" height="4" patternUnits="userSpaceOnUse">
        <path d="M4 0H0V4" fill="none" stroke="#3e5d55" stroke-width=".09"/>
      </pattern></defs>
      <rect :x="-LEVEL.width/2" :y="-LEVEL.depth/2" :width="LEVEL.width" :height="LEVEL.depth" fill="url(#story-grid)" stroke="#69847c" stroke-width=".15"/>
      <g v-for="e in game.enemies.filter(enemy => enemy.hp > 0)" :key="e.id" :transform="`translate(${-e.x} ${-e.z})`">
        <circle :r="e.size / 2" :fill="e.id === 'boss' ? '#ec785a' : '#d6ab6a'"/>
        <text y="-2.3">{{ e.name }} · {{ e.hp }}</text>
      </g>
      <g :transform="`translate(${-MERCHANT.x} ${-MERCHANT.z})`"><circle r=".8" fill="#94beef"/><text y="-1.3">商人</text></g>
      <g :transform="`translate(${-game.player.x} ${-game.player.z}) rotate(${-game.player.yaw * 180/Math.PI})`">
        <path d="M0 -1.4L.8 .9L0 .6L-.8 .9Z" fill="#80ffe2"/>
      </g>
    </svg>
    <header><div><small>CORONA · 剧情模式</small><h1>山门神殿</h1></div>
      <div class="actions"><button @click="command('Tab')">行囊 · Tab</button><button @click="exitStory">离开剧情</button></div></header>
    <aside class="status">
      <b>生命 {{ game.player.hp }} / 100</b><progress :value="game.player.hp" max="100"/>
      <span>怒气 {{ game.player.rage }} / 100</span><progress :value="game.player.rage" max="100"/>
      <span>守门巨兽 {{ boss.hp }} / {{ boss.maxHp }}</span><small>本局 {{ time }} 秒</small>
    </aside>
    <footer><p role="status">{{ game.message }}</p><div class="actions">
      <button @click="attack(game)">攻击 · J</button><button @click="attack(game,'heavy')">重斩 · E</button>
      <button @click="attack(game,'sweep')">横扫 · R</button><button @click="talkToMerchant(game)">交谈 · F</button></div>
      <small>WASD / 方向键移动 · V 切换视角 · Esc 离开 · 进度仅在本局有效</small></footer>
    <section v-if="bag" class="overlay" aria-label="行囊"><article>
      <h2>行囊</h2><p>点击装备穿戴，服用回气草可恢复怒气。</p>
      <div class="items"><button v-for="[id,count] in bagItems" :key="id" @click="useItem(game,id)">
        {{ EQUIPMENT[id]?.name || '回气草' }} × {{ count }}</button></div>
      <p>已穿戴：{{ Object.values(game.equipped).map(id => EQUIPMENT[id].name).join('、') || '无' }}</p>
      <button @click="command('Tab')">返回战斗</button></article></section>
    <section v-else-if="game.phase !== 'playing'" class="overlay"><article>
      <small>山门神殿</small><h2>{{ game.phase === 'victory' ? '守门巨兽已击败' : '挑战结束' }}</h2>
      <p>{{ game.message }}</p><button @click="reset">再玩一局</button> <button @click="exitStory">返回启动页</button>
    </article></section>
  </main>
</template>

<style scoped>
.story-world{position:fixed;inset:0;background:#142722;color:#f1f0df;font:15px/1.5 system-ui,sans-serif;overflow:hidden;isolation:isolate}
.stage,.field{position:absolute;width:100%;height:100%;inset:0}.stage :deep(canvas){display:block;width:100%;height:100%}
.field text{text-anchor:middle;fill:#e4e4d2;font-size:1.15px;paint-order:stroke;stroke:#182a25;stroke-width:.25px}
header,.status,footer,article{background:#162925ed;border:1px solid #657e6f;border-radius:8px;padding:12px 18px}
header{position:absolute;top:16px;left:16px;right:16px;display:flex;align-items:center;justify-content:space-between}
h1,h2,p{margin:0 0 6px}h1{font-size:24px}small{color:#b5c5b3;letter-spacing:.06em}
.status{position:absolute;left:16px;top:106px;display:grid;gap:6px;min-width:155px}
progress{width:100%;height:6px;accent-color:#74d1b4}
footer{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);width:max-content;max-width:94%;text-align:center}
.actions,.items{display:flex;gap:7px;flex-wrap:wrap;justify-content:center}
button{color:#f4f4e4;background:#304a40;border:1px solid #749282;border-radius:4px;padding:5px 11px;cursor:pointer}
button:focus-visible,button:hover{background:#527660;outline:1px solid #b8eac5}
.overlay{position:absolute;inset:0;display:grid;place-items:center;background:#0d1919b8}
article{max-width:min(420px,85vw)}article .items{margin:16px 0}
</style>
