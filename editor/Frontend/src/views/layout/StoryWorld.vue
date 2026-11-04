<script setup>
import { onMounted, onBeforeUnmount, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  advanceStory,
  attack,
  createStorySession,
  LEVEL,
  MERCHANT,
  talkToMerchant,
} from '../../story/session.mjs';
import { createPlayerControls, VIEW_LABELS } from '../../story/controls.mjs';
import { createPlayerAnimationSwitcher, PLAYER_SKILL_CLIP } from '../../story/playerAnimation.mjs';
import StoryHud from './StoryHud.vue';
import StoryBag from './StoryBag.vue';

const router = useRouter();
const game = reactive(createStorySession());
const surface = ref(null),
  stageHost = ref(null),
  bag = ref(false),
  hasStage = ref(false);
const view = ref('third');
let stage,
  frame,
  last = 0,
  mounted = false;
let lastDraw = 0;
function motion() {
  return createPlayerControls(game.player, {
    floor: (x, z) => stage?.floor(x, z) ?? 0,
    collide: (point) => {
      point.x = Math.max(-LEVEL.width / 2, Math.min(LEVEL.width / 2, point.x));
      point.z = Math.max(-LEVEL.depth / 2, Math.min(LEVEL.depth / 2, point.z));
      return stage?.constrain(point) ?? point;
    },
  });
}
const animate = () =>
  createPlayerAnimationSwitcher({ play: (clip, blend) => stage?.playPlayer(clip, blend) });
let controls = motion(),
  animation = animate();
function clearInput() {
  controls.resetInput();
  last = 0;
}
function unlock() {
  if (document.pointerLockElement === surface.value) document.exitPointerLock();
}
function exitStory() {
  clearInput();
  unlock();
  router.replace('/StartScreen');
}
function reset() {
  clearInput();
  unlock();
  animation.dispose();
  bag.value = false;
  Object.assign(game, createStorySession());
  controls = motion();
  animation = animate();
  view.value = controls.view;
}
function toggleBag() {
  clearInput();
  unlock();
  bag.value = !bag.value;
}
function strike(id = 'strike') {
  if (bag.value || !attack(game, id)) return;
  if (id === 'strike') animation.combo();
  else animation.playOnce(PLAYER_SKILL_CLIP);
}
function keyDown(event) {
  if (
    event.defaultPrevented ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.isComposing ||
    event.target?.closest?.('input,select,textarea,[contenteditable="true"]')
  )
    return;
  const code = event.code;
  if (code === 'Escape') {
    event.preventDefault();
    if (bag.value) toggleBag();
    else exitStory();
    return;
  }
  if (code === 'Tab') {
    event.preventDefault();
    if (!event.repeat) toggleBag();
    return;
  }
  if (bag.value || game.phase !== 'playing') return;
  if (controls.down(code, event.repeat)) {
    event.preventDefault();
    return;
  }
  if (event.repeat) return;
  if (code === 'KeyV') {
    event.preventDefault();
    view.value = controls.cycle();
    if (view.value === 'top') unlock();
  }
  if (code === 'KeyF') talkToMerchant(game);
  if (code === 'KeyE' || code === 'KeyR') strike(code === 'KeyE' ? 'heavy' : 'sweep');
}
function keyUp(event) {
  controls.up(event.code);
}
function pointerDown(event) {
  if (event.target.closest('button,.story-bag,.outcome') || bag.value || game.phase !== 'playing')
    return;
  surface.value.focus();
  if (event.button !== 0) return;
  event.preventDefault();
  if (view.value !== 'top' && !document.pointerLockElement)
    surface.value.requestPointerLock?.()?.catch?.(() => {});
  strike();
}
function pointerMove(event) {
  if (!bag.value && game.phase === 'playing')
    controls.pointerMove(
      event,
      surface.value?.getBoundingClientRect(),
      document.pointerLockElement === surface.value
    );
}
function wheel(event) {
  if (!bag.value) controls.zoom(event.deltaY);
}
function tick(time) {
  if (!mounted) return;
  frame = requestAnimationFrame(tick);
  if (document.hidden) {
    last = 0;
    return;
  }
  const dt = last ? Math.min((time - last) / 1000, 0.1) : 0;
  last = time;
  if (!bag.value && game.phase === 'playing') {
    controls.step(dt);
    advanceStory(game, dt);
    animation.update(game.player.motion);
  }
  if (stage && (!lastDraw || time - lastDraw >= 1000 / 30)) {
    stage.draw(lastDraw ? Math.min((time - lastDraw) / 1000, 0.1) : 0, controls.pose());
    lastDraw = time;
  }
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
  } catch (error) {
    console.warn('剧情 3D 视口不可用', error);
    dropStage();
  }
});
onBeforeUnmount(() => {
  mounted = false;
  cancelAnimationFrame(frame);
  unlock();
  animation.dispose();
  window.removeEventListener('keydown', keyDown);
  window.removeEventListener('keyup', keyUp);
  window.removeEventListener('blur', clearInput);
  document.removeEventListener('visibilitychange', clearInput);
  dropStage();
});
</script>

<template>
  <main
    ref="surface"
    class="story-world-viewport"
    aria-label="剧情模式"
    tabindex="0"
    data-story-viewport
    @pointerdown="pointerDown"
    @pointermove="pointerMove"
    @pointerleave="controls.clearPointer()"
    @wheel.prevent="wheel"
    @contextmenu.prevent
  >
    <div ref="stageHost" class="stage" />
    <svg v-if="!hasStage" class="field" viewBox="-34 -46 68 92" aria-label="主世界战术地图">
      <defs>
        <pattern id="story-grid" width="4" height="4" patternUnits="userSpaceOnUse">
          <path d="M4 0H0V4" fill="none" stroke="#3e5d55" stroke-width=".09" />
        </pattern>
      </defs>
      <rect
        :x="-LEVEL.width / 2"
        :y="-LEVEL.depth / 2"
        :width="LEVEL.width"
        :height="LEVEL.depth"
        fill="url(#story-grid)"
        stroke="#69847c"
        stroke-width=".15"
      />
      <g
        v-for="e in game.enemies.filter((enemy) => enemy.hp > 0)"
        :key="e.id"
        :transform="`translate(${-e.x} ${-e.z})`"
      >
        <circle :r="e.size / 2" :fill="e.id === 'boss' ? '#ec785a' : '#d6ab6a'" />
        <text y="-2.3">{{ e.name }} · {{ e.hp }}</text>
      </g>
      <g :transform="`translate(${-MERCHANT.x} ${-MERCHANT.z})`">
        <circle r=".8" fill="#94beef" />
        <text y="-1.3">商人</text>
      </g>
      <g
        :transform="`translate(${-game.player.x} ${-game.player.z}) rotate(${(-game.player.yaw * 180) / Math.PI})`"
      >
        <path d="M0 -1.4L.8 .9L0 .6L-.8 .9Z" fill="#80ffe2" />
      </g>
    </svg>
    <StoryHud
      v-show="!bag"
      :game="game"
      :view-label="VIEW_LABELS[view]"
      @skill="strike"
      @bag="toggleBag"
      @exit="exitStory"
    />
    <StoryBag v-if="bag" :game="game" @close="toggleBag" />
    <section v-if="!bag && game.phase !== 'playing'" class="outcome">
      <article>
        <small>山门神殿</small>
        <h2>{{ game.phase === 'victory' ? '守门巨兽已击败' : '挑战结束' }}</h2>
        <p>{{ game.message }}</p>
        <button @click="reset">再玩一局</button>
        <button @click="exitStory">返回启动页</button>
      </article>
    </section>
  </main>
</template>
<style scoped>
.story-world-viewport {
  /* —— 颜色 —— */
  --c-paper: #e8ede3;
  --c-paper-dim: #8d9e85;
  --c-gold: #b3995d;
  --c-gold-dim: #4d4024;
  --c-gold-bright: #e6d5a7;
  --c-cinnabar: #c24133;
  --c-cinnabar-bright: #e0523b;
  --c-bronze: #689f38;
  --c-bronze-dim: #2c4a3c;

  /* —— 结构 —— */
  --gold-line: rgba(179, 153, 93, 0.42);
  --gold-line-soft: rgba(179, 153, 93, 0.22);
  --panel-a: 0.88;
  --pattern: rgba(232, 237, 227, 0.08);
  --haze: 0.12;
  --cut: 14px;
  --edge: 2px;
  --shape: polygon(
    var(--cut) 0,
    100% 0,
    100% calc(100% - var(--cut)),
    calc(100% - var(--cut)) 100%,
    0 100%,
    0 var(--cut)
  );
  --font-serif:
    'Noto Serif SC', 'Source Han Serif SC', 'Source Han Serif CN', 'Songti SC', 'STSong', 'SimSun',
    serif;
  --font-brush:
    'LXGW WenKai', '霞鹜文楷', 'Kaiti SC', 'STKaiti', 'KaiTi', '楷体', var(--font-serif);

  position: fixed;
  inset: 0;
  overflow: hidden;
  outline: none;
  background: transparent;
  color: var(--c-paper);
  font-family: var(--font-serif);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.stage,
.field {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.stage :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
.field text {
  text-anchor: middle;
  fill: var(--c-text-main);
  font-size: 1.15px;
  paint-order: stroke;
  stroke: var(--c-bg);
  stroke-width: 0.25px;
}
.outcome {
  position: absolute;
  inset: 0;
  z-index: 11;
  display: grid;
  place-items: center;
  background: #0c120eaa;
}
.outcome article {
  padding: 28px 40px;
  background: var(--c-panel-bg, #181f19);
  border: 1px solid var(--c-gold);
  color: var(--c-text-main);
}
.outcome button {
  border: 1px solid var(--c-gold);
  padding: 4px 12px;
  margin: 8px 4px 0;
}
</style>
