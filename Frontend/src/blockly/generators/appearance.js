import { pythonGenerator } from 'blockly/python';

export const defineAppearanceGenerators = () => {

  pythonGenerator.forBlock['appearance_cartoonSet'] = function (block) {
    const x = block.getFieldValue('x');
    return `CoronaEngine.cartoonSet(${x})\n`;
  };

  pythonGenerator.forBlock['appearance_nextCartoon'] = function (block) {
    return `CoronaEngine.nextCartoon()\n`;
  };

  pythonGenerator.forBlock['appearance_playCartoon'] = function (block) {
    return `CoronaEngine.playCartoon()\n`;
  };

  pythonGenerator.forBlock['appearance_stopCartoon'] = function (block) {
    return `CoronaEngine.stopCartoon()\n`;
  };

  pythonGenerator.forBlock['appearance_resetCartoon'] = function (block) {
    return `CoronaEngine.resetCartoon()\n`;
  };

  pythonGenerator.forBlock['appearance_sizeAdd'] = function (block) {
    const x = block.getFieldValue('x');
    return `CoronaEngine.sizeAdd(${x})\n`;
  };

  pythonGenerator.forBlock['appearance_sizeSet'] = function (block) {
    const x = block.getFieldValue('x');
    return `CoronaEngine.sizeSet(${x})\n`;
  };

  pythonGenerator.forBlock['appearance_show'] = function (block) {
    return `CoronaEngine.show()\n`;
  };

  pythonGenerator.forBlock['appearance_hide'] = function (block) {
    return `CoronaEngine.hide()\n`;
  };

  pythonGenerator.forBlock['appearance_cartoon'] = function (block) {
    const x = block.getFieldValue('x');
    return `CoronaEngine.cartoon(${x})\n`;
  };

  pythonGenerator.forBlock['appearance_size'] = function (block) {
    const x = block.getFieldValue('x');
    return `CoronaEngine.size(${x})\n`;
  };
};
