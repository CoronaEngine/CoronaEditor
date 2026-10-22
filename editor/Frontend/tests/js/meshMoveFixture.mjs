import { createPlayerController } from '../../../game/frontend/playerController.mjs';

// A flat-ground native host for input/camera wiring tests, not a collision solver.
// Movement changes the controller only through its authoritative native reply.
export function createMeshMoveHost({ readActor, onResult, onRequest = () => {}, autoReply = true }) {
  const pending = [];
  function flush() {
    for (const result of pending.splice(0)) onResult(result);
  }
  return {
    pending,
    flush,
    moveActorMesh(actorHandle, cameraHandle, requestId, velocity, delta, jump, facing) {
      onRequest(actorHandle, cameraHandle, requestId, velocity, delta, jump, facing);
      const actor = readActor(actorHandle);
      const pose = actor.geometry ?? actor;
      const position = pose.position.map((value, i) => value + velocity[i] * delta);
      const rotation = [...pose.rotation];
      if (facing !== null) rotation[1] = facing;
      if (jump) position[1] += 0.2;
      pending.push({ status: 'success', requestId, actorHandle, position, rotation, grounded: !jump });
      if (autoReply) flush();
      return true;
    },
  };
}

export function createPlayerControllerWithHost(options) {
  let controller;
  const host = createMeshMoveHost({
    readActor: () => controller.snapshotPlayer(),
    onResult: result => controller.acceptMeshMove(result),
  });
  controller = createPlayerController({ ...options,
    getBridge: () => ({ ...options.getBridge(), moveActorMesh: host.moveActorMesh }),
  });
  return controller;
}
