<template>
  <div class="relative min-h-screen w-full bg-white/5" tabindex="0" @keydown="handleKeyDown" @wheel="handleWheel" >
    <!-- 场景栏 -->
    <div class="w-full bg-[#4b6554]/90 border-b border-gray-200/65 h-10 relative">
      <div class="flex items-center space-x-1 px-2">
        <div v-for="(tab, index) in tabs" :key="index"
          class="px-4 py-2 cursor-pointer rounded-t-lg flex items-center gap-2" :class="{
            'bg-white/65 border-b-2 border-blue-500': activeTab === index,
            'hover:bg-gray-200/65': activeTab !== index
          }" @click="switchTab(index)" @dblclick="openSceneBar(index)">
          {{ tab.name }}
          <button v-if="tabs.length > 1" @click.stop="closeTab(index)" class="hover:bg-gray-300/50 rounded-full p-1">
            ×
          </button>
        </div>

        <button @click="addNewTab" class="px-3 py-1 text-xl font-bold hover:bg-gray-200/50 rounded-lg">
          +
        </button>
        <button @click.stop="Out"
        class="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center bg-transparent hover:bg-gray-600/20 text-black rounded transition-colors duration-200">
        <span class="transform scale-125">×</span>
      </button>
      </div>
    </div>
    <!-- 返回首页按钮 -->
    <button 
      @click="goToHome"
      class="home-button">
      <img 
        src="@/assets/首页的小房子按钮.png" 
        class="home-button-img"
      />
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import "@/assets/welcome-page.css";

const router = useRouter();

const goToHome = () => {
  if (window.pyBridge) {
    window.pyBridge.removeDockWidget("Pet");
  }
  router.push('/');
};

const activeTab = ref(0);  // 当前激活的标签页

const cameraState = ref({
  position: [0.0, 5.0, 10.0],
  forward: [0.0, 1.5, 0.0],
  up: [0.0, -1.0, 0.0],
  fov: 45.0
});

// 标签页数据
const tabs = ref([
  { name: '场景1', id: 'scene1' },
]);

// 添加新标签页
const addNewTab = () => {
  const newIndex = tabs.value.length + 1;
  tabs.value.push({
    name: `场景${newIndex}`,
    id: `scene${newIndex}`
  });
  activeTab.value = tabs.value.length - 1;
};

const handleWheel = (event) => {
  const direction = event.deltaY > 0 ? 'backward' : 'forward';
  handleCameraMove(direction);
};

const handleKeyDown = (event) => {
  event.preventDefault();
  switch(event.key.toLowerCase()) {
    case 'w':
      handleCameraMove('up');
      break;
    case 's':
      handleCameraMove('down');
      break;
    case 'a':
      handleCameraMove('left');
      break;
    case 'd':
      handleCameraMove('right');
      break;
    case 'q':
      handleCameraMove('rotateLeft');
      break;
    case 'e':
      handleCameraMove('rotateRight');
      break;
    case 'escape':
      openSetup();
      break;
  }
};

const handleCameraMove = (direction) => {
  const speed = 0.2;
  const { position, forward } = cameraState.value;
  
  switch(direction) {
    case 'up':
      position[1] += speed;
      break;
    case 'down':
      position[1] -= speed;
      break;
    case 'left':
      position[0] -= speed;
      break;
    case 'right':
      position[0] += speed;
      break;
    case 'forward':
      position[2] -= speed;
      break;
    case 'backward':
      position[2] += speed;
      break;
    case 'rotateRight':
      const angleLeft = Math.PI / 180;
      const [x, z] = forward;
      forward[0] = x * Math.cos(angleLeft) - z * Math.sin(angleLeft);
      forward[2] = x * Math.sin(angleLeft) + z * Math.cos(angleLeft);
      break;
    case 'rotateLeft':
      const angleRight = -Math.PI / 180;
      const [x2, z2] = forward;
      forward[0] = x2 * Math.cos(angleRight) - z2 * Math.sin(angleRight);
      forward[2] = x2 * Math.sin(angleRight) + z2 * Math.cos(angleRight);
      break;
  }

  if (window.pyBridge) {
    window.pyBridge.HandleCameraMove(JSON.stringify({
      sceneName: tabs.value[activeTab.value]?.id || 'scene1',
      position: [...position],
      forward: [...forward],
      up: [...cameraState.value.up],
      fov: cameraState.value.fov
    }));
  }
};

// 调用Esc
const openSetup = () => {
  if (window.pyBridge) {
    window.pyBridge.addDockWidget("SetUp", "/SetUp", "float", "center");
  }
}

// 关闭标签页
const closeTab = (index) => {
  if (tabs.value.length > 1) {
    tabs.value.splice(index, 1);
    if (activeTab.value >= index) {
      activeTab.value = Math.max(0, activeTab.value - 1);
    }
  }
};

// 切换标签页
const switchTab = (index) => {
  activeTab.value = index;
};

// 控制包菜精显示
const cabbagetalk = () => {
  const size = { width: 160, height: 160};
  if (window.pyBridge) {
    window.pyBridge.addDockWidget("Pet", "/Pet", "float", "bottom_right", JSON.stringify(size));
  }
};

// 打开场景设置栏
const openSceneBar = (index) => {
  if (window.pyBridge) {
    const sceneName = tabs.value[index]?.id || 'scene1';
    window.pyBridge.addDockWidget(sceneName, `/SceneBar?sceneName=${sceneName}`, "left");
  } else {
    window.pyBridge.removeDockWidget(sceneName);
  }
};

const Out = () => {
    if (window.pyBridge) {
        window.pyBridge.closeprocess();
    } else {
        console.error("Python SendMessageToDock 未连接！");
    }
}

const createScene = () => {
  if (window.pyBridge) {
    window.pyBridge.CreateScene(JSON.stringify({sceneName:"scene1"}));
  }
};

onMounted(() => {
  createScene();
  cabbagetalk();
  document.addEventListener('keydown', handleKeyDown);
});

// 在onUnmounted中移除事件监听
onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown);
});
</script>