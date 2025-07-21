<template>
  <div tabindex="0" @keydown="handleKeyDown">
    <div class="min-h-screen w-full bg-[#333333]">
      <!-- LOGO -->
      <div class="fixed top-0 left-0 inset-x-0 z-[50] text-center transform -translate-y-6">
        <img 
          src="@/assets/CabbageEngine-LOGO.png" 
          alt="Cabbage Engine Logo"
          class="h-auto transform transform-gpu perspective-1000 animate-float"
        />
      </div>
        <!-- 公告按钮与面板 -->
        <div class="flex flex-row justify-end items-start w-full p-8 z-[51]">
            <div class="items-center w-2/3"></div>
            <!-- 公告按钮 -->
            <button 
              @click="toggleAnnouncements" 
              class="absolute right-8 top-5 text-black/50 hover:text-black/80 
                    transition-colors p-1 hover:bg-black/5 rounded-full z-[51]">
              <img 
              src="@/assets/PE按钮.png" 
              class="w-12 h-12 object-contain"
              :class="{ 'animate-soft-shake': !showAnnouncements }"
              />
            </button>
            <!-- 公告面板 -->
            <div v-show="showAnnouncements" 
                 class="fixed top-20 right-20 w-96 bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl 
                        transition-all duration-300 ease-out z-[998] 
                        transform-gpu origin-top-right
                        opacity-0 translate-y-4 scale-95
                        [&.active]:opacity-100 [&.active]:translate-y-0 [&.active]:scale-100"
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
        <div class="flex flex-col items-start gap-4 absolute top-1/3 left-40 w-auto z-[51] p-4
            sm:w-3/4 md:w-1/2 lg:w-1/3">
            <!--开始游戏-->
            <router-link to="/MainPagePE" class="w-full max-w-xs">
                <button
                    @click="removeActors" 
                    class="w-full rounded-lg bg-[rgba(95,157,198,0.5)] font-bold px-6 py-4
                    transition-all duration-300 origin-center
                    hover:bg-[rgba(255,255,255,0.5)] hover:scale-105 hover:px-10 hover:py-7 hover:w-[105%]">
                    <p class="font-bold text-black/80 tracking-wide text-center text-sm leading-5 sm:text-base sm:leading-6 md:text-lg md:leading-7">开始游戏<br />Start Game
                    </p>
                </button>
            </router-link>
            <!--继续游戏-->
            <router-link to="/MainPagePE" class="w-full max-w-xs">
                <button
                    @click="removeActors" 
                    class="w-full rounded-lg bg-[rgba(95,157,198,0.5)] font-bold px-6 py-4
                    transition-all duration-300 origin-center
                    hover:bg-[rgba(255,255,255,0.5)] hover:scale-105 hover:px-10 hover:py-7 hover:w-[105%]">
                    <p class="font-bold text-black/80 tracking-wide text-center text-sm leading-5 sm:text-base sm:leading-6 md:text-lg md:leading-7">继续游戏<br />Continue
                    </p>
                </button>
            </router-link>
            <!--主题切换-->
            <router-link to="/" class="w-full max-w-xs">
                <button 
                @click="removeActors"    
                class="w-full rounded-lg bg-[rgba(95,157,198,0.5)] font-bold px-6 py-4
                    transition-all duration-300 origin-center
                    hover:bg-[rgba(255,255,255,0.5)] hover:scale-105 hover:px-10 hover:py-7 hover:w-[105%]">
                    <p class="font-bold text-black/80 tracking-wide text-center text-sm leading-5 sm:text-base sm:leading-6 md:text-lg md:leading-7">主题切换<br />Theme</p>
                </button>
            </router-link>
            <!--退出游戏-->
            <router-link to=" " class="w-full max-w-xs">
                <button @click="Out"
                    class="w-full rounded-lg bg-[rgba(95,157,198,0.5)] font-bold px-6 py-4
                    transition-all duration-300 origin-center
                    hover:bg-[rgba(255,255,255,0.5)] hover:scale-105 hover:px-10 hover:py-7 hover:w-[105%]">
                    <p class="font-bold text-black/80 tracking-wide text-center text-sm leading-5 sm:text-base sm:leading-6 md:text-lg md:leading-7">结束游戏<br />Exit</p>
                </button>
            </router-link>
        </div>
    </div>
    <!-- 返回首页按钮 -->
    <button 
        v-show="true"
        @click="goToHome"
        class="absolute right-8 bottom-28 text-black/50 transition-colors duration-300 p-1 rounded-full z-[51] hover:text-black/80 hover:bg-black/5">
        <img 
        src="@/assets/首页的小房子按钮.png" 
        class="w-12 h-12 object-contain"
    />
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
// 控制公告显示的状态
const currentScene = ref("mainscene");
const showAnnouncements = ref(false);
const autoCloseTimer = ref(null);
const actorid = ref([]);
const isJumping = ref(false);
const jumpSpeed = ref(0);
const gravity = 0.01;


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

const goToHome = () => {
  router.push('/WelcomePagePE');
};

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
    createActor();
    document.addEventListener('keydown', handleKeyDown);
  });
</script>