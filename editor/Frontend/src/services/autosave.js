// Autosave policy and facade wiring.
//
// The policy lives here in the renderer because it is a UI decision - how often to write, what
// counts as a change - and because going through C++ would mean a timer and a dirty flag inside
// the scene service, which is meant to own scene data and nothing else. C++ keeps producing the
// scene when asked; this module only decides when to ask.
//
// Nothing here touches the DOM directly, and every dependency is injectable, so the policy is
// testable with a fake clock (`tests/js/autosave.test.mjs`).

import { notifyWorldError } from './worldSessionLifecycle.js';

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
  // Every edit bumps the generation. A save only settles the scene when the generation it
  // started with is still current: an edit made while the write was in flight is not in that
  // write, so marking the scene clean after it would drop the edit silently.
  let generation = 0;
  let inFlight = null;

  const clearTimers = () => {
    if (debounceTimer !== null) clearTimer(debounceTimer), (debounceTimer = null);
    if (deadlineTimer !== null) clearTimer(deadlineTimer), (deadlineTimer = null);
  };

  // Restart the debounce so a stream of edits writes once, after the last one. The ceiling is
  // armed once per dirty window and is deliberately *not* restarted: a continuous drag that
  // never stops still has to reach the disk.
  const arm = () => {
    if (debounceTimer !== null) clearTimer(debounceTimer);
    debounceTimer = setTimer(fire, debounceMs);
    if (deadlineTimer === null) deadlineTimer = setTimer(fire, maxIntervalMs);
  };

  const runSave = async (forced) => {
    const startedAt = generation;
    try {
      await save({ forced });
      failure = null;
      lastSavedAt = now();
      if (generation === startedAt) dirty = false;
    } catch (error) {
      failure = error;
    } finally {
      saving = false;
      inFlight = null;
      // Still dirty means either the write failed or an edit arrived while it ran; both need a
      // follow-up write, and nothing else will schedule one.
      if (dirty) arm();
    }
  };

  const fire = (forced = false) => {
    clearTimers();
    if (saving) return inFlight ?? Promise.resolve();
    if (!dirty && !forced) return Promise.resolve();
    saving = true;
    inFlight = runSave(forced);
    return inFlight;
  };

  return {
    markDirty() {
      dirty = true;
      generation += 1;
      // A running save arms the follow-up write itself when it settles.
      if (!saving) arm();
    },
    async flush() {
      // A write that is already running may predate the newest edit; wait for it, then write
      // whatever is still pending.
      if (inFlight) await inFlight;
      return fire();
    },
    /**
     * Write the scene even when nothing is dirty.
     *
     * The quit path uses this: the dirty flag is a heuristic (it only knows the facade methods
     * it wraps), so the last write before the process ends is unconditional. A write already
     * running is awaited first - it may predate the newest edit.
     */
    async saveNow() {
      if (inFlight) await inFlight;
      return fire(true);
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
export function withAutosave(api, { notify = defaultNotify, notifySkipped = defaultSkippedNotice, ...options } = {}) {
  const scene = api.scene ?? {};
  // An attempt that writes nothing is worth saying out loud once: the user edited a world whose
  // changes cannot be saved, and repeating it on every edit would be noise.
  const reported = new Set();
  const policy = createAutosavePolicy({
    ...options,
    save: async ({ forced = false } = {}) => {
      const outcome = await saveActiveScene(scene);
      // The quit path writes unconditionally; a world it cannot write is not news at that point
      // (the user already saw it when the first edit was refused).
      if (!forced && !outcome.saved && outcome.reason !== 'no_scene' && !reported.has(outcome.reason)) {
        reported.add(outcome.reason);
        notifySkipped(outcome);
      }
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
      saveNow: policy.saveNow,
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

// The quit path does not live here: `corona.app.close_process` writes the live scene natively
// before the process stops (the Web call and the window button reach the same request), so a
// renderer-side flush on the way out would only repeat that write.
function defaultSkippedNotice(outcome) {
  const message = outcome.reason === 'read_only'
    ? '当前世界为只读，修改不会被保存'
    : `自动保存未完成（${outcome.reason}）`;
  try {
    notifyWorldError(new Error(message), message);
  } catch {
    // A notification is a courtesy; the attempt is still reported through `corona:autosave`.
  }
}
