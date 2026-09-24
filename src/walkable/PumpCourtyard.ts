import * as THREE from "three";

const bounds = { minX: -4, maxX: 4, minZ: -8, maxZ: 2 };
const clearance = 0.4;
export const pumpPosition = new THREE.Vector3(1.45, 0, -5.4);

export function isValidDestination(point: THREE.Vector3): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.z)
    && point.x >= bounds.minX + clearance && point.x <= bounds.maxX - clearance
    && point.z >= bounds.minZ + clearance && point.z <= bounds.maxZ - clearance
    && Math.hypot(point.x - pumpPosition.x, point.z - pumpPosition.z) >= 1.05;
}

/** Check the whole walking segment so a frame cannot cross the pump. */
export function canWalkBetween(from: THREE.Vector3, to: THREE.Vector3): boolean {
  if (!isValidDestination(from) || !isValidDestination(to)) return false;
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared === 0 ? 0 : THREE.MathUtils.clamp(
    ((pumpPosition.x - from.x) * dx + (pumpPosition.z - from.z) * dz) / lengthSquared, 0, 1,
  );
  return Math.hypot(from.x + t * dx - pumpPosition.x, from.z + t * dz - pumpPosition.z) >= 1.05;
}

/** A schematic street fragment, not an archaeological reconstruction. */
export class PumpCourtyard {
  readonly group = new THREE.Group();
  readonly floor: THREE.Mesh;
  readonly pump = new THREE.Group();
  readonly spawn = new THREE.Vector3(0, 0, 0);
  private readonly solids: THREE.Object3D[] = [];

  constructor() {
    const stone = new THREE.MeshStandardMaterial({ color: "#777b79", roughness: 1 });
    const brick = new THREE.MeshStandardMaterial({ color: "#64534a", roughness: 1 });
    const iron = new THREE.MeshStandardMaterial({ color: "#244c4a", metalness: 0.55, roughness: 0.42 });
    const trim = new THREE.MeshStandardMaterial({ color: "#a39b87", roughness: 0.9 });
    const dark = new THREE.MeshStandardMaterial({ color: "#232c30", roughness: 0.7 });
    const box = (size: number[], position: number[], material: THREE.Material, parent = this.group) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size as [number, number, number]), material);
      mesh.position.set(...position as [number, number, number]);
      parent.add(mesh);
      return mesh;
    };
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 10), stone);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.z = -3;
    this.group.add(this.floor);
    const grid = new THREE.GridHelper(10, 20, "#535957", "#656b68");
    grid.scale.x = 0.8;
    grid.position.set(0, 0.006, -3);
    this.group.add(grid);

    // Facades and end barriers bound the entire teleport area.
    for (const x of [-4.3, 4.3]) {
      this.solids.push(box([0.6, 5.5, 10.6], [x, 2.75, -3], brick));
      box([0.12, 0.18, 10], [Math.sign(x) * 3.95, 0.09, -3], trim);
      for (const z of [-6.5, -3, 0.5]) {
        for (const y of [1.7, 3.8]) {
          box([0.04, 1.2, 0.9], [Math.sign(x) * 3.98, y, z], dark);
          box([0.15, 0.08, 1.1], [Math.sign(x) * 3.9, y - 0.6, z], trim);
        }
      }
    }
    for (const z of [-8.2, 2.2]) {
      this.solids.push(box([8, 0.8, 0.4], [0, 0.4, z], brick));
    }

    this.pump.position.copy(pumpPosition);
    this.group.add(this.pump);
    box([1.2, 0.14, 1.2], [0, 0.07, 0], trim, this.pump);
    const cylinder = (top: number, bottom: number, height: number, y: number) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, 12), iron);
      mesh.position.y = y;
      this.pump.add(mesh);
    };
    cylinder(0.21, 0.3, 0.35, 0.31);
    cylinder(0.16, 0.2, 1.3, 1.08);
    cylinder(0.26, 0.2, 0.15, 1.8);
    cylinder(0.03, 0.26, 0.25, 2);
    box([0.15, 0.15, 0.55], [0, 1.25, 0.32], iron, this.pump);
    box([0.15, 0.22, 0.12], [0, 1.15, 0.55], iron, this.pump);
    const handle = box([0.08, 0.85, 0.08], [0.38, 1.36, 0], iron, this.pump);
    handle.rotation.z = -0.3;
    box([0.38, 0.08, 0.08], [0.18, 1.68, 0], iron, this.pump);
    this.solids.push(this.pump);
    this.group.visible = false;
  }

  pick(raycaster: THREE.Raycaster): THREE.Intersection | undefined {
    if (!this.group.visible) return undefined;
    this.group.updateMatrixWorld(true);
    return raycaster.intersectObjects([this.floor, ...this.solids], true)[0];
  }

  isPump(object: THREE.Object3D): boolean {
    for (let node: THREE.Object3D | null = object; node; node = node.parent) {
      if (node === this.pump) return true;
    }
    return false;
  }

  canTeleport(hit: THREE.Intersection): boolean {
    return hit.object === this.floor && isValidDestination(hit.point);
  }
}
