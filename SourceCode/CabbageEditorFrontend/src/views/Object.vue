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

Blockly.setLocale(CN);

Blockly.Blocks['detect_collision'] = {
  init: function () {
    this.appendDummyInput()
     .appendField('如果碰到')
     .appendField(new Blockly.FieldTextInput(actorname.value), 'TARGET');
    this.setInputsInline(true);
    this.setPreviousStatement(true, null); 
    this.setNextStatement(true, null);
    this.setColour('#00FFFF');
    this.setHelpUrl('');
    this.setTooltip('检测该角色是与指定角色否发生碰撞');//改为true or falsh
  }
};
pythonGenerator.forBlock['detect_collision'] = function(block) {
  const target = block.getFieldValue('TARGET');
  return `CabbageEngine.collisionDetection(${target})\n`;
};

Blockly.Blocks['detect_press'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('按下')
      .appendField(new Blockly.FieldTextInput(actorname.value), 'TARGET');
    this.setOutput(true, 'Boolean');  // 设置输出为布尔值
    this.setInputsInline(true);
    this.setColour('#00FFFF');
    this.setHelpUrl('');
    this.setTooltip('检测该按钮是否被按下，返回true或false');
  }
};
pythonGenerator.forBlock['detect_press'] = function(block) {
  const target = block.getFieldValue('TARGET');
  return `CabbageEngine.collisionDetection(${target})`;
};

Blockly.Blocks['detect_press_mouse'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('按下鼠标？');
    this.setOutput(true, 'Boolean');  // 设置输出为布尔值
    this.setInputsInline(true);
    this.setColour('#00FFFF');
    this.setHelpUrl('');
    this.setTooltip('检测鼠标是否被按下，返回true或false');
  }
};
pythonGenerator.forBlock['detect_press_mouse'] = function(block) {
  return `CabbageEngine.collisionDetection()`;
};

Blockly.Blocks['engine_move_actor'] = {
  init: function () {
    this.appendDummyInput()
     .appendField('移动角色')
     .appendField(new Blockly.FieldTextInput(actorname.value), 'NAME')
     .appendField('向量')
     .appendField('x:')
     .appendField(new Blockly.FieldTextInput('0.0'), 'X')
     .appendField('y:')
      .appendField(new Blockly.FieldTextInput('0.0'), 'Y')
      .appendField('z:')
      .appendField(new Blockly.FieldTextInput('0.0'), 'Z');
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#FF5722');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['engine_move_actor'] = function(block) {
  const x = parseFloat(block.getFieldValue('X') || '0.0').toFixed(1);
  const y = parseFloat(block.getFieldValue('Y') || '0.0').toFixed(1);
  const z = parseFloat(block.getFieldValue('Z') || '0.0').toFixed(1);
  const name = block.getFieldValue('NAME');
  return `CabbageEngine.moveActor(${name}, [${x}, ${y}, ${z}])\n`;
};
Blockly.Blocks['engine_rotate_actor'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('旋转角色')
      .appendField(new Blockly.FieldTextInput(actorname.value), 'NAME')
      .appendField('到角度')
      .appendField('x:')
      .appendField(new Blockly.FieldTextInput('0.0'), 'X')
      .appendField('°')
      .appendField('y:')
      .appendField(new Blockly.FieldTextInput('0.0'), 'Y')
      .appendField('°')
      .appendField('z:')
      .appendField(new Blockly.FieldTextInput('0.0'), 'Z')
      .appendField('°');
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#FF5722');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['engine_rotate_actor'] = function(block) {
  const x = parseFloat(block.getFieldValue('X') || '0.0').toFixed(1);
  const y = parseFloat(block.getFieldValue('Y') || '0.0').toFixed(1);
  const z = parseFloat(block.getFieldValue('Z') || '0.0').toFixed(1);
  const name = block.getFieldValue('NAME');
  return `CabbageEngine.rotateActor(${name}, [${x}, ${y}, ${z}])\n`;
};
Blockly.Blocks['engine_scale_actor'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('缩放角色')
      .appendField(new Blockly.FieldTextInput(actorname.value), 'NAME')
      .appendField('到比例')
      .appendField('x:')
      .appendField(new Blockly.FieldTextInput('1.0'), 'X')
      .appendField('y:')
     .appendField(new Blockly.FieldTextInput('1.0'), 'Y')
     .appendField('z:')
     .appendField(new Blockly.FieldTextInput('1.0'), 'Z');
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#FF5722');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['engine_scale_actor'] = function(block) {
  const x = parseFloat(block.getFieldValue('X') || '0.0').toFixed(1);
  const y = parseFloat(block.getFieldValue('Y') || '0.0').toFixed(1);
  const z = parseFloat(block.getFieldValue('Z') || '0.0').toFixed(1);
  const name = block.getFieldValue('NAME');
  return `CabbageEngine.scaleActor(${name}, [${x}, ${y}, ${z}])\n`;
};


Blockly.Blocks['event_keyboardEventHandling'] = {
  init: function(){
    this.appendDummyInput()
      .appendField('当按下')
      .appendField(new Blockly.FieldTextInput(actorname.value),'KEY');
    this.setInputsInline(true);
    this.setPreviousStatement(false, null);
    this.setNextStatement(true, null);
    this.setColour('#5C97FF');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['event_keyboardEventHandling'] = function(block) {
  const key = block.getFieldValue('KEY');
  return  `CabbageEngine.scaleActor(${key})\n`;
};

Blockly.Blocks['event_gameStart'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('当游戏开始时')
    this.setInputsInline(true);
    this.setPreviousStatement(false, null);
    this.setNextStatement(true, null);
    this.setColour('#5C97FF');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['event_gameStart'] = function(block) {
  return `CabbageEngine.scaleaddActor()\n`;
};

Blockly.Blocks['event_cloneStart'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('当作为克隆体启动时')
    this.setInputsInline(true);
    this.setPreviousStatement(false, null);
    this.setNextStatement(true, null);
    this.setColour('#5C97FF');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['event_cloneStart'] = function(block) {
  return `CabbageEngine.scaleaddActor()\n`;
};

Blockly.Blocks['ask'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('询问')
      .appendField(new Blockly.FieldTextInput(actorname.value),'TEXT');
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#5C97FF');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['ask'] = function(block) {
  const text = block.getFieldValue('TEXT') || '';
  return `CabbageEngine.scaleaddActor(${text})\n`;
};


Blockly.Blocks['event_scenairChange'] = {
  init: function(){
    this.appendDummyInput()
      .appendField('当场景切换为')
      .appendField(new Blockly.FieldTextInput(actorname.value),'Scenario_ID')
      .appendField('时');
    this.setInputsInline(true);
    this.setPreviousStatement(false, null);
    this.setNextStatement(true, null);
    this.setColour('#5C97FF');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['event_scenairChange'] = function(block) {
  const scid = block.getFieldValue('Scenario_ID');
  return  `CabbageEngine.scaleActor(${scid})\n`;
};

Blockly.Blocks['variable_assignTo'] = {
  init: function () {
    this.appendDummyInput()
     .appendField('将')
     .appendField(new Blockly.FieldTextInput(), 'VARIABLENAME')
     .appendField('设为')
     .appendField(new Blockly.FieldTextInput(), 'VALUE')
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#FF5722');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['variable_assignTo'] = function(block) {
  const name = block.getFieldValue('VARIABLENAME');
  const value = parseFloat(block.getFieldValue('VALUE') || '0.0').toFixed(1);
  return `CabbageEngine.moveActor(${name},${value})\n`;
};

Blockly.Blocks['variable_add'] = {
  init: function () {
    this.appendDummyInput()
     .appendField('将')
     .appendField(new Blockly.FieldTextInput(), 'VARIABLENAME')
     .appendField('加上')
     .appendField(new Blockly.FieldTextInput(), 'VALUE')
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#FF5722');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['variable_add'] = function(block) {
  const name = block.getFieldValue('VARIABLENAME');
  const value = parseFloat(block.getFieldValue('VALUE') || '0.0').toFixed(1);
  return `CabbageEngine.moveActor(${name},${value})\n`;
};


Blockly.Blocks['variable_show'] = {
  init: function () {
    this.appendDummyInput()
     .appendField('显示变量')
     .appendField(new Blockly.FieldTextInput(), 'VARIABLENAME')
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#FF5722');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['variable_show'] = function(block) {
  const name = block.getFieldValue('VARIABLENAME');
  return `CabbageEngine.moveActor(${name})\n`;
};

Blockly.Blocks['variable_hide'] = {
  init: function () {
    this.appendDummyInput()
     .appendField('隐藏变量')
     .appendField(new Blockly.FieldTextInput(), 'VARIABLENAME')
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#FF5722');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['variable_hide'] = function(block) {
  const name = block.getFieldValue('VARIABLENAME');
  return `CabbageEngine.moveActor(${name})\n`;
};



Blockly.Blocks['math_add'] = {
  init: function() {
    // 设置圆形外观（需搭配CSS或主题）
    this.setStyle('math_blocks');  // 使用数学类样式（通常自带圆形）
    this.appendDummyInput()
        .appendField(new Blockly.FieldTextInput(0), "VALUE1")
        .appendField('+')
        .appendField(new Blockly.FieldTextInput(0), "VALUE2");  // 数字输入框
    this.setOutput(true, 'Number');  // 关键：输出数值类型
    this.setColour(230);  // 数学积木常用橙色
    this.setTooltip("可在数学运算中使用的圆形操作数");
  }
};
pythonGenerator.forBlock['math_add'] = function(block) {
  const value1 = block.getFieldValue('VALUE1');
  const value2 = block.getFieldValue('VALUE2');
  return  `CabbageEngine.scaleActor(${value1},${value2})\n`;  // 返回基础数值
};

Blockly.Blocks['math_sub'] = {
  init: function() {
    // 设置圆形外观
    this.setStyle('math_blocks');  // 使用数学类样式（通常自带圆形）
    this.appendDummyInput()
        .appendField(new Blockly.FieldTextInput(0), "VALUE1")
        .appendField('-')
        .appendField(new Blockly.FieldTextInput(0), "VALUE2");  // 数字输入框
    this.setOutput(true, 'Number');  // 关键：输出数值类型
    this.setColour(230);  // 数学积木常用橙色
    this.setTooltip("可在数学运算中使用的圆形操作数");
  }
};
pythonGenerator.forBlock['math_sub'] = function(block) {
  const value1 = block.getFieldValue('VALUE1');
  const value2 = block.getFieldValue('VALUE2');
  return  `CabbageEngine.scaleActor(${value1},${value2})\n`;  // 返回基础数值
};

Blockly.Blocks['math_mul'] = {
  init: function() {
    // 设置圆形外观
    this.setStyle('math_blocks');  // 使用数学类样式（通常自带圆形）
    this.appendDummyInput()
        .appendField(new Blockly.FieldTextInput(0), "VALUE1")
        .appendField('*')
        .appendField(new Blockly.FieldTextInput(0), "VALUE2");  // 数字输入框
    this.setOutput(true, 'Number');  // 关键：输出数值类型
    this.setColour(230);  // 数学积木常用橙色
    this.setTooltip("可在数学运算中使用的圆形操作数");
  }
};
pythonGenerator.forBlock['math_mul'] = function(block) {
  const value1 = block.getFieldValue('VALUE1');
  const value2 = block.getFieldValue('VALUE2');
  return  `CabbageEngine.scaleActor(${value1},${value2})\n`;  // 返回基础数值
};

Blockly.Blocks['math_div'] = {
  init: function() {
    // 设置圆形外观（需搭配CSS或主题）
    this.setStyle('math_blocks');  // 使用数学类样式（通常自带圆形）
    this.appendDummyInput()
        .appendField(new Blockly.FieldTextInput(0), "VALUE1")
        .appendField('/')
        .appendField(new Blockly.FieldTextInput(0), "VALUE2");  // 数字输入框
    this.setOutput(true, 'Number');  // 关键：输出数值类型
    this.setColour(230);  // 数学积木常用橙色
    this.setTooltip("可在数学运算中使用的圆形操作数");
  }
};
pythonGenerator.forBlock['math_div'] = function(block) {
  const value1 = block.getFieldValue('VALUE1');
  const value2 = block.getFieldValue('VALUE2');
  return  `CabbageEngine.scaleActor(${value1},${value2})\n`;  // 返回基础数值
};

Blockly.Blocks['random'] = {
  init: function () {
    this.setStyle('math_blocks');
    this.appendDummyInput()
      .appendField('在')
      .appendField(new Blockly.FieldTextInput(0), "VALUE1")
      .appendField('到')
      .appendField(new Blockly.FieldTextInput(0), "VALUE2")
      .appendField('之间的一个随机数');
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#8A2BE2');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['random'] = function(block) {
  const value1 = block.getFieldValue('VALUE1');
  const value2 = block.getFieldValue('VALUE2');
  return  `CabbageEngine.scaleActor(${value1},${value2})\n`;  // 返回基础数值
};

Blockly.Blocks['wait'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('等待')
      .appendField(new Blockly.FieldTextInput(), 'NUMBER')
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#8A2BE2');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['wait'] = function(block) {
  const number = parseFloat(block.getFieldValue('NUMBER') || '0.0').toFixed(1);
  return `CabbageEngine.scalespeaddZActor(${number})\n`;
};

Blockly.Blocks['clone'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('克隆')
      .appendField(new Blockly.FieldTextInput(), 'NUMBER')
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#8A2BE2');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['clone'] = function(block) {
  const number = parseFloat(block.getFieldValue('NUMBER') || '0.0').toFixed(1);
  return `CabbageEngine.scalespeaddZActor(${number})\n`;
};

Blockly.Blocks['clone_del'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('删除此克隆体')
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(flash, null);
    this.setColour('#8A2BE2');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['clone_del'] = function(block) {
  return `CabbageEngine.scaleaddActor()\n`;
};



// 使用 JSON 格式的工具箱配置
const TOOLBOX_CONFIG = {
  kind: 'categoryToolbox',
  scrollbars: false,
  contents: [
    {
      kind: 'category',
      name: '引擎',
      colour: '#FF5722',
      contents: [
        { kind: 'block', type: 'engine_move_actor' },
        { kind: 'block', type: 'engine_movetoplass_actor' },
        { kind: 'block', type: 'engine_moveto_actor' },
        { kind: 'block', type: 'engine_movetotimeplass_actor' },
        { kind: 'block', type: 'engine_movetotime_actor' },
        { kind: 'block', type: 'engine_rotate_actor' },
        { kind: 'block', type: 'engine_faceplass_actor' },
        { kind: 'block', type: 'engine_face_actor' },
        { kind: 'block', type: 'engine_moveX_actor' },
        { kind: 'block', type: 'engine_movetoX_actor' },
        { kind: 'block', type: 'engine_moveY_actor' },
        { kind: 'block', type: 'engine_movetoY_actor' },
        { kind: 'block', type: 'engine_moveZ_actor' },
        { kind: 'block', type: 'engine_movetoZ_actor' },
      ]
    },
    {
      kind: 'category',
      name: '外观',
      colour: '#8A2BE2',
      contents: [
        { kind: 'block', type: 'appearance_scaleadd_actor' },
        { kind: 'block', type: 'appearance_scale_actor' },
        { kind: 'block', type: 'appearance_hide_actor' },
        { kind: 'block', type: 'appearance_show_actor' },
        { kind: 'block', type: 'appearance_scalespe_actor'},
        { kind: 'block', type: 'appearance_scalespeaddX_actor'},
        { kind: 'block', type: 'appearance_scalespeaddY_actor'},
        { kind: 'block', type: 'appearance_scalespeaddZ_actor'},
        { kind: 'block', type: 'appearance_scalespeX_actor'},
        { kind: 'block', type: 'appearance_scalespeY_actor'},
        { kind: 'block', type: 'appearance_scalespeZ_actor'}
      ]
    },
    {
      kind: 'category',
      name: '事件',
      colour: '#855E42',
      contents: [
        { kind: 'block', type: 'event_keyboardEventHandling'},
        { kind: 'bkock', type: 'event_gameStart'},
        { kind: 'bkock', type: 'event_scenairChange'},
        { kind: 'bkock', type: 'event_cloneStart'},
      ]
    },
    {
      kind: 'category',
      name: '变量',
      colour: '#FF6680',
      contents: [
        { kind: 'block', type: 'variable_assignTo' },
        { kind: 'block', type: 'variable_add' },
        { kind: 'block', type: 'variable_show' },
        { kind: 'block', type: 'variable_hide' },
        { kind: 'block', type: 'math_change' }
      ]
    },
    {
      kind: 'category',
      name: '数学',
      colour: '#FFAB19',
      contents: [
        { kind: 'block', type: 'math_add' },
        { kind: 'block', type: 'math_mul' },
        { kind: 'block', type: 'math_div' },
        { kind: 'block', type: 'math_sub' },
        { kind: 'block', type: 'random' },
        { kind: 'block', type: 'logic_compare' }
      ]
    },
    {
      kind: 'category',
      name: '控制',
      colour: '#FFAB19',
      contents: [
        { kind: 'block', type: 'wait' },
        { kind: 'block', type: 'ask' },
        { kind: 'block', type: 'clone'},
        { kind: 'block', type: 'clone_del'}
      ]
    },
    {
      kind: 'category',
      name: '侦测',
      colour: '#00FFFF',
      contents: [
        { kind: 'block', type: 'detect_collision'},
        { kind: 'block', type: 'detect_press_mouse'},
        { kind: 'block', type: 'detect_press'},

      ]
    }
  ]
};

const BLOCK_CATEGORY_MAP = {
  'engine_move_actor': '引擎',
  'engine_moveto_actor': '引擎',
  'engine_movetotimeplass_actor': '引擎',
  'engine_movetotime_actor': '引擎',
  'engine_movetoplass_actor': '引擎',
  'engine_faceplass_actor': '引擎',
  'engine_face_actor': '引擎',
  'engine_rotate_actor': '引擎',
  'engine_moveX_actor': '引擎',
  'engine_movetoX_actor': '引擎',
  'engine_moveY_actor': '引擎',
  'engine_movetoY_actor': '引擎',
  'engine_moveZ_actor': '引擎',
  'engine_movetoZ_actor': '引擎',
  'appearance_scaleadd_actor': '外观',
  'appearance_scale_actor': '外观',
  'appearance_hide_actor': '外观',
  'appearance_show_actor': '外观',
  'appearance_scalespe_actor': '外观',
  'appearance_scalespeaddX_actor': '外观',
  'appearance_scalespeaddY_actor': '外观',
  'appearance_scalespeaddZ_actor': '外观',
  'appearance_scalespeX_actor': '外观',
  'appearance_scalespeY_actor': '外观',
  'appearance_scalespeZ_actor': '外观',
  'logic_compare': '数学',
  'logic_boolean': '逻辑',
  'math_change': '变量',
  'event_keyboardEventHandling':'事件',
  'event_gameStart':'事件',
  'event_scenairChange':'事件',
  'event_cloneStart':'事件',
  'variable_assignTo':'变量',
  'variable_add':'变量',
  'variable_show':'变量',
  'variable_hide':'变量',
  'detect_collision':'侦测',
  'detect_press_mouse':'侦测',
  'detect_press':'侦测',
  'math_add':'数学',
  'math_mul':'数学',
  'math_div':'数学',
  'math_sub':'数学',
  'random':'数学',
  'wait':'控制',
  'ask':'控制',
  'clone':'控制',
  'clone_del':'控制',
  



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
    window.pyBridge.HandleActorMove(JSON.stringify({
      px: parseFloat(px.value),
      py: parseFloat(py.value),
      pz: parseFloat(pz.value),
      actorname: actorname.value
    }));
    console.error('updatePosition', actorname.value, px.value, py.value, pz.value); // 调试用，确保值正确传递到 Python 端
  } 
}

const updateRotation = () => {
  if (window.pyBridge) {
    window.pyBridge.HandleActorRotate(JSON.stringify({
      rx: parseFloat(rx.value),
      ry: parseFloat(ry.value),
      rz: parseFloat(rz.value),
      actorname: actorname.value
    }));
    console.error('updateRotation', rx.value, ry.value, rz.value); // 调试用，确保值正确传递到 Python 端
  }
}

const updateScale = () => {
  if (window.pyBridge) {
    window.pyBridge.HandleActorScale(JSON.stringify({
      sx: parseFloat(sx.value),
      sy: parseFloat(sy.value),
      sz: parseFloat(sz.value),
      actorname: actorname.value
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

onMounted(() => {
  actorname.value = parseInt(route.query.index);
  character.value = decodeURIComponent(route.query.path);
  routename.value = route.query.routename;
  console.error('Received actor index:', actorname.value);
  console.error('Received character:', character.value);
  console.error('Received routename:', routename.value);

  initBlockly();
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
  document.addEventListener('mousemove', onResize);
  document.addEventListener('mouseup', stopResize);

});

// 组件卸载时清理
onUnmounted(() => {
  // 这里假设 closeWorkspace 是一个自定义函数，需要根据实际情况实现
  // closeWorkspace();
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
  document.removeEventListener('mousemove', onResize);
  document.removeEventListener('mouseup', stopResize);

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