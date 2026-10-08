import * as THREE from "three";
import layout from "./registrar-layout.json" with { type: "json" };
import { FurnishedRoom, roomArea } from "./FurnishedRoom";

export const registrarArea = roomArea(layout);
export const registrarSpawn = new THREE.Vector3(...layout.spawn);
export const registrarLedgerTarget = new THREE.Vector3(...layout.deskTarget);

export class RegistrarRoom extends FurnishedRoom {
  constructor() {
    super({characters: "registrar", name: "Registrar's records room", asset: "registrar-room.glb", layout, area: registrarArea,
      bakedLighting: {lightMap: "registrar-room-lightmap.png", environment: "registrar-room-environment.png"},
      interactionFurniture: "ledger-table", hotspot: "registrar-ledger", daylight: "#edf3ff", fill: 0});
  }
}
