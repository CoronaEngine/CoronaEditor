<template>
<div :class="themeClass">
  <div tabindex="0" @keydown="handleKeyDown">
    <div class="welcome-container">
      <!-- LOGO -->
      <div class="welcome-logo">
        <img 
          src="@/assets/CabbageEngine-LOGO.png" 
          alt="Cabbage Engine Logo"
          class="welcome-logo-img"
        />
      </div>
        <!-- 公告按钮与面板 -->
        <div class="announcement-container">
            <div class="items-center w-2/3"></div>
            <!-- 公告按钮 -->
            <button 
              @click="toggleAnnouncements" 
              class="announcement-button">
              <img 
              src="@/assets/announcement.png" 
              class="announcement-button-img"
              :class="{ 'animate-soft-shake': !showAnnouncements }"
              />
            </button>
            <!-- 公告面板 -->
            <div v-show="showAnnouncements" 
                 class="announcement-panel"
                 :class="{ 'active': showAnnouncements }">
                <div class="relative p-6">
                    <p class="text-center text-2xl font-bold text-black mb-4">公告</p>
                    <div class="h-64 overflow-y-auto space-y-4">
                        <div class="bg-white/5 rounded-lg p-4">
                            <p class="text-black/80">欢迎使用 Cabbage Engine</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!--按钮部分-->
        <div class="button-container">
            <!--开始游戏-->
            <router-link to="/MainPage" class="w-full max-w-xs">
                <button
                    @click="removeActors" 
                    class="welcome-button">
                    <p class="button-text">开始游戏<br />Start Game</p>
                </button>
            </router-link>
            <!--继续游戏-->
            <router-link to="/MainPage" class="w-full max-w-xs">
                <button
                    @click="removeActors" 
                    class="welcome-button">
                    <p class="button-text">继续游戏<br />Continue</p>
                </button>
            </router-link>
            <!--游戏设置-->
            <router-link to=" " class="w-full max-w-xs">
                <button @click="removeActors"
                    class="welcome-button">
                    <p class="button-text">游戏设置<br />Exit</p>
                </button>
            </router-link>
            <!--退出游戏-->
            <router-link to=" " class="w-full max-w-xs">
                <button @click="Out"
                    class="welcome-button">
                    <p class="button-text">结束游戏<br />Exit</p>
                </button>
            </router-link>
        </div>
    </div>
    <!-- 返回首页按钮 -->
    <button 
      v-show="true"
      @click="goToHome"
      class="home-button">
      <img 
        src="@/assets/home.png" 
        class="home-button-img"
      />
    </button>
  </div>

<div class="w-[140px] overflow-hidden">
     <div
         v-for="item in themeArr"
         :key="item.id"
         @click="onItemClick(item)"
         class="flex items-center p-1 cursor-pointer rounded
          hover:bg-zinc-100/60 dark:hover:bg-zinc-800"
     >
         <m-svg-icon
             :name="item.icon"
             class="w-1.5 h-1.5 mr-1"
             fillClass="fill-zinc-900 dark:fill-zinc-300"
         ></m-svg-icon>
         <span class="text-zinc-900 dark:text-zinc-300 text-sm">{{ item.name }}</span>
     </div>
 </div>

</div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, onUnmounted, computed, provide } from 'vue';
import '@/assets/welcome-page.css'
import '@/assets/welcome-pagePE.css'
import { useRouter } from 'vue-router';
import eventBus from '@/utils/eventBus';

// 控制公告显示的状态
const currentScene = ref("mainscene");
const showAnnouncements = ref(false);
const autoCloseTimer = ref(null);
const actorid = ref([]);
const isJumping = ref(false);
const jumpSpeed = ref(0);
const gravity = 0.01;
const router = useRouter();
const selectedVersion = ref('fun');

const themeClass = computed(() => {
  const cls = selectedVersion.value === 'pro' ? 'theme-pro' : 'theme-fun'
  console.log('Current theme class:', cls)
  return cls
})

const goToHome = () => {
  router.push('/');
};

const toggleAnnouncements = () => {
  showAnnouncements.value = !showAnnouncements.value;

  if (autoCloseTimer.value) {
    clearTimeout(autoCloseTimer.value);
    autoCloseTimer.value = null;
  }

  if (showAnnouncements.value) {
    autoCloseTimer.value = setTimeout(() => {
      showAnnouncements.value = false;
    }, 5000);
  }
};

const closeAnnouncements = () => {
  showAnnouncements.value = false;
  if (autoCloseTimer.value) {
    clearTimeout(autoCloseTimer.value);
    autoCloseTimer.value = null;
  }
};

onBeforeUnmount(() => {
  if (autoCloseTimer.value) {
    clearTimeout(autoCloseTimer.value);
  }
});

const createActor = () => {
    if (window.pyBridge) {
        window.pyBridge.CreateActor(currentScene.value,`./Resource/Cabbage/armadillo.obj`);
        window.pyBridge.CreateActor(currentScene.value,`./Resource/Cabbage/Ball.obj`);
    } else {
        console.error("Python SendMessageToDock 未连接！");
    }
}

const handleActorMove = (direction, deltaTime = 16) => {
  const baseSpeed = 0.2;
  const speed = baseSpeed * (deltaTime / 16);
  
  if (!actorid.value.length) return;
  
  // 计算移动向量
  let x = 0, y = 0, z = 0;
  switch(direction) {
    case 'forward':
      z = -speed;
      break;
    case 'backward':
      z = speed;
      break;
    case 'left':
      x = -speed;
      break;
    case 'right':
      x = speed;
      break;
    case 'rotateRight':
      // 新增右旋转逻辑
      if (window.pyBridge) {
        window.pyBridge.Actor_Operation(JSON.stringify({
          Operation: "Rotate",
          sceneName: "mainscene",
          x: 0,
          y: -Math.PI/36, // 5度旋转
          z: 0,
          actorName: actorid.value[0]
        }));
      }
      return;
    case 'rotateLeft':
      // 新增左旋转逻辑
      if (window.pyBridge) {
        window.pyBridge.Actor_Operation(JSON.stringify({
          Operation: "Rotate",
          sceneName: "mainscene",
          x: 0,
          y: Math.PI/36, // 5度旋转
          z: 0,
          actorName: actorid.value[0]
        }));
      }
      return;
  }
  
  // 处理跳跃
  if (isJumping.value) {
    jumpSpeed.value -= gravity;
    y = jumpSpeed.value;
    
    // 落地检测
    if (jumpSpeed.value <= 0) {
      isJumping.value = false;
      jumpSpeed.value = 0;
    }
  }

  if (window.pyBridge) {
    window.pyBridge.Actor_Operation(JSON.stringify({
      Operation: "Move",
      sceneName: "mainscene",
      x: x,
      y: y,
      z: z,
      actorName: actorid.value[0]
    }));
  }
};

const handleKeyDown = (event) => {
  event.preventDefault();
  switch(event.key.toLowerCase()) {
    case 'w':
      handleActorMove('forward');
      break;
    case 's':
      handleActorMove('backward');
      break;
    case 'a':
      handleActorMove('left');
      break;
    case 'd':
      handleActorMove('right');
      break;
    case 'q':
      handleActorMove('rotateLeft');
      break;
    case 'e':
      handleActorMove('rotateRight');
      break;
    case ' ':
      if (!isJumping.value) {
        isJumping.value = true;
        jumpSpeed.value = 0.5;
      }
      break;
  }
};

// 版本切换处理
const handleVersionSelect = (version) => {
  selectedVersion.value = version
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('selectedVersion', version)
    }
  } catch (e) {
    console.warn('localStorage access error:', e)
  }
}

const Out = () => {
    if (window.pyBridge) {
        window.pyBridge.closeprocess();
    } else {
        console.error("Python SendMessageToDock 未连接！");
    }
}

const removeActors = () => {
    if (window.pyBridge) {
        window.pyBridge.RemoveActor();
    } else {
        console.error("Python SendMessageToDock 未连接！");
    }
}

onMounted(() => {
  try {
    const savedVersion = localStorage?.getItem('selectedVersion')
    if (savedVersion) {
      selectedVersion.value = savedVersion
    } else {
      selectedVersion.value = 'fun'
    }
  } catch (e) {
    console.warn('localStorage access error:', e)
    selectedVersion.value = 'fun'
  }

  createActor();
  document.addEventListener('keydown', handleKeyDown);
  eventBus.on('version-selected', handleVersionSelect);
});

onUnmounted(() => {
  eventBus.off('version-selected', handleVersionSelect)
  document.removeEventListener('keydown', handleKeyDown)
})
</script>