import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

globalThis.window = new EventTarget();
const aliases = registerHooks({
  resolve(specifier, context, nextResolve) {
    const url = specifier.startsWith('@/')
      ? new URL(`../../src/${specifier.slice(2)}`, import.meta.url).href
      : specifier;
    return nextResolve(url, context);
  },
});
const { nodeGraphGenerationIntent } =
  await import('../../src/services/nodeGraphGenerationService.js');
aliases.deregister();

for (const instruction of [
  '请不要删除节点',
  '请别移除节点',
  '请不要把节点速度改为 5',
  '请解释如何修改节点',
  '请不要删除节点，只修改速度',
  '请说明修改节点的步骤',
  'Please do not delete the node',
  'Please explain how to modify the node',
]) {
  test(`routes to ordinary chat: ${instruction}`, () => {
    assert.deepEqual(nodeGraphGenerationIntent(instruction), {
      matched: false,
      operation: '',
      instruction,
    });
  });
}

for (const [instruction, operation] of [
  ['请删除节点', 'delete'],
  ['请分别删除这两个节点', 'delete'],
  ['请修改节点并解释原因', 'edit'],
  ['请把说明节点的速度改为 5', 'edit'],
  ['请创建节点', 'create'],
  ['帮我添加跳跃逻辑', 'extend'],
]) {
  test(`retains the requested ${operation} operation: ${instruction}`, () => {
    assert.deepEqual(nodeGraphGenerationIntent(instruction), {
      matched: true,
      operation,
      instruction,
    });
  });
}
