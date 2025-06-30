import { ref } from 'vue';

export function useDragResize() {
const isFloating = ref(false);

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

const startDrag = (event) => {
  if (event.button !== 0) return;
  dragState.value.isDragging = true;
  dragState.value.startX = event.clientX;
  dragState.value.startY = event.clientY;

  // 拖动标题栏时自动变成浮动状态
  if (!isFloating.value && window.pyBridge) {
    isFloating.value = true;
    window.pyBridge.forwardDockEvent('float', JSON.stringify({
      isFloating: true
    }));
  }
  event.currentTarget.classList.add('bg-[#7BA590]/80');
  event.preventDefault();
};

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

const stopDrag = (event) => {
  if (!dragState.value.isDragging) return;

  dragState.value.isDragging = false;
  dragState.value.startX = 0;
  dragState.value.startY = 0;

  event.currentTarget.classList.remove('bg-[#7BA590]/80');
  event.preventDefault();
};

const onDrag = (event) => {
  if (!dragState.value.isDragging) return;

  const deltaX = event.clientX - dragState.value.startX;
  const deltaY = event.clientY - dragState.value.startY;
  
  // 检测是否拖拽到边界触发浮动或吸附
  const rect = event.currentTarget.parentElement.getBoundingClientRect();
  const newX = rect.left + deltaX;
  const newY = rect.top + deltaY;
  
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  const threshold = 30;
  
  const isNearEdge = newX < threshold || newX + newWidth > screenWidth - threshold || newY < threshold || newY + newHeight > screenHeight - threshold;
  
  if (isNearEdge && !isFloating.value && window.pyBridge) {
    // 靠近边界时浮动
    isFloating.value = true;
    window.pyBridge.forwardDockEvent('float', JSON.stringify({
      isFloating: true
    }));
  }

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

const stopResize = () => {
  dragState.value.isResizing = false;
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
      newHeight = Math.max(200, dragState.value.startHeight - deltaY);
      newY = dragState.value.windowY + deltaY;
      break;
    case 's':
      newHeight = Math.max(200, dragState.value.startHeight + deltaY);
      break;
    case 'w': {
      const rightEdge = dragState.value.windowX + dragState.value.startWidth;
      newWidth = Math.max(200, dragState.value.startWidth - deltaX);
      newX = dragState.value.windowX + deltaX;
      break;
    }
    case 'e':
      newWidth = Math.max(200, dragState.value.startWidth + deltaX);
      break;
    case 'nw': {
      const rightEdge = dragState.value.windowX + dragState.value.startWidth;
      newWidth = Math.max(200, dragState.value.startWidth - deltaX);
      newX = rightEdge - newWidth;
      newHeight = Math.max(200, dragState.value.startHeight - deltaY);
      newY = dragState.value.windowY + deltaY;
      break;
    }
    case 'ne':
      newWidth = Math.max(200, dragState.value.startWidth + deltaX);
      newHeight = Math.max(200, dragState.value.startHeight - deltaY);
      newY = dragState.value.windowY + deltaY;
      break;
    case 'sw': {
      const rightEdge = dragState.value.windowX + dragState.value.startWidth;
      newWidth = Math.max(200, dragState.value.startWidth - deltaX);
      newX = rightEdge - newWidth;
      newHeight = Math.max(200, dragState.value.startHeight + deltaY);
      break;
    }
    case 'se':
      newWidth = Math.max(200, dragState.value.startWidth + deltaX);
      newHeight = Math.max(200, dragState.value.startHeight + deltaY);
      break;
  }

  if (window.pyBridge) {
    const payload = {
      width: newWidth,
      height: newHeight
    };
    if (dragState.value.resizeDirection.includes('w')) {
      payload.x = newX;
    }
    if (dragState.value.resizeDirection.includes('n')) {
      payload.y = newY;
    }
    window.pyBridge.forwardDockEvent('resize', JSON.stringify(payload));
  }
  event.preventDefault();
};


return {dragState,startDrag,startResize,stopDrag,onDrag,stopResize,onResize};
}