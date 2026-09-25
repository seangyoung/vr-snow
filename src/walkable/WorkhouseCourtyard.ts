import * as THREE from "three";
import layout from "./workhouse-layout.json" with { type: "json" };
import { FurnishedRoom, roomArea } from "./FurnishedRoom";

export const workhouseArea = roomArea(layout);
export const workhouseSpawn = new THREE.Vector3(...layout.spawn);
export const workhouseStewardTarget = new THREE.Vector3(...layout.deskTarget);

/** A bounded, interpretive courtyard using the shared room navigation and ray proxies. */
export class WorkhouseCourtyard extends FurnishedRoom {
  private courtyardVisuals?: Promise<void>;
  constructor() {
    super({name: "St. James Workhouse courtyard", asset: "workhouse-courtyard.glb", layout, area: workhouseArea,
      interactionFurniture: "steward-table", hotspot: "poland-workhouse", daylight: "#e1e9e7", fill: 0});
  }
  override loadVisuals(basePath: string): Promise<void> {
    return this.courtyardVisuals ??= Promise.all([super.loadVisuals(basePath), this.loadSky(basePath)]).then(() => {});
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
