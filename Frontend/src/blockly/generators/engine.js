import { pythonGenerator } from 'blockly/python';

export const defineEngineGenerators = () => {
    pythonGenerator.forBlock['engine_move'] = function(block) {
      const x = block.getFieldValue('x');
      return `CoronaEngine.move(${x})\n`;
    };
    
    pythonGenerator.forBlock['engine_rotateX'] = function(block) {
      const x = block.getFieldValue('x');
      return `CoronaEngine.rotateX(${x})\n`;
    };
    
    pythonGenerator.forBlock['engine_rotateY'] = function(block) {
      const x = block.getFieldValue('x');
      return `CoronaEngine.rotateY(${x})\n`;
    };
    
    pythonGenerator.forBlock['engine_face'] = function(block) {
      const x = block.getFieldValue('x');
      return `CoronaEngine.face(${x})\n`;
    };
    
    pythonGenerator.forBlock['engine_moveto'] = function(block) {
      const position = block.getFieldValue('POSITION');
      return `CoronaEngine.moveto(${position})\n`;
    };
    
    pythonGenerator.forBlock['engine_movetoXYZ'] = function(block) {
      const position = block.getFieldValue('POSITION');
      return `CoronaEngine.movetoXYZ(${position})\n`;
    };
    
    pythonGenerator.forBlock['engine_movetoXYZtime'] = function(block) {
      const t = block.getFieldValue('t');
      const x1 = block.getFieldValue('x1');
      const x2 = block.getFieldValue('x2');
      const x3 = block.getFieldValue('x3');
      return `CoronaEngine.movetoXYZtime(${t},${x1}, ${x2}, ${x3})\n`;
    };
    
    pythonGenerator.forBlock['engine_Xset'] = function(block) {
      const x = block.getFieldValue('x');
      return `CoronaEngine.Xset(${x})\n`;
    };
    
    pythonGenerator.forBlock['engine_Yset'] = function(block) {
      const x = block.getFieldValue('x');
      return `CoronaEngine.Yset(${x})\n`;
    };
    
    pythonGenerator.forBlock['engine_Zset'] = function(block) {
      const x = block.getFieldValue('x');
      return `CoronaEngine.Zset(${x})\n`;
    };
    
    pythonGenerator.forBlock['engine_Xadd'] = function(block) {
      const x = block.getFieldValue('x');
      return `CoronaEngine.Xadd(${x})\n`;
    };
    
    pythonGenerator.forBlock['engine_Yadd'] = function(block) {
      const x = block.getFieldValue('x');
      return `CoronaEngine.Yadd(${x})\n`;
    };
    
    pythonGenerator.forBlock['engine_Zadd'] = function(block) {
      const x = block.getFieldValue('x');
      return `CoronaEngine.Zadd(${x})\n`;
    };
    
    pythonGenerator.forBlock['engine_X'] = function(block) {
      const x = block.getFieldValue('x');
      return  `CoronaEngine.X(${x})\n`;
    };
    
    pythonGenerator.forBlock['engine_Y'] = function(block) {
      const X = block.getFieldValue('X');
      return  `CoronaEngine.Y(${X})\n`;
    };
    
    pythonGenerator.forBlock['engine_Z'] = function(block) {
      const x = block.getFieldValue('x');
      return  `CoronaEngine.X(${x})\n`;
    };
};