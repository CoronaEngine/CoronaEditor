<template>
<div class="relative min-w-[300px] rounded-md border-2 border-[#84a65b] bg-black/70 backdrop-blur-sm">
    <!-- 标题栏 -->
    <div class="titlebar flex items-center w-full cursor-move select-none justify-between rounded-t-md bg-black p-2"
      @mousemove="onDrag" @mouseup="stopDrag" @mouseleave="stopDrag">
      <div class="w-auto whitespace-nowrap font-medium text-white">设置</div>
      <!-- 关闭按钮 -->
      <button @click.stop="closeDock"
        class="rounded px-2 py-1 text-sm text-white transition-colors duration-200 hover:bg-gray-600 bg-gray-700">
        ×
      </button>
    </div>

    <!-- 按钮容器 -->
    <div class="button-group flex flex-col items-center space-y-4 p-4">
      <button 
        @click="emitProVersion"
        class="w-full max-w-xs rounded-md bg-[#5f9dc6]/50 px-6 py-3 font-bold text-black/80 transition-[transform,background-color] duration-200 ease-out hover:scale-[1.03] hover:bg-white/50">
        <p class="text-center text-sm sm:text-base md:text-lg">专业版本</p>
      </button>
      
      <button
        @click="emitFunVersion"
        class="w-full max-w-xs rounded-md bg-[#5f9dc6]/50 px-6 py-3 font-bold text-black/80 transition-[transform,background-color] duration-200 ease-out hover:scale-[1.03] hover:bg-white/50">
        <p class="text-center text-sm sm:text-base md:text-lg">娱乐版本</p>
      </button>
      
      <button
        @click="goToHome"
        class="w-full max-w-xs rounded-md bg-[#5f9dc6]/50 px-6 py-3 font-bold text-black/80 transition-[transform,background-color] duration-200 ease-out hover:scale-[1.03] hover:bg-white/50">
        <p class="text-center text-sm sm:text-base md:text-lg">返回初始页面</p>
      </button>
    </div>
</div>
</template>

<script setup>
    import { ref, onMounted } from 'vue';
    import { useDragResize } from '@/composables/useDragResize';
    import eventBus from '@/utils/eventBus';

    const { stopDrag,onDrag} = useDragResize();
    const showContextMenu = ref(false);

    const emitProVersion = () => {
        removeActors();
        eventBus.emit('version-selected', 'pro');
    }

    const emitFunVersion = () => {
        removeActors();
        eventBus.emit('version-selected', 'fun');
    }

    const closeDock = () => {
    if (window.pyBridge) {
        window.pyBridge.removeDockWidget("SetUp");
    }
    };

    const goToHome = () => {
    if (window.pyBridge) {
    window.pyBridge.removeDockWidget("SetUp");
    }
    eventBus.emit('return-to-welcome');
    };

    onMounted(() => {
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
    });
</script>
