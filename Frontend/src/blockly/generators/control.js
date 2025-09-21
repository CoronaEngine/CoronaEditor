import { pythonGenerator } from "blockly/python";

export const defineControlGenerators = () => {
    pythonGenerator.forBlock['control_wait'] = function (block) {
        const x = block.getFieldValue('x');
        return `CoronaEngine.wait(${x})\n`;
    };

    pythonGenerator.forBlock['control_for'] = function (block) {
        let branch = pythonGenerator.statementToCode(block, 'DO');
        if (pythonGenerator.STATEMENT_PREFIX) {
            branch = pythonGenerator.prefixLines(
                pythonGenerator.STATEMENT_PREFIX.replace(/%1/g, '\'' + block.id + '\''),
                pythonGenerator.INDENT) + branch;
        }
        const code = `while True:\n` + pythonGenerator.prefixLines(branch, pythonGenerator.INDENT);
        return code;
    };

    // 定义重复执行 x 次积木块的 Python 代码生成器
    pythonGenerator.forBlock['control_forX'] = function (block) {
        const times = pythonGenerator.valueToCode(block, 'TIMES', pythonGenerator.ORDER_NONE) || block.getFieldValue('DEFAULT_TIMES');
        const branch = pythonGenerator.statementToCode(block, 'DO');
        const code = `for _ in range(${times}):\n` + pythonGenerator.prefixLines(branch, pythonGenerator.INDENT);
        return code;
    };

    pythonGenerator.forBlock['control_if'] = function (block) {
        const condition = pythonGenerator.valueToCode(block, 'CONDITION', pythonGenerator.ORDER_NONE) || 'False';
        const branch = pythonGenerator.statementToCode(block, 'DO');
        const code = `if ${condition}:\n` + pythonGenerator.prefixLines(branch, pythonGenerator.INDENT);
        return code;
    };

    // 定义如果那么否则积木块的 Python 代码生成器
    pythonGenerator.forBlock['control_else'] = function (block) {
        const condition = pythonGenerator.valueToCode(block, 'CONDITION', pythonGenerator.ORDER_NONE) || 'False';
        const branch = pythonGenerator.statementToCode(block, 'DO');
        const elseBranch = pythonGenerator.statementToCode(block, 'ELSE');
        let code = `if ${condition}:\n` + pythonGenerator.prefixLines(branch, pythonGenerator.INDENT);
        if (elseBranch) {
            code += `else:\n` + pythonGenerator.prefixLines(elseBranch, pythonGenerator.INDENT);
        }
        return code;
    };

    // 定义等待直到条件满足积木块的 Python 代码生成器
    pythonGenerator.forBlock['control_wait2'] = function (block) {
        const condition = pythonGenerator.valueToCode(block, 'CONDITION', pythonGenerator.ORDER_NONE) || 'False';
        const code = `while not (${condition}):\n` +
            pythonGenerator.prefixLines('    pass\n', pythonGenerator.INDENT);
        return code;
    };

    // 定义重复执行直到积木块的 Python 代码生成器
    pythonGenerator.forBlock['control_until'] = function (block) {
        const condition = pythonGenerator.valueToCode(block, 'CONDITION', pythonGenerator.ORDER_NONE) || 'False';
        const branch = pythonGenerator.statementToCode(block, 'DO');
        const code = `while not (${condition}):\n` +
            pythonGenerator.prefixLines(branch, pythonGenerator.INDENT);
        return code;
    };

    // 定义停止积木块的 Python 代码生成器
    pythonGenerator.forBlock['control_stop'] = function (block) {
        const stopOption = block.getFieldValue('STOP_OPTION');
        return `CoronaEngine.stop("${stopOption}")\n`;
    };

    pythonGenerator.forBlock['control_cloneStart'] = function (block) {
        return `CoronaEngine.cloneStart()\n`;
    };

    pythonGenerator.forBlock['control_clone'] = function (block) {
        const x = block.getFieldValue('x');
        return `CoronaEngine.clone(${x})\n`;
    };

    pythonGenerator.forBlock['control_cloneDEL'] = function (block) {
        return `CoronaEngine.deleteClone()\n`;
    };

    pythonGenerator.forBlock['control_senceSet'] = function (block) {
        const x = block.getFieldValue('x');
        return `CoronaEngine.setScene(${x})\n`;
    };

    pythonGenerator.forBlock['control_nextSence'] = function (block) {
        return `CoronaEngine.nextScene()\n`;
    };
}