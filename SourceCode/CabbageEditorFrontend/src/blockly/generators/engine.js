import { pythonGenerator } from 'blockly/python';

export const defineEngineGenerators = () => {
    pythonGenerator.forBlock['engine_move'] = function(block) {
      const x = block.getFieldValue('x');
      return `CabbageEngine.move(${x})\n`;
    };
    
    pythonGenerator.forBlock['engine_rotateX'] = function(block) {
      const x = block.getFieldValue('x');
      return `CabbageEngine.rotateX(${x})\n`;
    };
    
    pythonGenerator.forBlock['engine_rotateY'] = function(block) {
      const x = block.getFieldValue('x');
      return `CabbageEngine.rotateY(${x})\n`;
    };
    
    pythonGenerator.forBlock['engine_face'] = function(block) {
      const x = block.getFieldValue('x');
      return `CabbageEngine.face(${x})\n`;
    };
    
    pythonGenerator.forBlock['engine_moveto'] = function(block) {
      const position = block.getFieldValue('POSITION');
      return `CabbageEngine.moveto(${position})\n`;
    };
    
    pythonGenerator.forBlock['engine_movetoXYZ'] = function(block) {
      const position = block.getFieldValue('POSITION');
      return `CabbageEngine.movetoXYZ(${position})\n`;
    };
    
    pythonGenerator.forBlock['engine_movetoXYZtime'] = function(block) {
      const t = block.getFieldValue('t');
      const x1 = block.getFieldValue('x1');
      const x2 = block.getFieldValue('x2');
      const x3 = block.getFieldValue('x3');
      return `CabbageEngine.movetoXYZtime(${t},${x1}, ${x2}, ${x3})\n`;
    };
    
    pythonGenerator.forBlock['engine_Xset'] = function(block) {
      const x = block.getFieldValue('x');
      return `CabbageEngine.Xset(${x})\n`;
    };
    
    pythonGenerator.forBlock['engine_Yset'] = function(block) {
      const x = block.getFieldValue('x');
      return `CabbageEngine.Yset(${x})\n`;
    };
    
    pythonGenerator.forBlock['engine_Zset'] = function(block) {
      const x = block.getFieldValue('x');
      return `CabbageEngine.Zset(${x})\n`;
    };
    
    pythonGenerator.forBlock['engine_Xadd'] = function(block) {
      const x = block.getFieldValue('x');
      return `CabbageEngine.Xadd(${x})\n`;
    };
    
    pythonGenerator.forBlock['engine_Yadd'] = function(block) {
      const x = block.getFieldValue('x');
      return `CabbageEngine.Yadd(${x})\n`;
    };
    
    pythonGenerator.forBlock['engine_Zadd'] = function(block) {
      const x = block.getFieldValue('x');
      return `CabbageEngine.Zadd(${x})\n`;
    };
    
    pythonGenerator.forBlock['engine_X'] = function(block) {
      const x = block.getFieldValue('x');
      return  `CabbageEngine.X(${x})\n`;
    };
    
    pythonGenerator.forBlock['engine_Y'] = function(block) {
      const X = block.getFieldValue('X');
      return  `CabbageEngine.Y(${X})\n`;
    };
    
    pythonGenerator.forBlock['engine_Z'] = function(block) {
      const x = block.getFieldValue('x');
      return  `CabbageEngine.X(${x})\n`;
    };
};