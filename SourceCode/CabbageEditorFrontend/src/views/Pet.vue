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

// 拖拽状态管理
const dragState = ref({
  isDragging: false,
  isResizing: false,
  offsetX: 0,
  offsetY: 0,
  startWidth: 0,
  startHeight: 0,
  startX: 0,
  startY: 0
});

// 拖拽相关
const startDrag = (event) => {
  if (event.button !== 0) return;
  dragState.value.isDragging = true;
  dragState.value.startX = event.clientX;
  dragState.value.startY = event.clientY;
  
  // 移除获取位置的代码
  event.currentTarget.classList.add('bg-[#7BA590]/80');
  event.preventDefault();
};

const onDrag = (event) => {
  if (!dragState.value.isDragging) return;
  
  const deltaX = event.clientX - dragState.value.startX;
  const deltaY = event.clientY - dragState.value.startY;
  
  if (window.pyBridge) {
    window.pyBridge.forwardDockEvent('drag', JSON.stringify({
      deltaX,
      deltaY
    }));
  }
  
  dragState.value.startX = event.clientX;
  dragState.value.startY = event.clientY;
  event.preventDefault();
};

const stopDrag = (event) => {
  if (!dragState.value.isDragging) return;

  dragState.value.isDragging = false;
  dragState.value.startX = 0;
  dragState.value.startY = 0;

  event.currentTarget.classList.remove('bg-[#7BA590]/80');
  event.preventDefault();
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