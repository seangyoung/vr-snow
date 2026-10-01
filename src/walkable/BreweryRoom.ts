import * as THREE from "three";
import layout from "./brewery-layout.json" with { type: "json" };
import { FurnishedRoom, roomArea } from "./FurnishedRoom";

export const breweryArea = roomArea(layout);
export const brewerySpawn = new THREE.Vector3(...layout.spawn);
export const breweryOwnersTarget = new THREE.Vector3(...layout.deskTarget);

/** Interpretive brewhouse, following the panorama rather than a surveyed historic plan. */
export class BreweryRoom extends FurnishedRoom {
  constructor() {
    super({name: "Lion Brewery brewhouse", asset: "brewery-room.glb", layout, area: breweryArea,
      bakedLighting: {lightMap: "brewery-room-lightmap.png", environment: "brewery-room-environment.png"},
      interactionFurniture: "owners-table", hotspot: "broad-street-brewery", daylight: "#e7e6d9", fill: 5});
  }
}
