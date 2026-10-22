import { FurnishedRoom, roomArea } from './FurnishedRoom';
import layout from './manufactory-layout.json' with {type:'json'};
export const manufactoryArea=roomArea(layout);
/** A compact interpretive workshop at the documented address, not a surveyed interior. */
export class ManufactoryRoom extends FurnishedRoom {
 constructor(){
  super({name:'37 Broad Street workshop',asset:'manufactory-room.glb',layout,area:manufactoryArea,
   characters:'manufactory',hotspot:'manufactory-worker',daylight:'#e1e7e0',fill:3,
   bakedLighting:{lightMap:'manufactory-room-lightmap.png',environment:'manufactory-room-environment.png'}});
  this.characters!.labelPosition.set(-.9,1.96,-.4);
 }
}
