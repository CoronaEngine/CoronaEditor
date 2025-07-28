<template>
<div class="bborder-2 border-black rounded-md relative">
    <div class="flex flex-col items-center space-y-4 absolute top-1/3 right-30 mx-auto w-full sm:w-3/4 md:w-1/2 lg:w-1/3"
    @contextmenu="openContextMenu($event)"
    @mousedown="startDrag" @mousemove="onDrag" @mouseup="stopDrag" @mouseleave="stopDrag"
    >
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
        <router-link to="/" class="w-full max-w-xs">
            <button
            @click="removeActors"
            class="w-full rounded-none bg-[#9E9E9E]/50 hover:bg-white/50 font-bold py-2 px-4 sm:py-3 sm:px-6 md:py-4 md:px-8 
            transform hover:scale-110 hover:px-9 hover:py-6 hover:w-[110%] origin-center 
            transition-all duration-300 transition-[transform,padding]"
            >返回初始页面</button>
        </router-link>
    </div>
</div>
</template>

<script setup>
    import { ref, onMounted } from 'vue';
    import { useDragResize } from '@/composables/useDragResize';
    import eventBus from '@/utils/eventBus';

    const emitProVersion = () => {
        removeActors();
        eventBus.emit('version-selected', 'pro');
    }

    const emitFunVersion = () => {
        removeActors();
        eventBus.emit('version-selected', 'fun');
    }

    const {startDrag,stopDrag,onDrag} = useDragResize();
    const showContextMenu = ref(false);
    const contextMenuX = ref(0);
    const contextMenuY = ref(0);
    let isClosingMenu = false;

    // 打开快捷栏
    const openContextMenu = (e) => {
    e.preventDefault();
    if (showContextMenu.value) {
        if (!isClosingMenu) {
        isClosingMenu = true;
        closeContextMenu();
        // 在一定时间后重置标记，避免影响后续操作
        setTimeout(() => {
            isClosingMenu = false;
        }, 100); 
        }
    } else {
        if (!isClosingMenu) {
        showContextMenu.value = true;
        contextMenuX.value = e.clientX;
        contextMenuY.value = e.clientY;
        const closeOnRightClick = (event) => {
            if (event.button === 2) {
            isClosingMenu = true;
            closeContextMenu();
            document.removeEventListener('mousedown', closeOnRightClick);
            setTimeout(() => {
                isClosingMenu = false;
            }, 100); 
            }
        };
        document.addEventListener('mousedown', closeOnRightClick);
        }
    }
    };

    // 关闭快捷栏
    const closeContextMenu = () => {
    showContextMenu.value = false;
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