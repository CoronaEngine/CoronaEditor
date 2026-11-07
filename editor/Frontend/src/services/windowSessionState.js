const METHOD = 'windowSession.state';
const EVENT = 'windowSession.stateChanged';
const RECORD_METHOD = 'windowSession.record';
export const WINDOW_SESSION_POLICY_EVENT = 'windowSession.policyChanged';

const clone = value => structuredClone(value);
const initialState = (owner, generation) => ({ owner, revision: -1, generation, enabled: false, records: [], stateVersion: 0 });

export function createWindowSessionState(messages, { owner, main = false, generation = null } = {}) {
  let state = initialState(owner, generation);
  const accept = value => {
    if (value?.owner === owner && value.stateVersion >= state.stateVersion) state = clone(value);
    return clone(state);
  };
  const write = next => {
    if (!main) throw new Error('Only the main document can replace window policy');
    const policyChanged = ['owner', 'revision', 'generation', 'enabled'].some(key => next[key] !== state[key]);
    state = clone({ ...next, owner, records: Array.isArray(next.records) ? next.records : [], stateVersion: state.stateVersion + 1 });
    void messages.emit(EVENT, state).catch(() => {});
    if (policyChanged) void messages.emit(WINDOW_SESSION_POLICY_EVENT, state).catch(() => {});
    return clone(state);
  };
  const mutateRecord = ({ operation, record }) => {
    if (record?.owner !== owner || !record.id || record.generation !== state.generation) throw new Error('CONTEXT_CHANGED');
    const existing = state.records.find(item => item.id === record.id);
    if (operation === 'save') {
      if (!existing && !state.enabled) throw new Error('CONTEXT_CHANGED');
      return write({ ...state, records: existing
        ? state.records.map(item => item.id === record.id ? record : item)
        : [...state.records, record] });
    }
    if (operation !== 'remove') throw new Error('INVALID_OPERATION');
    return existing ? write({ ...state, records: state.records.filter(item => item.id !== record.id) }) : clone(state);
  };
  const update = (operation, record) => main ? mutateRecord({ operation, record })
    : messages.request('main', RECORD_METHOD, { operation, record }).then(accept);
  const stopRequest = main ? messages.handle(METHOD, () => clone(state)) : () => {};
  const stopRecord = main ? messages.handle(RECORD_METHOD, mutateRecord) : () => {};
  const stopEvent = main ? () => {} : messages.on(EVENT, accept);
  return {
    main,
    read: () => clone(state),
    write,
    saveRecord: record => update('save', record),
    removeRecord: record => update('remove', record),
    async hydrate() {
      if (!main) accept(await messages.request('main', METHOD, null));
      return clone(state);
    },
    dispose() { stopRequest(); stopRecord(); stopEvent(); },
  };
}

export { METHOD as WINDOW_SESSION_STATE_METHOD, EVENT as WINDOW_SESSION_STATE_EVENT };
