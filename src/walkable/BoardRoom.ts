import layout from "./board-layout.json" with { type: "json" };
import { FurnishedRoom, roomArea } from "./FurnishedRoom";
export const boardArea = roomArea(layout);
/** The Board room and unnamed officials are an interpretation, not a surveyed reconstruction. */
export class BoardRoom extends FurnishedRoom {
  constructor() {
    super({ name: "Parish Board room", asset: "board-room.glb", layout, area: boardArea,
      characters: "board", hotspot: "board-hearing", interactionFurniture: "meeting-table",
      bakedLighting: { lightMap: "board-room-lightmap.png", environment: "board-room-environment.png" } });
  }
}
