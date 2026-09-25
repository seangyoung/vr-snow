import * as THREE from "three";
import layout from "./registrar-layout.json" with { type: "json" };
import { FurnishedRoom, roomArea } from "./FurnishedRoom";

export const registrarArea = roomArea(layout);
export const registrarSpawn = new THREE.Vector3(...layout.spawn);
export const registrarLedgerTarget = new THREE.Vector3(...layout.deskTarget);

export class RegistrarRoom extends FurnishedRoom {
  constructor() {
    super({name: "Registrar's records room", asset: "registrar-room.glb", layout, area: registrarArea,
      interactionFurniture: "ledger-table", hotspot: "registrar-ledger", daylight: "#e6eef0", fill: 4});
  }
}
