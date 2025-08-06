import * as Blockly from 'blockly/core';


export const defineEngineBlocks = (actorname) =>{
    Blockly.Blocks['engine_move'] = {
      init: function () {
        this.appendDummyInput()
         .appendField('移动')
         .appendField(new Blockly.FieldTextInput(actorname.value), 'x');
        this.setInputsInline(true);
        this.setPreviousStatement(true, null); 
        this.setNextStatement(true, null);
        this.setColour('#5631E4');
        this.setHelpUrl('');
      }
    };
    
    Blockly.Blocks['engine_rotateX'] = {
      init: function () {
        this.appendDummyInput()
         .appendField('水平旋转')
         .appendField(new Blockly.FieldTextInput(actorname.value), 'x')
         .appendField('度');
        this.setInputsInline(true);
        this.setPreviousStatement(true, null); 
        this.setNextStatement(true, null);
        this.setColour('#5631E4');
        this.setHelpUrl('');
      }
    };
    
    Blockly.Blocks['engine_rotateY'] = {
      init: function () {
        this.appendDummyInput()
         .appendField('竖直旋转')
         .appendField(new Blockly.FieldTextInput(actorname.value), 'x')
         .appendField('度');
        this.setInputsInline(true);
        this.setPreviousStatement(true, null); 
        this.setNextStatement(true, null);
        this.setColour('#5631E4');
        this.setHelpUrl('');
      }
    };
    
    Blockly.Blocks['engine_face'] = {
      init: function () {
        this.appendDummyInput()
         .appendField('面向')
         .appendField(new Blockly.FieldTextInput(actorname.value), 'x')
         .appendField('度方向');
        this.setInputsInline(true);
        this.setPreviousStatement(true, null); 
        this.setNextStatement(true, null);
        this.setColour('#5631E4');
        this.setHelpUrl('');
      }
    };
    
    Blockly.Blocks['engine_moveto'] = {
      init: function () {
        this.appendDummyInput()
          .appendField('移动到')
          .appendField(new Blockly.FieldDropdown([
            ['随机位置', 'random_position'],
            ['准星位置', 'sight_position']
          ]), 'POSITION');
        this.setInputsInline(true);
        this.setPreviousStatement(true, null); 
        this.setNextStatement(true, null);
        this.setColour('#5631E4');
        this.setHelpUrl('');
      }
    };
    
    Blockly.Blocks['engine_movetoXYZ'] = {
      init: function () {
        this.appendDummyInput()
          .appendField('移动到')
          .appendField(new Blockly.FieldDropdown([
            ['随机位置', 'random_position'],
            ['准星位置', 'sight_position']
          ]), 'POSITION');
        this.setInputsInline(true);
        this.setPreviousStatement(true, null); 
        this.setNextStatement(true, null);
        this.setColour('#5631E4');
        this.setHelpUrl('');
      }
    };
    
    Blockly.Blocks['engine_movetoXYZtime'] = {
      init: function () {
        this.appendDummyInput()
         .appendField('在')
         .appendField(new Blockly.FieldTextInput(actorname.value), 't')
         .appendField('秒内移到')
         .appendField(new Blockly.FieldTextInput(actorname.value), 'x1')
         .appendField(new Blockly.FieldTextInput(actorname.value), 'x2')
         .appendField(new Blockly.FieldTextInput(actorname.value), 'x3');
        this.setInputsInline(true);
        this.setPreviousStatement(true, null); 
        this.setNextStatement(true, null);
        this.setColour('#5631E4');
        this.setHelpUrl('');
      }
    };
    
    Blockly.Blocks['engine_Xset'] = {
      init: function () {
        this.appendDummyInput()
         .appendField('将x坐标设为')
         .appendField(new Blockly.FieldTextInput(actorname.value), 'x')
        this.setInputsInline(true);
        this.setPreviousStatement(true, null); 
        this.setNextStatement(true, null);
        this.setColour('#5631E4');
        this.setHelpUrl('');
      }
    };
    
    Blockly.Blocks['engine_Yset'] = {
      init: function () {
        this.appendDummyInput()
         .appendField('将y坐标设为')
         .appendField(new Blockly.FieldTextInput(actorname.value), 'x')
        this.setInputsInline(true);
        this.setPreviousStatement(true, null); 
        this.setNextStatement(true, null);
        this.setColour('#5631E4');
        this.setHelpUrl('');
      }
    };
    
    Blockly.Blocks['engine_Zset'] = {
      init: function () {
        this.appendDummyInput()
         .appendField('将z坐标设为')
         .appendField(new Blockly.FieldTextInput(actorname.value), 'x')
        this.setInputsInline(true);
        this.setPreviousStatement(true, null); 
        this.setNextStatement(true, null);
        this.setColour('#5631E4');
        this.setHelpUrl('');
      }
    };
    
    Blockly.Blocks['engine_Xadd'] = {
      init: function () {
        this.appendDummyInput()
         .appendField('将x坐标增加')
         .appendField(new Blockly.FieldTextInput(actorname.value), 'x')
        this.setInputsInline(true);
        this.setPreviousStatement(true, null); 
        this.setNextStatement(true, null);
        this.setColour('#5631E4');
        this.setHelpUrl('');
      }
    };
    
    Blockly.Blocks['engine_Yadd'] = {
      init: function () {
        this.appendDummyInput()
         .appendField('将y坐标增加')
         .appendField(new Blockly.FieldTextInput(actorname.value), 'x')
        this.setInputsInline(true);
        this.setPreviousStatement(true, null); 
        this.setNextStatement(true, null);
        this.setColour('#5631E4');
        this.setHelpUrl('');
      }
    };
    
    Blockly.Blocks['engine_Zadd'] = {
      init: function () {
        this.appendDummyInput()
         .appendField('将z坐标增加')
         .appendField(new Blockly.FieldTextInput(actorname.value), 'x')
        this.setInputsInline(true);
        this.setPreviousStatement(true, null); 
        this.setNextStatement(true, null);
        this.setColour('#5631E4');
        this.setHelpUrl('');
      }
    };
    
    Blockly.Blocks['engine_X'] = {
      init: function() {
        this.setStyle('math_blocks');  // 使用数学类样式（通常自带圆形）
        this.appendDummyInput()
             .appendField('X');
        this.setOutput(true, 'Number');  // 关键：输出数值类型
        this.setColour('#5631E4'); 
        this.setTooltip("该角色的x坐标");
      }
    };
    
    Blockly.Blocks['engine_Y'] = {
      init: function() {
        this.setStyle('math_blocks');  // 使用数学类样式（通常自带圆形）
        this.appendDummyInput()
             .appendField('Y');
        this.setOutput(true, 'Number');  // 关键：输出数值类型
        this.setColour('#5631E4'); 
        this.setTooltip("该角色的y坐标");
      }
    };
    
    Blockly.Blocks['engine_Z'] = {
      init: function() {
        this.setStyle('math_blocks');  // 使用数学类样式（通常自带圆形）
        this.appendDummyInput()
             .appendField('Z');
        this.setOutput(true, 'Number');  // 关键：输出数值类型
        this.setColour('#5631E4'); 
        this.setTooltip("该角色的z坐标");
      }
    };
};