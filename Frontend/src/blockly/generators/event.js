import { pythonGenerator } from 'blockly/python';

export const defineEventGenerators = () => {
  pythonGenerator.forBlock['event_gameStart'] = function(block) {
    return `CabbageEngine.gameStart()\n`;
  };
  
  pythonGenerator.forBlock['event_keyboard'] = function(block) {
    const x = block.getFieldValue('x');
    return `CabbageEngine.keyboard(${x})\n`;
  };
  
  pythonGenerator.forBlock['event_RB'] = function(block) {
    const x = block.getFieldValue('x');
    return `CabbageEngine.RB("${x}")\n`;
  };
  
  pythonGenerator.forBlock['event_broadcast'] = function(block) {
    const x = block.getFieldValue('x');
    return `CabbageEngine.broadcast("${x}")\n`;
  };
  
  pythonGenerator.forBlock['event_broadcastWait'] = function(block) {
    const x = block.getFieldValue('x');
    return `CabbageEngine.broadcastWait("${x}")\n`;
  };
}