import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { babelParse, parse } from 'vue/compiler-sfc';

function declarations(path, names) {
  const text = readFileSync(new URL(`../../src/${path}`, import.meta.url), 'utf8');
  const source = path.endsWith('.vue') ? parse(text).descriptor.scriptSetup.content : text;
  return babelParse(source, { sourceType: 'module' }).program.body
    .filter(node => node.type === 'FunctionDeclaration' && names.includes(node.id.name))
    .map(node => source.slice(node.start, node.end)).join('\n');
}

const paletteSource = declarations('blockly/components/BlocklyToolboxPalette.vue', [
  'renderPaletteBlocks',
  'paletteBlockFromEvent',
]);

function createFakeBlock(type, id) {
  const root = {
    getBBox: () => ({ width: 180, height: 42 }),
    setAttribute() {},
    contains: target => target === root,
  };
  return {
    type,
    id,
    initSvg() {},
    render() {},
    moveBy() {},
    getSvgRoot: () => root,
    getHeightWidth: () => ({ width: 180, height: 42 }),
    getRelativeToSurfaceXY: () => ({ x: 0, y: 0 }),
    getInput: () => null,
    isDisposed: () => false,
  };
}

function createFakeWorkspace() {
  const blocks = new Map();
  let sequence = 0;
  return {
    blocks,
    clear() {
      blocks.clear();
    },
    newBlock(type) {
      sequence += 1;
      const block = createFakeBlock(type, `palette-block-${sequence}`);
      blocks.set(block.id, block);
      return block;
    },
    getBlockById(id) {
      return blocks.get(id) ?? null;
    },
    getAllBlocks() {
      return [...blocks.values()];
    },
    resizeContents() {},
    scrollbar: { resize() {} },
  };
}

function createPalette(options) {
  const harnessSource = [
    'let isRenderingPalette = false;',
    'let paletteRenderGeneration = 0;',
    'let paletteLayoutFrame = null;',
    'function cancelPaletteLayout() {',
    '  paletteRenderGeneration += 1;',
    '  if (paletteLayoutFrame != null) window.cancelAnimationFrame(paletteLayoutFrame);',
    '  paletteLayoutFrame = null;',
    '}',
    paletteSource,
    'return {',
    '  renderPaletteBlocks,',
    '  paletteBlockFromEvent,',
    '  isRenderingPalette: () => isRenderingPalette,',
    '  paletteLayoutFrame: () => paletteLayoutFrame,',
    '};',
  ].join('\n');
  const factory = new Function(
    'workspace',
    'BlocklyLib',
    'props',
    'window',
    'activeCategory',
    'preparePaletteBlock',
    'paletteBlockSize',
    'resizeBlockly',
    'logError',
    harnessSource,
  );
  return factory(
    options.workspace,
    options.BlocklyLib,
    options.props ?? { workspaceRole: 'node' },
    {
      requestAnimationFrame: options.requestAnimationFrame,
      cancelAnimationFrame: options.cancelAnimationFrame,
    },
    options.activeCategory,
    options.preparePaletteBlock ?? (() => {}),
    options.paletteBlockSize ?? (() => ({ width: 180, height: 42 })),
    options.resizeBlockly ?? (() => {}),
    options.logError ?? (() => {}),
  );
}

test('palette rendering releases its guard when the layout frame never runs', () => {
  const workspace = createFakeWorkspace();
  const frames = [];
  let frameId = 0;
  const palette = createPalette({
    workspace,
    BlocklyLib: { svgResize() {} },
    requestAnimationFrame(callback) {
      frames.push(callback);
      return (frameId += 1);
    },
    cancelAnimationFrame() {},
    activeCategory: () => ({ blocks: [{ type: 'math_number' }] }),
  });

  palette.renderPaletteBlocks();

  assert.equal(frames.length, 1, 'a layout frame should be scheduled');
  assert.notEqual(palette.paletteLayoutFrame(), null, 'the frame was never run, as in a hidden dock panel');
  assert.equal(
    palette.isRenderingPalette(),
    false,
    'a pending layout frame must not leave the palette permanently inert',
  );
});

test('palette pointer resolution works from a data-id event path after rendering', () => {
  const workspace = createFakeWorkspace();
  const palette = createPalette({
    workspace,
    BlocklyLib: { svgResize() {} },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
    activeCategory: () => ({ blocks: [{ type: 'math_number' }] }),
  });

  palette.renderPaletteBlocks();

  const [block] = workspace.getAllBlocks();
  assert.ok(block, 'rendering should create the palette block');
  assert.equal(block.type, 'math_number');

  const event = {
    composedPath: () => [{ getAttribute: name => (name === 'data-id' ? block.id : null) }],
    target: null,
  };

  assert.equal(
    palette.paletteBlockFromEvent(event),
    block,
    'pointer resolution must recover once the synchronous rebuild has finished',
  );
});

test('palette rendering rethrows a synchronous failure after releasing the guard', () => {
  const workspace = createFakeWorkspace();
  const failure = new Error('category lookup failed');
  const palette = createPalette({
    workspace,
    BlocklyLib: { svgResize() {} },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
    activeCategory: () => {
      throw failure;
    },
  });

  assert.throws(() => palette.renderPaletteBlocks(), error => error === failure);
  assert.equal(palette.isRenderingPalette(), false);
});
