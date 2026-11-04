// One request chain per renderer. Listeners receive only values sampled by this renderer.
export function createSceneReader(query, intervalMs = 180) {
  const listeners = new Map();
  let nextId = -1;
  let timer;
  let active = false;
  let paused = false;
  let generation = 0;

  function publish(kind, key, data, epoch) {
    for (const entry of listeners.values()) {
      if (epoch !== generation) return;
      if (entry.kind !== kind || (key !== null && entry.key === key)) continue;
      entry.key = key;
      try {
        Promise.resolve(entry.receive(data)).catch(error => console.warn('[scene read]', error));
      } catch (error) { console.warn('[scene read]', error); }
    }
  }

  function schedule(delay = 0) {
    if (timer !== undefined || active || paused || document.hidden || !listeners.size) return;
    timer = setTimeout(sample, delay);
  }

  async function sample() {
    timer = undefined;
    if (paused || document.hidden || !listeners.size) return;
    active = true;
    const epoch = generation;
    try {
      const state = await query('readActive');
      if (epoch !== generation) return;
      const session = state.archive_session;
      if (!session) return;
      const selection = state.selection || {};
      const scope = { archive_session: session };
      publish('project', session, { path: state.project_path, scene: { path: state.scene, name: state.name }, ...scope }, epoch);
      publish('tree', session + ':' + state.tree_revision, { scene: state.scene, ...scope }, epoch);
      publish('selection', session + JSON.stringify(selection), { scene: state.scene, ...selection, ...scope }, epoch);

      const kinds = new Set(Array.from(listeners.values(), e => e.kind));
      if (kinds.has('transform') && selection.actor_guid && epoch === generation) {
        const values = await query('readTransforms', { ...scope, actors: [selection.actor_guid] });
        for (const actor of values.actors) {
          publish('transform', session + JSON.stringify(actor), { ...actor, ...scope }, epoch);
        }
      }
      if (epoch === generation && ['actorPickResult', 'viewportGizmoPointerResult', 'meshMoveResult', 'focusPoseResult'].some(k => kinds.has(k))) {
        for (const result of await query('takeViewportResults', scope)) publish(result.kind, null, result.payload, epoch);
      }
    } catch (error) {
      // A project may have switched between the lightweight read and the scoped read.
      if (epoch === generation && !String(error).includes('PROJECT_CONTEXT_CHANGED')) console.warn('[scene read]', error);
    } finally {
      active = false;
      schedule(intervalMs);
    }
  }

  function invalidate() {
    generation++;
    clearTimeout(timer);
    timer = undefined;
  }
  return {
    observe(kind, receive) {
      const token = nextId--;
      listeners.set(token, { kind, receive });
      schedule();
      return token;
    },
    off(token) {
      listeners.delete(token);
      if (!listeners.size) invalidate();
    },
    pause() { paused = true; invalidate(); },
    resume() { paused = false; invalidate(); schedule(); },
    visibilityChanged() { invalidate(); schedule(); },
  };
}
