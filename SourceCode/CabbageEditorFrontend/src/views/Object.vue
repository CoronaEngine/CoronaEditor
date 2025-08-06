<template>
  <div class=" border-2 border-[#84a65b] rounded-md relative">
  <div class="titlebar flex items-center w-full p-2 justify-between bg-[#84A65B] cursor-move select-none"
    @mousedown="startDrag" @mousemove="onDrag" @mouseup="stopDrag" @mouseleave="stopDrag">
    <div class="text-white font-medium w-auto whitespace-nowrap">角色</div>
    <!-- 按钮组 -->
    <div class="flex w-full space-x-2 justify-end">
      <button @click.stop="closeFloat"
        class="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors duration-200">
        ×
      </button>
    </div>
  </div>
  <div class="w-full bg-[#a8a4a3]/65 flex flex-col" style="height: calc(100vh - 56px);">
    <!-- 角色输入框 -->
    <div class="flex items-center space-x-2 mb-4">
      <label class="text-gray-600">角色</label>
      <input type="text" placeholder="角色路径"
        class="flex-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400" v-model="character" />
    </div>

    <!-- 坐标调整 -->
    <div class="flex items-center justify-between space-x-4 mb-4">
      <label class="text-write whitespace-nowrap">坐标：</label>
      <label class="text-write">x</label>
      <input type="number" step="0.1" @change="updatePosition" @input="e => px = e.target.value"
        class="w-20 p-1 text-center border rounded-md focus:outline-none focus:ring-2 text-write focus:ring-blue-400 bg-[#686868]/70"
        :value="px" />
      <label class="text-write">y</label>
      <input type="number" step="0.1" @change="updatePosition" @input="e => py = e.target.value"
        class="w-20 p-1 text-center border rounded-md focus:outline-none focus:ring-2 text-write focus:ring-blue-400 bg-[#686868]/70"
        :value="py" />
      <label class="text-write">z</label>
      <input type="number" step="0.1" @change="updatePosition" @input="e => pz = e.target.value"
        class="w-20 p-1 text-center border rounded-md focus:outline-none focus:ring-2 text-write focus:ring-blue-400 bg-[#686868]/70"
        :value="pz" />
    </div>

    <div class="flex items-center justify-between space-x-4 mb-4">
      <label class="text-write whitespace-nowrap">旋转：</label>
      <label class="text-write">x</label>
      <input type="number" step="0.1" @change="updateRotation" @input="e => rx = e.target.value"
        class="w-20 p-1 text-center border rounded-md focus:outline-none focus:ring-2 text-write focus:ring-blue-400 bg-[#686868]/70"
        :value="rx" />
      <label class="text-write">y</label>
      <input type="number" step="0.1" @change="updateRotation" @input="e => ry = e.target.value"
        class="w-20 p-1 text-center border rounded-md focus:outline-none focus:ring-2 text-write focus:ring-blue-400 bg-[#686868]/70"
        :value="ry" />
      <label class="text-write">z</label>
      <input type="number" step="0.1" @change="updateRotation" @input="e => rz = e.target.value"
        class="w-20 p-1 text-center border rounded-md focus:outline-none focus:ring-2 text-write focus:ring-blue-400 bg-[#686868]/70"
        :value="rz" />
    </div>

    <div class="flex items-center justify-between space-x-4 mb-4">
      <label class="text-write whitespace-nowrap">缩放：</label>
      <label class="text-write">x</label>
      <input type="number" step="0.1" @change="updateScale" @input="e => sx = e.target.value"
        class="w-20 p-1 text-center border rounded-md focus:outline-none focus:ring-2 text-write focus:ring-blue-400 bg-[#686868]/70"
        :value="sx" />
      <label class="text-write">y</label>
      <input type="number" step="0.1" @change="updateScale" @input="e => sy = e.target.value"
        class="w-20 p-1 text-center border rounded-md focus:outline-none focus:ring-2 text-write focus:ring-blue-400 bg-[#686868]/70"
        :value="sy" />
      <label class="text-write">z</label>
      <input type="number" step="0.1" @change="updateScale" @input="e => sz = e.target.value"
        class="w-20 p-1 text-center border rounded-md focus:outline-none focus:ring-2 text-write focus:ring-blue-400 bg-[#686868]/70"
        :value="sz" />
    </div>
    <div class="flex-1 overflow-y-auto">
      <div id="blockdiv" class="blockly-container"></div>
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
</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import * as Blockly from 'blockly/core';
import * as CN from 'blockly/msg/zh-hans';
import { pythonGenerator } from 'blockly/python';
import 'blockly/blocks';
import { useDragResize } from '@/composables/useDragResize';

const { dragState,startDrag,startResize,stopDrag,onDrag,stopResize,onResize } = useDragResize();
const workspace = ref(null);
const character = ref('');
const px=ref('0.0'), py=ref('0.0'), pz=ref('0.0');
const rx=ref('0.0'), ry=ref('0.0'), rz=ref('0.0');
const sx=ref('1.0'), sy=ref('1.0'), sz=ref('1.0');

const route = useRoute();
const scenename = ref(null);
const actorname = ref(null);
const routename = ref(null);
const flash = ref(null);

Blockly.setLocale(CN);

import { defineEngineBlocks } from '@/blockly/blocks/engine.js';
import { defineAppearanceBlocks } from '@/blockly/blocks/appearance.js';
import { defineEventBlocks } from '@/blockly/blocks/event.js';
import { defineControlBlocks } from '@/blockly/blocks/control.js';
import { defineDetectBlocks } from '@/blockly/blocks/detect.js';

import { defineEngineGenerators } from '@/blockly/generators/engine.js';
import { defineAppearanceGenerators } from '@/blockly/generators/appearance.js';
import { defineEventGenerators } from '@/blockly/generators/event.js';
import { defineControlGenerators } from '@/blockly/generators/control.js';
import { defineDetectGenerators } from '@/blockly/generators/detect.js';



// 定义响应式的广播列表，初始为空
const broadcastList = ref([]);
// 新建广播的函数
const createNewBroadcast = () => {
  const newBroadcastName = prompt('请输入新广播的名称：');
  if (newBroadcastName && newBroadcastName.trim() !== '') {
    broadcastList.value.push(newBroadcastName.trim());
  }
};

const initBlocklyAndGenerators = () => {

  defineEngineBlocks(actorname);
  defineAppearanceBlocks(actorname);
  defineEventBlocks(actorname, flash, broadcastList, createNewBroadcast);
  defineControlBlocks(actorname);
  defineDetectBlocks(actorname);

  defineEngineGenerators();
  defineAppearanceGenerators();
  defineEventGenerators();
  defineControlGenerators();
  defineDetectGenerators();
  
};


















Blockly.Blocks['math_add'] = {
  init: function() {
    this.setStyle('math_blocks'); 
    this.appendDummyInput()
         .appendField(new Blockly.FieldTextInput(actorname.value), 'x1')
         .appendField('+')
         .appendField(new Blockly.FieldTextInput(actorname.value), 'x2');
    this.setOutput(true, 'Number'); 
    this.setColour('#7DDA58'); 
  }
};
pythonGenerator.forBlock['math_add'] = function(block) {
  const x1 = block.getFieldValue('x1');
  const x2 = block.getFieldValue('x2');
  return  `CabbageEngine.add(${x1},${x2})\n`;
};
Blockly.Blocks['math_mul'] = {
  init: function() {
    this.setStyle('math_blocks'); 
    this.appendDummyInput()
         .appendField(new Blockly.FieldTextInput(actorname.value), 'x1')
         .appendField('-')
         .appendField(new Blockly.FieldTextInput(actorname.value), 'x2');
    this.setOutput(true, 'Number'); 
    this.setColour('#7DDA58'); 
  }
};
pythonGenerator.forBlock['math_mul'] = function(block) {
  const x1 = block.getFieldValue('x1');
  const x2 = block.getFieldValue('x2');
  return  `CabbageEngine.mul(${x1},${x2})\n`;
};
Blockly.Blocks['math_div'] = {
  init: function() {
    this.setStyle('math_blocks'); 
    this.appendDummyInput()
         .appendField(new Blockly.FieldTextInput(actorname.value), 'x1')
         .appendField('*')
         .appendField(new Blockly.FieldTextInput(actorname.value), 'x2');
    this.setOutput(true, 'Number'); 
    this.setColour('#7DDA58'); 
  }
};
pythonGenerator.forBlock['math_div'] = function(block) {
  const x1 = block.getFieldValue('x1');
  const x2 = block.getFieldValue('x2');
  return  `CabbageEngine.div(${x1},${x2})\n`;
};
Blockly.Blocks['math_sub'] = {
  init: function() {
    this.setStyle('math_blocks'); 
    this.appendDummyInput()
         .appendField(new Blockly.FieldTextInput(actorname.value), 'x1')
         .appendField('/')
         .appendField(new Blockly.FieldTextInput(actorname.value), 'x2');
    this.setOutput(true, 'Number'); 
    this.setColour('#7DDA58'); 
  }
};
pythonGenerator.forBlock['math_sub'] = function(block) {
  const x1 = block.getFieldValue('x1');
  const x2 = block.getFieldValue('x2');
  return  `CabbageEngine.sub(${x1},${x2})\n`;
};
Blockly.Blocks['math_random'] = {
  init: function () {
    this.setStyle('math_blocks');
    this.appendDummyInput()
      .appendField('在')
      .appendField(new Blockly.FieldTextInput(0), "x1")
      .appendField('到')
      .appendField(new Blockly.FieldTextInput(0), "x2")
      .appendField('之间的一个随机数');
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#8A2BE2');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['math_random'] = function(block) {
  const x1 = block.getFieldValue('x1');
  const x2 = block.getFieldValue('x2');
  return  `CabbageEngine.random(${x1},${x2})\n`;
};
Blockly.Blocks['math_G'] = {
  init: function() {
    this.setStyle('math_blocks'); 
    this.appendDummyInput()
         .appendField(new Blockly.FieldTextInput(actorname.value), 'x1')
         .appendField('>')
         .appendField(new Blockly.FieldTextInput(actorname.value), 'x2');
    this.setOutput(true, 'Number'); 
    this.setColour('#7DDA58'); 
  }
};
pythonGenerator.forBlock['math_G'] = function(block) {
  const x1 = block.getFieldValue('x1');
  const x2 = block.getFieldValue('x2');
  return  `CabbageEngine.G(${x1},${x2})\n`;
};
Blockly.Blocks['math_L'] = {
  init: function() {
    this.setStyle('math_blocks'); 
    this.appendDummyInput()
         .appendField(new Blockly.FieldTextInput(actorname.value), 'x1')
         .appendField('<')
         .appendField(new Blockly.FieldTextInput(actorname.value), 'x2');
    this.setOutput(true, 'Number'); 
    this.setColour('#7DDA58'); 
  }
};
pythonGenerator.forBlock['math_L'] = function(block) {
  const x1 = block.getFieldValue('x1');
  const x2 = block.getFieldValue('x2');
  return  `CabbageEngine.L(${x1},${x2})\n`;
};
Blockly.Blocks['math_E'] = {
  init: function() {
    this.setStyle('math_blocks'); 
    this.appendDummyInput()
         .appendField(new Blockly.FieldTextInput(actorname.value), 'x1')
         .appendField('=')
         .appendField(new Blockly.FieldTextInput(actorname.value), 'x2');
    this.setOutput(true, 'Number'); 
    this.setColour('#7DDA58'); 
  }
};
pythonGenerator.forBlock['math_E'] = function(block) {
  const x1 = block.getFieldValue('x1');
  const x2 = block.getFieldValue('x2');
  return  `CabbageEngine.E(${x1},${x2})\n`;
};
Blockly.Blocks['math_AND'] = {
  init: function() {
    this.setStyle('logic_compare_blocks');
    this.appendValueInput('A')
      .setCheck('Boolean')
      .appendField('');
    this.appendValueInput('B')
      .setCheck('Boolean')
      .appendField('与');
    this.setInputsInline(true);
    this.setOutput(true, 'Boolean');
    this.setColour('#7DDA58');
    this.setTooltip('逻辑与运算，两个条件都满足时返回 true，否则返回 false');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['math_AND'] = function(block) {
  const a = pythonGenerator.valueToCode(block, 'A', pythonGenerator.ORDER_LOGICAL_AND) || 'False';
  const b = pythonGenerator.valueToCode(block, 'B', pythonGenerator.ORDER_LOGICAL_AND) || 'False';
  return [a + ' and ' + b, pythonGenerator.ORDER_LOGICAL_AND];
};
Blockly.Blocks['math_OR'] = {
  init: function() {
    this.setStyle('logic_compare_blocks');
    this.appendValueInput('A')
      .setCheck('Boolean')
      .appendField('');
    this.appendValueInput('B')
      .setCheck('Boolean')
      .appendField('或');
    this.setInputsInline(true);
    this.setOutput(true, 'Boolean');
    this.setColour('#7DDA58'); 
    this.setTooltip('逻辑或运算，两个条件中至少一个满足时返回 true，否则返回 false');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['math_OR'] = function(block) {
  const a = pythonGenerator.valueToCode(block, 'A', pythonGenerator.ORDER_LOGICAL_OR) || 'False';
  const b = pythonGenerator.valueToCode(block, 'B', pythonGenerator.ORDER_LOGICAL_OR) || 'False';
  return [a + ' or ' + b, pythonGenerator.ORDER_LOGICAL_OR];
};
Blockly.Blocks['math_NOT'] = {
  init: function() {
    this.setStyle('logic_compare_blocks');
    this.appendValueInput('A')
      .setCheck('Boolean')
      .appendField('非');
    this.setInputsInline(true);
    this.setOutput(true, 'Boolean');
    this.setColour('#7DDA58');
    this.setTooltip('逻辑非运算，条件不满足时返回 true，满足时返回 false');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['math_NOT'] = function(block) {
  const a = pythonGenerator.valueToCode(block, 'A', pythonGenerator.ORDER_LOGICAL_NOT) || 'False';
  return ['not ' + a, pythonGenerator.ORDER_LOGICAL_NOT];
};
Blockly.Blocks['math_connect'] = {
  init: function() {
    // 使用数学类样式，通常为圆形
    this.setStyle('math_blocks');
    this.appendValueInput('LEFT')
      .appendField('连接');
    this.appendValueInput('RIGHT')
      .appendField('和');
    this.setInputsInline(true);
    this.setOutput(true, 'String');
    this.setColour(160); // 自定义颜色
    this.setTooltip('将左右两边的内容连接成一个字符串');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['math_connect'] = function(block) {
  const left = pythonGenerator.valueToCode(block, 'LEFT', pythonGenerator.ORDER_NONE) || "''";
  const right = pythonGenerator.valueToCode(block, 'RIGHT', pythonGenerator.ORDER_NONE) || "''";
  const leftStr = `str(${left})`;
  const rightStr = `str(${right})`;
  return [leftStr + ' + ' + rightStr, pythonGenerator.ORDER_ADDITION];
};






Blockly.Blocks['variable_add'] = {
  init: function () {
    this.appendDummyInput()
     .appendField('将')
     .appendField(new Blockly.FieldTextInput(), 'v')
     .appendField('增加')
     .appendField(new Blockly.FieldTextInput(), 'x')
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#FE9900');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['variable_add'] = function(block) {
  const v = block.getFieldValue('v');
  const x = parseFloat(block.getFieldValue('x') || '0.0').toFixed(1);
  return `CabbageEngine.add(${v},${x})\n`;
};
Blockly.Blocks['variable_set'] = {
  init: function () {
    this.appendDummyInput()
     .appendField('将')
     .appendField(new Blockly.FieldTextInput(), 'v')
     .appendField('设为')
     .appendField(new Blockly.FieldTextInput(), 'x')
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#FE9900');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['variable_set'] = function(block) {
  const v = block.getFieldValue('v');
  const x = parseFloat(block.getFieldValue('x') || '0.0').toFixed(1);
  return `CabbageEngine.set(${v},${x})\n`;
};


Blockly.Blocks['variable_show'] = {
  init: function () {
    this.appendDummyInput()
     .appendField('显示变量')
     .appendField(new Blockly.FieldTextInput(), 'v')
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#FF5722');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['variable_show'] = function(block) {
  const v = block.getFieldValue('v');
  return `CabbageEngine.show(${v})\n`;
};

Blockly.Blocks['variable_hide'] = {
  init: function () {
    this.appendDummyInput()
     .appendField('隐藏变量')
     .appendField(new Blockly.FieldTextInput(), 'v')
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#FF5722');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['variable_hide'] = function(block) {
  const v = block.getFieldValue('v');
  return `CabbageEngine.hide(${v})\n`;
};
Blockly.Blocks['list_show'] = {
  init: function () {
    this.appendDummyInput()
     .appendField('显示列表')
     .appendField(new Blockly.FieldTextInput(), 'v')
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('E4080A');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['list_show'] = function(block) {
  const v = block.getFieldValue('v');
  return `CabbageEngine.show(${v})\n`;
};

Blockly.Blocks['list_hide'] = {
  init: function () {
    this.appendDummyInput()
     .appendField('隐藏列表')
     .appendField(new Blockly.FieldTextInput(), 'v')
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('E4080A');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['list_hide'] = function(block) {
  const v = block.getFieldValue('v');
  return `CabbageEngine.hide(${v})\n`;
};








// 使用 JSON 格式的工具箱配置
const TOOLBOX_CONFIG = {
  kind: 'categoryToolbox',
  scrollbars: false,
  contents: [
    {
      kind: 'category',
      name: '引擎',
      colour: '#5631E4',
      contents: [
        { kind: 'block', type: 'engine_move' },
        { kind: 'block', type: 'engine_rotateX' },
        { kind: 'block', type: 'engine_rotateY' },
        { kind: 'block', type: 'engine_face' },
        { kind: 'block', type: 'engine_moveto' },
        { kind: 'block', type: 'engine_movetoXYZ' },
        { kind: 'block', type: 'engine_movetoXYZtime' },
        { kind: 'block', type: 'engine_Xset' },
        { kind: 'block', type: 'engine_Yset' },
        { kind: 'block', type: 'engine_Zset' },
        { kind: 'block', type: 'engine_Xadd' },
        { kind: 'block', type: 'engine_Yadd' },
        { kind: 'block', type: 'engine_Zadd' },
        { kind: 'block', type: 'engine_X' },
        { kind: 'block', type: 'engine_Y' },
        { kind: 'block', type: 'engine_Z' }
      ]
    },
    {
      kind: 'category',
      name: '外观',
      colour: '#C501F6',
      contents: [
        { kind: 'block', type: 'appearance_cartoonSet' },
        { kind: 'block', type: 'appearance_nextCartoon' },
        { kind: 'block', type: 'appearance_playCartoon' },
        { kind: 'block', type: 'appearance_stopCartoon' },
        { kind: 'block', type: 'appearance_resetCartoon'},
        { kind: 'block', type: 'appearance_sizeAdd'},
        { kind: 'block', type: 'appearance_sizeSet'},
        { kind: 'block', type: 'appearance_show'},
        { kind: 'block', type: 'appearance_hide'},
        { kind: 'block', type: 'appearance_cartoon'},
        { kind: 'block', type: 'appearance_size'}
      ]
    },
    {
      kind: 'category',
      name: '事件',
      colour: '#FFDE59',
      contents: [
        { kind: 'block', type: 'event_gameStart'},
        { kind: 'bkock', type: 'event_keyboard'},
        { kind: 'bkock', type: 'event_RB'},
        { kind: 'bkock', type: 'event_broadcast'},
        { kind: 'bkock', type: 'event_broadcastWait'}

      ]
    },
    {
      kind: 'category',
      name: '控制',
      colour: '#FE9900',
      contents: [
        { kind: 'block', type: 'control_wait'},
        { kind: 'bkock', type: 'control_for'},
        { kind: 'bkock', type: 'control_forX'},
        { kind: 'bkock', type: 'control_if'},
        { kind: 'bkock', type: 'control_else'},
        { kind: 'bkock', type: 'control_wait2'},
        { kind: 'bkock', type: 'control_until'},
        { kind: 'bkock', type: 'control_stop'},
        { kind: 'bkock', type: 'control_cloneStart'},
        { kind: 'bkock', type: 'control_clone'},
        { kind: 'bkock', type: 'control_cloneDEL'},
        { kind: 'bkock', type: 'control_senceSet'},
        { kind: 'bkock', type: 'control_nextSence'},
      ]
    },
    {
      kind: 'category',
      name: '侦测',
      colour: '#42EEF4',
      contents: [
        { kind: 'block', type: 'detect_touch'},
        { kind: 'block', type: 'detect_distance'},
        { kind: 'block', type: 'detect_ask'},
        { kind: 'block', type: 'detect_keyboard1'},
        { kind: 'block', type: 'detect_keyboard0'},
        { kind: 'block', type: 'detect_mouse1'},
        { kind: 'block', type: 'detect_mouse0'},
        { kind: 'block', type: 'detect_attribute'}
      ]
    },
    {
      kind: 'category',
      name: '运算',
      colour: '#7DDA58',
      contents: [
        { kind: 'block', type: 'math_add' },
        { kind: 'block', type: 'math_mul' },
        { kind: 'block', type: 'math_div' },
        { kind: 'block', type: 'math_sub' },
        { kind: 'block', type: 'math_random' },
        { kind: 'block', type: 'math_G' },
        { kind: 'block', type: 'math_L' },
        { kind: 'block', type: 'math_E' },
        { kind: 'block', type: 'math_AND' },
        { kind: 'block', type: 'math_OR' },
        { kind: 'block', type: 'math_NOT' },
        { kind: 'block', type: 'math_connect' }/* ,
        { kind: 'block', type: 'math_str' },
        { kind: 'block', type: 'math_strNumber' },
        { kind: 'block', type: 'math_strInside' },
        { kind: 'block', type: 'math_mod' },
        { kind: 'block', type: 'math_other' } */
      ]
    },
    {
      kind: 'category',
      name: '变量',
      colour: '#FE9900',
      contents: [
        { kind: 'block', type: 'variable_add' },
        { kind: 'block', type: 'variable_set' },
        { kind: 'block', type: 'variable_show' },
        { kind: 'block', type: 'variable_hide' }
      ]
    },
    {
      kind: 'category',
      name: '列表',
      colour: '#E4080A',
      contents: [
       /*  { kind: 'block', type: 'list_add' },
        { kind: 'block', type: 'list_del' },
        { kind: 'block', type: 'list_delAll'},
        { kind: 'block', type: 'list_insert'},
        { kind: 'block', type: 'list_override' },
        { kind: 'block', type: 'list_list' },
        { kind: 'block', type: 'list_fristSer'},
        { kind: 'block', type: 'list_number'},
        { kind: 'block', type: 'list_incode' }, */
        { kind: 'block', type: 'list_show'},
        { kind: 'block', type: 'list_hide'}
      ]
    }
  ]
};

const BLOCK_CATEGORY_MAP = {
  'engine_move': '引擎',
  'engine_rotateX': '引擎',
  'engine_rotateY': '引擎',
  'engine_face': '引擎',
  'engine_moveto': '引擎',
  'engine_movetoXYZ': '引擎',
  'engine_movetoXYZtime': '引擎',
  'engine_Xset': '引擎',
  'engine_Yset': '引擎',
  'engine_Zset': '引擎',
  'engine_Xadd': '引擎',
  'engine_Yadd': '引擎',
  'engine_Zadd': '引擎',
  'engine_X': '引擎',
  'engine_Y': '引擎',
  'engine_Z': '引擎',
  'appearance_cartoonSet': '外观',
  'appearance_nextCartoon': '外观',
  'appearance_playCartoon': '外观',
  'appearance_stopCartoon': '外观',
  'appearance_resetCartoon': '外观',
  'appearance_sizeAdd': '外观',
  'appearance_sizeSet': '外观',
  'appearance_show': '外观',
  'appearance_hide': '外观',
  'appearance_cartoon':'外观',
  'appearance_size': '外观',
  'event_gameStart': '事件',
  'event_keyboard': '事件',
  'event_RB': '事件',
  'event_broadcast': '事件',
  'event_broadcastWait': '事件',
  'control_wait': '控制',
  'control_for': '控制',
  'control_forX': '控制',
  'control_if': '控制',
  'control_else': '控制',
  'control_wait2': '控制',
  'control_until': '控制',
  'control_stop': '控制',
  'control_cloneStart': '控制',
  'control_clone': '控制',
  'control_cloneDEL': '控制',
  'control_senceSet': '控制',
  'control_nextSence': '控制',
  'detect_touch': '侦测',
  'detect_distance': '侦测',
  'detect_ask': '侦测',
  'detect_keyboard1': '侦测',
  'detect_keyboard0': '侦测',
  'detect_mouse1': '侦测',
  'detect_mouse0': '侦测',
  'detect_attribute': '侦测',
  'math_add': '运算',
  'math_mul': '运算',
  'math_div': '运算',
  'math_sub': '运算',
  'math_random': '运算',
  'math_G': '运算',
  'math_L': '运算',
  'math_E': '运算',
  'math_AND': '运算',
  'math_OR': '运算',
  'math_NOT': '运算',
  'math_connect': '运算',
/*   'math_str': '运算',
  'math_strNumber': '运算',
  'math_strInside': '运算',
  'math_mod': '运算',
  'math_other': '运算', */
  'variable_add': '变量',
  'variable_set': '变量',
  'variable_show': '变量',
  'variable_hide': '变量',
/*   'list_add': '列表',
  'list_del': '列表',
  'list_delAll': '列表',
  'list_insert': '列表',
  'list_override': '列表',
  'list_list': '列表',
  'list_fristSer': '列表',
  'list_number': '列表',
  'list_incode': '列表', */
  'list_show': '列表',
  'list_hide': '列表'
};

const WORKSPACE_CONFIG = {
  toolbox: TOOLBOX_CONFIG,
  theme: Blockly.Themes.Dark,
  toolboxPosition: 'start',
  horizontalLayout: false,
  ContextMenu:true,
  scrollbars: {
    horizontal: false,
    vertical: false,
    set: false
  },  
  grid: {
    spacing: 20,
    length: 3,
    colour: '#ccc',
    snap: true
  },
  zoom: {
    controls: true,
    wheel: true,
    startScale: 1.0,
    maxScale: 3,
    minScale: 0.3
  },
  trashcan: true,
  renderer: 'zelos'
};

const saveWorkspaceToFile = async (workspaceData) => {
  try {
    if (!window.showSaveFilePicker) {
      console.error('File System Access API不可用');
      return false;
    }
    
    const jsonStr = JSON.stringify(workspaceData, null, 2);
    const options = {
      types: [{
        description: 'JSON文件',
        accept: {
          'application/json': ['.json']
        }
      }],
      suggestedName: `blockly_workspace_${Date.now()}.json`
    };
    
    const handle = await window.showSaveFilePicker(options);
    const writable = await handle.createWritable();

    await writable.write(jsonStr);
    await writable.close();
    
    return true;
  } catch (e) {
    console.error('保存文件失败:', e);
    return false;
  }
};

const loadWorkspaceFromFile = async () => {
  try {
    if (!window.showOpenFilePicker) {
      console.error('File System Access API不可用');
      return false;
    }
    
    const [fileHandle] = await window.showOpenFilePicker({
      types: [{
        description: 'JSON文件',
        accept: {
          'application/json': ['.json']
        }
      }]
    });
    
    const file = await fileHandle.getFile();
    const content = await file.text();
    
    if (!content || content.trim() === '') {
      console.error('文件内容为空');
      return false;
    }
    
    const workspaceData = JSON.parse(content);
    
    if (!workspaceData || 
        typeof workspaceData !== 'object' ||
        !workspaceData.blocks || 
        typeof workspaceData.blocks !== 'object') {
      console.error('无效的工作区数据格式');
      return false;
    }
    
    // 清空当前工作区
    workspace.value.clear();
    
    Blockly.serialization.workspaces.load(workspaceData, workspace.value);
    console.log('工作区已从文件载入');
    return true;
  } catch (e) {
    if (e.name !== 'AbortError') {
      console.error('载入工作区失败:', e);
    }
    return false;
  }
};


// 初始化 Blockly
const initBlockly = () => {
  const blocklyDiv = document.getElementById('blockdiv');
  if (!blocklyDiv) {
    console.error('Blockly 容器未找到');
    return;
  }

  // 设置语言
  Blockly.setLocale(CN);
  initBlocklyAndGenerators();

  // 创建工作区
  workspace.value = Blockly.inject(blocklyDiv, WORKSPACE_CONFIG);

  Blockly.ContextMenuRegistry.registry.register({
    displayText: '保存工作区',
    preconditionFn: (scope) => {
      return workspace.value && workspace.value.getAllBlocks(false).length > 0 ? 'enabled' : 'disabled';
    },
    callback: async () => {
      const workspaceData = Blockly.serialization.workspaces.save(workspace.value);
      const success = await saveWorkspaceToFile(workspaceData);
      if (success) {
        console.log('工作区已保存到文件');
      }
    },
    scopeType: Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
    id: 'saveWorkspace',
    weight: 1
  });
  Blockly.ContextMenuRegistry.registry.register({
    displayText: '载入工作区',
    preconditionFn: () => 'enabled',
    callback: async () => {
      await loadWorkspaceFromFile();
    },
    scopeType: Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
    id: 'loadWorkspace', 
    weight: 2
  });
  Blockly.ContextMenuRegistry.registry.register({
    displayText: '运行',
    preconditionFn: (scope) => {
      return workspace.value && workspace.value.getAllBlocks(false).length > 0 ? 'enabled' : 'disabled';
    },
    callback: async () => {
        const code = pythonGenerator.workspaceToCode(workspace.value);
        if (window.pyBridge) {
            window.pyBridge.executePythonCode(code,actorname.value);
        }
    },
    scopeType: Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
    id: 'executePythonCode',
    weight: 3
  });
  // 配置工具箱样式
  const toolbox = blocklyDiv.querySelector('.blocklyToolboxDiv');
  if (toolbox) {
    toolbox.style.overflow = 'hidden';
  }
  const toolboxDiv = document.querySelector('.blocklyToolboxDiv');
  if (toolboxDiv) {
    toolboxDiv.style.overflow = 'hidden';
  }

  // 添加块创建事件监听器
  setupBlockListener();

  workspace.value.addChangeListener((event) => {
    if (event.type === Blockly.Events.TOOLBOX_ITEM_SELECT) {
      console.log('选中分类:', event.itemName);
    }
  });
};

const setupBlockListener = () => {
  if (!workspace.value) return;

  workspace.value.addChangeListener((event) => {
    if (event.type === Blockly.Events.BLOCK_CREATE) {
      handleBlockCreate(event);
    }
  });
};

// 处理块创建事件
const handleBlockCreate = (event) => {
  const block = workspace.value.getBlockById(event.blockId);
  if (!block) return;

  const blockType = block.type;
  const categoryName = BLOCK_CATEGORY_MAP[blockType];

  if (categoryName) {
    const toolbox = workspace.value.getToolbox();
    if (toolbox) {
      const categories = toolbox.getToolboxItems();
      const targetCategory = categories.find(cat => cat.name === categoryName);
      if (targetCategory) {
        toolbox.setSelectedItem(targetCategory);
      }
    }
  }
};

const updatePosition = () => {
  if (window.pyBridge) {
    window.pyBridge.actorOperation(JSON.stringify({
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
    window.pyBridge.actorOperation(JSON.stringify({
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

const updateScale = () => {
  if (window.pyBridge) {
    window.pyBridge.actorOperation(JSON.stringify({
      Operation: "Scale",
      sceneName: scenename.value,
      x: parseFloat(sx.value),
      y: parseFloat(sy.value),
      z: parseFloat(sz.value),
      actorName: actorname.value
    }));
    console.error('updateScale', sx.value, sy.value, sz.value); // 调试用，确保值正确传递到 Python 端
  } 
}

//关闭浮动窗口
const closeFloat = () => {
  if (window.pyBridge) {
    window.pyBridge.removeDockWidget(routename.value);
  }
};

const handleResizeMove = (e) => {
  if (dragState.value.isResizing) onResize(e);
};

const handleResizeUp = () => {
  if (dragState.value.isResizing) stopResize();
};

onMounted(() => {
  scenename.value = route.query.sceneName;
  actorname.value = route.query.objectName;
  character.value = decodeURIComponent(route.query.path);
  routename.value = route.query.routename;
  initBlockly();
  document.addEventListener('mousemove', handleResizeMove);
  document.addEventListener('mouseup', handleResizeUp);
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
});

// 组件卸载时清理
onUnmounted(() => {
  // 这里假设 closeWorkspace 是一个自定义函数，需要根据实际情况实现
  // closeWorkspace();
  document.removeEventListener('mousemove', handleResizeMove);
  document.removeEventListener('mouseup', handleResizeUp);
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
});
</script>

<style scoped>
.blockly-container {
  width: 100%;
  height: 100%;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: #fff;
}
#blockdiv :deep(.blocklyZoom) {
  display: flex !important;
  opacity: 1 !important;
}
#blockdiv :deep(.blocklyTrash) {
  opacity: 1 !important;
}
svg {
  display: inline !important;
}
svg[display="none"] {
  display: none !important;
}
</style>