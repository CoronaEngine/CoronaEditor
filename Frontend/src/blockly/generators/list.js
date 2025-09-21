import { pythonGenerator } from "blockly/python";

export const defineListGenerators = () => {
    pythonGenerator.forBlock['list_show'] = function (block) {
        const v = block.getFieldValue('v');
        return `CoronaEngine.show(${v})\n`;
    };

    pythonGenerator.forBlock['list_hide'] = function (block) {
        const v = block.getFieldValue('v');
        return `CoronaEngine.hide(${v})\n`;
    };
}