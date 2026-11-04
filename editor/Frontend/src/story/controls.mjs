// Distances, timing, orbit and input curves are taken from the original main-world controller.
export const CONTROL = Object.freeze({
  speed: 3,
  maxDelta: 0.05,
  sprintMultiplier: 1.5,
  sprintThresholdMs: 200,
  dodgeDistance: 3,
  dodgeDuration: 0.25,
  dodgeCooldownMs: 600,
  jumpDistance: 4,
  jumpDuration: 0.7,
  jumpHeight: 1.2,
  distance: 4.5,
  minDistance: 2.5,
  maxDistance: 10,
  pitch: (20 * Math.PI) / 180,
  minPitch: (10 * Math.PI) / 180,
  maxPitch: (65 * Math.PI) / 180,
  sensitivity: 0.005,
  edgeWidth: 40,
  edgeYawSpeed: Math.PI / 2,
  edgePitchSpeed: Math.PI / 3,
  firstPersonEyeHeight: 1.6,
  topPitch: (82 * Math.PI) / 180,
  topDistance: 16,
  maxTopDistance: 30,
});
export const VIEW_LABELS = { third: '第三人称', first: '降临视角', top: '俯视建筑' };
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const edge = (value, start, extent) => {
  const band = Math.min(CONTROL.edgeWidth, extent / 2);
  return band > 0
    ? clamp((value - start - extent + band) / band, 0, 1) -
        clamp((start + band - value) / band, 0, 1)
    : 0;
};

export function createPlayerControls(
  player,
  { now = () => performance.now(), floor = () => 0, collide = (p) => p } = {}
) {
  const keys = new Set(),
    shifts = new Set();
  let yaw = player.yaw,
    pitch = CONTROL.pitch,
    distance = CONTROL.distance,
    view = 'third';
  let shiftSince = null,
    lastDodge = -Infinity,
    dodge = null,
    jump = null,
    vertical = 0,
    spaceHeld = false;
  let pointer = null;
  function direction() {
    const x = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
    const z = Number(keys.has('KeyW')) - Number(keys.has('KeyS'));
    const length = Math.hypot(x, z);
    return length
      ? [
          (x * Math.cos(yaw) + z * Math.sin(yaw)) / length,
          (z * Math.cos(yaw) - x * Math.sin(yaw)) / length,
        ]
      : null;
  }
  function resetInput() {
    keys.clear();
    shifts.clear();
    shiftSince = null;
    pointer = null;
    dodge = null;
    jump = null;
    spaceHeld = false;
  }
  function turn(x, y) {
    yaw += x;
    const [lo, hi] =
      view === 'top'
        ? [CONTROL.topPitch, Math.PI / 2 - 0.001]
        : [CONTROL.minPitch, CONTROL.maxPitch];
    pitch = clamp(pitch + y, lo, hi);
  }
  function step(seconds) {
    const dt = clamp(seconds, 0, CONTROL.maxDelta);
    if (view !== 'first' && pointer)
      turn(pointer.edgeX * CONTROL.edgeYawSpeed * dt, pointer.edgeY * CONTROL.edgePitchSpeed * dt);
    let dir = direction(),
      travel = dt * CONTROL.speed;
    if (dodge) {
      dir = dodge.dir;
      const next = Math.min(CONTROL.dodgeDuration, dodge.time + dt);
      const curve = (t) => CONTROL.dodgeDistance * (1 - (1 - t / CONTROL.dodgeDuration) ** 2);
      travel = curve(next) - curve(dodge.time);
      dodge.time = next;
    } else if (jump && jump.time < CONTROL.jumpDuration) {
      dir = jump.dir;
      travel = (dt * CONTROL.jumpDistance) / CONTROL.jumpDuration;
      jump.time += dt;
    } else if (shiftSince !== null && now() - shiftSince >= CONTROL.sprintThresholdMs)
      travel *= CONTROL.sprintMultiplier;
    const wanted = {
      x: player.x + (dir?.[0] || 0) * travel,
      z: player.z + (dir?.[1] || 0) * travel,
    };
    const nextVertical = Math.max(-24, vertical - 19.6 * dt);
    wanted.y = player.y + (vertical + nextVertical) * 0.5 * dt;
    const surface = floor(wanted.x, wanted.z);
    wanted.y = Math.max(surface, wanted.y);
    const next = collide(wanted, player);
    if (dir && !dodge) {
      const turnAngle = Math.atan2(dir[0], dir[1]) - player.yaw;
      player.yaw += clamp(Math.atan2(Math.sin(turnAngle), Math.cos(turnAngle)), -6 * dt, 6 * dt);
    }
    const blocked = Math.hypot(next.x - wanted.x, next.z - wanted.z) > 0.001;
    const lifted = next.y > wanted.y + 0.0001;
    player.x = next.x;
    player.z = next.z;
    player.y = next.y;
    player.grounded = nextVertical <= 0 && (lifted || next.y <= floor(next.x, next.z) + 0.002);
    vertical =
      player.grounded || (nextVertical > 0 && next.y < wanted.y - 0.001) ? 0 : nextVertical;
    if (player.grounded) jump = null;
    if (dodge && (dodge.time >= CONTROL.dodgeDuration || blocked)) dodge = null;
    player.motion =
      jump || !player.grounded
        ? 'jumping'
        : dodge
          ? 'dodging'
          : direction()
            ? shiftSince !== null && now() - shiftSince >= CONTROL.sprintThresholdMs
              ? 'sprinting'
              : 'walking'
            : 'idle';
  }
  return {
    get view() {
      return view;
    },
    pose() {
      const forward = [
        Math.sin(yaw) * Math.cos(pitch),
        -Math.sin(pitch),
        Math.cos(yaw) * Math.cos(pitch),
      ];
      const eye = [
        player.x,
        player.y + (view === 'first' ? CONTROL.firstPersonEyeHeight : 1.35),
        player.z,
      ];
      return {
        position: eye.map((n, i) => n - forward[i] * (view === 'first' ? 0 : distance)),
        forward,
        view,
      };
    },
    cycle() {
      view = view === 'third' ? 'first' : view === 'first' ? 'top' : 'third';
      if (view === 'top') distance = CONTROL.topDistance;
      if (view === 'third') distance = clamp(distance, CONTROL.minDistance, CONTROL.maxDistance);
      turn(0, 0);
      resetInput();
      return view;
    },
    pointerMove(event, rect, locked) {
      if (locked) {
        turn(
          (event.movementX || 0) * CONTROL.sensitivity,
          (event.movementY || 0) * CONTROL.sensitivity
        );
        pointer = null;
        return;
      }
      const { clientX: x, clientY: y, pointerId: id } = event;
      if (!rect || x < rect.left || y < rect.top || x >= rect.right || y >= rect.bottom) {
        pointer = null;
        return;
      }
      if (pointer?.id === id)
        turn((x - pointer.x) * CONTROL.sensitivity, (y - pointer.y) * CONTROL.sensitivity);
      pointer = {
        id,
        x,
        y,
        edgeX: edge(x, rect.left, rect.width),
        edgeY: edge(y, rect.top, rect.height),
      };
    },
    clearPointer() {
      pointer = null;
    },
    zoom(delta) {
      if (view !== 'first')
        distance = clamp(
          distance * Math.exp(clamp(delta * 0.001, -1, 1)),
          CONTROL.minDistance,
          view === 'top' ? CONTROL.maxTopDistance : CONTROL.maxDistance
        );
    },
    down(code, repeat) {
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(code)) keys.add(code);
      else if (code === 'ShiftLeft' || code === 'ShiftRight') {
        if (!repeat && !jump && !dodge) {
          if (!shifts.size) shiftSince = now();
          shifts.add(code);
        }
      } else if (code === 'Space') {
        if (!repeat && !spaceHeld && player.grounded && !dodge) {
          jump = { dir: direction() || [Math.sin(player.yaw), Math.cos(player.yaw)], time: 0 };
          vertical = Math.sqrt(2 * 19.6 * CONTROL.jumpHeight);
          player.grounded = false;
          player.motion = 'jumping';
        }
        spaceHeld = true;
      } else return false;
      return true;
    },
    up(code) {
      keys.delete(code);
      if (code === 'Space') spaceHeld = false;
      if (shifts.delete(code) && !shifts.size) {
        if (
          now() - shiftSince < CONTROL.sprintThresholdMs &&
          now() - lastDodge >= CONTROL.dodgeCooldownMs &&
          player.grounded &&
          !jump &&
          !dodge
        ) {
          dodge = { dir: direction() || [-Math.sin(player.yaw), -Math.cos(player.yaw)], time: 0 };
          lastDodge = now();
          player.motion = 'dodging';
        }
        shiftSince = null;
      }
    },
    resetInput,
    step,
  };
}
