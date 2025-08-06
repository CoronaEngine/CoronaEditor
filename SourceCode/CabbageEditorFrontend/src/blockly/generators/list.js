import { pythonGenerator } from "blockly/python";

export const defineListGenerators = () => {
    pythonGenerator.forBlock['list_show'] = function (block) {
        const v = block.getFieldValue('v');
        return `CabbageEngine.show(${v})\n`;
    };

    pythonGenerator.forBlock['list_hide'] = function (block) {
        const v = block.getFieldValue('v');
        return `CabbageEngine.hide(${v})\n`;
    };
}