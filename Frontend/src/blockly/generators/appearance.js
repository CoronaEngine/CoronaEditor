import { pythonGenerator } from 'blockly/python';

export const defineAppearanceGenerators = () => {

  pythonGenerator.forBlock['appearance_cartoonSet'] = function (block) {
    const x = block.getFieldValue('x');
    return `CabbageEngine.cartoonSet(${x})\n`;
  };

  pythonGenerator.forBlock['appearance_nextCartoon'] = function (block) {
    return `CabbageEngine.nextCartoon()\n`;
  };

  pythonGenerator.forBlock['appearance_playCartoon'] = function (block) {
    return `CabbageEngine.playCartoon()\n`;
  };

  pythonGenerator.forBlock['appearance_stopCartoon'] = function (block) {
    return `CabbageEngine.stopCartoon()\n`;
  };

  pythonGenerator.forBlock['appearance_resetCartoon'] = function (block) {
    return `CabbageEngine.resetCartoon()\n`;
  };

  pythonGenerator.forBlock['appearance_sizeAdd'] = function (block) {
    const x = block.getFieldValue('x');
    return `CabbageEngine.sizeAdd(${x})\n`;
  };

  pythonGenerator.forBlock['appearance_sizeSet'] = function (block) {
    const x = block.getFieldValue('x');
    return `CabbageEngine.sizeSet(${x})\n`;
  };

  pythonGenerator.forBlock['appearance_show'] = function (block) {
    return `CabbageEngine.show()\n`;
  };

  pythonGenerator.forBlock['appearance_hide'] = function (block) {
    return `CabbageEngine.hide()\n`;
  };

  pythonGenerator.forBlock['appearance_cartoon'] = function (block) {
    const x = block.getFieldValue('x');
    return `CabbageEngine.cartoon(${x})\n`;
  };

  pythonGenerator.forBlock['appearance_size'] = function (block) {
    const x = block.getFieldValue('x');
    return `CabbageEngine.size(${x})\n`;
  };
};
