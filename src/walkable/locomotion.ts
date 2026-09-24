import * as THREE from "three";

/** Move the viewer's feet to a destination, preserving tracked height and yaw. */
export function teleportViewer(rig: THREE.Group, camera: THREE.Camera, destination: THREE.Vector3): void {
  const viewer = camera.getWorldPosition(new THREE.Vector3());
  rig.position.x += destination.x - viewer.x;
  rig.position.z += destination.z - viewer.z;
  rig.updateMatrixWorld(true);
}

/** Rotate about the tracked viewer, not the room's reference-space origin. */
export function turnViewer(rig: THREE.Group, camera: THREE.Camera, angle: number): void {
  const before = camera.getWorldPosition(new THREE.Vector3());
  rig.rotation.y += angle;
  rig.updateMatrixWorld(true);
  const after = camera.getWorldPosition(new THREE.Vector3());
  rig.position.x += before.x - after.x;
  rig.position.z += before.z - after.z;
  rig.updateMatrixWorld(true);
}

/** Never guess a vendor's axis order when the standard mapping is absent. */
export function standardTurnAxis(source?: Pick<XRInputSource, "gamepad">): number {
  const pad = source?.gamepad;
  if (pad?.mapping !== "xr-standard") return 0;
  const stick = pad.axes[2] ?? 0;
  const touchpad = pad.axes[0] ?? 0;
  const value = Math.abs(stick) >= Math.abs(touchpad) ? stick : touchpad;
  return Number.isFinite(value) ? value : 0;
}
