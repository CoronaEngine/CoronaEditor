<template>
  <Teleport to="body">
    <transition name="bubble-pop">
      <div
        v-if="visible"
        ref="bubbleRef"
        class="fixed z-[9999] flex items-start gap-2"
        :style="bubbleStyle"
        @mouseenter="isHovering = true; cancelAutoHide()"
        @mouseleave="isHovering = false; startAutoHide()"
      >
        <!-- Cabbage avatar -->
        <div class="flex-shrink-0 w-8 h-8 rounded-full bg-green-400 border-2 border-green-600 overflow-hidden shadow-md">
          <img
            src="@/assets/cabbage.png"
            class="w-full h-full object-cover"
            alt="cabbage"
          />
        </div>

        <!-- Bubble -->
        <div class="relative max-w-[220px] bg-gradient-to-br from-green-50 to-green-100 text-gray-800 px-3 py-2 rounded-2xl rounded-tl-sm shadow-lg border border-green-200">
          <!-- Hint text -->
          <p class="text-sm leading-relaxed">{{ hintText }}</p>

          <!-- Auto-hide progress bar -->
          <div class="mt-1.5 h-0.5 bg-green-200 rounded-full overflow-hidden">
            <div
              class="h-full bg-green-400 rounded-full transition-all"
              :style="{ width: progressPercent + '%' }"
            ></div>
          </div>

          <!-- Close button -->
          <button
            class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white rounded-full shadow border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors"
            @click.stop="dismiss"
          >
            <span class="text-xs text-gray-400 leading-none">x</span>
          </button>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, onUnmounted, watch, nextTick } from 'vue';
import { createViewLifetime } from '@/utils/viewLifetime.js';

const props = defineProps({
  show: { type: Boolean, default: false },
  hintText: { type: String, default: '' },
  anchorEl: { type: Object, default: null },
  autoHideMs: { type: Number, default: 6000 },
});

const emit = defineEmits(['close']);
const bubbleRef = ref(null);
const visible = ref(false);
const dismissRequested = ref(false);
const isHovering = ref(false);
const progressPercent = ref(100);

let hideTimer = null;
let progressTimer = null;
let progressStart = 0;
let closeTimer = null;
let showVersion = 0;
let autoHideVersion = 0;
const viewLifetime = createViewLifetime();
const currentHint = version => viewLifetime.current() && props.show && version === showVersion;

const bubbleStyle = computed(() => {
  const pos = calcPosition();
  return {
    left: pos.x + 'px',
    top: pos.y + 'px',
  };
});

const calcPosition = () => {
  const anchor = props.anchorEl;
  if (anchor) {
    const rect = anchor.getBoundingClientRect();
    let x = rect.left - 220;
    let y = rect.top - 10;

    if (x < 10) x = rect.right + 10;
    if (y < 10) y = 10;
    if (y + 80 > window.innerHeight) y = window.innerHeight - 90;

    return { x, y };
  }

  // Default: bottom-left area
  return { x: 80, y: window.innerHeight - 160 };
};

const startAutoHide = () => {
  if (!viewLifetime.current() || !props.show || !visible.value || dismissRequested.value || isHovering.value) return;
  cancelAutoHide();
  const version = showVersion;
  const timerVersion = autoHideVersion;
  const current = () => currentHint(version) && timerVersion === autoHideVersion
    && !dismissRequested.value && !isHovering.value;

  progressStart = Date.now();
  progressPercent.value = 100;

  progressTimer = setInterval(() => {
    if (!current()) return;
    const elapsed = Date.now() - progressStart;
    const remaining = Math.max(0, 100 - (elapsed / props.autoHideMs) * 100);
    progressPercent.value = remaining;
  }, 50);

  hideTimer = setTimeout(() => {
    if (!current()) return;
    dismiss();
  }, props.autoHideMs);
};

const cancelAutoHide = () => {
  autoHideVersion++;
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
};

const cancelClose = () => {
  if (closeTimer !== null) clearTimeout(closeTimer);
  closeTimer = null;
};

const dismiss = () => {
  if (!viewLifetime.current() || !props.show || dismissRequested.value) return;
  const version = showVersion;
  dismissRequested.value = true;
  cancelAutoHide();
  visible.value = false;
  // Emit close after leave transition completes (200ms)
  closeTimer = setTimeout(() => {
    if (!currentHint(version) || !dismissRequested.value) return;
    closeTimer = null;
    emit('close');
  }, 220);
};

// Watch for show changes
watch(
  () => [props.show, props.hintText],
  ([val]) => {
    const version = ++showVersion;
    cancelAutoHide();
    cancelClose();
    if (!viewLifetime.current()) return;
    if (val) {
      dismissRequested.value = false;
      nextTick(() => {
        if (!currentHint(version) || dismissRequested.value) return;
        visible.value = true;
        startAutoHide();
      });
    } else {
      visible.value = false;
    }
  },
  { immediate: true }
);

// 当 autoHideMs 改变时（如设置页修改），重启自动隐藏定时器
watch(
  () => props.autoHideMs,
  () => {
    if (visible.value && !dismissRequested.value && !isHovering.value) {
      startAutoHide();
    }
  }
);

onUnmounted(() => {
  void viewLifetime.dispose();
  cancelAutoHide();
  cancelClose();
});
</script>

<style scoped>
.bubble-pop-enter-active {
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.bubble-pop-leave-active {
  transition: all 0.2s ease-in;
}
.bubble-pop-enter-from {
  opacity: 0;
  transform: scale(0.5) translateY(10px);
}
.bubble-pop-leave-to {
  opacity: 0;
  transform: scale(0.8) translateY(-5px);
}
</style>
