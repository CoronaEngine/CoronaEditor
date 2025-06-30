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

const workspace = ref(null);
const character = ref('');
const px=ref('0.0'), py=ref('0.0'), pz=ref('0.0');
const rx=ref('0.0'), ry=ref('0.0'), rz=ref('0.0');
const sx=ref('1.0'), sy=ref('1.0'), sz=ref('1.0');
const isFloating = ref(false);
const route = useRoute();
const scenename = ref(null);
const actorname = ref(null);
const routename = ref(null);

Blockly.setLocale(CN);

Blockly.Blocks['detect_collision'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('碰到')
      .appendField(new Blockly.FieldTextInput(actorname.value), 'TARGET');
    this.setOutput(true, 'Boolean');  // 设置输出为布尔值
    this.setInputsInline(true);
    this.setColour('#00FFFF');
    this.setHelpUrl('');
    this.setTooltip('检测该角色是否与指定角色发生碰撞，返回true或false');
  }
};
pythonGenerator.forBlock['detect_collision'] = function(block) {
  const target = block.getFieldValue('TARGET');
  return `CabbageEngine.collisionDetection(${target})`;
};

Blockly.Blocks['engine_move_actor'] = {
  init: function () {
    this.appendDummyInput()
     .appendField('移动')
     .appendField(new Blockly.FieldTextInput(), 'NUMBER')
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#FF5722');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['engine_move_actor'] = function(block) {
  const number = parseFloat(block.getFieldValue('NUMBER') || '0.0').toFixed(1);
  return `CabbageEngine.moveActor(${number})\n`;
};

Blockly.Blocks['engine_moveto_actor'] = {
  init: function () {
    this.appendDummyInput()
     .appendField('移到')
     .appendField('x:')
     .appendField(new Blockly.FieldTextInput(), 'X')
     .appendField('y:')
      .appendField(new Blockly.FieldTextInput(), 'Y')
      .appendField('z:')
      .appendField(new Blockly.FieldTextInput(), 'Z');
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#FF5722');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['engine_moveto_actor'] = function(block) {
  const x = parseFloat(block.getFieldValue('X') || '0.0').toFixed(1);
  const y = parseFloat(block.getFieldValue('Y') || '0.0').toFixed(1);
  const z = parseFloat(block.getFieldValue('Z') || '0.0').toFixed(1);
  return `CabbageEngine.moveToActor([${x}, ${y}, ${z}])\n`;
};

Blockly.Blocks['engine_movetoplass_actor'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('移到')
      .appendField(new Blockly.FieldDropdown([
        ['角色1', 'actor1'],
        ['角色2', 'actor2'],
        ['角色3', 'actor3']
      ]), 'ACTOR')
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#FF5722');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['engine_movetoplass_actor'] = function(block) {
  const actor = block.getFieldValue('ACTOR');
  return `CabbageEngine.moveToPlassActor(${actor})\n`;
};

Blockly.Blocks['engine_movetotimeplass_actor'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('在')
      .appendField(new Blockly.FieldTextInput('1'), 'T')
      .appendField('秒内移到')
      .appendField(new Blockly.FieldDropdown([
        ['角色1', 'actor1'],
        ['角色2', 'actor2'],
        ['角色3', 'actor3']
      ]), 'ACTOR')
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#FF5722');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['engine_movetoplass_actor'] = function(block) {
  const actor = block.getFieldValue('ACTOR');
  const t = block.getFieldValue('T');
  return `CabbageEngine.moveToTimePlassActor(${t},${actor})\n`;
};

Blockly.Blocks['engine_movetotime_actor'] = {
  init: function () {
    this.appendDummyInput()
     .appendField('在')
     .appendField(new Blockly.FieldTextInput("1"), 'T')
     .appendField('秒内移到')
     .appendField('x:')
     .appendField(new Blockly.FieldTextInput(), 'X')
     .appendField('y:')
      .appendField(new Blockly.FieldTextInput(), 'Y')
      .appendField('z:')
      .appendField(new Blockly.FieldTextInput(), 'Z');
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#FF5722');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['engine_movetotime_actor'] = function(block) {
  const t = parseFloat(block.getFieldValue('T') || '0.0').toFixed(1);
  const x = parseFloat(block.getFieldValue('X') || '0.0').toFixed(1);
  const y = parseFloat(block.getFieldValue('Y') || '0.0').toFixed(1);
  const z = parseFloat(block.getFieldValue('Z') || '0.0').toFixed(1);
  return `CabbageEngine.moveToTimeActor(${t},[${x}, ${y}, ${z}])\n`;
};

Blockly.Blocks['engine_rotate_actor'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('旋转')
      .appendField('x:')
      .appendField(new Blockly.FieldTextInput(), 'X')
      .appendField('°')
      .appendField('y:')
      .appendField(new Blockly.FieldTextInput(), 'Y')
      .appendField('°')
      .appendField('z:')
      .appendField(new Blockly.FieldTextInput(), 'Z')
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
  return `CabbageEngine.rotateActor([${x}, ${y}, ${z}])\n`;
};

Blockly.Blocks['engine_faceplass_actor'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('面向')
      .appendField(new Blockly.FieldDropdown([
        ['角色1', 'actor1'],
        ['角色2', 'actor2'],
        ['角色3', 'actor3']
      ]), 'ACTOR')
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#FF5722');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['engine_faceplass_actor'] = function(block) {
  const actor = block.getFieldValue('ACTOR');
  return `CabbageEngine.moveToPlassActor(${actor})\n`;
};

Blockly.Blocks['engine_face_actor'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('面向')
      .appendField('x:')
      .appendField(new Blockly.FieldTextInput(), 'X')
      .appendField('°')
      .appendField('y:')
      .appendField(new Blockly.FieldTextInput(), 'Y')
      .appendField('°')
      .appendField('z:')
      .appendField(new Blockly.FieldTextInput(), 'Z')
      .appendField('°');
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#FF5722');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['engine_face_actor'] = function(block) {
  const x = parseFloat(block.getFieldValue('X') || '0.0').toFixed(1);
  const y = parseFloat(block.getFieldValue('Y') || '0.0').toFixed(1);
  const z = parseFloat(block.getFieldValue('Z') || '0.0').toFixed(1);
  return `CabbageEngine.faceActor([${x}, ${y}, ${z}])\n`;
};

Blockly.Blocks['engine_moveX_actor'] = {
  init: function () {
    this.appendDummyInput()
     .appendField('将x轴增加')
     .appendField(new Blockly.FieldTextInput(), 'NUMBER')
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#FF5722');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['engine_moveX_actor'] = function(block) {
  const number = parseFloat(block.getFieldValue('NUMBER') || '0.0').toFixed(1);
  return `CabbageEngine.moveXActor(${number})\n`;
};

Blockly.Blocks['engine_movetoX_actor'] = {
  init: function () {
    this.appendDummyInput()
     .appendField('将x轴设为')
     .appendField(new Blockly.FieldTextInput(), 'NUMBER')
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#FF5722');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['engine_moveX_actor'] = function(block) {
  const number = parseFloat(block.getFieldValue('NUMBER') || '0.0').toFixed(1);
  return `CabbageEngine.movetoXActor(${number})\n`;
};

Blockly.Blocks['engine_moveY_actor'] = {
  init: function () {
    this.appendDummyInput()
     .appendField('将y轴增加')
     .appendField(new Blockly.FieldTextInput(), 'NUMBER')
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#FF5722');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['engine_moveY_actor'] = function(block) {
  const number = parseFloat(block.getFieldValue('NUMBER') || '0.0').toFixed(1);
  return `CabbageEngine.moveYActor(${number})\n`;
};

Blockly.Blocks['engine_movetoY_actor'] = {
  init: function () {
    this.appendDummyInput()
     .appendField('将y轴设为')
     .appendField(new Blockly.FieldTextInput(), 'NUMBER')
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#FF5722');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['engine_movetoY_actor'] = function(block) {
  const number = parseFloat(block.getFieldValue('NUMBER') || '0.0').toFixed(1);
  return `CabbageEngine.movetoYActor(${number})\n`;
};

Blockly.Blocks['engine_moveZ_actor'] = {
  init: function () {
    this.appendDummyInput()
     .appendField('将z轴增加')
     .appendField(new Blockly.FieldTextInput(), 'NUMBER')
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#FF5722');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['engine_moveZ_actor'] = function(block) {
  const number = parseFloat(block.getFieldValue('NUMBER') || '0.0').toFixed(1);
  return `CabbageEngine.moveZActor(${number})\n`;
};

Blockly.Blocks['engine_movetoZ_actor'] = {
  init: function () {
    this.appendDummyInput()
     .appendField('将z轴设为')
     .appendField(new Blockly.FieldTextInput(), 'NUMBER')
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#FF5722');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['engine_movetoZ_actor'] = function(block) {
  const number = parseFloat(block.getFieldValue('NUMBER') || '0.0').toFixed(1);
  return `CabbageEngine.movetoZActor(${number})\n`;
};

Blockly.Blocks['appearance_scale_actor'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('将大小设为')
      .appendField(new Blockly.FieldTextInput('100'), 'NUMBER')
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#8A2BE2');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['appearance_scale_actor'] = function(block) {
  const number = parseFloat(block.getFieldValue('NUMBER') || '0.0').toFixed(1);
  return `CabbageEngine.scaleActor([${number}])\n`;
};

Blockly.Blocks['appearance_scaleadd_actor'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('将大小增加')
      .appendField(new Blockly.FieldTextInput(), 'NUMBER')
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#8A2BE2');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['appearance_scaleadd_actor'] = function(block) {
  const number = parseFloat(block.getFieldValue('NUMBER') || '0.0').toFixed(1);
  return `CabbageEngine.scaleaddActor([${number}])\n`;
};

Blockly.Blocks['appearance_hide_actor'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('隐藏')
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#8A2BE2');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['appearance_hide_actor'] = function(block) {
  return `CabbageEngine.scaleaddActor()\n`;
};

Blockly.Blocks['appearance_show_actor'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('显示')
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#8A2BE2');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['appearance_show_actor'] = function(block) {
  return `CabbageEngine.scaleaddActor()\n`;
};


Blockly.Blocks['appearance_scalespe_actor'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('将缩放设为')
      .appendField('x:')
      .appendField(new Blockly.FieldTextInput('100'), 'X')
      .appendField('y:')
     .appendField(new Blockly.FieldTextInput('100'), 'Y')
     .appendField('z:')
     .appendField(new Blockly.FieldTextInput('100'), 'Z');
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#8A2BE2');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['appearance_scalespe_actor'] = function(block) {
  const x = parseFloat(block.getFieldValue('X') || '0.0').toFixed(1);
  const y = parseFloat(block.getFieldValue('Y') || '0.0').toFixed(1);
  const z = parseFloat(block.getFieldValue('Z') || '0.0').toFixed(1);
  return `CabbageEngine.scalespeActor([${x}, ${y}, ${z}])\n`;
};

Blockly.Blocks['appearance_scalespeaddX_actor'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('将X缩放增加')
      .appendField(new Blockly.FieldTextInput(), 'NUMBER')
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#8A2BE2');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['appearance_scalespeaddX_actor'] = function(block) {
  const number = parseFloat(block.getFieldValue('NUMBER') || '0.0').toFixed(1);
  return `CabbageEngine.scalespeaddXActor(${number})\n`;
};

Blockly.Blocks['appearance_scalespeaddY_actor'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('将y缩放增加')
      .appendField(new Blockly.FieldTextInput(), 'NUMBER')
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#8A2BE2');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['appearance_scalespeaddY_actor'] = function(block) {
  const number = parseFloat(block.getFieldValue('NUMBER') || '0.0').toFixed(1);
  return `CabbageEngine.scalespeaddYActor(${number})\n`;
};

Blockly.Blocks['appearance_scalespeaddZ_actor'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('将z缩放增加')
      .appendField(new Blockly.FieldTextInput(), 'NUMBER')
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#8A2BE2');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['appearance_scalespeaddZ_actor'] = function(block) {
  const number = parseFloat(block.getFieldValue('NUMBER') || '0.0').toFixed(1);
  return `CabbageEngine.scalespeaddZActor(${number})\n`;
};

Blockly.Blocks['appearance_scalespeX_actor'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('将X缩放设为')
      .appendField(new Blockly.FieldTextInput(), 'NUMBER')
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#8A2BE2');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['appearance_scalespeX_actor'] = function(block) {
  const number = parseFloat(block.getFieldValue('NUMBER') || '0.0').toFixed(1);
  return `CabbageEngine.scalespeXActor(${number})\n`;
};

Blockly.Blocks['appearance_scalespeY_actor'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('将y缩放设为')
      .appendField(new Blockly.FieldTextInput(), 'NUMBER')
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#8A2BE2');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['appearance_scalespeY_actor'] = function(block) {
  const number = parseFloat(block.getFieldValue('NUMBER') || '0.0').toFixed(1);
  return `CabbageEngine.scalespeYActor(${number})\n`;
};

Blockly.Blocks['appearance_scalespeZ_actor'] = {
  init: function () {
    this.appendDummyInput()
      .appendField('将z缩放设为')
      .appendField(new Blockly.FieldTextInput(), 'NUMBER')
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour('#8A2BE2');
    this.setHelpUrl('');
  }
};
pythonGenerator.forBlock['appearance_scalespeZ_actor'] = function(block) {
  const number = parseFloat(block.getFieldValue('NUMBER') || '0.0').toFixed(1);
  return `CabbageEngine.scalespeZActor(${number})\n`;
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

Blockly.Blocks['math_add'] = {
  init: function() {
    // 设置圆形外观（需搭配CSS或主题）
    this.setStyle('math_blocks');  // 使用数学类样式（通常自带圆形）
    this.appendDummyInput()
        .appendField(new Blockly.FieldTextInput(0), "VALUE");  // 数字输入框
    this.setOutput(true, 'Number');  // 关键：输出数值类型
    this.setColour(230);  // 数学积木常用橙色
    this.setTooltip("可在数学运算中使用的圆形操作数");
  }
};
pythonGenerator.forBlock['math_add'] = function(block) {
  const value = block.getFieldValue('VALUE');
  return  `CabbageEngine.scaleActor(${value})\n`;  // 返回基础数值
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
      name: '逻辑',
      colour: '#5C97FF',
      contents: [
        { kind: 'block', type: 'controls_if' },
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_boolean' }
      ]
    },
    {
      kind: 'category',
      name: '循环',
      colour: '#FF6680',
      contents: [
        { kind: 'block', type: 'controls_repeat_ext' },
        { kind: 'block', type: 'controls_whileUntil' }
      ]
    },
    {
      kind: 'category',
      name: '数学',
      colour: '#FFAB19',
      contents: [
        { kind: 'block', type: 'math_number' },
        { kind: 'block', type: 'math_arithmetic' },
        { kind: 'block', type: 'math_change' },
        { kind: 'block', type: 'math_add' }
      ]
    },
    {
      kind: 'category',
      name: '侦测',
      colour: '#00FFFF',
      contents: [
        { kind: 'block', type: 'detect_collision'}   
      ]
    },
    {
      kind: 'category',
      name: '事件',
      colour: '#855E42',
      contents: [
        { kind: 'block', type: 'event_keyboardEventHandling'},
        { kind: 'bkock', type: 'event_gameStart'}
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
  'controls_if': '逻辑',
  'logic_compare': '逻辑',
  'logic_boolean': '逻辑',
  'controls_repeat_ext': '循环',
  'controls_whileUntil': '循环',
  'math_number': '数学',
  'math_arithmetic': '数学',
  'math_change': '数学',
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

const updateScale = () => {
  if (window.pyBridge) {
    window.pyBridge.Actor_Operation(JSON.stringify({
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

// 拖拽状态管理
const dragState = ref({
  isDragging: false,
  isResizing: false,
  offsetX: 0,
  offsetY: 0,
  startWidth: 0,
  startHeight: 0,
  startX: 0,
  startY: 0,
  windowX: 0,
  windowY: 0
});


const startResize = (event,direction) => {
  if (event.button !== 0) return;
  dragState.value.isResizing = true;
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

//关闭浮动窗口
const closeFloat = () => {
  if (window.pyBridge) {
    window.pyBridge.removeDockWidget(routename.value);
  }
};


onMounted(() => {
  scenename.value = route.query.sceneName;
  actorname.value = route.query.objectName;
  character.value = decodeURIComponent(route.query.path);
  routename.value = route.query.routename;
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