import { SnowCharacter } from "./SnowCharacter";
import * as THREE from "three";
import layout from "./office-layout.json" with { type: "json" };
import { FurnishedRoom, roomArea } from "./FurnishedRoom";

export const officeArea = roomArea(layout);
export const officeSpawn = new THREE.Vector3(...layout.spawn);
export const officeDeskTarget = new THREE.Vector3(...layout.deskTarget);

export class SnowOffice extends FurnishedRoom {
  readonly character = new SnowCharacter();
  private characterVisuals?: Promise<void>;
  constructor() {
    super({name: "Snow's walkable office", asset: "snow-office.glb", layout, area: officeArea,
      interactionFurniture: "desk", hotspot: "john-snow", daylight: "#f4eee2", fill: 2.5,
      bakedLighting: {lightMap: "snow-office-lightmap.png", environment: "snow-office-environment.png"}});
    this.group.add(this.character.group);
  }
  override loadVisuals(basePath: string): Promise<void> {
    return this.characterVisuals ??= Promise.all([super.loadVisuals(basePath),this.character.loadVisuals(basePath)]).then(()=>{});
  }
  override pick(raycaster: THREE.Raycaster): THREE.Intersection | undefined {
    this.deskPrompt.layers.mask=this.character.group.userData.characterStatus==="ready"?0:1;
    const furniture=super.pick(raycaster);
    if(!this.group.visible || this.character.group.userData.characterStatus!=="ready")return furniture;
    this.group.updateMatrixWorld(true);
    const person=raycaster.intersectObject(this.character.target,false)[0];
    return person && (!furniture || person.distance<furniture.distance)?person:furniture;
  }
  override hotspotFor(object: THREE.Object3D): string | undefined {
    return object===this.character.target?"john-snow":super.hotspotFor(object);
  }
}
