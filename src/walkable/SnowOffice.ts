import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import layout from "./office-layout.json" with { type: "json" };
import { WalkableArea, type WalkableEnvironment } from "./WalkableArea";

const clearance = 0.25;
export const officeArea = new WalkableArea(
  { minX: -layout.width/2+clearance, maxX: layout.width/2-clearance,
    minZ: -layout.depth/2+clearance, maxZ: layout.depth/2-clearance },
  layout.furniture.map(f => ({ minX: f.x-f.width/2-clearance, maxX: f.x+f.width/2+clearance,
    minZ: f.z-f.depth/2-clearance, maxZ: f.z+f.depth/2+clearance })),
);
export const officeSpawn = new THREE.Vector3(...layout.spawn);
export const officeDeskTarget = new THREE.Vector3(...layout.deskTarget);

/** Art, collision and fallback furniture share the same measured-in-metres layout. */
export class SnowOffice implements WalkableEnvironment {
  readonly group = new THREE.Group();
  readonly spawn = officeSpawn.clone();
  readonly floor: THREE.Mesh;
  readonly canWalkBetween = officeArea.canWalkBetween;
  private readonly solids: THREE.Object3D[] = [];
  private readonly fallback = new THREE.Group();
  private readonly desk: THREE.Mesh;
  private readonly deskPrompt: THREE.Mesh;
  private visualsPromise?: Promise<void>;

  constructor() {
    this.group.name = "Snow's walkable office";
    const rayOnly = new THREE.MeshBasicMaterial({ visible: false });
    const timber = new THREE.MeshStandardMaterial({ color: "#69513a", roughness: 0.9 });
    const plaster = new THREE.MeshStandardMaterial({ color: "#ada187", roughness: 1 });
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(layout.width, layout.depth), rayOnly);
    this.floor.rotation.x = -Math.PI/2;
    this.group.add(this.floor, this.fallback);
    const floorArt = new THREE.Mesh(this.floor.geometry, timber);
    floorArt.rotation.copy(this.floor.rotation);floorArt.position.y = -0.005;
    this.fallback.add(floorArt);
    const box = (x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material) => {
      const proxy = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),rayOnly);
      proxy.position.set(x,y,z);this.group.add(proxy);this.solids.push(proxy);
      const visible = new THREE.Mesh(proxy.geometry,mat);visible.position.copy(proxy.position);
      this.fallback.add(visible);return proxy;
    };
    box(-layout.width/2,layout.height/2,0,.1,layout.height,layout.depth,plaster);
    box(layout.width/2,layout.height/2,0,.1,layout.height,layout.depth,plaster);
    box(0,layout.height/2,-layout.depth/2,layout.width,layout.height,.1,plaster);
    box(0,layout.height/2,layout.depth/2,layout.width,layout.height,.1,plaster);
    let desk!: THREE.Mesh;
    for (const f of layout.furniture) {
      const proxy=box(f.x,f.height/2,f.z,f.width,f.height,f.depth,timber);
      if (f.id === "desk") desk=proxy;
    }
    this.desk=desk;
    this.deskPrompt = new THREE.Mesh(new THREE.SphereGeometry(.32,12,8),rayOnly);
    this.deskPrompt.position.copy(officeDeskTarget).add(new THREE.Vector3(0,.35,0));
    this.group.add(this.deskPrompt);this.solids.push(this.deskPrompt);
    this.group.add(new THREE.HemisphereLight("#f7ecd9", "#76654f", 1.8));
    const daylight=new THREE.DirectionalLight("#fff0d4",2.1);
    daylight.position.set(2.7,2.5,-.5);this.group.add(daylight);
    const fill=new THREE.PointLight("#ffcf91",9,6,2);
    fill.position.set(-2.1,1.1,-.1);this.group.add(fill);
    this.group.visible=false;
  }
  loadVisuals(basePath: string): Promise<void> {
    return this.visualsPromise ??= this.loadAssets(basePath);
  }
  private async loadAssets(basePath: string): Promise<void> {
    try {
      const gltf=await new GLTFLoader().loadAsync(`${basePath}models/snow-office.glb`);
      gltf.scene.traverse(object => {
        if (object instanceof THREE.Mesh) { object.castShadow=false;object.receiveShadow=false; }
      });
      this.group.add(gltf.scene);this.fallback.visible=false;
      this.group.userData.environmentStatus="ready";
    } catch (error) {
      this.group.userData.environmentStatus="fallback";
      console.warn("Office model could not load; using the furnished fallback.",error);
    }
  }
  pick(raycaster: THREE.Raycaster): THREE.Intersection | undefined {
    if (!this.group.visible) return undefined;
    this.group.updateMatrixWorld(true);
    return raycaster.intersectObjects([this.floor,...this.solids],false)[0];
  }
  hotspotFor(object: THREE.Object3D): string | undefined {
    return (object === this.desk || object === this.deskPrompt) ? "john-snow" : undefined;
  }
  canTeleport(hit: THREE.Intersection): boolean {
    return hit.object === this.floor && officeArea.isValidDestination(hit.point);
  }
}
