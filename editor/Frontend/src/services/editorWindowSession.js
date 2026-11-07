/** Web-owned window sessions. Native Dock remains a mode-agnostic transport. */
import { isSecondaryWebDocument } from '../api/webDocument.js';
const uniqueId = () => `${Date.now()}_${Math.random().toString(36).slice(2)}`;

export function createEditorWindowSession({ state, send, publish, getWorld, getQuery, owner = uniqueId(),
  activities = { begin: () => null, end: () => {}, drain: async () => {} },
  beforeRetire = () => {},
  wait = ms => new Promise(resolve => setTimeout(resolve, ms)), timeoutMs = 30_000 }) {
  let queue = Promise.resolve();
  let retirement = null;
  let retirementRevision = null;
  let needsRetirement = true;
  let preparationSequence = 0;
  // Surface identity must survive route changes; a secondary page never becomes
  // the policy owner simply by navigating to a URL without standalone=1.
  const surfaceQuery = new URLSearchParams(getQuery());
  const query = () => surfaceQuery;
  const standalone = () => isSecondaryWebDocument(surfaceQuery);
  const sessionOwner = () => standalone() ? query().get('uiOwner') : owner;
  const read = () => state.read();
  const write = value => state.write(value);
  const hydrate = () => state.hydrate?.() || Promise.resolve(read());
  const records = () => read().records.filter(record => record.owner === sessionOwner());
  const forget = async record => {
    await state.removeRecord(record);
    record.status = 'disposed';
  };
  const save = record => state.saveRecord(record);
  const worldAllowed = () => getWorld().status === 'ready';
  function policy() {
    const current = read();
    const record = standalone() ? ownRecord() : null;
    const valid = current?.enabled && (standalone()
      ? current.generation === query().get('uiSession') && current.owner === query().get('uiOwner')
        && record?.generation === current.generation && record.status !== 'closing'
      : current.owner === owner && current.revision === getWorld().revision);
    return { ...current, enabled: Boolean(valid) };
  }
  function requirePolicy() {
    const current = policy();
    if (!current.enabled || !worldAllowed()) throw new Error('当前世界不允许打开编辑器窗口');
    return current;
  }
  // The existing command acknowledges after TWO main-thread turns. With no scene
  // selected it closes nothing, but fences queued creates and SDL surface retirement.
  const fence = () => send({ cmd: 'suspendCameraViews', sceneId: '' });
  function taggedRoute(route, generation, id, sessionOwner) {
    return `${route || '/'}${String(route || '').includes('?') ? '&' : '?'}uiSession=${encodeURIComponent(generation)}&uiWindow=${encodeURIComponent(id)}&uiOwner=${encodeURIComponent(sessionOwner)}`;
  }
  const outstanding = record => ['pending', 'uncertain', 'settling'].includes(record.status);
  async function drain(predicate = () => true) {
    const started = Date.now();
    while (records().some(record => predicate(record) && outstanding(record))) {
      if (Date.now() - started >= timeoutMs) throw new Error('等待旧窗口请求结束超时，已取消切换世界，请重试。');
      await wait(20);
    }
  }
  async function dispose(record, notify = false) {
    if (record.kind === 'operation') {
      await fence();
    } else if (record.kind === 'camera') {
      await fence();
      await send({ cmd: 'suspendCameraViews', sceneId: record.sceneId });
    } else if (Number.isInteger(record.tabId)) {
      if (notify) {
        record.status = 'closing'; await save(record);
        await drain(item => item.source === record.id);
        await activities.drain(item => item.source === record.id);
      }
      await send({ cmd: 'closePanelTab', tabId: record.tabId, panelId: '' });
    }
    await forget(record);
  }
  async function retire() {
    await beforeRetire();
    await drain();
    await activities.drain();
    await fence();
    for (const record of records()) await dispose(record);
    await fence();
    needsRetirement = false;
  }
  function prepare(enabled) {
    if (standalone()) return Promise.reject(new Error('只有主窗口可以更改世界界面策略'));
    const preparation = ++preparationSequence;
    const revision = getWorld().revision;
    const previous = read();
    if (previous?.owner !== owner || previous?.revision !== revision) needsRetirement = true;
    if (!enabled || needsRetirement) {
      if (previous?.owner !== owner || previous.enabled || previous.revision !== revision) {
        // Revoke UI operations immediately, but keep the old message generation
        // alive until its archive-scoped saves and native retirement complete.
        write({ ...previous, owner, revision,
          generation: previous?.owner === owner ? previous.generation : uniqueId(), enabled: false });
      }
      needsRetirement = true;
      if (!enabled && retirement && retirementRevision === revision) return retirement;
    }
    const operation = queue.catch(() => {}).then(async () => {
      if (revision !== getWorld().revision) return policy();
      if (needsRetirement) await retire();
      if (enabled && preparation === preparationSequence && revision === getWorld().revision && worldAllowed()) {
        const current = policy();
        if (!current.enabled) write({ ...current,
          owner, revision, generation: uniqueId(), enabled: true,
        });
      }
      return policy();
    });
    queue = operation;
    if (!enabled) {
      retirementRevision = revision;
      retirement = operation;
      operation.then(() => { if (retirement === operation) retirement = null; },
        () => { if (retirement === operation) retirement = null; });
    }
    return operation;
  }
  async function open(command) {
    if (!state.main) await hydrate();
    const current = requirePolicy();
    const id = uniqueId();
    const record = { owner: current.owner, id,
      generation: current.generation, source: query().get('uiWindow'), panelId: command.panelId || '', sceneId: command.sceneId,
      kind: command.cmd === 'createCameraView' ? 'camera'
        : command.cmd.startsWith('create') ? 'panel' : 'operation', status: 'pending' };
    const activityId = record.kind === 'operation'
      ? activities.begin({ source: record.source || owner, kind: 'operation' })
      : null;
    if (record.kind !== 'operation') {
      const saved = save(record);
      if (!state.main) await saved;
    }
    const request = { ...command };
    if (record.kind !== 'operation') request.routePath = taggedRoute(command.routePath, current.generation, id, current.owner);
    const finish = async result => {
      record.tabId = result?.tab_id;
      record.status = 'settling';
      if (record.kind !== 'operation') await save(record);
      if (record.kind === 'operation') {
        if (!policy().enabled || policy().generation !== current.generation) throw new Error('世界已切换，已丢弃旧窗口请求');
        return;
      }
      if (record.kind !== 'operation' && !Number.isInteger(record.tabId)) {
        record.status = 'uncertain'; await save(record);
        throw new Error('窗口创建结果缺少 tab_id，已取消切换世界');
      }
      if (!policy().enabled || policy().generation !== current.generation || !worldAllowed()) {
        await dispose(record);
        throw new Error('世界已切换，已丢弃旧窗口请求');
      }
      record.status = 'ready';
      await save(record);
    };
    try {
      if (requirePolicy().generation !== current.generation) throw new Error('世界已切换，已丢弃旧窗口请求');
      const result = await send(request);
      await finish(result);
      return result;
    } catch (error) {
      if (record.kind === 'operation') throw error;
      if (record.status === 'pending') await forget(record);
      else if (record.status === 'settling') { record.status = 'ready'; await save(record); }
      throw error;
    } finally {
      if (activityId) activities.end(activityId);
    }
  }
  function ownRecord() {
    const current = read();
    const id = query().get('uiWindow');
    const sourceOwner = query().get('uiOwner') || current?.owner;
    return id && sourceOwner ? records().find(item => item.id === id && item.owner === sourceOwner) : null;
  }
  async function closeThis(panelId) {
    if (!standalone()) throw new Error('主世界窗口不能作为面板关闭');
    let record = ownRecord();
    panelId ||= record?.panelId || '';
    // Once retired, the owner closes this page only after its outstanding native
    // replies settle. Self-closing now would strand their registered callbacks.
    if (record && !policy().enabled && record.status !== 'closing') return;
    // Retired camera windows are already suspended by their owning main surface.
    if (query().get('camera') && !record) return;
    if (record) {
      await drain(item => item.id === record.id);
      record.status = 'closing'; await save(record);
      await activities.drain(item => item.source === record.id);
      record = ownRecord();
      if (!record) return; // The main surface already retired it.
      await drain(item => item.source === record.id);
      const current = read();
      if (!current?.enabled || current.generation !== record.generation) return;
    }
    await send({ cmd: 'closeThisTab', panelId: '' });
    if (record) await forget(record);
  }
  async function closeTab(tabId, panelId) {
    const record = records().find(item => item.tabId === tabId);
    if (record) return dispose({ ...record, panelId }, true);
    return send({ cmd: 'closePanelTab', tabId, panelId: '' });
  }
  async function broadcast(event, payload) {
    const current = requirePolicy();
    const record = ownRecord();
    return publish(event, {
      ...payload, uiGeneration: current.generation, ...(record?.tabId !== undefined ? { tabId: record.tabId } : {}),
    });
  }
  function accepts(payload) {
    const current = policy();
    return worldAllowed() && current.enabled && payload?.uiGeneration === current.generation;
  }
  return { prepare, policy, hydrate, open, closeThis, closeTab, broadcast, accepts };
}
