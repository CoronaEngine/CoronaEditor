import policy from './aiPolicy.json' with { type: 'json' };
import prompts from './aiPrompts.json' with { type: 'json' };
import contractText from './aiBlockContract.xml?raw';
import { completeModel, parseModelJson } from './aiModelService.js';
import { validateGeneratedNodeGraphResult } from '../blockly/node-editor/aiNodeGraphService.js';
import { generationRequirements } from './aiGraphRequirements.js';
export { generationRequirements } from './aiGraphRequirements.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const actorKey = (name) =>
  String(name || '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replaceAll('ß', 'ss')
    .replaceAll('ς', 'σ');
const catalog = policy.catalog;
const reviewCache = new Map();
function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, ordered(value[key])])
    );
  return value;
}
export function walkBlocks(value, result = []) {
  if (!value || typeof value !== 'object') return result;
  if (typeof value.type === 'string' && !value.nodeType) result.push(value);
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') walkBlocks(child, result);
  }
  return result;
}

function actorReference(block, field) {
  const connection = block.inputs?.[field];
  const child = connection?.block || connection?.shadow;
  if (child) {
    if (child.type === 'object_reference')
      return {
        name:
          child.fields?.OBJECT === '__manual__' ? child.fields?.MANUAL : child.fields?.OBJECT || '',
      };
    if (child.type === 'text') return { name: child.fields?.TEXT || '' };
    return { dynamic: true };
  }
  return { name: block.fields?.[field] || block.fields?.[field + '_TEXT'] || '' };
}

export function graphFacts(workspace, project = {}) {
  const facts = [];
  const nodes = workspace.nodes || [];
  const edges = workspace.edges || [];
  const ids = new Set(nodes.map((n) => n.id));
  const add = (code, details = {}) => facts.push({ code, ...details });
  const checkIds = (items, kind, owner = {}) => {
    const seen = new Set();
    for (const item of items) {
      if (!item.id) add('missing_' + kind + '_id', owner);
      else if (seen.has(item.id)) add('duplicate_' + kind + '_id', owner);
      seen.add(item.id);
    }
  };
  checkIds(nodes, 'node');
  checkIds(edges, 'edge');
  if (nodes.filter((n) => n.nodeType === 'start').length !== 1) add('start_node_count');
  const names = new Set(
    (project.actors || [])
      .flatMap((a) => [
        a.name,
        a.actorName,
        a.actor_name,
        a.displayName,
        a.nativeName,
        ...(a.aliases || []),
      ])
      .map(actorKey)
  );
  const known =
    project.actorContextAvailable === true ||
    (project.actorContextAvailable == null && Array.isArray(project.actors));
  const scopes = [
    ...nodes.map((n) => ({ nodeId: n.id, value: n.workspace })),
    ...edges.map((e) => ({ edgeId: e.id, value: e.conditionWorkspace })),
    { value: workspace.globalVariablesWorkspace },
  ];
  for (const { value, ...owner } of scopes) {
    const blocks = walkBlocks(value);
    checkIds(blocks, 'block', owner);
    for (const block of blocks) {
      const spec = catalog[block.type];
      const detail = { ...owner, blockId: block.id, blockType: block.type };
      if (!spec) {
        add('unknown_block_type', detail);
        continue;
      }
      if (spec.projectUsage !== 'project-safe') add('missing_actor_target', detail);
      for (const field of policy.actorFields[block.type] || []) {
        const ref = actorReference(block, field);
        if (ref.dynamic) continue;
        const name = actorKey(ref.name);
        if (
          !name ||
          [
            'none',
            'null',
            'undefined',
            '__manual__',
            'target',
            'current actor',
            'current object',
            '请选择',
            '选择对象',
            '未选择',
            '对象名称',
            '物体名称',
            '当前对象',
            '当前物体',
            '对象',
            '物体',
            'actor',
            'object',
            '请选择对象',
            'select object',
          ].includes(name)
        ) {
          add('missing_actor_target', { ...detail, field });
        } else if (known && !names.has(name)) {
          add('actor_target_not_found', { ...detail, field, actorName: ref.name });
        }
      }
      for (const input of spec.inputs || []) {
        if (
          input.required &&
          !block.inputs?.[input.name]?.block &&
          !block.inputs?.[input.name]?.shadow &&
          !block.fields?.[input.name]
        )
          add('missing_required_input', { ...detail, field: input.name });
      }
    }
  }
  for (const edge of edges) {
    if (!ids.has(edge.source?.nodeId) || !ids.has(edge.target?.nodeId))
      add('invalid_edge_endpoint', { edgeId: edge.id });
    const roots = edge.conditionWorkspace?.blocks?.blocks || [];
    if (roots.length !== 1) add('invalid_visible_condition_count', { edgeId: edge.id });
    else if (!catalog[roots[0].type]?.outputChecks.includes('Boolean')) {
      add('non_boolean_condition', { edgeId: edge.id, blockId: roots[0].id });
    }
  }
  return facts;
}

export function filterReview(result, workspace, project = {}) {
  if (typeof result?.hasProblems !== 'boolean' || !Array.isArray(result.issues || []))
    throw new Error('无效节点审查结果');
  if (result.hasProblems && (typeof result.summary !== 'string' || !result.summary.trim()))
    throw new Error('审查结果缺少摘要');
  const facts = graphFacts(workspace, project),
    nodes = new Set((workspace.nodes || []).map((n) => n.id)),
    edges = new Set((workspace.edges || []).map((e) => e.id));
  const blocks = new Map(walkBlocks(workspace).map((b) => [b.id, b]));
  const deterministic = new Set([
    'missing_actor_target',
    'actor_target_not_found',
    'missing_required_input',
  ]);
  const clip = (v, n) =>
    String(v || '')
      .trim()
      .slice(0, n);
  const summary = clip(result.summary, 160),
    summaryEn = clip(result.summaryEn || summary, 160);
  const issues = [];
  for (const item of (result.hasProblems ? result.issues || [] : []).slice(0, 6)) {
    if (!item || typeof item !== 'object') continue;
    const nodeId = String(item.nodeId || ''),
      blockId = String(item.blockId || '');
    let edgeId = String(item.edgeId || '');
    if (
      (nodeId && !nodes.has(nodeId)) ||
      (blockId && !blocks.has(blockId)) ||
      (edgeId && !edges.has(edgeId))
    )
      continue;
    const confidence = Math.max(0, Math.min(1, Number(item.confidence) || 0));
    if (confidence < 0.8) continue;
    const code =
      item.code === 'dangling_edge'
        ? 'invalid_edge_endpoint'
        : String(item.code || 'logic_issue').slice(0, 80);
    const fact = facts.find(
      (f) =>
        f.code === code &&
        (!nodeId || !f.nodeId || f.nodeId === nodeId) &&
        (!blockId || !f.blockId || f.blockId === blockId) &&
        (!edgeId || !f.edgeId || f.edgeId === edgeId)
    );
    if (deterministic.has(code) && !fact) continue;
    const block = blocks.get(blockId);
    const searchable = [
      item.title,
      item.message,
      item.suggestion,
      item.titleEn,
      item.messageEn,
      item.suggestionEn,
    ]
      .join(' ')
      .toLowerCase();
    const optional = (catalog[block?.type]?.fields || []).some((field) => {
      if (
        field.required !== false ||
        (block.fields?.[field.name] != null && block.fields[field.name] !== '')
      )
        return false;
      const aliases = [
        field.name.toLowerCase(),
        field.name.replaceAll('_', '').toLowerCase(),
        ...(field.name === 'OBSTACLE_TAG'
          ? ['obstacle_tag', 'obstacletag', 'obstacle tag', '障碍标签']
          : []),
      ];
      return (
        item.pattern?.missingInput?.toLowerCase() === field.name.toLowerCase() ||
        aliases.some((v) => searchable.includes(v))
      );
    });
    if (optional) continue;
    if (!edgeId && edges.has(fact?.edgeId)) edgeId = fact.edgeId;
    const pattern = {};
    for (const field of [
      'blockType',
      'workspaceRole',
      'relationType',
      'missingInput',
      'objectRequirement',
      'edgeId',
    ])
      if (item.pattern?.[field]) pattern[field] = clip(item.pattern[field], 180);
    if (block?.type) pattern.blockType = block.type;
    if (fact?.blockType) pattern.blockType = fact.blockType;
    if (fact?.field) pattern.missingInput = fact.field;
    if (['missing_actor_target', 'actor_target_not_found'].includes(code))
      pattern.objectRequirement = 'scene_actor';
    if (['invalid_visible_condition_count', 'non_boolean_condition'].includes(code))
      Object.assign(pattern, { workspaceRole: 'condition', relationType: 'transition' });
    if (code === 'invalid_edge_endpoint') pattern.relationType = 'transition';
    if (code === 'start_node_count') pattern.workspaceRole = 'node_graph';
    if (edgeId) pattern.edgeId = edgeId;
    const title = clip(item.title || '节点逻辑需要调整', 80),
      message = clip(item.message || summary, 500),
      suggestion = clip(item.suggestion || summary, 500);
    issues.push({
      issueKey: code + '|' + nodeId + '|' + blockId + (edgeId ? '|' + edgeId : ''),
      severity: clip(item.severity || 'warning', 16),
      confidence,
      nodeId,
      blockId,
      edgeId,
      code,
      pattern,
      title,
      titleEn: clip(item.titleEn || title, 80),
      message,
      messageEn: clip(item.messageEn || summaryEn || message, 500),
      suggestion,
      suggestionEn: clip(item.suggestionEn || summaryEn || suggestion, 500),
    });
  }
  let tip = null;
  if (
    project.optimizationHintsEnabled === true &&
    result.optimizationTip?.tipKey &&
    result.optimizationTip.title &&
    result.optimizationTip.message
  ) {
    const raw = result.optimizationTip;
    tip = {
      tipKey: clip(raw.tipKey, 120),
      title: clip(raw.title, 80),
      titleEn: clip(raw.titleEn || raw.title, 80),
      message: clip(raw.message, 360),
      messageEn: clip(raw.messageEn || raw.message, 360),
    };
  }
  return {
    ...result,
    success: true,
    status: 'ok',
    issues,
    hasProblems: Boolean(issues.length),
    summary: issues.length ? summary : '',
    summaryEn: issues.length ? summaryEn : '',
    optimizationTip: issues.length ? null : tip,
  };
}

export async function reviewGraph(payload, signal) {
  payload = normalizeReviewRequest(payload);
  if (signal?.aborted) throw new Error('已取消节点审查');
  const cacheKey = JSON.stringify([
    payload.projectScopeId,
    payload.graphRevision,
    ordered(payload.projectContext || {}),
  ]);
  if (reviewCache.has(cacheKey)) return clone(reviewCache.get(cacheKey));
  const facts = graphFacts(payload.workspace, payload.projectContext);
  const used = [...new Set(walkBlocks(payload.workspace).map((b) => b.type))];
  const profile = payload.projectContext?.assistanceProfile || {};
  const score = Math.max(
    0,
    Math.min(100, Math.round(Number(profile.score ?? profile.fluencyScore) || 0))
  );
  const band =
    profile.updatedAt > 0 ? (score >= 75 ? 'high' : score <= 45 ? 'low' : 'medium') : 'unscored';
  const key = band + (payload.projectContext?.optimizationHintsEnabled === true ? '-opt' : '');
  const prefix = prompts.reviewPrefixes[key].replace('{{SCORE}}', String(score));
  const messages = [
    { role: 'system', content: prompts.reviewSystem },
    {
      role: 'user',
      content:
        prefix +
        '本地确定性事实：' +
        JSON.stringify(facts) +
        '\n项目上下文：' +
        JSON.stringify(payload.projectContext || {}) +
        '\n相关积木能力摘要：' +
        JSON.stringify(
          used
            .slice(0, 100)
            .map((type) => catalog[type])
            .filter(Boolean)
        ) +
        '\n节点图：' +
        JSON.stringify(payload.workspace),
    },
  ];
  const text = await completeModel(
    messages,
    { format: 'json', max_tokens: 1200, temperature: 0.1, timeout: 35 },
    signal
  );
  const result = {
    ...filterReview(parseModelJson(text), payload.workspace, payload.projectContext),
    schemaVersion: 1,
    graphRevision: payload.graphRevision,
  };
  reviewCache.set(cacheKey, clone(result));
  while (reviewCache.size > 32) reviewCache.delete(reviewCache.keys().next().value);
  return result;
}

export function validateGeneratedGraph(result, request) {
  for (const field of [
    'requestId',
    'targetId',
    'projectScopeId',
    'baseGraphRevision',
    'operation',
  ]) {
    if (result?.[field] !== request[field]) throw new Error('生成结果的 ' + field + ' 不匹配');
  }
  if (result.schemaVersion !== 1 || !result.summary || !result.workspace)
    throw new Error('生成结果缺少节点图或摘要');
  const forbidden = new Set([
    'python',
    'sourcecode',
    'generatedcode',
    'xml',
    'filepath',
    'actortarget',
    'scenetarget',
  ]);
  const scan = (value) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (forbidden.has(key.toLowerCase())) throw new Error('生成结果包含禁止字段 ' + key);
      scan(child);
    }
  };
  scan(result);
  result = normalizeSerialization(result);
  validateGeneratedNodeGraphResult(result);
  const workspace = result.workspace;
  validateCatalog(workspace);
  validateLanguage(result, request);
  const facts = graphFacts(workspace, request.projectContext);
  if (facts.length) throw new Error('节点图未通过校验 ' + facts.map((f) => f.code).join(', '));
  if (['edit', 'extend'].includes(request.operation)) {
    for (const kind of ['nodes', 'edges']) {
      const ids = new Set(workspace[kind].map((item) => item.id));
      if (request.workspace[kind].some((item) => !ids.has(item.id)))
        throw new Error('增量修改移除了已有结构');
    }
    if (
      request.operation === 'edit' &&
      JSON.stringify(workspace) === JSON.stringify(request.workspace)
    )
      throw new Error('修改请求没有改变节点图');
  }
  validateSemantics(result, request);
  return { ...clone(result), success: true, status: 'ok', warnings: [] };
}

export async function generateGraph(request, signal) {
  request = normalizeGenerationRequest(request);
  const requirements = generationRequirements(
    request.instruction,
    request.projectContext,
    request.operation
  );
  const base = JSON.stringify({ ...request, requirements });
  let rejected = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const selection = selectGenerationContract(
      request,
      requirements,
      attempt > 0 && /未知积木类型|unknown block type|缺少请求能力|未实现所请求/.test(rejected)
    );
    const text = await completeModel(
      [
        { role: 'system', content: prompts.generationSystem },
        {
          role: 'user',
          content:
            prompts.generationPrefixes[request.operation] +
            '\nLANGUAGE_RULES: ' +
            request.responseLanguage +
            '\nREQUEST_AND_REQUIREMENTS_JSON:\n' +
            base +
            '\n积木选择\n' +
            JSON.stringify({ mode: selection.mode, selectedTypes: selection.selectedTypes }) +
            '\n积木合同\n' +
            selection.text +
            (rejected ? '\n上次结果被拒绝，请修正\n' + rejected : ''),
        },
      ],
      { profile: 'node_graph', format: 'json', timeout: 90 },
      signal
    );
    if (signal?.aborted) throw new Error('已取消节点生成');
    try {
      return validateGeneratedGraph(parseModelJson(text), request);
    } catch (error) {
      rejected = String(error.message);
      if (attempt) throw error;
    }
  }
}

function roots(workspace) {
  return workspace?.blocks?.blocks || [];
}
function inputChildren(block, input) {
  const c = block.inputs?.[input];
  return [c?.block, c?.shadow].filter(Boolean);
}
function inputTree(block) {
  if (!block) return [];
  return [
    block,
    ...Object.keys(block.inputs || {}).flatMap((input) =>
      inputChildren(block, input).flatMap(inputTree)
    ),
  ];
}
function allWorkspaces(workspace) {
  return [
    ...workspace.nodes.map((n) => n.workspace),
    ...workspace.edges.map((e) => e.conditionWorkspace),
    workspace.globalVariablesWorkspace,
  ];
}
function reachable(workspace) {
  const ids = new Set(),
    queue = workspace.nodes.filter((n) => n.nodeType === 'start').map((n) => n.id);
  while (queue.length) {
    const id = queue.shift();
    if (ids.has(id)) continue;
    ids.add(id);
    queue.push(
      ...workspace.edges.filter((e) => e.source.nodeId === id).map((e) => e.target.nodeId)
    );
  }
  return {
    node: workspace.nodes.filter((n) => ids.has(n.id)).map((n) => n.workspace),
    condition: workspace.edges
      .filter((e) => ids.has(e.source.nodeId) && ids.has(e.target.nodeId))
      .map((e) => e.conditionWorkspace),
  };
}
export function normalizeSerialization(result) {
  const normalized = clone(result),
    used = new Set(walkBlocks(normalized.workspace).map((b) => b.id));
  let seq = 0;
  const id = (kind) => {
    let value;
    do {
      value = 'ai_repair_' + kind + '_' + ++seq;
    } while (used.has(value));
    used.add(value);
    return value;
  };
  for (const block of walkBlocks(normalized.workspace)) {
    const fields = block.fields,
      inputs = (block.inputs ||= {}),
      spec = catalog[block.type];
    if (
      ['control_if', 'control_else'].includes(block.type) &&
      fields &&
      Object.hasOwn(fields, 'BOOL')
    ) {
      if (!inputs.CONDITION)
        inputs.CONDITION = {
          block: { type: 'logic_boolean', id: id('condition'), fields: { BOOL: fields.BOOL } },
        };
      delete fields.BOOL;
    }
    if (
      fields &&
      spec &&
      Object.hasOwn(fields, 'OBJECT') &&
      !spec.fieldSpecs.OBJECT &&
      spec.inputSpecs.OBJECT?.check.includes('String')
    ) {
      if (!inputs.OBJECT && String(fields.OBJECT).trim())
        inputs.OBJECT = {
          block: {
            type: 'object_reference',
            id: id('object'),
            fields: { OBJECT: String(fields.OBJECT).trim(), MANUAL: '' },
          },
        };
      delete fields.OBJECT;
    }
    if (fields && !Object.keys(fields).length) delete block.fields;
    if (!Object.keys(inputs).length) delete block.inputs;
  }
  return normalized;
}
function validateCatalog(workspace) {
  for (const state of allWorkspaces(workspace)) {
    for (const block of walkBlocks(state)) {
      const spec = catalog[block.type];
      if (!spec || spec.projectUsage !== 'project-safe')
        throw new Error('积木类型无效 ' + block.type);
      for (const [name, value] of Object.entries(block.fields || {})) {
        const field = spec.fieldSpecs[name];
        if (!field && !spec.dynamic) throw new Error('未知积木字段 ' + name);
        if (field?.option_values.length && !field.option_values.includes(String(value)))
          throw new Error('下拉字段值无效 ' + name);
      }
      for (const [name, connection] of Object.entries(block.inputs || {})) {
        const input = spec.inputSpecs[name];
        if (!input && !spec.dynamic) throw new Error('未知积木输入 ' + name);
        for (const child of [connection.block, connection.shadow].filter(Boolean)) {
          const childSpec = catalog[child.type];
          if (!childSpec) throw new Error('未知积木 ' + child.type);
          if (input?.kind === 'value') {
            if (childSpec.shape !== 'output') throw new Error('值输入必须连接输出积木 ' + name);
            if (
              input.check.length &&
              childSpec.outputChecks.length &&
              !input.check.some((t) => childSpec.outputChecks.includes(t))
            )
              throw new Error('值输入类型不匹配 ' + name);
          }
          if (input?.kind === 'statement' && childSpec.shape === 'output')
            throw new Error('语句输入不能连接值积木 ' + name);
        }
      }
      if (block.next?.block && catalog[block.next.block.type]?.shape === 'output')
        throw new Error('next 不能连接值积木');
    }
  }
  if (
    roots(workspace.globalVariablesWorkspace).some((b) => !policy.globalRootTypes.includes(b.type))
  )
    throw new Error('全局变量池根积木无效');
}
function validateLanguage(result, request) {
  const chinese = (value) => /[\u3400-\u9fff]/.test(String(value || ''));
  const check = (value) => {
    if ((request.responseLanguage === 'zh-CN') !== chinese(value))
      throw new Error('生成结果语言与请求不一致');
  };
  check(result.summary);
  for (const kind of ['nodes', 'edges'])
    for (const item of result.workspace[kind]) {
      if (kind === 'nodes' && item.nodeType !== 'custom') continue;
      const old = request.workspace[kind].find((v) => v.id === item.id);
      const label = kind === 'nodes' ? item.customName || item.name : item.name;
      const before = kind === 'nodes' ? old?.customName || old?.name : old?.name;
      if (label && label !== before) check(label);
    }
}
function actorRefs(block) {
  return (policy.actorFields[block.type] || [])
    .map((field) => actorReference(block, field).name)
    .filter(Boolean);
}
function reads(blocks) {
  const values = {};
  for (const block of blocks.flatMap(inputTree)) {
    const getter = policy.coordinateGetters[block.type];
    if (getter) {
      const ref = actorReference(block, getter[0]);
      if (ref.name) (values[ref.name] ||= new Set()).add(getter[1]);
    }
  }
  return values;
}
export function validateSemantics(result, request) {
  const requirement = generationRequirements(
    request.instruction,
    request.projectContext,
    request.operation
  );
  const required = new Set(requirement.requiredCapabilities);
  if (!required.size) return;
  const scope = reachable(result.workspace),
    nodeBlocks = scope.node.flatMap((w) => walkBlocks(w));
  const allBlocks = [...nodeBlocks, ...scope.condition.flatMap((w) => walkBlocks(w))],
    types = new Set(allBlocks.map((b) => b.type));
  const control = ['wasd-object-movement', 'space-object-jump'].filter((c) => required.has(c));
  if (control.length) {
    const chains = scope.node
      .flatMap(roots)
      .filter((b) => b.type === 'node_while_active')
      .map((b) => walkBlocks(b.inputs?.DO?.block));
    const movementTypes = [
      'object_third_person_move',
      ...(requirement.firstPersonRequested ? ['object_first_person_move'] : []),
    ];
    const chain = chains.find((blocks) =>
      control.every((c) =>
        blocks.some((b) =>
          (c === 'wasd-object-movement' ? movementTypes : ['object_arcade_jump']).includes(b.type)
        )
      )
    );
    if (!chain) throw new Error('控制能力必须位于同一个可达的 node_while_active 持续循环');
    const targets = chain
      .filter((b) => [...movementTypes, 'object_arcade_jump'].includes(b.type))
      .map((b) => b.fields?.NAME);
    if (!targets.length || targets.some((n) => !n || n !== targets[0]))
      throw new Error('移动和跳跃必须绑定同一对象');
  }
  const alternatives = new Set(requirement.capabilityAlternatives.flat());
  for (const c of required) {
    const accepted = policy.capabilityValidation[c];
    if (
      !control.includes(c) &&
      !alternatives.has(c) &&
      accepted?.length &&
      !accepted.some((t) => types.has(t))
    )
      throw new Error('缺少请求能力 ' + c);
  }
  for (const group of requirement.capabilityAlternatives)
    if (!group.some((c) => policy.capabilityValidation[c]?.some((t) => types.has(t))))
      throw new Error('缺少可替代能力');
  if (required.has('attraction') && !types.has('node_while_active'))
    throw new Error('持续吸附逻辑必须可达');
  const actors = request.projectContext?.actors || [],
    tags = new Map(actors.map((a) => [a.name, new Set(a.tags || [])]));
  const literalTag = (b) =>
    b.fields?.TAG_TEXT || b.fields?.TAG || b.inputs?.TAG?.block?.fields?.TEXT || '';
  const refs = new Set(allBlocks.flatMap(actorRefs)),
    usedTags = new Set(allBlocks.map(literalTag).filter(Boolean));
  if (requirement.actors.multiTarget)
    for (const name of requirement.actors.targets)
      if (!refs.has(name) && ![...(tags.get(name) || [])].some((t) => usedTags.has(t)))
        throw new Error('多目标逻辑未覆盖 ' + name);
  for (const relation of requirement.dynamicActorRelations) {
    const coverage = Object.fromEntries(relation.targets.map((t) => [t, new Set()]));
    for (const block of nodeBlocks) {
      const axes = policy.movementInputs[block.type];
      if (!axes) continue;
      const targets = actorRefs(block);
      if (['object_move_tag', 'object_set_tag_velocity_axis'].includes(block.type))
        for (const [name, values] of tags) if (values.has(literalTag(block))) targets.push(name);
      for (const [input, configured] of Object.entries(axes)) {
        const axis =
          configured === 'FIELD_AXIS' ? String(block.fields?.AXIS || '').toUpperCase() : configured;
        const coordinates = reads(inputChildren(block, input));
        if (coordinates[relation.source]?.has(axis))
          for (const target of targets) coverage[target]?.add(axis);
      }
    }
    if (relation.targets.some((t) => !relation.axes.every((axis) => coverage[t].has(axis))))
      throw new Error('动态对象关系必须读取来源对象的实时坐标');
  }
  const conditions = [
    ...nodeBlocks
      .filter((b) => ['control_if', 'control_else'].includes(b.type))
      .flatMap((b) => inputChildren(b, 'CONDITION')),
    ...scope.condition.flatMap(roots),
  ];
  for (const relation of requirement.distanceActorRelations)
    for (const target of relation.targets) {
      const satisfied = conditions.some((root) => {
        const blocks = inputTree(root),
          names = new Set(blocks.flatMap(actorRefs)),
          coordinates = reads([root]);
        return (
          names.has(relation.source) &&
          names.has(target) &&
          relation.axes.every((a) => coordinates[relation.source]?.has(a)) &&
          (blocks.some((b) => b.type === 'detect_position_near') ||
            relation.axes.every((a) => coordinates[target]?.has(a)))
        );
      });
      if (!satisfied) throw new Error('距离条件必须包含双方对象的实时坐标');
    }
  if (
    requirement.cameraTargets.length &&
    !nodeBlocks.some(
      (b) =>
        [
          'camera_follow_object',
          'camera_third_person_orbit',
          'camera_first_person_follow',
        ].includes(b.type) && actorRefs(b).includes(requirement.cameraTargets[0])
    )
  )
    throw new Error('镜头未跟随指定对象');
  if (requirement.narrowObjectControl) {
    const count = (blocks) =>
      blocks.reduce((d, b) => {
        d[b.type] = (d[b.type] || 0) + 1;
        return d;
      }, {});
    const before = count(walkBlocks(request.workspace)),
      after = count(walkBlocks(result.workspace));
    if (
      Object.keys(after).some(
        (t) =>
          after[t] > (before[t] || 0) &&
          (['ui_set_score', 'ui_add_score', 'ui_set_lives', 'ui_game_win', 'ui_game_over'].includes(
            t
          ) ||
            t.startsWith('combat_'))
      )
    )
      throw new Error('局部控制请求增加了无关玩法');
    if (result.workspace.nodes.length - request.workspace.nodes.length > 2)
      throw new Error('局部控制请求新增节点过多');
  }
}

export function selectGenerationContract(request, requirements, expanded = false) {
  const entries = [...contractText.matchAll(/<Block\b[^>]*\btype="([^"]+)"[\s\S]*?<\/Block>/g)];
  const safe = (type) => catalog[type]?.projectUsage === 'project-safe';
  const selected = new Set(policy.coreBlocks.filter(safe));
  for (const capability of requirements.capabilities) {
    for (const type of policy.capabilityBlocks[capability] || [])
      if (safe(type)) selected.add(type);
    for (const [type, spec] of Object.entries(catalog))
      if (safe(type) && spec.capabilities.includes(capability)) selected.add(type);
  }
  for (const block of walkBlocks(request.workspace)) if (safe(block.type)) selected.add(block.type);
  const ignored = new Set([
    'the',
    'and',
    'for',
    'with',
    'this',
    'that',
    'from',
    'into',
    'make',
    'create',
  ]);
  const tokens = (request.instruction.match(/[a-zA-Z][a-zA-Z0-9_-]{2,}/g) || []).filter(
    (t) => !ignored.has(t.toLowerCase())
  );
  const matches = entries
    .filter((m) => safe(m[1]))
    .map((m) => ({
      type: m[1],
      score:
        tokens.filter((t) => m[0].toLowerCase().includes(t.toLowerCase())).length +
        (request.instruction.toLowerCase().includes(m[1].toLowerCase()) ? 4 : 0),
    }))
    .filter((m) => m.score)
    .sort((a, b) => b.score - a.score || a.type.localeCompare(b.type));
  matches.slice(0, 16).forEach((m) => selected.add(m.type));
  if (!requirements.capabilities.length && !matches.length)
    return { text: contractText, mode: 'full', selectedTypes: entries.map((m) => m[1]).sort() };
  if (expanded) {
    const categories = new Set([...selected].map((t) => catalog[t]?.category));
    for (const [type, spec] of Object.entries(catalog))
      if (safe(type) && categories.has(spec.category)) selected.add(type);
  }
  if (selected.size < 8)
    return { text: contractText, mode: 'full', selectedTypes: entries.map((m) => m[1]).sort() };
  return {
    text: contractText.replace(
      /(<Blocks>)[\s\S]*?(<\/Blocks>)/,
      (_all, open, close) =>
        open +
        '\n' +
        entries
          .filter((m) => selected.has(m[1]))
          .map((m) => m[0])
          .join('\n') +
        '\n' +
        close
    ),
    mode: expanded ? 'expanded' : 'filtered',
    selectedTypes: [...selected].sort(),
  };
}

export function compactProjectContext(context = {}) {
  const compact = {};
  for (const key of [
    'sceneName',
    'actorContextAvailable',
    'actorContextRevision',
    'assistanceProfile',
    'optimizationHintsEnabled',
  ])
    if (Object.hasOwn(context, key)) compact[key] = clone(context[key]);
  compact.actors = (Array.isArray(context.actors) ? context.actors : [])
    .filter((actor) => actor && typeof actor === 'object' && String(actor.name || '').trim())
    .map((actor) => {
      const item = {
        name: String(actor.name).trim(),
        type: String(actor.type || 'actor').trim() || 'actor',
        tags: Array.isArray(actor.tags)
          ? actor.tags
              .map(String)
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        aliases: Array.isArray(actor.aliases)
          ? actor.aliases
              .map(String)
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      };
      for (const key of ['semanticRole', 'transform', 'size', 'collision', 'physicsEnabled'])
        if (actor[key] != null) item[key] = clone(actor[key]);
      return item;
    });
  return compact;
}
function requestWorkspace(payload) {
  const workspace = payload?.workspace;
  if (
    !workspace ||
    typeof workspace !== 'object' ||
    !Array.isArray(workspace.nodes) ||
    !Array.isArray(workspace.edges)
  )
    throw new Error('workspace.nodes 和 workspace.edges 必须是数组');
  return clone(workspace);
}
export function normalizeGenerationRequest(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('节点生成请求必须是对象');
  const clip = (v, n) =>
    Array.from(String(v || '').trim())
      .slice(0, n)
      .join('');
  const request = {
    schemaVersion: 1,
    targetId: payload.targetId || 'node_graph:project:global',
    operation: clip(payload.operation || 'create', 40).toLowerCase(),
    instruction: clip(payload.instruction, 4000),
    workspace: requestWorkspace(payload),
    projectContext: compactProjectContext(payload.projectContext || {}),
  };
  for (const field of ['requestId', 'projectScopeId', 'baseGraphRevision']) {
    request[field] = clip(payload[field], 160);
    if (!request[field]) throw new Error('缺少 ' + field);
  }
  if (
    request.targetId !== 'node_graph:project:global' ||
    !['create', 'extend', 'edit', 'delete'].includes(request.operation)
  )
    throw new Error('节点生成目标或操作无效');
  if (!request.instruction) throw new Error('请输入要生成、制作或编辑的游戏逻辑');
  request.responseLanguage = ['zh-CN', 'en-US'].includes(payload.responseLanguage)
    ? payload.responseLanguage
    : /[\u3400-\u9fff]/.test(request.instruction)
      ? 'zh-CN'
      : 'en-US';
  return request;
}
function normalizeReviewRequest(payload) {
  const workspace = requestWorkspace(payload),
    graphRevision = String(payload.graphRevision || '').trim();
  if (!graphRevision) throw new Error('缺少 graphRevision');
  return {
    ...payload,
    schemaVersion: 1,
    graphRevision,
    workspace: {
      ...workspace,
      version: Number(workspace.version) || 1,
      globalVariablesWorkspace: workspace.globalVariablesWorkspace || {},
    },
    projectContext:
      payload.projectContext && typeof payload.projectContext === 'object'
        ? payload.projectContext
        : {},
  };
}
