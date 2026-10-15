import { FurnishedRoom,roomArea } from './FurnishedRoom';
import routines from './household-routines-layout.json' with {type:'json'};
import away from './household-away-layout.json' with {type:'json'};
export class AdditionalHousehold extends FurnishedRoom {
 constructor(key:'household-routines'|'household-away') {
  const layout=key==='household-routines'?routines:away;
  super({name:key==='household-routines'?'Household: Water Routines':'Household: A Daily Journey',asset:`${key}-room.glb`,layout,area:roomArea(layout),characters:key,
   hotspot:key==='household-routines'?'routines-household':'away-household',interactionFurniture:'interview-chair',
   bakedLighting:{lightMap:`${key}-room-lightmap.png`,environment:`${key}-room-environment.png`}});
 }
}
