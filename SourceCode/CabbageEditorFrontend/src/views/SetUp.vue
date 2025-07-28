<template>
<div class="bborder-2 border-[#84a65b] rounded-md relative">
    <!-- 标题栏 -->
    <div class="titlebar flex items-center w-full p-2 rounded-t-md justify-between bg-black cursor-move select-none"
      @mousemove="onDrag" @mouseup="stopDrag" @mouseleave="stopDrag">
      <div class="text-white font-medium w-auto whitespace-nowrap">设置</div>
      <!-- 按钮组 -->
      <div class="flex w-full space-x-2 justify-end">
        <button @click.stop="closeDock"
          class="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors duration-200">
          ×
        </button>
      </div>

    <div class="w-full max-w-xs">
    <button 
        @click="emitProVersion"
        class="w-full rounded-none bg-[#9E9E9E]/50 hover:bg-white/50 font-bold py-2 px-4 sm:py-3 sm:px-6 md:py-4 md:px-8 
        transform hover:scale-110 hover:px-9 hover:py-6 hover:w-[110%] origin-center 
        transition-all duration-300 transition-[transform,padding]"
        >专业版本</button>
    </div>
    <div class="w-full max-w-xs">
    <button
        @click="emitFunVersion"
        class="w-full rounded-none bg-[#9E9E9E]/50 hover:bg-white/50 font-bold py-2 px-4 sm:py-3 sm:px-6 md:py-4 md:px-8 
        transform hover:scale-110 hover:px-9 hover:py-6 hover:w-[110%] origin-center 
        transition-all duration-300 transition-[transform,padding]"
        >娱乐版本</button>
    </div>
    <div class="w-full max-w-xs">
    <button
        @click="removeActors"
        class="w-full rounded-none bg-[#9E9E9E]/50 hover:bg-white/50 font-bold py-2 px-4 sm:py-3 sm:px-6 md:py-4 md:px-8 
        transform hover:scale-110 hover:px-9 hover:py-6 hover:w-[110%] origin-center 
        transition-all duration-300 transition-[transform,padding]"
        >返回初始页面</button>
    </div>
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

    const removeActors = () => {
    if (window.pyBridge) {
        window.pyBridge.RemoveActor();
    } else {
        console.error("Python SendMessageToDock 未连接！");
    }
}

    onMounted(() => {
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
    });
</script>