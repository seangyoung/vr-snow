import data from './route-data.json' with {type:'json'};
import type {LocationId} from './types';
export type RouteId='marlborough-broad'|'marlborough-alternative'|'rupert-broad'|'rupert-alternative';
export type RoutePair='marlborough'|'rupert';
export const routeData=data;
export const surveyRoutes=data.routes.map(route=>{
 const projected=route.polyline.map(([x,y])=>[data.affine.easting[0]*x+data.affine.easting[1]*y+data.affine.easting[2],data.affine.northing[0]*x+data.affine.northing[1]*y+data.affine.northing[2]]);
 const length=projected.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-projected[i][0],p[1]-projected[i][1]),0);
 const metres=Math.round(length/5)*5;
 return {...route,id:route.id as RouteId,pair:route.pair as RoutePair,destination:route.destination as LocationId,metres,seconds:Math.round(metres/data.walkingMetresPerSecond)};
});
export interface RouteObservation {routeId:RouteId;metres:number;seconds:number}
export interface FieldworkView {guided:GuidedSurveyView;title:string;text:string}
export function observation(id:RouteId): RouteObservation {const route=surveyRoutes.find(r=>r.id===id)!;return {routeId:id,metres:route.metres,seconds:route.seconds};}

export type SurveyPhase = 'origin' | 'arrival' | 'compare' | 'feedback' | 'done';
export interface SurveyProgress { routeId: RouteId; phase: SurveyPhase; answer?: RouteId }
export interface GuidedSurveyView {
  mapPoint: {x:number;y:number;label:string};
  mapPumps: {x:number;y:number;label:string}[];
  key: string; title: string; text: string; progress: string;
  results: {label: string; time: string}[];
  actions: {id: string; label: string}[];
}
export const pumpName = (route: typeof surveyRoutes[number]): string => route.destination==='broad-street'?'Broad Street pump':route.destination==='marlborough-pump'?'Marlborough Street pump':'Rupert Street pump';
export const walkingTime = (seconds: number): string => `${Math.floor(seconds/60)} min ${seconds%60} sec`;
export const pairName = (pair: RoutePair): string => pair==='marlborough'?'Western starting point':'Eastern starting point';
