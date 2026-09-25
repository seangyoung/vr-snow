import * as THREE from "three";
import type { Hotspot } from "../simulation/types";

export interface Rectangle { minX: number; maxX: number; minZ: number; maxZ: number; }
export function inRectangle(p: THREE.Vector3, r: Rectangle): boolean {
  return p.x >= r.minX && p.x <= r.maxX && p.z >= r.minZ && p.z <= r.maxZ;
}
/** Segment/slab intersection also rejects corner cutting between valid endpoints. */
export function crossesRectangle(from: THREE.Vector3, to: THREE.Vector3, r: Rectangle): boolean {
  let enter = 0, exit = 1;
  for (const [axis, min, max] of [["x", r.minX, r.maxX], ["z", r.minZ, r.maxZ]] as const) {
    const delta = to[axis] - from[axis];
    if (Math.abs(delta) < 1e-10) {
      if (from[axis] < min || from[axis] > max) return false;
    } else {
      const a = (min - from[axis]) / delta, b = (max - from[axis]) / delta;
      enter = Math.max(enter, Math.min(a, b));
      exit = Math.min(exit, Math.max(a, b));
      if (enter > exit) return false;
    }
  }
  return true;
}
export class WalkableArea {
  constructor(readonly bounds: Rectangle, readonly obstacles: Rectangle[]) {}
  isValidDestination(point: THREE.Vector3): boolean {
    return Number.isFinite(point.x) && Number.isFinite(point.z)
      && inRectangle(point, this.bounds) && !this.obstacles.some(r => inRectangle(point, r));
  }
  canWalkBetween = (from: THREE.Vector3, to: THREE.Vector3): boolean =>
    this.isValidDestination(from) && this.isValidDestination(to)
    && !this.obstacles.some(r => crossesRectangle(from, to, r));
}
export interface WalkableEnvironment {
  group: THREE.Group;
  floor: THREE.Mesh;
  spawn: THREE.Vector3;
  pick(raycaster: THREE.Raycaster): THREE.Intersection | undefined;
  canTeleport(hit: THREE.Intersection): boolean;
  canWalkBetween(from: THREE.Vector3, to: THREE.Vector3): boolean;
  hotspotFor(object: THREE.Object3D): Hotspot["id"] | undefined;
}
