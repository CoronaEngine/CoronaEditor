import assert from 'node:assert/strict';
import test from 'node:test';
import { validateNodeGraph } from '../../src/blockly/graph/validate.js';

const node = (id, nodeType = 'action') => ({ id, nodeType, workspace: {} });
const edge = (id, sourceNodeId, targetNodeId, sourceSide = 'right', targetSide = 'left') => ({
  id,
  source: { nodeId: sourceNodeId, side: sourceSide, index: 0 },
  target: { nodeId: targetNodeId, side: targetSide, index: 0 },
});
const graph = (nodes, edges = []) => ({ nodes, edges });

test('a graph needs exactly one start node', () => {
  assert.throws(() => validateNodeGraph(graph([node('a')])), /开始节点/);
  assert.throws(
    () => validateNodeGraph(graph([node('s1', 'start'), node('s2', 'start')])),
    /开始节点/
  );
  assert.doesNotThrow(() => validateNodeGraph(graph([node('s', 'start')])));
});

test('node ids must be present and unique', () => {
  assert.throws(() => validateNodeGraph(graph([node('s', 'start'), node('')])), /缺少 ID/);
  assert.throws(() => validateNodeGraph(graph([node('s', 'start'), node('s')])), /重复的节点 ID/);
  assert.doesNotThrow(() => validateNodeGraph(graph([node('s', 'start'), node('a')])));
});

test('edge ids must be present and unique', () => {
  const edgeWithoutId = {
    source: { nodeId: 's', side: 'right', index: 0 },
    target: { nodeId: 's', side: 'left', index: 0 },
  };
  assert.throws(
    () => validateNodeGraph(graph([node('s', 'start')], [edgeWithoutId])),
    /缺少 ID 的连线/
  );
  assert.throws(
    () =>
      validateNodeGraph(graph([node('s', 'start')], [edge('e1', 's', 's'), edge('e1', 's', 's')])),
    /连线 ID 重复/
  );
});

test('edges must reference existing nodes', () => {
  assert.throws(
    () => validateNodeGraph(graph([node('s', 'start')], [edge('e1', 's', 'ghost')])),
    /不存在的节点/
  );
  assert.throws(
    () => validateNodeGraph(graph([node('s', 'start')], [edge('e1', 'ghost', 's')])),
    /不存在的节点/
  );
  assert.doesNotThrow(() =>
    validateNodeGraph(graph([node('s', 'start'), node('a')], [edge('e1', 's', 'a')]))
  );
});

test('edge ports are limited to left, right and bottom', () => {
  assert.throws(
    () => validateNodeGraph(graph([node('s', 'start'), node('a')], [edge('e1', 's', 'a', 'top')])),
    /端口无效/
  );
  assert.throws(
    () =>
      validateNodeGraph(
        graph([node('s', 'start'), node('a')], [edge('e1', 's', 'a', 'right', 'top')])
      ),
    /端口无效/
  );
  assert.throws(
    () =>
      validateNodeGraph(
        graph(
          [node('s', 'start'), node('a')],
          [
            {
              id: 'e1',
              source: { nodeId: 's', side: 'right' },
              target: { nodeId: 'a', side: 'left', index: 0 },
            },
          ]
        )
      ),
    /端口无效/
  );
  assert.doesNotThrow(() =>
    validateNodeGraph(
      graph([node('s', 'start'), node('a')], [edge('e1', 's', 'a', 'bottom', 'right')])
    )
  );
});
