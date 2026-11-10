// tests/js 大量使用 node:module 的 registerHooks（Node >= 22.15）。
// 用更旧的 Node 跑测试会在导入阶段抛出 SyntaxError（"module 'node:module'
// does not provide an export named 'registerHooks'"），在 9 个与改动无关的
// 文件上同时变红，看起来像回归而不是环境问题。
//
// 所以在测试真正开始前先做一次版本检查，把它变成一条可执行的提示。
import process from 'node:process';

const minimum = [22, 15];
const current = process.versions.node.split('.').map(Number);

const supported =
  current[0] > minimum[0] ||
  (current[0] === minimum[0] && current[1] >= minimum[1]);

if (supported) {
  process.exit(0);
}

console.error(
  `tests/js 需要 node:module#registerHooks，即 Node >= ${minimum.join('.')}；` +
    `当前是 v${process.versions.node}。\n` +
    '开发环境由 conda 提供 Node 22.19（coronaengine-dev 环境）。请在已激活该环境的 shell 里执行：\n' +
    '  conda run -n coronaengine-dev npm run test:unit\n' +
    '或直接指定该环境里的 node 可执行文件。',
);
process.exit(1);
