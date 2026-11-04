import policy from './cabbageChatPolicy.json' with { type: 'json' };

const MESSAGE_LIMIT = 24;
const TASK_LIMIT = 20;
const ACTOR_LIMIT = 80;
const DETAIL_PATTERN =
  /(不理解|看不懂|不会|怎么做|怎么连接|放在哪里|为什么还是不行|一步一步|具体步骤|展示|演示)/i;
// eslint-disable-next-line no-control-regex -- Python str.strip() includes U+001C through U+001F.
const PYTHON_WHITESPACE = /^[\p{White_Space}\u001c-\u001f]+|[\p{White_Space}\u001c-\u001f]+$/gu;

function clip(text, limit, suffix = '') {
  if (text.length <= limit) return text;
  let end = 0;
  let count = 0;
  for (const character of text) {
    if (count++ === limit) return text.slice(0, end) + suffix;
    end += character.length;
  }
  return text;
}

function field(value, limit, strip = false) {
  const text = String(value || '');
  return clip(strip ? text.replace(PYTHON_WHITESPACE, '') : text, limit);
}

// Compare Unicode fold-equivalent names. Dotless i is distinct; capital sharp S folds to ss.
function foldKey(text) {
  return Array.from(text, (c) =>
    c === 'ı' ? c : c.toUpperCase().toLowerCase().replaceAll('ß', 'ss')
  ).join('');
}

function nativeKeyOrder(a, b) {
  let i = 0;
  while (i < a.length && i < b.length) {
    const left = a.codePointAt(i);
    const right = b.codePointAt(i);
    if (left !== right) return left - right;
    i += left > 0xffff ? 2 : 1;
  }
  return a.length - b.length;
}

function graphNumber(value) {
  const token = JSON.stringify(value);
  if (token === 'null') return token;
  // Integer tokens fitting the native JSON int64/uint64 types arrive in Python as integers.
  if (!/[.e]/.test(token)) {
    const n = BigInt(token);
    if (n >= -(2n ** 63n) && n < 2n ** 64n) return token;
  }
  const [mantissa, exponentText] = value.toExponential().split('e');
  const exponent = Number(exponentText);
  if (exponent < -4 || exponent >= 16) {
    return (
      mantissa + 'e' + (exponent < 0 ? '-' : '+') + String(Math.abs(exponent)).padStart(2, '0')
    );
  }
  return Number.isInteger(value) ? value.toFixed(1) : token;
}

// graphExcerpt went through native sorted JSON, then compact Python JSON. The surrounding
// prompt context was built in field order by Python with a space after each separator.
function contextJson(value, graph = false) {
  const comma = graph ? ',' : ', ';
  if (Array.isArray(value))
    return '[' + Array.from(value, (item) => contextJson(item, graph) ?? 'null').join(comma) + ']';
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value);
    if (graph) keys.sort(nativeKeyOrder);
    const members = [];
    for (const key of keys) {
      const encoded = contextJson(value[key], graph);
      if (encoded !== undefined) members.push(JSON.stringify(key) + (graph ? ':' : ': ') + encoded);
    }
    return '{' + members.join(comma) + '}';
  }
  return graph && typeof value === 'number' ? graphNumber(value) : JSON.stringify(value);
}

function normalizeTask(task) {
  const taskKey = field(task.taskKey || task.issueKey, 160);
  return {
    taskKey,
    issueKey: taskKey,
    type: ['tutorial', 'goal', 'node-issue'].includes(task.type) ? task.type : 'node-issue',
    title: field(task.title, 160),
    titleEn: field(task.titleEn, 160),
    message: field(task.message, 800),
    messageEn: field(task.messageEn, 800),
    suggestion: field(task.suggestion, 800),
    suggestionEn: field(task.suggestionEn, 800),
    completionCriteria: field(task.completionCriteria, 600),
    completionCriteriaEn: field(task.completionCriteriaEn, 600),
    completionSignal: field(task.completionSignal, 80),
    guidanceIntent: field(task.guidanceIntent, 80),
    nodeId: field(task.nodeId, 160),
    blockId: field(task.blockId, 160),
    edgeId: field(task.edgeId, 160),
    code: field(task.code, 80),
  };
}

function projectContext(project) {
  const seen = new Set();
  const actors = [];
  for (const actor of (project.actors || []).slice(0, ACTOR_LIMIT)) {
    if (!actor) continue;
    const name = field(actor.name, 240, true);
    const key = foldKey(name);
    if (!name || seen.has(key)) continue;
    seen.add(key);
    const aliases = (actor.aliases || [])
      .slice(0, 12)
      .map((a) => field(a, 240, true))
      .filter((a) => a && foldKey(a) !== key);
    const tags = (actor.tags || [])
      .slice(0, 12)
      .map((t) => field(t, 120, true))
      .filter(Boolean);
    actors.push({
      name,
      type: field(actor.type, 120, true) || 'actor',
      tags: [...new Set(tags)],
      aliases: [...new Set(aliases)],
    });
  }
  return {
    sceneName: field(project.sceneName, 320, true),
    actorContextAvailable: project.actorContextAvailable === true,
    actors,
  };
}

function scoreBand(profile) {
  if (!(Number(profile.updatedAt) >= 1)) return 'unscored';
  const value = Number(Object.hasOwn(profile, 'score') ? profile.score : profile.fluencyScore);
  const floor = Math.floor(value);
  const score = !Number.isFinite(value)
    ? 0
    : value - floor === 0.5
      ? floor + (floor % 2)
      : Math.round(value);
  return score >= 75 ? 'high' : score <= 45 ? 'low' : 'medium';
}

function lookup(guides, key) {
  return Object.hasOwn(guides, key) ? guides[key] : null;
}

function guidanceFor(detail, question, selected, locale) {
  let guide;
  if (detail) {
    const match = policy.keywords.find(
      ({ any, also }) =>
        any.some((word) => question.includes(word)) &&
        (!also.length || also.some((word) => question.includes(word)))
    );
    if (match)
      guide = lookup(policy.taskGuides, match.guide) || lookup(policy.issueGuides, match.guide);
    if (!guide && selected?.type === 'goal') {
      guide = Object.values(policy.taskGuides).find(
        (item) => item.intent === selected.guidanceIntent
      );
    }
    guide ??=
      lookup(policy.taskGuides, selected?.taskKey) || lookup(policy.issueGuides, selected?.code);
  }
  return {
    needsShowcase: Boolean(guide),
    guidanceIntent: guide?.intent || '',
    steps: [...(guide?.[locale] || (detail ? policy.prompts[locale].fallbackSteps : []))],
  };
}

export function buildCabbageChatRequest({
  assistant,
  requestId,
  locale,
  selectedTaskKey,
  tasks,
  content,
}) {
  const language = String(locale || '')
    .toLowerCase()
    .startsWith('en')
    ? 'en-US'
    : 'zh-CN';
  const copy = policy.prompts[language];
  const history = assistant.messages
    .slice(-MESSAGE_LIMIT)
    .filter(Boolean)
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: field(m.content, 4000, true),
    }))
    .filter((m) => m.content);
  if (history.at(-1)?.role !== 'user') throw new Error('请输入需要继续询问的问题');
  const question = foldKey(history.at(-1).content);
  const activeTasks = tasks
    .slice(0, TASK_LIMIT)
    .filter((t) => t && typeof t === 'object' && !Array.isArray(t))
    .map(normalizeTask);
  const selectedKey = field(selectedTaskKey, 160);
  const selectedTask = activeTasks.find((task) => task.taskKey === selectedKey) || null;
  const detail =
    DETAIL_PATTERN.test(content) ||
    policy.detailTerms.some((term) => question.includes(term)) ||
    (Boolean(selectedKey) && history.filter((m) => m.role === 'user').length >= 2);
  const graph = assistant.graphExcerpt;
  const context = {
    worldId: field(assistant.worldId, 160),
    projectScopeId: field(assistant.projectScopeId, 160),
    graphRevision: field(assistant.graphRevision, 160),
    selectedTask,
    activeTasks,
    graphExcerpt: clip(
      contextJson(graph && typeof graph === 'object' && !Array.isArray(graph) ? graph : {}, true),
      18000,
      '…'
    ),
    projectContext: projectContext(assistant.projectContext || {}),
  };
  return {
    requestId,
    modelMessages: [
      {
        role: 'system',
        content:
          copy.base +
          copy.scores[scoreBand(assistant.assistanceProfile || {})] +
          (detail ? copy.detail : ''),
      },
      { role: 'system', content: copy.contextPrefix + contextJson(context) },
      ...history,
    ],
    guidance: guidanceFor(detail, question, selectedTask, language),
  };
}
