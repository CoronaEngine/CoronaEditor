import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import Blockly from 'blockly/core';
import { babelParse, parse } from 'vue/compiler-sfc';
import { reactive, ref } from 'vue';
import { cloneWebDto } from '../../src/utils/cloneWebDto.js';

function declarations(path, names) {
  const text = readFileSync(new URL(`../../src/${path}`, import.meta.url), 'utf8');
  const source = path.endsWith('.vue') ? parse(text).descriptor.scriptSetup.content : text;
  return babelParse(source, { sourceType: 'module' }).program.body
    .filter(node => node.type === 'FunctionDeclaration' && names.includes(node.id.name))
    .map(node => source.slice(node.start, node.end)).join('\n');
}

const miniSource = declarations('blockly/components/MiniBlocklyWorkspace.vue', ['cloneState']);
const graphSource = declarations('blockly/components/NodeGraphWorkspace.vue', ['refreshEmbeddedWorkspaceStates', 'graphSnapshot']);
const loaderSource = declarations('blockly/generators/index.js', ['loadSerializedWorkspace']);

function withoutJsonCopy(operation) {
  const stringify = JSON.stringify;
  JSON.stringify = () => { throw Error('Workspace DTO copies must not serialize through JSON'); };
  try { return operation(); } finally { JSON.stringify = stringify; }
}

test('mini workspace copies a reactive serialized state without JSON', () => {
  const cloneState = new Function('cloneWebDto', `${miniSource}; return cloneState;`)(cloneWebDto);
  const input = reactive({ blocks: { languageVersion: 0, blocks: [{ id: 'first', type: 'start' }] } });
  const result = withoutJsonCopy(() => cloneState(input));
  assert.deepEqual(result, { blocks: { languageVersion: 0, blocks: [{ id: 'first', type: 'start' }] } });
  result.blocks.blocks[0].id = 'changed';
  assert.equal(input.blocks.blocks[0].id, 'first');
});

test('mini workspace keeps empty and invalid state fallbacks', () => {
  const cloneState = new Function('cloneWebDto', `${miniSource}; return cloneState;`)(cloneWebDto);
  assert.deepEqual(cloneState(null), {});
  assert.deepEqual(cloneState({ unsupported() {} }), {});
});

test('graph snapshot refreshes embedded editors then owns its reactive DTO without JSON', () => {
  const graph = reactive({ nodes: [{ id: 'first', workspace: {} }], edges: [], globalVariablesWorkspace: {} });
  const selectedNode = ref(graph.nodes[0]), selectedEdge = ref(null);
  const embedded = { blocks: { languageVersion: 0, blocks: [] } };
  const variables = { variables: [{ name: 'counter', id: 'counter-id' }] };
  const editor = state => ref({ isReady: () => true, getState: () => state });
  const snapshot = new Function('graph', 'selectedNode', 'selectedEdge', 'activeBlocklyRef',
    'variablesBlocklyRef', 'cloneWebDto', `${graphSource}; return graphSnapshot;`)(
    graph, selectedNode, selectedEdge, editor(embedded), editor(variables), cloneWebDto);
  const result = withoutJsonCopy(snapshot);
  assert.deepEqual(result.nodes[0].workspace, embedded);
  assert.deepEqual(result.globalVariablesWorkspace, variables);
  result.nodes[0].id = 'changed';
  result.globalVariablesWorkspace.variables[0].name = 'changed';
  assert.equal(graph.nodes[0].id, 'first');
  assert.equal(variables.variables[0].name, 'counter');
});

test('graph snapshot uses the fallback when a workspace cannot be cloned', () => {
  const graph = reactive({ nodes: [{ unsupported() {} }], edges: [] });
  const snapshot = new Function('graph', 'selectedNode', 'selectedEdge', 'activeBlocklyRef',
    'variablesBlocklyRef', 'cloneWebDto', `${graphSource}; return graphSnapshot;`)(
    graph, ref(null), ref(null), ref(null), ref(null), cloneWebDto);
  assert.deepEqual(snapshot(), { version: 1, nodes: [], edges: [], globalVariablesWorkspace: {} });
});

test('generator loads an independent reactive state into a real Blockly workspace without JSON', () => {
  const load = new Function('Blockly', 'cloneWebDto', `${loaderSource}; return loadSerializedWorkspace;`)(Blockly, cloneWebDto);
  const state = reactive({ variables: [{ name: 'counter', id: 'counter-id', type: '' }] });
  const workspace = withoutJsonCopy(() => load(state));
  try {
    assert.equal(workspace.getVariableMap().getVariableById('counter-id').name, 'counter');
    workspace.getVariableMap().renameVariable(workspace.getVariableMap().getVariableById('counter-id'), 'changed');
    assert.equal(state.variables[0].name, 'counter');
  } finally { workspace.dispose(); }
});
