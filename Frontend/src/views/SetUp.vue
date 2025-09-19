<template>
<div class="relative min-w-[300px] rounded-md border-2 border-[#84a65b] bg-black/70">
    <!-- 标题栏 -->
    <div class="titlebar flex items-center w-full cursor-move select-none justify-between rounded-t-md bg-black p-2">
      <div class="w-auto whitespace-nowrap font-medium text-white">设置</div>
      <!-- 关闭按钮 -->
      <button @click.stop="closeDock"
        class="rounded px-2 py-1 text-sm text-white transition-colors duration-200 hover:bg-gray-600 bg-gray-700">
        ×
      </button>
    </div>

    <!-- 按钮容器 -->
    <div class="button-group flex flex-col items-center space-y-4 p-4">
      <!--<button 
        @click="emitProVersion"
         class="w-full max-w-xs rounded-md bg-[#5f9dc6]/50 px-6 py-3 font-bold text-black/80 hover:bg-[#5f9dc6]/70">
        <p class="text-center text-sm sm:text-base md:text-lg">专业版本</p>
      </button>
      <button
        @click="emitFunVersion"
        class="w-full max-w-xs rounded-md bg-[#5f9dc6]/50 px-6 py-3 font-bold text-black/80 hover:bg-[#5f9dc6]/70">
        <p class="text-center text-sm sm:text-base md:text-lg">娱乐版本</p>
      </button>-->
      <button
        @click.stop="Archive"
        class="w-full max-w-xs rounded-md bg-[#5f9dc6]/50 px-6 py-3 font-bold text-black/80 hover:bg-[#5f9dc6]/70">
        <p class="text-center text-sm sm:text-base md:text-lg">存档</p>
      </button>
      <button
        @click="goWelcome"
        class="w-full max-w-xs rounded-md bg-[#5f9dc6]/50 px-6 py-3 font-bold text-black/80 hover:bg-[#5f9dc6]/70">
        <p class="text-center text-sm sm:text-base md:text-lg">返回初始页面</p>
      </button>
      <button
        @click.stop="Out"
        class="w-full max-w-xs rounded-md bg-[#5f9dc6]/50 px-6 py-3 font-bold text-black/80 hover:bg-[#5f9dc6]/70">
        <p class="text-center text-sm sm:text-base md:text-lg">退出引擎</p>
      </button>
    </div>
</div>
</template>

<script setup>
    import { ref, onMounted, onUnmounted } from 'vue';
    import { useDragResize } from '@/composables/useDragResize';
    import eventBus from '@/utils/eventBus';
    import { useRouter } from 'vue-router';

    const router = useRouter();
    const { stopDrag,onDrag} = useDragResize();
    const showContextMenu = ref(false);
    const sceneImages = ref([]);

    const emitProVersion = () => {
        eventBus.emit('version-selected', 'pro');
    }

    const emitFunVersion = () => {
        eventBus.emit('version-selected', 'fun');
    }

    const closeDock = () => {
    if (window.pyBridge) {
        window.pyBridge.removeDockWidget("SetUp");
    }
    };

    const Archive = () => {
      if (window.pyBridge && window.pyBridge.sceneSave) {
        const sceneData = {
          actors: sceneImages.value.map(scene => ({
            name: scene.name,
            path: scene.path,
          }))
        };
        window.pyBridge.sceneSave(JSON.stringify(sceneData));
      };
      window.pyBridge.send_message_to_main("go_home", "");
      window.pyBridge.removeDockWidget("Pet");
      window.pyBridge.removeDockWidget("AITalkBar");
      window.pyBridge.removeDockWidget("Object");
      window.pyBridge.removeDockWidget("SceneBar");
      window.pyBridge.removeDockWidget("SetUp");
    }

  const handleDockEvent = (event_type, event_data) => {
  if (event_type === 'actorCreated') {
    try {
      const data = JSON.parse(event_data);
      // 使用后端返回的数据创建场景项
      sceneImages.value.push({
        name: data.name,         // 使用返回的名称
        path: data.path,         // 使用返回的完整路径
        type: 'obj'
      });
    } catch (error) {
      console.error('处理Actor创建响应失败:', error);
    }
  } else if (event_type === 'sceneLoaded') {
    try {
      const data = JSON.parse(event_data);
      if (data.actors && Array.isArray(data.actors)) {
        sceneImages.value = data.actors.map(actor => ({
          name: actor.path.split('/').pop().split('.')[0], 
          path: actor.path,
          type: 'obj'
        }));
      }
    } catch (error) {
      console.error('处理场景加载响应失败:', error);
    }
  } else if (event_type === 'message'){
    print(event_data)
  }
};

    const goWelcome = () => {
      window.pyBridge.send_message_to_main("go_home", "");
      window.pyBridge.removeDockWidget("Pet");
      window.pyBridge.removeDockWidget("AITalkBar");
      window.pyBridge.removeDockWidget("Object");
      window.pyBridge.removeDockWidget("SceneBar");
      window.pyBridge.removeDockWidget("SetUp");
    };

    const Out = () => {
    if (window.pyBridge) {
        window.pyBridge.closeprocess();
    } else {
        console.error("Python SendMessageToDock 未连接！");
    }
}

    onMounted(() => {
      document.addEventListener('mousemove', onDrag);
      document.addEventListener('mouseup', stopDrag);
      if (window.pyBridge) {
      window.pyBridge.dock_event.connect(handleDockEvent);
      };
    });

    onUnmounted(() => {
    if (window.pyBridge) {
      window.pyBridge.dockEvent.disconnect(handleDockEvent);
    };
  });
</script>
