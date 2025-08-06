import { pythonGenerator } from "blockly/python";

export const defineDetectGenerators = () => {
pythonGenerator.forBlock['detect_touch'] = function(block) {
  const x = block.getFieldValue('x');
  return `CabbageEngine.touch(${x})`;
};

pythonGenerator.forBlock['detect_distance'] = function(block) {
  const x = block.getFieldValue('x');
  return  `CabbageEngine.distance(${x})\n`;
};

pythonGenerator.forBlock['detect_ask'] = function(block) {
  const x = block.getFieldValue('x');
  return `CabbageEngine.ask(${x})\n`;
};

pythonGenerator.forBlock['detect_keyboard1'] = function(block) {
  const x = block.getFieldValue('x');
  return `CabbageEngine.keyboard(${x})`;
};

pythonGenerator.forBlock['detect_keyboard0'] = function(block) {
  const x = block.getFieldValue('x');
  return `CabbageEngine.keyboard0(${x})`;
};

pythonGenerator.forBlock['detect_mouse1'] = function(block) {
  return `CabbageEngine.mouse1()`;
};

pythonGenerator.forBlock['detect_mouse0'] = function(block) {
  return `CabbageEngine.mouse0()`;
};

pythonGenerator.forBlock['detect_attribute'] = function(block) {
  const x = block.getFieldValue('x');
  return `CabbageEngine.attribute(${x})\n`;
};
};
