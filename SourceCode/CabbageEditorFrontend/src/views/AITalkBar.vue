<template>
  <div class="border-2 border-[#84a65b] rounded-md relative">
    <!-- 标题栏 -->
    <div
      class="border-t-2 border-r-2 border-l-2 border-gray-950 titlebar fixed top-0 left-0 right-0 flex items-center w-full p-2 justify-between bg-[#84A65B] cursor-move select-none z-50"
      @mousedown="startDrag" @mousemove="onDrag" @mouseup="stopDrag" @mouseleave="stopDrag">
      <div class="text-white font-medium w-auto whitespace-nowrap">助手</div>
      <!-- 按钮组 -->
      <div class="flex w-full space-x-2 justify-end">
        <button @click.stop="closeFloat"
          class="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors duration-200">
          ×
        </button>
        </div>
    </div>

    <!-- 四周拖动边框 -->
    <div class="absolute top-0 left-0 w-full h-2 cursor-n-resize z-40" @mousedown="(e) => startResize(e, 'n')"></div>
    <div class="absolute bottom-0 left-0 w-full h-2 cursor-s-resize z-40" @mousedown="(e) => startResize(e, 's')"></div>
    <div class="absolute top-0 left-0 h-full w-2 cursor-w-resize z-40" @mousedown="(e) => startResize(e, 'w')"></div>
    <div class="absolute top-0 right-0 h-full w-2 cursor-e-resize z-40" @mousedown="(e) => startResize(e, 'e')"></div>
    <div class="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-40" @mousedown="(e) => startResize(e, 'nw')"></div>
    <div class="absolute top-0 right-0 w-4 h-4 cursor-ne-resize z-40" @mousedown="(e) => startResize(e, 'ne')"></div>
    <div class="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize z-40" @mousedown="(e) => startResize(e, 'sw')"></div>
    <div class="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-40" @mousedown="(e) => startResize(e, 'se')"></div>

    <!-- 主内容区域 -->
    <div class="flex flex-col h-screen bg-[#a8a4a3]/65 pt-12">
      <!-- 对话记录区域 -->
      <div class="flex-1 overflow-hidden">
        <div class="h-full max-w-6xl mx-auto p-6">
          <div class="h-full overflow-y-auto space-y-2 pr-2">
            <div v-for="(message, index) in messages" :key="index"
              class="p-3 bg-[#E8E8E8]/80 rounded-lg shadow-sm border border-gray-100">
              <span :class="{
                'text-blue-500': message.sender === 'AI',
                'text-green-500': message.sender === 'User'
              }" class="font-medium">
                {{ message.sender }}:
                <span class="text-gray-700">{{ message.text }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 输入区域 -->
      <div class="absolute bottom-0 left-0 right-0 bg-[#E8E8E8]/80 border-t border-gray-200 shadow-lg backdrop-blur-sm">
        <div class="max-w-6xl mx-auto p-4">
          <div class="flex space-x-2">
            <input v-model="userInput" @keyup.enter="sendMessage" placeholder="输入消息..." class="flex-1 p-2 border rounded-lg focus:ring-2 focus:ring-blue-400 
                  focus:outline-none transition-all border-gray-300
                  hover:border-blue-300 focus:border-blue-400" />
            <button @click="sendMessage" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 
                  transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 
                  focus:ring-offset-2 whitespace-nowrap">
              发送
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, inject, onMounted, onUnmounted } from 'vue';

const eventBus = inject('eventBus');
const isFloating = ref(false);

const closeAITalkBar = () => {
  if (window.pyBridge) {
    window.pyBridge.removeDockWidget("AITalkBar");
  } else {
    console.error("Python pyBridge 未连接！");
  }
};

const messages = ref([
  { sender: "AI", text: "你好！我是 AI。" },
]);
const userInput = ref('');

const SendMessageToAI = (query) => {
  if (window.pyBridge) {
    const testStr = JSON.stringify({ message: query });
    window.pyBridge.SendMessageToAI(testStr);
  } else {
    console.error("Python SendMessageToDock 未连接！");
  }
};

const sendMessage = () => {
  if (userInput.value.trim()) {
    messages.value.push({ sender: "User", text: userInput.value });
    SendMessageToAI(userInput.value);
    userInput.value = '';
  }
};

window.receiveAIMessage = (data) => {
  try {
    let message = data;
    if (typeof data === 'string') {
      try {
        message = JSON.parse(data);
      } catch {
        message = { content: data };
      }
    }

    if (message.type === 'error') {
      console.error('AI处理错误:', message.content);
    }

    messages.value.push({
      sender: "AI",
      text: message.content || JSON.stringify(message)
    });
  } catch (e) {
    console.error('处理AI消息失败:', e);
    messages.value.push({
      sender: "系统",
      text: `无法处理AI响应: ${typeof data === 'string' ? data : JSON.stringify(data)}`
    });
  }
};

// 拖拽状态管理
const dragState = ref({
  isDragging: false,
  isResizing: false,
  resizeDirection: '',
  offsetX: 0,
  offsetY: 0,
  startWidth: 0,
  startHeight: 0,
  startX: 0,
  startY: 0,
  windowX: 0,
  windowY: 0
});

const startResize = (event, direction) => {
  if (event.button !== 0) return;

  dragState.value.isResizing = true;
  dragState.value.resizeDirection = direction;
  dragState.value.startWidth = event.currentTarget.parentElement.offsetWidth;
  dragState.value.startHeight = event.currentTarget.parentElement.offsetHeight;
  dragState.value.startX = event.clientX;
  dragState.value.startY = event.clientY;
  
  // 记录窗口当前位置
  const rect = event.currentTarget.parentElement.getBoundingClientRect();
  dragState.value.windowX = rect.left;
  dragState.value.windowY = rect.top;
  
  event.preventDefault();
};

const onResize = (event) => {
  if (!dragState.value.isResizing) return;

  const deltaX = event.clientX - dragState.value.startX;
  const deltaY = event.clientY - dragState.value.startY;
  
  let newWidth = dragState.value.startWidth;
  let newHeight = dragState.value.startHeight;
  let newX = dragState.value.windowX;
  let newY = dragState.value.windowY;

  switch(dragState.value.resizeDirection) {
    case 'n':
      newHeight = Math.max(200, dragState.value.startHeight + deltaY);
      newY = dragState.value.windowY - deltaY;
      break;
    case 's':
      newHeight = Math.max(200, dragState.value.startHeight + deltaY);
      break;
    case 'w':
      newWidth = Math.max(200, dragState.value.startWidth + deltaX);
      newX = dragState.value.windowX - deltaX;
      break;
    case 'e':
      newWidth = Math.max(200, dragState.value.startWidth + deltaX);
      break;
    case 'nw':
      newWidth = Math.max(200, dragState.value.startWidth - deltaX);
      newHeight = Math.max(200, dragState.value.startHeight - deltaY);
      newX = dragState.value.windowX + deltaX;
      newY = dragState.value.windowY + deltaY;
      break;
    case 'ne':
      newWidth = Math.max(200, dragState.value.startWidth + deltaX);
      newHeight = Math.max(200, dragState.value.startHeight - deltaY);
      newY = dragState.value.windowY + deltaY;
      break;
    case 'sw':
      newWidth = Math.max(200, dragState.value.startWidth - deltaX);
      newHeight = Math.max(200, dragState.value.startHeight + deltaY);
      newX = dragState.value.windowX + deltaX;
      break;
    case 'se':
      newWidth = Math.max(200, dragState.value.startWidth + deltaX);
      newHeight = Math.max(200, dragState.value.startHeight + deltaY);
      break;
  }

  // 检测是否拖到边界自动浮动
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  const threshold = 50;
  
  if (newX < threshold || newX + newWidth > screenWidth - threshold ||
      newY < threshold || newY + newHeight > screenHeight - threshold) {
    if (!isFloating.value && window.pyBridge) {
      isFloating.value = true;
      window.pyBridge.forwardDockEvent('float', JSON.stringify({
        isFloating: true
      }));
    }
  }

  if (window.pyBridge) {
    window.pyBridge.forwardDockEvent('resize', JSON.stringify({
      width: newWidth,
      height: newHeight,
      x: newX,
      y: newY
    }));
  }
  event.preventDefault();
};

const stopResize = () => {
  dragState.value.isResizing = false;
};
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

// 浮动和缩放相关


//关闭浮动窗口
const closeFloat = () => {
  if (window.pyBridge) {
    window.pyBridge.removeDockWidget("AITalkBar");
  }
};

const handleDockEvent = (eventType, eventData) => {
  if (eventType === 'jsonData') {
    try {
      const data = JSON.parse(eventData);
      console.error(data['content'])
    } catch (error) {
      console.error('处理Dock事件失败:', error);
    }
  }
}

onMounted(() => {
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
  document.addEventListener('mousemove', onResize);
  document.addEventListener('mouseup', stopResize);
  window.pyBridge.dock_event.connect(handleDockEvent);
});

onUnmounted(() => {
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
  document.removeEventListener('mousemove', onResize);
  document.removeEventListener('mouseup', stopResize);
  window.pyBridge.dock_event.disconnect(handleDockEvent);
});
</script>