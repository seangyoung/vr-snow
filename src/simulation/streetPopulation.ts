import type { InquiryDay } from './campaign';

export interface StreetPlacement { position: [number, number, number]; yaw: number }
const placements: Record<InquiryDay, Record<string, StreetPlacement>> = {
  1: { 'resident-west': {position:[-9.6,-.135,-7],yaw:.45}, 'resident-east': {position:[11,-.135,-7],yaw:-.5}, whitehead:{position:[-6.5,-.135,-5.6],yaw:.25} },
  2: { 'resident-west': {position:[-8,-.135,-5.8],yaw:-.5}, 'resident-east': {position:[6.8,-.135,6.5],yaw:-1.1}, whitehead:{position:[-2,-.135,-6.3],yaw:.15} },
  3: { 'resident-west': {position:[-11,-.135,-4.8],yaw:.7}, 'resident-east': {position:[10,-.135,-5.6],yaw:-.7}, whitehead:{position:[5.8,-.135,4.8],yaw:-.8} },
};
export function streetPlacement(day: InquiryDay, actorId: string): StreetPlacement | undefined { return placements[day][actorId]; }
// Quiet groups on the pavements, clear of pump, survey origins and exit rings.
// Shared geometry/textures keep additional residents inexpensive on standalone VR.
export const streetExtras = [
  {source:'resident-west', tint:'#acb7a2', scale:.94, days:[[-.4,-6.7,.3],[10,-6.7,-.5],[-7,-6.5,.5]]},
  {source:'resident-east', tint:'#c7a99b', scale:1.03, days:[[.8,-6.5,-.55],[8.7,-6.4,.3],[-5.7,-6.3,-.4]]},
  {source:'resident-west', tint:'#9baabb', scale:1.06, days:[[6.6,8.8,-1.1],[-10.8,-4.9,.1],[1.5,8.6,1.3]]},
  {source:'resident-east', tint:'#b4aa8d', scale:.97, days:[[-12,-3.6,.8],[1.5,8.8,1.2],[6.6,12.3,-1.4]]},
] as const;
