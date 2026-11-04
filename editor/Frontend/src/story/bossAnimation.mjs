export const BOSS_TUNING = Object.freeze({
  attackRange: 6,
  attackCooldownSeconds: 4,
  hurtSeconds: 0.9,
});

/** Clips by state. The two attacks alternate so a fight does not read as one repeated swing. */
export const BOSS_CLIPS = Object.freeze({
  idle: 'Idle',
  attack1: 'Attack1',
  attack2: 'Attack2',
  hurt: 'Hurt',
  dead: 'Die',
});

/** Measured from the shipped GLB. */
export const BOSS_CLIP_SECONDS = Object.freeze({
  Attack1: 4.87,
  Attack2: 1.27,
  Hurt: 1.48,
  Die: 3.87,
});

/**
 * One decision step.
 *
 * Priority: death, then a flinch (rewards the player for landing a hit), then a swing on cooldown,
 * then idle. `hurt` is a one-shot the caller owns for `hurtSeconds`; while it runs no swing starts.
 */
export function nextBossState({
  state,
  hp,
  distance,
  cooldownReady,
  wasHit,
  hurtReady = true,
  tuning = BOSS_TUNING,
}) {
  if (hp <= 0) return { state: 'dead', clip: BOSS_CLIPS.dead, once: true };
  if (wasHit && hurtReady && state !== 'hurt')
    return { state: 'hurt', clip: BOSS_CLIPS.hurt, once: true };
  if (!Number.isFinite(distance)) return { state: 'idle', clip: BOSS_CLIPS.idle, once: false };
  if (distance <= tuning.attackRange && cooldownReady) {
    const clip = state === 'attack1' ? BOSS_CLIPS.attack2 : BOSS_CLIPS.attack1;
    return { state: clip === BOSS_CLIPS.attack1 ? 'attack1' : 'attack2', clip, once: true };
  }
  return { state: 'idle', clip: BOSS_CLIPS.idle, once: false };
}

/**
 * Drive the boss actor.
 *
 * `tick({ hp, distance, wasHit })` — the caller supplies ground truth every step: the boss's current
 * health, how far the player is, and whether this tick follows a hit that landed.
 */
export function createBossDirector({
  play,
  tuning = BOSS_TUNING,
  now = () => Date.now(),
  onError = () => {},
  onAttack = () => {},
}) {
  let state = 'idle';
  let currentClip = null;
  let lastAttackAt = -Infinity;
  let hurtUntil = 0;
  let dead = false;
  let disposed = false;

  function switchTo(clip, force = false) {
    // A one-shot must be re-sent even when it is already current, or a second swing would be silent.
    if (clip === currentClip && !force) return;
    currentClip = clip;
    Promise.resolve()
      .then(() => play(clip, 0.25, force))
      .catch((error) => {
        currentClip = null;
        if (!disposed) onError(error);
      });
  }

  return {
    tick({ hp, distance, wasHit = false }) {
      if (disposed) return;
      const at = now();

      if (dead) {
        switchTo(BOSS_CLIPS.dead);
        return;
      }
      if (hp <= 0) {
        dead = true;
        state = 'dead';
        switchTo(BOSS_CLIPS.dead, true);
        return;
      }
      // Own the flinch until it has run its course.
      if (state === 'hurt' && at < hurtUntil) {
        switchTo(BOSS_CLIPS.hurt);
        return;
      }

      const decision = nextBossState({
        state,
        hp,
        distance,
        wasHit,
        cooldownReady: at - lastAttackAt >= tuning.attackCooldownSeconds * 1000,
        hurtReady: state !== 'hurt',
        tuning,
      });

      if (decision.state === 'hurt') {
        state = 'hurt';
        hurtUntil = at + tuning.hurtSeconds * 1000;
        switchTo(decision.clip, true);
        return;
      }
      if (decision.once) {
        state = decision.state;
        lastAttackAt = at;
        switchTo(decision.clip, true);
        onAttack({ clip: decision.clip });
        return;
      }
      state = 'idle';
      switchTo(decision.clip);
    },
    state: () => state,
    currentClip: () => currentClip,
    dispose() {
      disposed = true;
      return true;
    },
  };
}
