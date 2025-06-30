<template>
  <div tabindex="0" @keydown="handleKeyDown">
    <div class="min-h-screen w-full bg-transparent">
      <!-- 3D悬浮标题 -->
      <div class="fixed top-20 left-20 inset-x-0 z-[999] texe-center">
        <div class="text-6xl font-extrabold text-green-600 tracking-[0.2em] transform-gpu perspective-1000 animate-float [text-shadow:_2px_2px_0_#065f06,_4px_4px_0_#034203,_6px_6px_0_#012601] space-y-4">
          <div class="preserve-3d rotate-x-[20deg] transition-transform duration-300">
            Cabbage
          </div>
          <div class="preserve-3d rotate-x-[20deg] transition-transform duration-300 -mt-4">
            engine
          </div>
        </div>
      </div>
        <!-- 公告按钮与面板 -->
        <div class="flex flex-row justify-end items-start w-full p-8">
            <div class="items-center w-2/3"></div>
            
            <!-- 公告按钮 -->
            <button @click="toggleAnnouncements" 
                    class="fixed right-8 top-8 bg-white/20 hover:bg-white/30 rounded-full p-3 
                           transition-all duration-300 shadow-lg z-[999] hover:rotate-12"
                    :class="{ 'bg-white/40 scale-110': showAnnouncements }">
            <svg class="w-8 h-8 text-black transform transition-all group-hover:scale-110" 
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 200 200"
            fill="none" 
            :class="{ 'animate-soft-shake': !showAnnouncements }">
              <!-- 新月 -->
            <circle cx="100" cy="100" r="50" fill="currentColor" />
            <circle cx="115" cy="100" r="40" fill="white/20" />

            <!-- 火焰光芒（共16片） -->
            <path d="M100,20 C85,60 115,60 100,20 Z" fill="currentColor"/>
            <path d="M145,30 C130,50 140,70 145,30 Z" fill="currentColor"/>
            <path d="M180,100 C140,90 140,110 180,100 Z" fill="currentColor"/>
            <path d="M145,170 C140,130 130,140 145,170 Z" fill="currentColor"/>
            <path d="M100,180 C115,140 85,140 100,180 Z" fill="currentColor"/>
            <path d="M55,170 C70,140 60,130 55,170 Z" fill="currentColor"/>
            <path d="M20,100 C60,90 60,110 20,100 Z" fill="currentColor"/>
            <path d="M55,30 C60,70 70,50 55,30 Z" fill="currentColor"/>

            <!-- 次级小火焰 -->
            <path d="M125,25 C120,45 130,55 125,25 Z" fill="currentColor"/>
            <path d="M165,65 C145,75 150,85 165,65 Z" fill="currentColor"/>
            <path d="M165,135 C150,125 145,155 165,135 Z" fill="currentColor"/>
            <path d="M125,175 C135,145 115,155 125,175 Z" fill="currentColor"/>
            <path d="M75,175 C85,155 65,145 75,175 Z" fill="currentColor"/>
            <path d="M35,135 C55,125 50,155 35,135 Z" fill="currentColor"/>
            <path d="M35,65 C50,75 55,45 35,65 Z" fill="currentColor"/>
            <path d="M75,25 C65,55 85,55 75,25 Z" fill="currentColor"/>
        </svg>
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
                    <button @click="toggleAnnouncements" 
                            class="absolute right-3 top-3 text-black/50 hover:text-black/80 
                                   transition-colors p-1 hover:bg-black/5 rounded-full">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                  d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
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
        <div
            class="flex flex-col items-center space-y-4 absolute top-1/3 right-30 mx-auto w-full sm:w-3/4 md:w-1/2 lg:w-1/3">
            <!--开始游戏-->
            <router-link to="/MainPage" class="w-full max-w-xs">
                <button
                    @click="removeActors" 
                    class="w-full rounded-none bg-[#9E9E9E]/50 hover:bg-white/50 font-bold py-2 px-4 sm:py-3 sm:px-6 md:py-4 md:px-8 
           transform hover:scale-110 hover:px-9 hover:py-6 hover:w-[130%] origin-center 
           transition-all duration-300 transition-[transform,padding]">
                    <p class="font-bold text-black/80 tracking-widest text-sm sm:text-base md:text-lg">开始游戏<br />Start Game
                    </p>
                </button>
            </router-link>
            <!--继续游戏-->
            <router-link to="/MainPage" class="w-full max-w-xs">
                <button
                    @click="removeActors" 
                    class="w-full rounded-none bg-[#9E9E9E]/50 hover:bg-white/50 font-bold py-2 px-4 sm:py-3 sm:px-6 md:py-4 md:px-8 
           transform hover:scale-110 hover:px-9 hover:py-6 hover:w-[130%] origin-center 
           transition-all duration-300 transition-[transform,padding]">
                    <p class="font-bold text-black/80 tracking-widest text-sm sm:text-base md:text-lg">继续游戏<br />Continue
                    </p>
                </button>
            </router-link>
            <!--游戏设置-->
            <router-link to=" " class="w-full max-w-xs">
                <button 
                @click="removeActors"    
                class="w-full rounded-none bg-[#9E9E9E]/50 hover:bg-white/50 font-bold py-2 px-4 sm:py-3 sm:px-6 md:py-4 md:px-8 
           transform hover:scale-110 hover:px-9 hover:py-6 hover:w-[130%] origin-center 
           transition-all duration-300 transition-[transform,padding]">
                    <p class="font-bold text-black/80 tracking-widest text-sm sm:text-base md:text-lg">游戏设置<br />Setting</p>
                </button>
            </router-link>
            <!--退出游戏-->
            <router-link to=" " class="w-full max-w-xs">
                <button @click="closeprocess"
                    class="w-full rounded-none bg-[#9E9E9E]/50 hover:bg-white/50 font-bold py-2 px-4 sm:py-3 sm:px-6 md:py-4 md:px-8 
           transform hover:scale-110 hover:px-9 hover:py-6 hover:w-[130%] origin-center 
           transition-all duration-300 transition-[transform,padding]">
                    <p class="font-bold text-black/80 tracking-widest text-sm sm:text-base md:text-lg">结束游戏<br />Exit</p>
                </button>
            </router-link>
        </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
// 控制公告显示的状态
const currentScene = ref("mainscene");
const showAnnouncements = ref(false);
const actorid = ref([]);
const isJumping = ref(false);
const jumpSpeed = ref(0);
const gravity = 0.01;
const toggleAnnouncements = () => {
  showAnnouncements.value = !showAnnouncements.value;
};

const closeprocess = () => {
    if (window.pyBridge) {
        window.pyBridge.closeprocess();
    } else {
        console.error("Python SendMessageToDock 未连接！");
    }
}


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

const updatePosition = () => {
  if (window.pyBridge) {
    window.pyBridge.Actor_Operation(JSON.stringify({
      Operation: "Move",
      sceneName: scenename.value,
      x: parseFloat(px.value),
      y: parseFloat(py.value),
      z: parseFloat(pz.value),
      actorName: actorname.value
    }));
    console.error('updatePosition', actorname.value, px.value, py.value, pz.value); // 调试用，确保值正确传递到 Python 端
  } 
}

const updateRotation = () => {
  if (window.pyBridge) {
    window.pyBridge.Actor_Operation(JSON.stringify({
      Operation: "Rotate",
      sceneName: scenename.value,
      x: parseFloat(rx.value),
      y: parseFloat(ry.value),
      z: parseFloat(rz.value),
      actorName: actorname.value
    }));
    console.error('updateRotation', rx.value, ry.value, rz.value); // 调试用，确保值正确传递到 Python 端
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