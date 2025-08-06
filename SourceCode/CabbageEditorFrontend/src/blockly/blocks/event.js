import * as Blockly from 'blockly/core';

export const defineEventBlocks = (actorname, flash, broadcastList, createNewBroadcast) => {
  Blockly.Blocks['event_gameStart'] = {
    init: function () {
      this.appendDummyInput()
       .appendField('当游戏开始时')
      this.setInputsInline(true);
      this.setPreviousStatement(flash, null); 
      this.setNextStatement(true, null);
      this.setColour('#FFDE59');
      this.setHelpUrl('');
    }
  };
  
  Blockly.Blocks['event_keyboard'] = {
    init: function () {
      this.appendDummyInput()
       .appendField('当按下')
       .appendField(new Blockly.FieldTextInput(actorname.value), 'x')
       .appendField('时');
      this.setInputsInline(true);
      this.setPreviousStatement(flash, null); 
      this.setNextStatement(true, null);
      this.setColour('#FFDE59');
      this.setHelpUrl('');
    }
  };
  
  Blockly.Blocks['event_RB'] = {
    init: function () {
      this.appendDummyInput()
        .appendField('当接收到广播')
        .appendField(new Blockly.FieldDropdown(() => {
          // 构造下拉选项，包含现有广播和新建广播按钮
          const options = broadcastList.value.map(item => [item, item]);
          options.push(['新建广播...', 'CREATE_NEW']);
          return options;
        }, (value) => {
          if (value === 'CREATE_NEW') {
            createNewBroadcast();
            // 取消选择新建广播选项
            return null;
          }
          return value;
        }), 'x')
      this.setInputsInline(true);
      this.setPreviousStatement(flash, null); 
      this.setNextStatement(true, null);
      this.setColour('#FFDE59');
      this.setHelpUrl('');
    }
  };
  
  Blockly.Blocks['event_broadcast'] = {
    init: function () {
      this.appendDummyInput()
        .appendField('当接收到广播')
        .appendField(new Blockly.FieldDropdown(() => {
          // 构造下拉选项，包含现有广播和新建广播按钮
          const options = broadcastList.value.map(item => [item, item]);
          options.push(['新建广播...', 'CREATE_NEW']);
          return options;
        }, (value) => {
          if (value === 'CREATE_NEW') {
            createNewBroadcast();
            // 取消选择新建广播选项
            return null;
          }
          return value;
        }), 'x')
      this.setInputsInline(true);
      this.setPreviousStatement(flash, null); 
      this.setNextStatement(true, null);
      this.setColour('#FFDE59');
      this.setHelpUrl('');
    }
  };
  
  Blockly.Blocks['event_broadcastWait'] = {
    init: function () {
      this.appendDummyInput()
        .appendField('当接收到广播')
        .appendField(new Blockly.FieldDropdown(() => {
          // 构造下拉选项，包含现有广播和新建广播按钮
          const options = broadcastList.value.map(item => [item, item]);
          options.push(['新建广播...', 'CREATE_NEW']);
          return options;
        }, (value) => {
          if (value === 'CREATE_NEW') {
            createNewBroadcast();
            // 取消选择新建广播选项
            return null;
          }
          return value;
        }), 'x')
        .appendField('并等待')
      this.setInputsInline(true);
      this.setPreviousStatement(flash, null); 
      this.setNextStatement(true, null);
      this.setColour('#FFDE59');
      this.setHelpUrl('');
    }
  };

}