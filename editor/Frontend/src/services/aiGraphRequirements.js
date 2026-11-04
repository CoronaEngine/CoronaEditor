import policy from './aiPolicy.json' with { type: 'json' };
const unique = (values) => [...new Set(values)];
const cameraPattern = /(?:camera|摄像机|相机|镜头)/i;
const sourcePattern = /(?:attractor|controller|source|origin|吸引源|控制源|来源)/i;
const escape = (value) => value.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
function actorTerms(actor) {
  const values = [actor.name, actor.semanticRole, ...(actor.aliases || []), ...(actor.tags || [])]
    .filter(Boolean)
    .map(String);
  const terms = values.flatMap((v) => [
    v,
    ...(v.match(/[\u3400-\u9fff]{2,}/g) || []),
    ...(v.match(/[A-Za-z][A-Za-z0-9_-]{2,}/g) || []),
  ]);
  const roles = values.join(' ');
  if (
    /(?:^|[\s_-])(?:attractor|controller|source|origin)(?:$|[\s_-])|吸引源|控制源|来源/i.test(roles)
  )
    terms.push('source object', 'source actor', '来源对象', '吸引源', '控制对象');
  if (/(?:^|[\s_-])(?:building|structure)s?(?:$|[\s_-])|建筑/i.test(roles))
    terms.push('building', 'buildings', '建筑');
  if (/(?:^|[\s_-])targets?(?:$|[\s_-])|目标/i.test(roles))
    terms.push('target object', 'target actor', 'targets', '目标对象');
  return unique(terms);
}
export function generationRequirements(instruction, project = {}, operation = 'create') {
  const text = String(instruction || ''),
    lower = text.toLowerCase();
  const wasd = /wasd|前后左右|四方向|方向键/i.test(text),
    jump = /space|空格/i.test(text) && /jump|跳/i.test(text);
  const firstPersonRequested = /first[- ]person|第一人称/i.test(text);
  const narrowObjectControl =
    (wasd || jump) &&
    !/(?:完整游戏|整个游戏|游戏演示|demo|deno|计分|生命|胜利|失败|敌人|战斗|关卡|score|lives?|victory|defeat|enemy|combat|level)/i.test(
      text
    );
  const capabilities = [];
  if (wasd) capabilities.push('input-control', 'wasd-object-movement');
  if (jump) capabilities.push('space-object-jump');
  for (const [name, pattern] of policy.capabilityPatterns)
    if (new RegExp(pattern, 'i').test(text)) capabilities.push(name);
  const actors = (project.actors || []).filter((a) => a?.name),
    byName = new Map(actors.map((a) => [a.name, a]));
  const matches = actors
    .flatMap((actor, index) => {
      const positions = actorTerms(actor)
        .map((term) => {
          const t = term.toLowerCase().trim();
          if (/^[a-z0-9_-]+$/.test(t))
            return lower.search(new RegExp('(?<![a-z0-9_-])' + escape(t) + '(?![a-z0-9_-])'));
          return lower.indexOf(t);
        })
        .filter((p) => p >= 0);
      return positions.length
        ? [{ position: Math.min(...positions), index, name: actor.name }]
        : [];
    })
    .sort((a, b) => a.position - b.position || a.index - b.index);
  const mentioned = unique(matches.map((m) => m.name));
  const isCamera = (name) => {
    const a = byName.get(name) || {};
    return cameraPattern.test([a.name, a.type, a.semanticRole, ...(a.tags || [])].join(' '));
  };
  let follow = null,
    cameraTarget = null;
  for (const m of text.matchAll(
    /\bfollow(?:s|ing)?\b|\btrack(?:s|ing)?\b|\bchase(?:s|ing)?\b|跟随|追随|追踪/gi
  )) {
    const nearCamera =
      cameraPattern.test(text.slice(Math.max(0, m.index - 80), m.index)) ||
      cameraPattern.test(text.slice(m.index + m[0].length, m.index + m[0].length + 40));
    const before = matches.filter((a) => a.position < m.index).map((a) => a.name),
      after = matches.filter((a) => a.position > m.index + m[0].length).map((a) => a.name);
    if (nearCamera)
      cameraTarget =
        after.find((n) => !isCamera(n)) || before.filter((n) => !isCamera(n)).at(-1) || null;
    else if (!follow && before.length && after.length && !before.every(isCamera))
      follow = { source: after[0], targets: unique(before.filter((n) => n !== after[0])) };
  }
  if (follow && !capabilities.includes('camera-follow') && !capabilities.includes('movement'))
    capabilities.push('movement');
  const roleSources = actors
    .filter((a) => sourcePattern.test([a.semanticRole, ...(a.tags || [])].join(' ')))
    .map((a) => a.name);
  const genericSource =
    /source\s+(?:object|actor)|controller|attractor|来源对象|吸引源|控制源/i.test(text);
  let source = [];
  if (follow) source = [follow.source];
  else if (capabilities.some((c) => ['attraction', 'rotation', 'camera-follow'].includes(c))) {
    source =
      !capabilities.some((c) => ['attraction', 'rotation'].includes(c)) &&
      capabilities.includes('camera-follow') &&
      cameraTarget
        ? [cameraTarget]
        : mentioned.filter((n) => roleSources.includes(n));
    if (!source.length)
      source = genericSource && roleSources.length === 1 ? roleSources : mentioned;
    source = source.slice(0, 1);
  }
  let targets = mentioned.filter((n) => !source.includes(n));
  const explicitList = mentioned.length >= 2 && /,|，|、|\band\b|和|与|及/i.test(text);
  let multiTarget =
    capabilities.includes('multi-object') ||
    targets.length >= 2 ||
    (explicitList && !capabilities.some((c) => ['attraction', 'rotation'].includes(c)));
  if (follow) {
    targets = follow.targets;
    multiTarget = targets.length >= 2;
  }
  if (
    multiTarget &&
    /all\s+(?:objects?|actors?|targets?)|every\s+(?:object|actor|target)|所有对象|全部对象|每个对象/i.test(
      text
    )
  )
    targets = unique([...targets, ...actors.map((a) => a.name).filter((n) => !source.includes(n))]);
  const parameters = {};
  const patterns = {
    speed: /(?:速度|speed)\s*(?:为|=|:)?\s*(-?\d+(?:\.\d+)?)/i,
    radius: /(?:半径|radius)\s*(?:为|=|:)?\s*(-?\d+(?:\.\d+)?)/i,
    force: /(?:力度|力量|吸力|force|strength)\s*(?:为|=|:)?\s*(-?\d+(?:\.\d+)?)/i,
    distance: /(?:距离|distance)\s*(?:小于|大于|为|=|:)?\s*(-?\d+(?:\.\d+)?)/i,
    duration: /(?:时间|时长|秒|duration|seconds?)\s*(?:为|=|:)?\s*(-?\d+(?:\.\d+)?)/i,
  };
  for (const [name, pattern] of Object.entries(patterns)) {
    const m = text.match(pattern);
    if (m) parameters[name] = Number(m[1]);
  }
  const numeric = [...text.matchAll(/-?\d+(?:\.\d+)?/g)]
    .map((m) => ({
      value: Number(m[0]),
      context: text.slice(Math.max(0, m.index - 12), m.index + m[0].length + 12),
    }))
    .slice(0, 12);
  if (numeric.length) parameters.numericMentions = numeric;
  parameters.defaultsRequired = [];
  if (capabilities.includes('movement') && parameters.speed == null)
    parameters.defaultsRequired.push('speed');
  if (capabilities.includes('attraction') && parameters.force == null)
    parameters.defaultsRequired.push('force');
  if (
    capabilities.includes('distance-check') &&
    parameters.distance == null &&
    parameters.radius == null
  )
    parameters.defaultsRequired.push('distanceThreshold');
  const lifecycle = [];
  if (/开始时|进入时|初始化|on\s+start|initialize/i.test(text)) lifecycle.push('on-enter');
  if (
    /持续|每帧|实时|不断|一直|while|continuously|constantly/i.test(text) ||
    capabilities.some((c) => ['movement', 'attraction', 'rotation', 'camera-follow'].includes(c))
  )
    lifecycle.push('while-active');
  if (capabilities.includes('input-control')) lifecycle.push('input-triggered');
  if (!lifecycle.length) lifecycle.push('on-enter');
  const axes = /xz|x-z|水平|地面|平面|俯视|top[- ]?down/i.test(text) ? ['X', 'Z'] : ['X', 'Y', 'Z'];
  const dynamicActorRelations = [];
  if (follow)
    dynamicActorRelations.push({
      kind: 'follow',
      source: follow.source,
      targets: follow.targets,
      axes,
    });
  else if (capabilities.includes('attraction') && source.length && targets.length)
    dynamicActorRelations.push({ kind: 'attraction', source: source[0], targets, axes });
  const distanceActorRelations = [];
  if (capabilities.includes('distance-check')) {
    if (source.length && targets.length)
      distanceActorRelations.push({ source: source[0], targets, axes });
    else if (mentioned.length >= 2)
      distanceActorRelations.push({ source: mentioned[0], targets: mentioned.slice(1), axes });
  }
  const replacement = text.match(
    /(?:(?:将|把)\s*)?(.{1,80}?)\s*(?:修改(?:成|为)|改(?:成|为)|替换(?:成|为)|换(?:成|为)|调整(?:成|为)|设置(?:成|为)|设(?:成|为)|变(?:成|为))\s*([^。！？!?\n]{1,80})/i
  );
  const trim = (value) => value.replace(/^[ \t，,：:]+|[ \t，,：:]+$/g, '');
  const capabilityAlternatives =
    /(?:隐藏|hide)\s*(?:或|或者|\/|or)\s*(?:销毁|删除|destroy|remove)|(?:销毁|删除|destroy|remove)\s*(?:或|或者|\/|or)\s*(?:隐藏|hide)/i.test(
      text
    )
      ? [['visibility', 'object-removal']]
      : [];
  return {
    operation: operation || 'create',
    actors: {
      mentioned,
      control: capabilities.some((c) =>
        ['input-control', 'wasd-object-movement', 'movement'].includes(c)
      )
        ? mentioned.slice(0, 1)
        : [],
      source,
      targets,
      multiTarget,
    },
    capabilities: unique(capabilities),
    requiredCapabilities: unique(capabilities),
    capabilityAlternatives,
    parameters,
    lifecycle: unique(lifecycle),
    constraints: [
      'use-only-existing-scene-actors',
      'use-only-contracted-blocks',
      'return-complete-workspace',
      'preserve-unrelated-logic',
    ],
    narrowObjectControl,
    firstPersonRequested,
    replacementDirective: replacement
      ? {
          source: trim(replacement[1])
            .replace(/^(?:请(?:你)?|麻烦|帮我|帮忙|给我|替我|为我)\s*/, '')
            .replace(/^(?:将|把)\s*/, ''),
          target: trim(replacement[2]),
        }
      : null,
    dynamicActorRelations,
    distanceActorRelations,
    cameraTargets: capabilities.includes('camera-follow')
      ? cameraTarget
        ? [cameraTarget]
        : source.slice(0, 1)
      : [],
  };
}
