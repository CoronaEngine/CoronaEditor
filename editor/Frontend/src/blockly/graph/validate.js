// 节点图结构校验：纯数据检查，刻意不依赖 Blockly（也不做反序列化 / 生成器试跑）。
export function validateNodeGraph(rawGraph) {
  const graph = rawGraph && typeof rawGraph === 'object' ? rawGraph : {};
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const startNodes = nodes.filter((node) => node?.nodeType === 'start');
  if (startNodes.length !== 1) {
    throw new Error(
      startNodes.length === 0 ? '节点图必须包含一个开始节点' : '节点图只能包含一个开始节点'
    );
  }
  const ids = nodes.map((node) => String(node?.id ?? ''));
  if (ids.some((id) => !id)) throw new Error('节点图中存在缺少 ID 的节点');
  if (new Set(ids).size !== ids.length) throw new Error('节点图中存在重复的节点 ID');
  const nodeIds = new Set(ids);
  const validSides = new Set(['left', 'right', 'bottom']);
  const edgeIds = new Set();
  for (const edge of edges) {
    const edgeId = String(edge?.id ?? '');
    if (!edgeId) throw new Error('节点图中存在缺少 ID 的连线');
    if (edgeIds.has(edgeId)) throw new Error(`连线 ID 重复: ${edgeId}`);
    edgeIds.add(edgeId);
    for (const [label, endpoint] of [
      ['起点', edge?.source],
      ['终点', edge?.target],
    ]) {
      if (!nodeIds.has(String(endpoint?.nodeId ?? '')))
        throw new Error(`连线“${edge?.name || edgeId}”${label}指向不存在的节点`);
      if (
        !validSides.has(endpoint?.side) ||
        !Number.isInteger(Number(endpoint?.index)) ||
        Number(endpoint.index) < 0
      )
        throw new Error(`连线“${edge?.name || edgeId}”${label}端口无效`);
    }
  }
}
