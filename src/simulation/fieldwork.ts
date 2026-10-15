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
export interface FieldworkView {title:string;text:string;routes:typeof surveyRoutes;canRecord:boolean;canConclude:boolean;observations:RouteObservation[]}
export function observation(id:RouteId): RouteObservation {const route=surveyRoutes.find(r=>r.id===id)!;return {routeId:id,metres:route.metres,seconds:route.seconds};}
