import data from './route-data.json' with {type:'json'};
import type {LocationId} from './types';
export type RouteId='marlborough-broad'|'marlborough-alternative'|'rupert-broad'|'rupert-alternative';
export type RoutePair='marlborough'|'rupert';
export const routeData=data;
export type MapPoint = {x:number;y:number;label:string};
function segmentMetres(a:number[],b:number[]):number {
 const dx=b[0]-a[0],dy=b[1]-a[1];
 return Math.hypot(data.affine.easting[0]*dx+data.affine.easting[1]*dy,data.affine.northing[0]*dx+data.affine.northing[1]*dy);
}
export const pumpJourneys=data.journeys.map(route=>{
 const lengths=route.polyline.slice(1).map((p,i)=>segmentMetres(route.polyline[i],p));
 const rawMetres=lengths.reduce((a,b)=>a+b,0),metres=Math.round(rawMetres/5)*5;
 return {...route,id:route.id as RoutePair,lengths,rawMetres,metres,seconds:Math.round(metres/data.walkingMetresPerSecond)};
});
/** Interpolate along the measured street path, not the chord between pumps. */
export function routePoint(id:RoutePair,fraction:number):number[] {
 const route=pumpJourneys.find(r=>r.id===id)!;
 let remaining=route.rawMetres*Math.max(0,Math.min(1,fraction));
 for(let i=0;i<route.lengths.length;i++) {
  if(remaining<=route.lengths[i]) {
   const t=remaining/route.lengths[i],a=route.polyline[i],b=route.polyline[i+1];
   return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  }
  remaining-=route.lengths[i];
 }
 return [...route.polyline.at(-1)!];
}
/** Closest point on the street polyline, measured in calibrated map metres. */
export function nearestRouteFraction(id:RoutePair,x:number,y:number):number {
 const route=pumpJourneys.find(r=>r.id===id)!;
 const project=(dx:number,dy:number)=>[data.affine.easting[0]*dx+data.affine.easting[1]*dy,data.affine.northing[0]*dx+data.affine.northing[1]*dy];
 let best=Infinity,fraction=0,travelled=0;
 route.lengths.forEach((length,i)=>{
  const a=route.polyline[i],b=route.polyline[i+1],v=project(b[0]-a[0],b[1]-a[1]),w=project(x-a[0],y-a[1]);
  const t=Math.max(0,Math.min(1,(v[0]*w[0]+v[1]*w[1])/(length*length)));
  const distance=(w[0]-t*v[0])**2+(w[1]-t*v[1])**2;
  if(distance<best){best=distance;fraction=(travelled+t*length)/route.rawMetres;}
  travelled+=length;
 });
 return fraction;
}
// Stable identifiers preserve notebook/save compatibility; each pair now records
// the equal-distance halves of a single journey starting at Broad Street.
export const surveyRoutes=pumpJourneys.flatMap(route=>{
 const midpoint=routePoint(route.id,.5),half=route.rawMetres/2;
 let travelled=0,split=0;while(split<route.lengths.length && travelled+route.lengths[split]<half)travelled+=route.lengths[split++];
 return [
  {id:`${route.id}-broad` as RouteId,pair:route.id,title:'Broad Street to halfway',origin:'broad-street-pump',destination:'broad-street' as LocationId,polyline:[...route.polyline.slice(0,split+1),midpoint]},
  {id:`${route.id}-alternative` as RouteId,pair:route.id,title:`Halfway to ${route.id==='rupert'?'Rupert Street':'Marlborough Street'}`,origin:'halfway',destination:route.destination as LocationId,polyline:[midpoint,...route.polyline.slice(split+1)]},
 ].map(leg=>({...leg,metres:route.metres/2,seconds:Math.round(route.seconds/2)}));
});
export interface RouteObservation {routeId:RouteId;metres:number;seconds:number}
export interface FieldworkView {guided:GuidedSurveyView;title:string;text:string}
export function observation(id:RouteId): RouteObservation {const route=surveyRoutes.find(r=>r.id===id)!;return {routeId:id,metres:route.metres,seconds:route.seconds};}
export type SurveyPhase = 'origin' | 'compare' | 'feedback' | 'done';
export interface SurveyProgress { routeId: RouteId; phase: SurveyPhase; marker?:number }
export interface GuidedSurveyView {
 mapPoint:MapPoint; mapPumps:MapPoint[]; mapPolyline?:number[][]; markerFraction?:number;
 key:string;title:string;text:string;progress:string;
 results:{label:string;time:string}[];actions:{id:string;label:string}[];
}
export const pumpName = (route: typeof surveyRoutes[number]): string => route.destination==='broad-street'?'Broad Street pump':route.destination==='marlborough-pump'?'Marlborough Street pump':'Rupert Street pump';
export const walkingTime = (seconds:number):string => `${Math.floor(seconds/60)}m ${String(seconds%60).padStart(2,'0')}s`;
