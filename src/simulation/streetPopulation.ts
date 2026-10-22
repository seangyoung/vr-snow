import type { InquiryDay } from './campaign';

export interface StreetPlacement { position: [number, number, number]; yaw: number }
const placements: Record<InquiryDay, Record<string, StreetPlacement>> = {
  1: { 'resident-west': {position:[-9.6,-.135,-7],yaw:.45}, 'resident-east': {position:[11,-.135,-7],yaw:-.5}, whitehead:{position:[-6.5,-.135,-5.6],yaw:.25} },
  2: { 'resident-west': {position:[-8,-.135,-5.8],yaw:-.5}, 'resident-east': {position:[6.8,-.135,6.5],yaw:-1.1}, whitehead:{position:[-2,-.135,-6.3],yaw:.15} },
  3: { 'resident-west': {position:[-11,-.135,-4.8],yaw:.7}, 'resident-east': {position:[10,-.135,-5.6],yaw:-.7}, whitehead:{position:[5.8,-.135,4.8],yaw:-.8} },
};
// Every visible resident has an authored appearance and an individual conversation.
export const streetExtras = [
  {id:'seamstress', label:'Seamstress', days:[[-.4,-6.7,.3],[10,-6.7,-.5],[-7,-6.5,.5]]},
  {id:'laundress', label:'Laundress', days:[[.8,-6.5,-.55],[8.7,-6.4,.3],[-5.7,-6.3,-.4]]},
  {id:'porter', label:'Porter', days:[[6.6,8.8,-1.1],[-10.8,-4.9,.1],[1.5,8.6,1.3]]},
  {id:'messenger', label:'Messenger', days:[[-12,-3.6,.8],[1.5,8.8,1.2],[6.6,12.3,-1.4]]},
] as const;
export const streetActorIds = ['resident-west','resident-east','whitehead',...streetExtras.map(p=>p.id)];
export function streetPlacement(day: InquiryDay, actorId: string): StreetPlacement | undefined {
  const extra=streetExtras.find(p=>p.id===actorId);
  if(extra){const [x,z,yaw]=extra.days[day-1];return {position:[x,-.135,z],yaw};}
  return placements[day][actorId];
}
