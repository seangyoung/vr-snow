import * as THREE from "three";
import layout from "./office-layout.json" with { type: "json" };
import { FurnishedRoom, roomArea } from "./FurnishedRoom";

export const officeArea = roomArea(layout);
export const officeSpawn = new THREE.Vector3(...layout.spawn);
export const officeDeskTarget = new THREE.Vector3(...layout.deskTarget);

export class SnowOffice extends FurnishedRoom {
  constructor() {
    super({name: "Snow's walkable office", asset: "snow-office.glb", layout, area: officeArea,
      interactionFurniture: "desk", hotspot: "john-snow", daylight: "#f4eee2", fill: 2.5,
      bakedLighting: {lightMap: "snow-office-lightmap.png", environment: "snow-office-environment.png"}});
  }
}
