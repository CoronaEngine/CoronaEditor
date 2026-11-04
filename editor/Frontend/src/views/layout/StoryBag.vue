<script setup>
import { computed, ref, onMounted } from 'vue';
import HERO_FIGURE from '@/assets/hero-figure.png';
import { BAG_TABS, GEAR_SLOTS, ITEMS, itemIcon } from '../../story/art.mjs';
import { EQUIPMENT, useItem } from '../../story/session.mjs';
import './StoryWorld.bag.css';
const props = defineProps({ game: Object });
defineEmits(['close']);
const tab = ref('all'),
  selected = ref(Object.keys(props.game.inventory).find((id) => props.game.inventory[id] > 0));
const equipped = computed(() =>
  Object.fromEntries(Object.entries(props.game.equipped).map(([s, id]) => [s, ITEMS[id]]))
);
const owned = computed(() =>
  Object.entries(props.game.inventory)
    .filter(([id, n]) => n > 0 && ITEMS[id])
    .map(([id, qty]) => ({ ...ITEMS[id], qty }))
);
const tabCount = (cat) => owned.value.filter((item) => cat === 'all' || item.cat === cat).length;
const cells = computed(() => {
  const list = owned.value.filter((item) => tab.value === 'all' || item.cat === tab.value);
  return Array.from({ length: Math.max(24, list.length) }, (_, index) => ({
    index,
    item: list[index],
    filled: !!list[index],
  }));
});
const attributes = computed(() =>
  Object.values(props.game.equipped).reduce(
    (a, id) => ({
      atk: a.atk + (EQUIPMENT[id]?.attack || 0),
      def: a.def + (EQUIPMENT[id]?.armor || 0),
    }),
    { atk: 20, def: 0 }
  )
);
const detail = computed(() => {
  const item = ITEMS[selected.value];
  if (!item) return null;
  const worn = props.game.equipped[item.slot] === item.u;
  return {
    item,
    typeLine: item.type,
    rarity: { rare: '稀有', epic: '史诗', legend: '传说', common: '普通' }[item.rarity] || '珍品',
    flavor: item.flavor || item.name,
    stats: item.stats || [],
    preview: itemIcon(item),
    actions:
      worn || props.game.inventory[item.u] > 0
        ? [{ label: worn ? '卸下' : item.slot ? '装备' : '服用' }]
        : [],
  };
});
const panel = ref(null);
onMounted(() => panel.value?.querySelector('.closeBtn')?.focus());
function navigate(event) {
  const steps = {ArrowLeft:-1, ArrowRight:1, ArrowUp:-5, ArrowDown:5};
  if (!(event.code in steps) && event.code !== 'Home' && event.code !== 'End') return;
  const slots = [...panel.value.querySelectorAll('.inventory-slot:not(:disabled)')];
  if (!slots.length) return;
  event.preventDefault();
  const active = slots.indexOf(document.activeElement);
  const index = event.code === 'Home' ? 0 : event.code === 'End' ? slots.length-1 :
    active < 0 ? 0 : active + steps[event.code];
  if (index < 0) panel.value.querySelector('.closeBtn')?.focus();
  else slots[Math.min(index,slots.length-1)]?.focus();
}
function select(id) {
  if (id) selected.value = id;
}
function act(id) {
  const item = ITEMS[id];
  if (!item) return;
  if (item.slot && props.game.equipped[item.slot] === id) {
    delete props.game.equipped[item.slot];
    props.game.inventory[id] = (props.game.inventory[id] || 0) + 1;
  } else useItem(props.game, id);
}
</script>
<template>
  <div ref="panel" class="story-bag" @keydown="navigate" role="dialog" aria-label="行囊" @pointerdown.stop @wheel.stop>
    <div class="bagStage">
      <section class="bag symphony-panel">
        <div class="bag__body">
          <!-- 顶栏 -->
          <header class="bag__head">
            <div class="bag__seal">
              <svg viewBox="0 0 24 24">
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <circle cx="12" cy="12" r="4" />
              </svg>
            </div>
            <div class="bag__title-wrap">
              <h1 class="bag__title">背包</h1>
            </div>
            <div class="bag__headline"></div>
            <div class="purse" title="荒野代币">
              <span class="purse__coin"></span>
              <span class="purse__num">0</span>
            </div>
            <button
              type="button"
              class="closeBtn"
              data-inventory-close
              title="关闭 (Esc)"
              aria-label="关闭行囊"
              @click="$emit('close')"
            >
              ✕
            </button>
          </header>

          <!-- 优化后的主体网格布局 -->
          <div class="bag__cols main-bag-cols">
            <!-- 左上：武装编成与人偶 -->
            <div class="colL">
              <div class="dollWrap">
                <div class="doll">
                  <div class="figure" title="机体投影">
                    <img :src="HERO_FIGURE" alt="" aria-hidden="true" draggable="false" />
                  </div>

                  <button
                    v-for="slot in GEAR_SLOTS"
                    :key="slot.id"
                    type="button"
                    class="eslot hint-anchor"
                    :data-slot="slot.id"
                    :title="slot.name"
                    :class="{
                      has: Boolean(equipped[slot.id]),
                      'is-sel': equipped[slot.id] && equipped[slot.id].u === selected,
                      ['r-' + (equipped[slot.id]?.rarity || 'common')]: true,
                    }"
                    :aria-label="
                      equipped[slot.id]
                        ? `${slot.name}：${equipped[slot.id].name}`
                        : `${slot.name}（空）`
                    "
                    @click="select(equipped[slot.id]?.u)"
                    @dblclick="act(equipped[slot.id]?.u)"
                  >
                    <span class="eslot__ph">{{ slot.name }}</span>
                    <span
                      v-if="equipped[slot.id]"
                      class="icon"
                      aria-hidden="true"
                      v-html="itemIcon(equipped[slot.id])"
                    />
                  </button>
                </div>

                <div class="hero-stats">
                  <div class="hstat">
                    <span class="hstat-name">战力值</span>
                    <span class="hstat-val">{{ attributes.atk }}</span>
                  </div>
                  <div class="hstat">
                    <span class="hstat-name">防御值</span>
                    <span class="hstat-val">{{ attributes.def }}</span>
                  </div>
                  <div class="hstat">
                    <span class="hstat-name">暴击率</span>
                    <span class="hstat-val">{{ 0 }}%</span>
                  </div>
                  <div class="hstat">
                    <span class="hstat-name">耐久值</span>
                    <span class="hstat-val">{{ game.player.hp }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 右上：物品分类与仓库阵列 -->
            <div class="colR">
              <div class="tabs" role="tablist" aria-label="分类">
                <button
                  v-for="tabItem in BAG_TABS"
                  :key="tabItem.id"
                  type="button"
                  class="tab"
                  role="tab"
                  :aria-selected="tab === tabItem.id ? 'true' : 'false'"
                  @click="tab = tabItem.id"
                >
                  {{ tabItem.name }}
                  <span class="tab__count">{{ tabCount(tabItem.id) }}</span>
                </button>
              </div>
              <div class="gridWrap">
                <div class="grid" role="listbox" aria-label="背包格">
                  <button
                    v-for="cell in cells"
                    :key="cell.index"
                    type="button"
                    class="cell inventory-slot hint-anchor"
                    :class="{
                      has: cell.filled,
                      'is-flow': !cell.filled,
                      'is-sel': cell.filled && selected === cell.item?.u,
                      ['r-' + (cell.item?.rarity || 'common')]: true,
                    }"
                    :disabled="!cell.filled"
                    :tabindex="cell.filled && selected === cell.item?.u ? 0 : -1"
                    :aria-label="
                      cell.item
                        ? `${cell.item.name}，数量 ${cell.item.qty}`
                        : `空格 ${cell.index + 1}`
                    "
                    @click="select(cell.item?.u)"
                    @dblclick="act(cell.item?.u)"
                    @focus="select(cell.item?.u)"
                  >
                    <span
                      v-if="cell.item"
                      class="icon"
                      aria-hidden="true"
                      v-html="itemIcon(cell.item)"
                    />
                    <span v-if="cell.item && cell.item.qty > 1" class="qty">
                      {{ cell.item.qty }}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <!-- 右下：装备详情与属性浮动对比 -->
            <div class="detailWrap">
              <div v-if="detail" class="detail">
                <div class="detail__preview" :class="`r-${detail.item.rarity}`">
                  <span class="icon" aria-hidden="true" v-html="detail.preview" />
                </div>
                <div class="detail__info">
                  <div class="detail__title-row">
                    <h2 class="detail__name">{{ detail.item.name }}</h2>
                    <span class="detail__rarity" :class="`r-${detail.item.rarity}`">
                      {{ detail.rarity }}
                    </span>
                    <span class="detail__type">{{ detail.typeLine }}</span>
                  </div>
                  <div v-if="detail.stats.length" class="detail__stats">
                    <div v-for="pair in detail.stats" :key="pair[0]" class="dstat-item">
                      <span class="dstat-name">{{ pair[0] }}</span>
                      <div class="dstat-val-group">
                        <span class="dstat-curr">{{ pair[1] }}</span>
                      </div>
                    </div>
                  </div>
                  <p class="detail__flavor">“{{ detail.flavor }}”</p>
                  <div class="detail__acts">
                    <button
                      v-for="action in detail.actions"
                      :key="action.label"
                      type="button"
                      class="dbtn"
                      :class="action.ghost ? 'dbtn--ghost' : 'dbtn--primary'"
                      @click="act(detail.item.u)"
                    >
                      {{ action.label }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 底栏 -->
          <footer class="bag__foot">
            <div>
              <span>收纳空间利用率：</span>
              <b>{{ owned.length + ' / 24' }}</b>
            </div>
          </footer>
        </div>
      </section>
    </div>
  </div>
</template>
<style scoped>
.main-bag-cols .detailWrap {
  grid-column: 1/-1;
}
</style>
