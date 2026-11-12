<template>
  <div v-if="active && nodeCount > 0">
    <!-- A row-shaped toggle instead of a nested menu: the actor row stays a single
         row, and the detail (node list + local transform) exists only while open.
         Styling follows the scene dock rows so the section reads as part of it. -->
    <div
      class="group flex items-center gap-1 py-0.5 pr-2 pl-[18px] hover:bg-[#2b362d]/50 cursor-pointer border-l-2 border-transparent hover:border-[#b3995d]"
      :class="{ 'text-[#e8ede3]': detailOpen }"
      :title="detailOpen ? '收起模型节点' : '展开模型节点'"
      data-testid="model-node-tag"
      @click="toggleDetail"
    >
      <span class="w-3 text-center text-[10px] leading-none text-[#8d9e85]">
        {{ detailOpen ? '▾' : '▸' }}
      </span>
      <span class="text-[10px] leading-none text-[#c9b987] truncate flex-1">
        模型节点 {{ nodeCount }}
      </span>
    </div>

    <template v-if="detailOpen">
      <div v-if="loading && !flatRows.length" class="px-2 py-1 text-[10px] text-[#777]">
        正在读取节点…
      </div>
      <div v-else-if="!flatRows.length" class="px-2 py-1 text-[10px] text-[#777]">
        没有可编辑的模型节点
      </div>
      <div v-else ref="scrollElement" class="model-node-list" @scroll="onScroll">
        <div :style="{ height: `${flatRows.length * rowHeight}px` }">
          <div :style="{ transform: `translateY(${windowed.topSpacer}px)` }">
            <template v-for="row in renderedRows" :key="rowKey(row)">
              <button
                v-if="row.kind === 'more'"
                class="group flex w-full items-center border-0 border-l-2 border-transparent bg-transparent py-0.5 pr-2 text-left hover:bg-[#2b362d]/50 hover:border-[#b3995d] cursor-pointer"
                :style="{ paddingLeft: `${(row.depth + 1) * 12 + 18}px` }"
                @click="loadMore(row.parentKey)"
              >
                <span class="text-[10px] leading-none text-[#8ab4f8]">加载更多…</span>
              </button>
              <div
                v-else
                class="group flex items-center border-l-2 border-transparent py-0.5 pr-2 hover:bg-[#2b362d]/50 hover:border-[#b3995d] cursor-pointer"
                :class="{
                  'bg-[#4b391c]/60': isSelected(row.node),
                  'opacity-50': !row.node.effective_visible,
                }"
                :style="{ paddingLeft: `${(row.depth + 1) * 12 + 18}px` }"
                @click="select(row.node)"
              >
                <button
                  v-if="Number(row.node.child_count) > 0"
                  class="w-3 border-0 bg-transparent text-center text-[10px] leading-none text-[#8d9e85] hover:text-[#b3995d] cursor-pointer"
                  @click.stop="toggleExpanded(row.node)"
                >
                  {{ expanded.has(Number(row.node.node_index)) ? '⌄' : '›' }}
                </button>
                <span v-else class="w-3 text-center text-[10px] leading-none text-[#6f7f69]">·</span>
                <span class="ml-1 text-xs text-[#e8ede3] truncate flex-1" :title="row.node.name">
                  {{ row.node.name || `节点 ${row.node.node_index}` }}
                </span>
                <button
                  class="w-4 border-0 bg-transparent text-[10px] leading-none text-[#888] hover:text-[#b3995d] cursor-pointer"
                  :title="row.node.visible ? '隐藏' : '显示'"
                  @click.stop="toggleVisibility(row.node)"
                >
                  {{ row.node.visible ? '◉' : '○' }}
                </button>
              </div>
            </template>
          </div>
        </div>
      </div>

      <div v-if="selectedNode" class="border-t border-[#18221a] px-2 pb-2 pt-1">
        <div class="text-[10px] text-[#8d9e85]">局部变换</div>
        <label v-for="field in fields" :key="field.key" class="mt-1 flex items-center gap-1">
          <span class="w-6 text-[10px] text-[#8d9e85]">{{ field.label }}</span>
          <span v-for="(value, axis) in selectedNode[field.key]" :key="axis" class="flex-1">
            <input
              v-model.number="selectedNode[field.key][axis]"
              type="number"
              :step="field.step"
              class="w-full rounded-sm border border-[#3a3a3a] bg-[#262626] px-1 py-0.5 text-[10px] text-[#ddd]"
              @change="save(field.key)"
            />
          </span>
        </label>
      </div>
    </template>
  </div>
</template>
<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { editorApi } from '@/api/editorApi.js';
import { createViewLifetime } from '@/utils/viewLifetime.js';
import {
  flattenLoadedNodes,
  MODEL_NODE_DISPLAY_MAX_SKIP,
  resolveModelNodeDisplayParent,
  virtualNodeWindow,
} from '@/utils/modelHierarchy.js';

const props = defineProps({ active: Boolean, sceneName: String, actor: Object, selection: Object });
const emit = defineEmits(['select']);
const viewLifetime = createViewLifetime();

const pageSize = 100;
const rowHeight = 28;
const fields = [
  { key: 'position', label: '位置', step: 0.1 },
  { key: 'rotation', label: '旋转', step: 1 },
  { key: 'scale', label: '缩放', step: 0.05 },
];

const scrollElement = ref(null);
const pages = ref({});
const expanded = ref(new Set());
const loading = ref(false);
const detailOpen = ref(false);
// Children of this node are the top level, so a synthetic "root" container never
// shows up as a one-row menu above the model's real nodes.
const displayRoot = ref(-1);
const scrollTop = ref(0);
const viewportHeight = ref(280);
let request = 0;
let resizeObserver;
let mutationChain = Promise.resolve();

const actorName = computed(() => props.actor?.name || '');
const actorGuid = computed(() => props.actor?.actor_guid || '');
const archiveSession = computed(() => props.actor?.archive_session || '');
const actorIdentity = () => ({ archive_session: archiveSession.value, scene: props.sceneName, actor_guid: actorGuid.value });
const isCurrentActor = (identity) => viewLifetime.current() && identity.archive_session === archiveSession.value
  && identity.scene === props.sceneName && identity.actor_guid === actorGuid.value;
const actorVersion = ref(Number(props.actor?.actor_version || 1));
const nodeCount = computed(() => Number(props.actor?.model_node_count || 0));
const rootKey = computed(() => String(displayRoot.value));
const flatRows = computed(() => flattenLoadedNodes(pages.value, expanded.value, rootKey.value));
const windowed = computed(() =>
  virtualNodeWindow(flatRows.value, scrollTop.value, viewportHeight.value, rowHeight)
);
const renderedRows = computed(() => flatRows.value.slice(windowed.value.start, windowed.value.end));
const selectedNode = computed(
  () => flatRows.value.find((row) => row.node && isSelected(row.node))?.node || null
);

const pageKey = (parentIndex) => String(parentIndex);
const rowKey = (row) =>
  row.kind === 'more' ? `more-${row.parentKey}` : `node-${row.node.node_index}`;
const isSelected = (node) =>
  Number(node.node_index) === Number(props.selection?.nodeIndex) &&
  props.selection?.actorName === actorName.value;

const persistNodePatch = (node, patch) => {
  if (!viewLifetime.current()) return Promise.resolve(null);
  const identity = {
    ...actorIdentity(),
    node_index: Number(node.node_index),
  };
  const operation = mutationChain.then(async () => {
    if (!viewLifetime.current()) return null;
    if (!isCurrentActor(identity)) {
      throw new Error('Model node edit belongs to an inactive Actor');
    }
    const data = await editorApi.scene.setModelNodeState({
      ...identity,
      expected_actor_version: actorVersion.value,
    }, patch);
    if (!isCurrentActor(identity)) return null;
    actorVersion.value = Number(data.actor_version || actorVersion.value);
    // Any read that started before this write would describe the old node, and the page
    // map is replaced wholesale, so retire those reads now instead of letting one land
    // after the patch and undo it.
    request += 1;
    return data;
  });
  mutationChain = operation.catch(() => {});
  return operation;
};

const loadPage = async (parentIndex, offset = 0) => {
  if (!viewLifetime.current() || !actorName.value) return null;
  const identity = actorIdentity();
  const key = pageKey(parentIndex);
  if (pages.value[key]?.loading) return null;
  const token = ++request;
  pages.value = { ...pages.value, [key]: { ...(pages.value[key] || {}), loading: true } };
  loading.value = true;
  try {
    const data = await editorApi.scene.readModelNodes(props.sceneName, {
      archive_session: archiveSession.value,
      actor_guid: actorGuid.value,
      parent_index: parentIndex,
      offset,
      limit: pageSize,
    });
    const replyVersion = Number(data.actor_version);
    const stale = Number.isFinite(replyVersion) && replyVersion > 0 && replyVersion < actorVersion.value;
    if (token !== request || stale || !isCurrentActor(identity)) return null;
    const previous = pages.value[key]?.items || [];
    const incoming = Array.isArray(data.nodes) ? data.nodes : [];
    const page = {
      items: offset ? [...previous, ...incoming] : incoming,
      has_more: data.has_more === true,
      next_offset: Number(data.next_offset || 0),
      loading: false,
    };
    actorVersion.value = Number(data.actor_version || actorVersion.value);
    pages.value = { ...pages.value, [key]: page };
    return page;
  } catch {
    if (token === request && isCurrentActor(identity)) {
      pages.value = { ...pages.value, [key]: { ...(pages.value[key] || {}), loading: false } };
    }
    return null;
  } finally {
    if (token === request && isCurrentActor(identity)) loading.value = false;
  }
};

// Walks past the importer's synthetic containers so the model's nodes are the top level.
const loadDisplayRoot = async () => {
  if (!viewLifetime.current()) return;
  const identity = actorIdentity();
  let parent = -1;
  for (let depth = 0; depth <= MODEL_NODE_DISPLAY_MAX_SKIP; depth += 1) {
    const token = request + 1;
    const page = await loadPage(parent, 0);
    if (!isCurrentActor(identity) || token !== request) return;
    if (!page) break;
    const next = resolveModelNodeDisplayParent(page, depth);
    if (next < 0) break;
    parent = next;
  }
  displayRoot.value = parent;
};

const reset = () => {
  if (!viewLifetime.current()) return;
  request += 1;
  pages.value = {};
  expanded.value = new Set();
  displayRoot.value = -1;
  scrollTop.value = 0;
};

const refresh = async () => {
  if (!viewLifetime.current()) return;
  reset();
  if (!detailOpen.value || !props.active || !actorName.value) return;
  await loadDisplayRoot();
};

const toggleDetail = () => {
  if (!viewLifetime.current()) return;
  detailOpen.value = !detailOpen.value;
  if (detailOpen.value) void refresh();
  else reset();
};

const applyNode = (node) => {
  if (!viewLifetime.current() || !node) return;
  const next = {};
  for (const [key, page] of Object.entries(pages.value)) {
    next[key] = {
      ...page,
      items: (page.items || []).map((item) =>
        Number(item.node_index) === Number(node.node_index) ? { ...item, ...node } : item
      ),
    };
  }
  pages.value = next;
};

const toggleExpanded = async (node) => {
  if (!viewLifetime.current()) return;
  const identity = actorIdentity();
  const index = Number(node.node_index);
  const next = new Set(expanded.value);
  if (next.has(index)) {
    next.delete(index);
  } else {
    next.add(index);
    if (!pages.value[pageKey(index)]) await loadPage(index);
  }
  if (isCurrentActor(identity)) expanded.value = next;
};

const loadMore = (parentKeyValue) => {
  const page = pages.value[parentKeyValue];
  return loadPage(Number(parentKeyValue), Number(page?.next_offset || 0));
};

const select = (node) => {
  if (!viewLifetime.current()) return;
  emit('select', {
    actorName: actorName.value,
    nodeIndex: Number(node.node_index),
    node_index: Number(node.node_index),
  });
};

const toggleVisibility = async (node) => {
  if (!viewLifetime.current()) return;
  const identity = actorIdentity();
  const data = await persistNodePatch(node, { visible: !node.visible });
  if (!data || !isCurrentActor(identity)) return;
  const updated = data.nodes?.[0] || node; applyNode(updated); select(updated);
};

const save = async (key) => {
  if (!viewLifetime.current()) return;
  const identity = actorIdentity();
  const node = selectedNode.value;
  if (!node) return;
  const data = await persistNodePatch(node, { [key]: [...node[key]] });
  if (!data || !isCurrentActor(identity)) return;
  applyNode(data.nodes?.[0] || node);
};

const onScroll = (event) => {
  if (!viewLifetime.current()) return;
  scrollTop.value = event.target.scrollTop;
  viewportHeight.value = event.target.clientHeight;
};

watch(
  () => [props.active, props.sceneName, actorName.value, actorGuid.value, archiveSession.value, props.actor?.actor_version],
  () => {
    if (!viewLifetime.current()) return;
    actorVersion.value = Number(props.actor?.actor_version || 1);
    void refresh();
  },
  { immediate: true }
);

// Picking a node in the viewport opens this actor's detail so the row is visible.
watch(
  () => [props.selection?.actorName, props.selection?.nodeIndex],
  () => {
    if (!viewLifetime.current() || !props.active || detailOpen.value) return;
    if (props.selection?.actorName !== actorName.value) return;
    detailOpen.value = true;
    void refresh();
  }
);

onMounted(async () => {
  await nextTick();
  if (!viewLifetime.current()) return;
  if (scrollElement.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      if (!viewLifetime.current()) return;
      viewportHeight.value = scrollElement.value?.clientHeight || 280;
    });
    resizeObserver.observe(scrollElement.value);
  }
});

onUnmounted(() => {
  void viewLifetime.dispose();
  request += 1;
  resizeObserver?.disconnect();
  resizeObserver = null;
});
</script>

<style scoped>
/* Opaque surfaces are not needed here: the scene dock panel behind this section is
   already opaque.  Only the virtual list viewport has to be fixed to scroll. */
.model-node-list {
  height: 260px;
  overflow-y: auto;
  /* The CEF default is a bright white bar, which shouts inside the dock.  This uses
     the same gold-on-black scrollbar as the editor's other dark panels. */
  scrollbar-width: thin;
  scrollbar-color: #4d4024 #14120c;
}

.model-node-list::-webkit-scrollbar {
  width: 8px;
}

.model-node-list::-webkit-scrollbar-track {
  background: #14120c;
}

.model-node-list::-webkit-scrollbar-thumb {
  background: #4d4024;
  border-radius: 999px;
}

.model-node-list::-webkit-scrollbar-thumb:hover {
  background: #a8843f;
}

.model-node-list::-webkit-scrollbar-corner {
  background: #14120c;
}

.model-node-list input[type='number'] {
  appearance: textfield;
}
</style>
