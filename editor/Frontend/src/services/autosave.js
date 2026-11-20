// Autosave policy and facade wiring.
//
// The policy lives here in the renderer because it is a UI decision - how often to write, what
// counts as a change - and because going through C++ would mean a timer and a dirty flag inside
// the scene service, which is meant to own scene data and nothing else. C++ keeps producing the
// scene when asked; this module only decides when to ask.
//
// Nothing here touches the DOM directly, and every dependency is injectable, so the policy is
// testable with a fake clock (`tests/js/autosave.test.mjs`).

/** Scene methods that change persisted state. Reads and camera framing do not belong here. */
export const PERSISTENT_SCENE_METHODS = [
  'create_actor',
  'delete_actor',
  'update_actor',
  'set_actor_transform',
  'rebind_actor_resource',
  'set_actor_ik_chains',
  'set_environment',
  'set_model_node_state',
  'create_camera',
  'delete_camera',
  'update_camera',
  'set_camera_render_settings',
  'import_resource_file',
];

/**
 * Decide when a dirty scene is written.
 *
 * Two timers, because either one alone is wrong: the debounce restarts on every edit, so a
 * burst writes once when it ends, and the ceiling is armed from the first edit of a dirty
 * window so a stream that never stops still reaches the disk. A failed save leaves the scene
 * dirty and schedules a retry, so a transient failure (the editor is busy, the archive service
 * is starting) is not silently the last attempt.
 */
export function createAutosavePolicy({
  save,
  now = () => Date.now(),
  setTimer = (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimer = id => globalThis.clearTimeout(id),
  debounceMs = 3000,
  maxIntervalMs = 60000,
} = {}) {
  if (typeof save !== 'function') throw new TypeError('createAutosavePolicy needs a save function');

  let dirty = false;
  let saving = false;
  let debounceTimer = null;
  let deadlineTimer = null;
  let lastSavedAt = now();
  let failure = null;

  const clearTimers = () => {
    if (debounceTimer !== null) clearTimer(debounceTimer), (debounceTimer = null);
    if (deadlineTimer !== null) clearTimer(deadlineTimer), (deadlineTimer = null);
  };

  const fire = async () => {
    clearTimers();
    if (!dirty || saving) return;
    saving = true;
    try {
      await save();
      dirty = false;
      failure = null;
      lastSavedAt = now();
    } catch (error) {
      failure = error;
      if (dirty) debounceTimer = setTimer(fire, debounceMs);
    } finally {
      saving = false;
    }
  };

  return {
    markDirty() {
      dirty = true;
      if (saving) return;
      // Restart the debounce so a stream of edits writes once, after the last one. The ceiling
      // is armed once per dirty window and is deliberately *not* restarted: a continuous drag
      // that never stops still has to reach the disk.
      if (debounceTimer !== null) clearTimer(debounceTimer);
      debounceTimer = setTimer(fire, debounceMs);
      if (deadlineTimer === null) deadlineTimer = setTimer(fire, maxIntervalMs);
    },
    flush() {
      return fire();
    },
    /** A save that already happened elsewhere (the user pressed save) settles the scene. */
    markClean() {
      dirty = false;
      clearTimers();
    },
    dispose() {
      clearTimers();
      dirty = false;
    },
    state() {
      return { dirty, saving, armed: debounceTimer !== null || deadlineTimer !== null, lastSavedAt, failure };
    },
  };
}

/** Read the active scene and write it. Skips a read-only scene and an empty editor. */
export async function saveActiveScene(scene) {
  const active = await scene.read_active();
  if (!active || !active.archive_session) return { saved: false, reason: 'no_scene' };
  if (active.read_only) return { saved: false, reason: 'read_only' };
  const result = await scene.save(active.scene, { archive_session: active.archive_session });
  return { saved: result?.status === 'saved', reason: result?.status ?? 'unknown', result };
}

/**
 * Wrap the editor facade so its persistent scene methods mark the scene dirty.
 *
 * The native bindings are read-only V8 properties, so the facade is the only place a wrapper can
 * sit. Everything else on the object is forwarded untouched.
 */
export function withAutosave(api, { notify = defaultNotify, ...options } = {}) {
  const scene = api.scene ?? {};
  const policy = createAutosavePolicy({
    ...options,
    save: async () => {
      const outcome = await saveActiveScene(scene);
      notify(outcome);
      return outcome;
    },
  });

  const wrappedScene = { ...scene };
  if (typeof scene.save === 'function') {
    // A manual save is authoritative: it must not be followed by an autosave of the same state.
    wrappedScene.save = async (...args) => {
      const result = await scene.save(...args);
      if (result?.status === 'saved') policy.markClean();
      return result;
    };
  }
  for (const name of PERSISTENT_SCENE_METHODS) {
    const original = scene[name];
    if (typeof original !== 'function') continue;
    wrappedScene[name] = (...args) => {
      policy.markDirty();
      return original(...args);
    };
  }

  return {
    ...api,
    scene: wrappedScene,
    autosave: {
      markDirty: policy.markDirty,
      flush: policy.flush,
      dispose: policy.dispose,
      state: policy.state,
    },
  };
}

function defaultNotify(outcome) {
  const target = globalThis.window;
  if (typeof target?.dispatchEvent !== 'function') return;
  try {
    target.dispatchEvent(new CustomEvent('corona:autosave', { detail: outcome }));
  } catch {
    // A notification is a courtesy; the save already happened.
  }
}
