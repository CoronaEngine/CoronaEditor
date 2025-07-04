<template>
    <div class="flex h-[50px] w-[50px]">
        <div class="flex w-full h-full">
        <img 
        src="../assets/cabbage3.png" 
        class="h-20 w-20 fixed left-10 bottom-10 cursor-move" 
        @contextmenu="openContextMenu($event)"
        @dblclick="controlAITalkBar"
        @mousedown="startDrag" @mousemove="onDrag" @mouseup="stopDrag" @mouseleave="stopDrag"
        >
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useDragResize } from '@/composables/useDragResize';

const { dragState,startDrag,stopDrag,onDrag} = useDragResize();

// 定义响应式状态变量
const showContextMenu = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);
let isClosingMenu = false;


// 打开快捷栏
const openContextMenu = (e) => {
  e.preventDefault();
  if (showContextMenu.value) {
    if (!isClosingMenu) {
      isClosingMenu = true;
      closeContextMenu();
      // 在一定时间后重置标记，避免影响后续操作
      setTimeout(() => {
        isClosingMenu = false;
      }, 100); 
    }
  } else {
    if (!isClosingMenu) {
      showContextMenu.value = true;
      contextMenuX.value = e.clientX;
      contextMenuY.value = e.clientY;
      const closeOnRightClick = (event) => {
        if (event.button === 2) {
          isClosingMenu = true;
          closeContextMenu();
          document.removeEventListener('mousedown', closeOnRightClick);
          // 在一定时间后重置标记，避免影响后续操作
          setTimeout(() => {
            isClosingMenu = false;
          }, 100); 
        }
      };
      document.addEventListener('mousedown', closeOnRightClick);
    }
  }
};

// 关闭快捷栏
const closeContextMenu = () => {
  showContextMenu.value = false;
};

// 打开AI对话栏
const controlAITalkBar = () => {
  if (window.pyBridge) {
    window.pyBridge.addDockWidget("AITalkBar", "/AITalkBar", "left");
  }
};

onMounted(() => {
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
});

onUnmounted(() => {
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
});
</script>