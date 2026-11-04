<script setup>
import { computed } from 'vue';
import { SKILLS } from '../../story/session.mjs';
import { SKILL_ICON_INNER } from '../../story/art.mjs';
import './StoryWorld.hud.css';
const props = defineProps({ game: Object, viewLabel: String });
defineEmits(['skill', 'bag', 'exit']);
const skillIds = ['heavy', 'sweep'];
const keyOf = (id) => (id === 'heavy' ? 'E' : 'R');
const distance = (e) => Math.hypot(e.x - props.game.player.x, e.z - props.game.player.z);
const boss = computed(() => props.game.enemies[0]);
const bossNearby = computed(() => boss.value.hp > 0 && distance(boss.value) <= 10);
const nearbyMonsterBar = computed(() => {
  const enemy = props.game.enemies
    .slice(1)
    .filter((e) => e.hp > 0 && distance(e) <= 10)
    .sort((a, b) => distance(a) - distance(b))[0];
  return enemy && { ...enemy, max: enemy.maxHp, percent: (100 * enemy.hp) / enemy.maxHp };
});
const remaining = (id) => Math.max(0, (props.game.cooldown[id] || 0) - props.game.elapsed);
const available = (id) =>
  !remaining(id) &&
  props.game.phase === 'playing' &&
  props.game.player.grounded &&
  props.game.player.motion !== 'dodging' &&
  props.game.player.rage >= SKILLS[id].cost;
</script>

<template>
  <div class="story-hud" aria-label="战斗界面">
    <!-- 顶部：首领血条 -->
    <section v-if="bossNearby" class="boss-wrap" aria-label="Boss 血条">
      <div class="boss-header">
        <div class="boss-title">
          <span class="boss-badge">DANGER</span>
          <h2 class="boss-name">荒野巨兽 · 远古聚合体</h2>
        </div>
        <div class="boss-val">
          <b>{{ boss.hp }}</b>
          /
          <span>{{ boss.maxHp }}</span>
        </div>
      </div>
      <div
        class="boss-bar-box"
        role="progressbar"
        aria-label="Boss 生命"
        :aria-valuenow="boss.hp"
        :aria-valuemax="boss.maxHp"
        aria-valuemin="0"
      >
        <div class="boss-bar-lag" :style="{ width: `${(100 * boss.hp) / boss.maxHp}%` }"></div>
        <div class="boss-bar-fill" :style="{ width: `${(100 * boss.hp) / boss.maxHp}%` }"></div>
      </div>
    </section>

    <!-- 中上部：只显示离玩家最近的那只普通怪物，靠近才出现 -->
    <section v-if="nearbyMonsterBar" class="monster-bars" aria-label="附近怪物血条">
      <div class="monster-bar" :data-monster-role="nearbyMonsterBar.id">
        <span class="monster-bar__name">{{ nearbyMonsterBar.name }}</span>
        <span class="monster-bar__hp">{{ nearbyMonsterBar.hp }} / {{ nearbyMonsterBar.max }}</span>
        <div
          class="monster-bar__track"
          role="progressbar"
          :aria-label="`${nearbyMonsterBar.name} 生命`"
          :aria-valuenow="nearbyMonsterBar.hp"
          :aria-valuemax="nearbyMonsterBar.max"
          aria-valuemin="0"
        >
          <div class="monster-bar__lag" :style="{ width: `${nearbyMonsterBar.percent}%` }"></div>
          <div class="monster-bar__fill" :style="{ width: `${nearbyMonsterBar.percent}%` }"></div>
        </div>
      </div>
    </section>

    <!-- 左上角：自然写实风格复合结构 -->
    <div class="vitals-container">
      <div class="soul-frame-group">
        <!-- 原型是「荒野修复剂」，引擎侧对应怒气：满怒即可释放重斩 -->
        <div class="gourd-hub" title="怒气槽 · 满怒可释放重斩">
          <span class="gourd-key">E</span>
          <svg class="gourd-icon" viewBox="0 0 48 48">
            <polygon points="24,4 40,24 24,44 8,24" fill="rgba(230,213,167,.28)" />
            <polygon points="24,4 40,24 24,44 8,24" />
            <circle cx="24" cy="24" r="6" fill="rgba(230,213,167,.5)" />
            <circle cx="24" cy="24" r="6" />
          </svg>
          <span class="gourd-count">{{ game.player.rage }}</span>
        </div>
        <div class="sub-slot-mini" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
          </svg>
        </div>
      </div>

      <div class="vitals-bars">
        <div class="meter-row">
          <div
            class="meter-track meter-hp"
            role="progressbar"
            aria-label="生命"
            :aria-valuenow="game.player.hp"
            :aria-valuemax="100"
            aria-valuemin="0"
          >
            <div class="meter-lag" :style="{ width: game.player.hp + '%' }"></div>
            <div class="meter-fill" :style="{ width: game.player.hp + '%' }"></div>
          </div>
          <span class="meter-label">HP</span>
          <span class="meter-val">{{ game.player.hp }}</span>
        </div>
        <div class="meter-row">
          <div
            class="meter-track meter-sp"
            role="progressbar"
            aria-label="怒气"
            :aria-valuenow="game.player.rage"
            :aria-valuemax="100"
            aria-valuemin="0"
          >
            <div class="meter-lag" :style="{ width: `${game.player.rage}%` }"></div>
            <div class="meter-fill" :style="{ width: `${game.player.rage}%` }"></div>
          </div>
          <span class="meter-label">SP</span>
          <span class="meter-val">{{ game.player.rage }}</span>
        </div>
        <!-- 原型第三条是 EP；引擎暂无该资源，沿用耐力槽的读数以免伪造数值 -->
        <div class="meter-row">
          <div
            class="meter-track meter-mp"
            role="progressbar"
            aria-label="耐力"
            :aria-valuenow="game.player.rage"
            :aria-valuemax="100"
            aria-valuemin="0"
          >
            <div class="meter-lag" :style="{ width: `${game.player.rage}%` }"></div>
            <div class="meter-fill" :style="{ width: `${game.player.rage}%` }"></div>
          </div>
          <span class="meter-label">EP</span>
          <span class="meter-val">{{ game.player.rage }}</span>
        </div>
      </div>
    </div>

    <!-- 右下：气刃槽 + 战技群 -->
    <div class="action-cluster">
      <div class="focus-system">
        <!-- 原型是三层气刃充能；引擎侧用怒气比例点亮 -->
        <div class="focus-blade" aria-hidden="true">
          <div class="focus-orb" :class="{ 'is-lit': game.player.rage >= 33 }"></div>
          <div class="focus-orb" :class="{ 'is-lit': game.player.rage >= 66 }"></div>
          <div class="focus-orb" :class="{ 'is-lit': game.player.rage >= 100 }"></div>
        </div>
        <button
          type="button"
          class="focus-heavy-btn hint-anchor"
          :class="{ 'is-active': available('heavy') }"
          :disabled="!available('heavy')"
          :aria-label="`${'E'} ${SKILLS.heavy.name}，消耗 ${SKILLS.heavy.cost} 怒气`"
          @click.stop="$emit('skill', 'heavy')"
        >
          <svg viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="18" stroke-dasharray="6 6" fill="rgba(230,213,167,.18)" />
            <circle cx="24" cy="24" r="18" stroke-dasharray="6 6" />
            <polygon points="24,10 32,28 16,28" fill="rgba(230,213,167,.4)" />
            <polygon points="24,10 32,28 16,28" />
          </svg>
          <span class="ui-tooltip" role="tooltip">
            {{ SKILLS.heavy.name }} · {{ SKILLS.heavy.cost }} 怒气
          </span>
        </button>
      </div>

      <div class="spells-group">
        <div v-for="id in skillIds" :key="id" class="spell-item">
          <button
            type="button"
            class="spell-btn hint-anchor"
            :data-key="keyOf(id)"
            :class="{ 'is-cd': remaining(id) > 0, unavailable: !available(id) }"
            :style="{ '--cd-deg': `${Math.round((360 * remaining(id)) / SKILLS[id].cooldown)}deg` }"
            :aria-label="`${keyOf(id)} ${SKILLS[id].name}，消耗 ${SKILLS[id].cost} 怒气`"
            @click.stop="$emit('skill', id)"
          >
            <span class="spell-cost">{{ SKILLS[id].cost }}</span>
            <!-- 技能图标：自包含行内 SVG（与器物图标同一套做法，不用 <use>） -->
            <svg
              class="spell-icon"
              viewBox="0 0 48 48"
              v-html="SKILL_ICON_INNER[id === 'heavy' ? 'shield' : 'mirage']"
            />
            <div class="spell-cd-overlay"></div>
            <span class="spell-cd-num">{{ Math.ceil(remaining(id)) || '' }}</span>
            <span class="ui-tooltip" role="tooltip">
              {{ SKILLS[id].name }} · {{ SKILLS[id].cost }} 怒气
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- 世界指示与状态层（原型无此项，沿用同一套面板语言） -->
    <div class="world-indicator" role="status" aria-live="polite">主世界</div>
    <div class="story-bottom-column">
      <div class="story-feedback" role="status">{{ game.message }}</div>
    </div>
    <div class="action-tips">
      <p>
        <kbd>WASD</kbd>
        移动　
        <kbd>鼠标</kbd>
        转向 · 滚轮缩放
      </p>
      <p>
        <kbd>Space</kbd>
        跳远　
        <kbd>Shift</kbd>
        长按跑步 · 点按闪避
      </p>
      <p>
        <kbd>左键</kbd>
        攻击　
        <kbd>E / R</kbd>
        技能　
        <kbd>F</kbd>
        交谈
      </p>
      <p>
        <kbd>V</kbd>
        {{ viewLabel }}　
        <button @click="$emit('bag')">
          <kbd>Tab</kbd>
          背包
        </button>
        <button @click="$emit('exit')">
          <kbd>Esc</kbd>
          退出
        </button>
      </p>
    </div>
  </div>
</template>
<style scoped>
.action-tips button {
  pointer-events: auto;
  background: none;
  border: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
}
</style>
