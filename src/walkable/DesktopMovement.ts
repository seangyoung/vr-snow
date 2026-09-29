import * as THREE from "three";
import { canWalkBetween } from "./PumpCourtyard";

const movementKeys = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
const walkingSpeed = 2; // metres per second
const turningSpeed = Math.PI / 2; // radians per second
export const desktopPitchLimit = 1.15;

export class DesktopMovement {
  private readonly held = new Set<string>();
  private readonly pendingLook = new Set<string>();

  press(code: string, repeat = false): boolean {
    code = this.normalizeKey(code);
    if (!movementKeys.has(code)) return false;
    // A held key must be released after a focus change or an overlay closes.
    if (!repeat) {
      this.held.add(code);
      if (code.startsWith("Arrow")) this.pendingLook.add(code);
    }
    return true;
  }

  release(code: string): void { this.held.delete(this.normalizeKey(code)); }
  clear(): void { this.held.clear(); this.pendingLook.clear(); }

  private normalizeKey(key: string): string {
    return key.length === 1 ? `Key${key.toUpperCase()}` : key;
  }

  update(position: THREE.Vector3, yaw: number, elapsedSeconds: number, canWalk: typeof canWalkBetween = canWalkBetween, pitch = 0): { position: THREE.Vector3; yaw: number; pitch: number } {
    // Discard time spent in a suspended tab rather than jumping on resume.
    const dt = Number.isFinite(elapsedSeconds) ? THREE.MathUtils.clamp(elapsedSeconds, 0, 0.05) : 0;
    // Brief look taps still receive one frame when keyup arrives before rendering.
    const down = (...keys: string[]) => Number(keys.some((key) => this.held.has(key) || this.pendingLook.has(key)));
    yaw += (down("ArrowLeft") - down("ArrowRight")) * turningSpeed * dt;
    pitch = THREE.MathUtils.clamp(pitch + (down("ArrowUp") - down("ArrowDown")) * turningSpeed * dt, -desktopPitchLimit, desktopPitchLimit);
    this.pendingLook.clear();
    const forward = down("KeyW") - down("KeyS");
    const right = down("KeyD") - down("KeyA");
    const scale = walkingSpeed * dt / Math.max(1, Math.hypot(forward, right));
    const dx = (-Math.sin(yaw) * forward + Math.cos(yaw) * right) * scale;
    const dz = (-Math.cos(yaw) * forward - Math.sin(yaw) * right) * scale;
    const next = position.clone().add(new THREE.Vector3(dx, 0, dz));
    if (canWalk(position, next)) return { position: next, yaw, pitch };

    // Slide along obstacles when one component of diagonal movement is blocked.
    next.copy(position);
    const candidate = position.clone();
    candidate.x += dx;
    if (canWalk(next, candidate)) next.copy(candidate);
    candidate.copy(next);
    candidate.z += dz;
    if (canWalk(next, candidate)) next.copy(candidate);
    return { position: next, yaw, pitch };
  }
}
