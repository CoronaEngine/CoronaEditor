import { pythonGenerator } from 'blockly/python';

export const defineEventGenerators = () => {
  pythonGenerator.forBlock['event_gameStart'] = function(block) {
    return `CoronaEngine.gameStart()\n`;
  };
  
  pythonGenerator.forBlock['event_keyboard'] = function(block) {
    const x = block.getFieldValue('x');
    return `CoronaEngine.keyboard(${x})\n`;
  };
  
  pythonGenerator.forBlock['event_RB'] = function(block) {
    const x = block.getFieldValue('x');
    return `CoronaEngine.RB("${x}")\n`;
  };
  
  pythonGenerator.forBlock['event_broadcast'] = function(block) {
    const x = block.getFieldValue('x');
    return `CoronaEngine.broadcast("${x}")\n`;
  };
  
  pythonGenerator.forBlock['event_broadcastWait'] = function(block) {
    const x = block.getFieldValue('x');
    return `CoronaEngine.broadcastWait("${x}")\n`;
  };
}