import { WorkhousePump } from "./WorkhousePump";
import * as THREE from "three";
import layout from "./workhouse-layout.json" with { type: "json" };
import { FurnishedRoom, roomArea } from "./FurnishedRoom";

export const workhouseArea = roomArea(layout);
export const workhouseSpawn = new THREE.Vector3(...layout.spawn);
export const workhouseStewardTarget = new THREE.Vector3(...layout.deskTarget);

/** A bounded, interpretive courtyard using the shared room navigation and ray proxies. */
export class WorkhouseCourtyard extends FurnishedRoom {
  readonly pump = new WorkhousePump();
  get pumpAction() { return this.pump.action; }
  private courtyardVisuals?: Promise<void>;
  constructor() {
    super({characters: "workhouse", name: "St. James Workhouse courtyard", asset: "workhouse-courtyard.glb", layout, area: workhouseArea,
      bakedLighting: {lightMap: "workhouse-courtyard-lightmap.png", environment: "workhouse-courtyard-environment.png"},
      rayHeights:{"water-supply":.43}, hotspot: "poland-workhouse", daylight: "#e1e9e7", fill: 0});
    this.group.add(this.pump.group);
  }
  protected override prepareVisuals(model: THREE.Group): void { this.pump.replaceStaticPump(model); }
  override pick(ray: THREE.Raycaster): THREE.Intersection | undefined {
    if(!this.group.visible)return undefined;
    const solid=super.pick(ray);
    const pump=ray.intersectObject(this.pump.group,true)[0];
    return pump && (!solid || pump.distance<solid.distance) ? pump : solid;
  }
  override hotspotFor(object: THREE.Object3D): string | undefined {
    if(this.pump.owns(object))return this.pumpAction.owns(object)?undefined:'workhouse-pump';
    return super.hotspotFor(object);
  }
  override loadVisuals(basePath: string): Promise<void> {
    return this.courtyardVisuals ??= Promise.all([super.loadVisuals(basePath), this.loadSky(basePath), this.pump.loadVisuals(basePath)]).then(() => {});
  }
  private async loadSky(basePath: string): Promise<void> {
    try {
      const texture = await new THREE.TextureLoader().loadAsync(`${basePath}textures/broad-street/overcast.jpg`);
      texture.colorSpace = THREE.SRGBColorSpace;
      const sky = new THREE.Mesh(new THREE.SphereGeometry(70, 24, 12), new THREE.MeshBasicMaterial({
        map: texture, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false,
      }));
      sky.name = "Workhouse overcast sky";
      this.group.add(sky);
    } catch (error) {
      console.warn("Workhouse sky could not load; using the overcast background.", error);
    }
  }
}
