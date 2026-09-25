import * as THREE from "three";
import layout from "./household-layout.json" with { type: "json" };
import { FurnishedRoom, roomArea } from "./FurnishedRoom";

export const householdArea = roomArea(layout);
export const householdSpawn = new THREE.Vector3(...layout.spawn);
export const householdInterviewTarget = new THREE.Vector3(...layout.deskTarget);

/** An illustrative household, not a reconstruction of an identified family's room. */
export class HouseholdRoom extends FurnishedRoom {
  constructor() {
    super({name: "Broad Street household", asset: "household-room.glb", layout, area: householdArea,
      interactionFurniture: "interview-chair", hotspot: "broad-street-household", daylight: "#ede4d1", fill: 3});
  }
}
