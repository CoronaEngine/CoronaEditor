import { ref } from 'vue';

export function useDragResize() {
const isFloating = ref(false);

// 拖拽状态管理
const dragState = ref({
  isDragging: false,
  isResizing: false,
  resizeDirection: '',
  offset: { x: 0, y: 0 },
  startPos: { x: 0, y: 0 },
  startSize: { width: 0, height: 0 },
  windowPos: { x: 0, y: 0 }
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

  switch(dragState.value.resizeDirection) {
    case 'n':
      newHeight = Math.max(200, dragState.value.startHeight - deltaY);
      break;
    case 's':
      newHeight = Math.max(200, dragState.value.startHeight + deltaY);
      break;
    case 'w': {
      newWidth = Math.max(200, dragState.value.startWidth - deltaX);
      break;
    }
    case 'e':
      newWidth = Math.max(200, dragState.value.startWidth + deltaX);
      break;
    case 'nw': {
      newWidth = Math.max(200, dragState.value.startWidth - deltaX);
      newHeight = Math.max(200, dragState.value.startHeight - deltaY);
      break;
    }
    case 'ne':
      newWidth = Math.max(200, dragState.value.startWidth + deltaX);
      newHeight = Math.max(200, dragState.value.startHeight - deltaY);
      break;
    case 'sw': {
      newWidth = Math.max(200, dragState.value.startWidth - deltaX);
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
    window.pyBridge.forwardDockEvent('resize', JSON.stringify(payload));
  }
  event.preventDefault();
};


return {dragState,startDrag,startResize,stopDrag,onDrag,stopResize,onResize};
}