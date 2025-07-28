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
        class="setup-button w-full min-w-[200px] max-w-xs rounded-md border border-transparent bg-[#9E9E9E]/50 px-6 py-3 font-bold text-white transition-all duration-300 hover:scale-105 hover:border-[#84a65b] hover:bg-white/50 active:scale-95">
        专业版本
      </button>
      
      <button
        @click="emitFunVersion"
        class="setup-button w-full min-w-[200px] max-w-xs rounded-md border border-transparent bg-[#9E9E9E]/50 px-6 py-3 font-bold text-white transition-all duration-300 hover:scale-105 hover:border-[#84a65b] hover:bg-white/50 active:scale-95">
        娱乐版本
      </button>
      
      <button
        @click="removeActors"
        class="setup-button w-full min-w-[200px] max-w-xs rounded-md border border-transparent bg-[#9E9E9E]/50 px-6 py-3 font-bold text-white transition-all duration-300 hover:scale-105 hover:border-[#84a65b] hover:bg-white/50 active:scale-95">
        返回初始页面
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
