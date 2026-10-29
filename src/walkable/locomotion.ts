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

/** Only a tracked right-hand standard thumbstick opts into release-to-teleport. */
export function hasTeleportStick(source?: XRInputSource): boolean {
  return !!source && !source.hand && source.handedness === "right" && source.targetRayMode === "tracked-pointer"
    && source.gamepad?.mapping === "xr-standard" && source.gamepad.axes.length >= 4;
}

/** Neutral must be observed after cancellation, connection or losing focus. */
export class StickTeleport {
  active = false;
  private ready = false;
  cancel(): void { this.active = false; this.ready = false; }
  update(x: number, y: number, enabled: boolean): "idle" | "aim" | "release" {
    if (!enabled || !Number.isFinite(x) || !Number.isFinite(y)) { this.cancel(); return "idle"; }
    const neutral = Math.max(Math.abs(x),Math.abs(y)) < .22;
    if (this.active) {
      if (neutral) { this.active = false; this.ready = true; return "release"; }
      // Pulling back or sideways cancels; it must never fall through to a turn.
      if (y >= -.22 || Math.abs(x) > .55) { this.cancel(); return "idle"; }
      return "aim";
    }
    if (neutral) this.ready = true;
    else if (this.ready) {
      this.ready = false;
      if (y < -.72 && Math.abs(x) < .35) { this.active = true; return "aim"; }
      // Small forward motion may grow into a deliberate push; sideways input may not.
      if (y < 0 && Math.abs(x) < .35) this.ready = true;
    }
    return "idle";
  }
}
