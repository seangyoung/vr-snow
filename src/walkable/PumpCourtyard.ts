import * as THREE from "three";
import { inRectangle, crossesRectangle } from "./WalkableArea";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/** Local street coordinates: +X east, +Z south. Dimensions are reconstruction estimates. */
export const pumpPosition = new THREE.Vector3(-3.8, 0, 1.3);
export const streetSpawn = new THREE.Vector3(1.6, 0, -2);
const pumpClearance = 0.65;
const bounds = { minX: -13, maxX: 15, minZ: -7.85, maxZ: 13 };
// Expanded building/railing envelopes include a person's clearance from the facade.
const obstacles = [
  { minX: -60, maxX: 0.4, minZ: 2.6, maxZ: 60 },
  { minX: 8.0, maxX: 60, minZ: 2.6, maxZ: 60 },
];

export function isValidDestination(point: THREE.Vector3): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.z)
    && inRectangle(point, bounds) && !obstacles.some((r) => inRectangle(point, r))
    && Math.hypot(point.x - pumpPosition.x, point.z - pumpPosition.z) >= pumpClearance;
}

export function canWalkBetween(from: THREE.Vector3, to: THREE.Vector3): boolean {
  if (!isValidDestination(from) || !isValidDestination(to)) return false;
  if (obstacles.some((r) => crossesRectangle(from, to, r))) return false;
  const dx = to.x - from.x, dz = to.z - from.z;
  const lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared === 0 ? 0 : THREE.MathUtils.clamp(
    ((pumpPosition.x - from.x) * dx + (pumpPosition.z - from.z) * dz) / lengthSquared, 0, 1,
  );
  return Math.hypot(from.x + t * dx - pumpPosition.x, from.z + t * dz - pumpPosition.z) >= pumpClearance;
}

/** Historical reconstruction with lightweight selection proxies independent of art meshes. */
export class PumpCourtyard {
  readonly group = new THREE.Group();
  readonly floor: THREE.Mesh;
  readonly pump = new THREE.Group();
  readonly spawn = streetSpawn.clone();
  private readonly solids: THREE.Object3D[] = [];
  private readonly fallback = new THREE.Group();
  private visualsPromise?: Promise<void>;

  constructor() {
    this.group.name = "Broad Street reconstruction";
    const stone = new THREE.MeshStandardMaterial({ color: "#777b73", roughness: 1 });
    // This ray-only plane is at the shared locomotion datum. The visual road is 13 cm lower.
    const rayOnly = new THREE.MeshBasicMaterial({ visible: false });
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(116, 110), rayOnly);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.set(4, 0, 8);
    this.group.add(this.floor, this.fallback);
    const ground = new THREE.Mesh(this.floor.geometry, stone);
    ground.rotation.copy(this.floor.rotation);
    ground.position.set(4, -0.13, 8);
    this.fallback.add(ground);
    const brick = new THREE.MeshStandardMaterial({ color: "#756b57", roughness: 1 });
    // These coarse envelopes also prevent aiming through buildings during asset loading.
    for (const [x, z, w, d] of [[-26, 7, 52, 8], [33.2, 7, 49.6, 8], [-3, -13, 42, 8], [-42, -13, 24, 8], [-4, 32, 8, 42], [12.4, 32, 8, 42]]) {
      const geometry = new THREE.BoxGeometry(w, 10, d);
      const proxy = new THREE.Mesh(geometry, rayOnly);
      proxy.position.set(x, 5, z);
      this.solids.push(proxy);
      this.group.add(proxy);
      const visual = new THREE.Mesh(geometry, brick);
      visual.position.copy(proxy.position);
      this.fallback.add(visual);
    }
    this.buildPump();
    this.pump.position.copy(pumpPosition);
    this.group.add(this.pump);
    this.solids.push(this.pump);
    // Soft daylight; no shadow-map passes or transparent window layers in the street.
    this.group.add(new THREE.HemisphereLight("#e0e6e4", "#6c6656", 2.3));
    const daylight = new THREE.DirectionalLight("#fff2d7", 1.65);
    daylight.position.set(-15, 30, -12);
    this.group.add(daylight);
    this.group.visible = false;
  }

  /** Preload once during the desk scene. A failed request retains a usable fallback. */
  loadVisuals(basePath: string): Promise<void> {
    return this.visualsPromise ??= this.loadAssets(basePath);
  }

  private async loadAssets(basePath: string): Promise<void> {
    try {
      const gltf = await new GLTFLoader().loadAsync(`${basePath}models/broad-street.glb`);
      gltf.scene.name = "Authored street environment";
      gltf.scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = false;
          object.receiveShadow = false;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            if (material instanceof THREE.MeshStandardMaterial) {
              for (const texture of [material.map, material.normalMap]) if (texture) texture.anisotropy = 4;
            }
          }
        }
      });
      this.group.add(gltf.scene);
      this.fallback.visible = false;
      this.group.userData.environmentStatus = "ready";
    } catch (error) {
      this.group.userData.environmentStatus = "fallback";
      console.warn("Broad Street model could not load; using the basic street.", error);
    }
    try {
      const texture = await new THREE.TextureLoader().loadAsync(`${basePath}textures/broad-street/overcast.jpg`);
      texture.colorSpace = THREE.SRGBColorSpace;
      const sky = new THREE.Mesh(new THREE.SphereGeometry(85, 32, 16), new THREE.MeshBasicMaterial({
        map: texture, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false,
      }));
      sky.name = "Overcast sky";
      this.group.add(sky);
    } catch (error) {
      console.warn("Broad Street sky could not load; using the overcast background.", error);
    }
  }

  private buildPump(): void {
    const iron = new THREE.MeshStandardMaterial({ color: "#39433b", metalness: 0.35, roughness: 0.5 });
    const stone = new THREE.MeshStandardMaterial({ color: "#8b897a", roughness: 1 });
    // Profile follows the replica's narrow stem, shouldered barrel, rings, dome and finial.
    // The working handle is an inferred pre-removal detail, not present on the memorial.
    const profile = [[.19,0],[.19,.07],[.135,.1],[.12,.18],[.105,.88],[.145,.9],[.145,.96],
      [.11,1.0],[.145,1.04],[.165,1.1],[.165,1.63],[.185,1.66],[.185,1.72],[.16,1.73],
      [.16,1.91],[.205,1.93],[.205,1.99],[.17,2.02],[.12,2.09],[.07,2.12],[.05,2.16],
      [.07,2.18],[.065,2.23],[.03,2.26],[0,2.27]];
    const body = new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r,y]) => new THREE.Vector2(r,y)), 24), iron);
    this.pump.add(body);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(.58,.07,.62), stone);
    slab.position.y = -.005;
    this.pump.add(slab);
    const tube = (points: number[][], radius: number) => {
      const path = new THREE.CatmullRomCurve3(points.map(([x,y,z]) => new THREE.Vector3(x,y,z)));
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(path, 16, radius, 8, false), iron);
      this.pump.add(mesh);
      return mesh;
    };
    // Spout faces the street (north); handle clears the pavement on the east side.
    tube([[0,1.3,-.13],[0,1.31,-.27],[0,1.27,-.42],[0,1.16,-.45]],.052);
    const opening = new THREE.Mesh(new THREE.CircleGeometry(.039,12),new THREE.MeshBasicMaterial({color:"#070b09",side:THREE.DoubleSide}));
    opening.rotation.x = Math.PI/2; opening.position.set(0,1.155,-.45);this.pump.add(opening);
    tube([[.13,1.72,0],[.28,1.73,0],[.43,1.5,0],[.5,1.13,0],[.47,.87,0]],.032);
    tube([[.47,.87,0],[.47,.8,.13]],.043);
    // A soft opaque contact patch avoids an expensive dynamic shadow map.
    const contact = new THREE.Mesh(new THREE.CircleGeometry(.31,24),new THREE.MeshBasicMaterial({color:"#4e5147"}));
    contact.rotation.x=-Math.PI/2;contact.position.y=.002;this.pump.add(contact);
  }

  pick(raycaster: THREE.Raycaster): THREE.Intersection | undefined {
    if (!this.group.visible) return undefined;
    this.group.updateMatrixWorld(true);
    return raycaster.intersectObjects([this.floor, ...this.solids], true)[0];
  }

  isPump(object: THREE.Object3D): boolean {
    for (let node: THREE.Object3D | null = object; node; node = node.parent) if (node === this.pump) return true;
    return false;
  }

  readonly canWalkBetween = canWalkBetween;
  hotspotFor(object: THREE.Object3D): string | undefined {
    return this.isPump(object) ? "broad-street-pump" : undefined;
  }

  canTeleport(hit: THREE.Intersection): boolean {
    return hit.object === this.floor && isValidDestination(hit.point);
  }
}
