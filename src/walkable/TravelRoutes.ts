import type { LocationId } from "../simulation/types";

export interface WorldTravelRoute {
  id: string;
  from: LocationId;
  to: LocationId;
  title: string;
  direction: string;
  position: [number, number, number];
  yaw: number;
  zone?: { x: number; z: number; radius: number };
  door?: boolean;
  labelWidth?: number;
}

/** These are route entrances, not straight-line bearings or measured destination positions. */
export const streetTravelRoutes: WorldTravelRoute[] = [
  { id: "street-brewery", from: "broad-street", to: "brewery", title: "Lion Brewery", direction: "EAST · Along Broad Street", position: [13.4, 1.65, -1.5], yaw: -Math.PI/2, zone: {x:12.3,z:-1.5,radius:.75} },
  { id: "street-workhouse", from: "broad-street", to: "workhouse", title: "St. James Workhouse", direction: "EAST, THEN NORTH · Poland St", position: [13.4, 1.65, -6.2], yaw: -Math.PI/2, zone: {x:12.3,z:-6.2,radius:.75} },
  { id: "street-snow", from: "broad-street", to: "snow-desk", title: "Snow's Desk", direction: "SOUTH · Continue via Cambridge St", position: [2.3, 1.65, 11.7], yaw: Math.PI, zone: {x:2.3,z:10.6,radius:.75} },
  { id: "street-registrar", from: "broad-street", to: "registrar", title: "Registrar's Ledger", direction: "SOUTH · Onward to the records office", position: [6.1, 1.65, 11.7], yaw: Math.PI, zone: {x:6.1,z:10.6,radius:.75} },
  // The right-hand door in the northern shop frontage is an illustrative household entrance.
  { id: "street-household", from: "broad-street", to: "household", title: "Broad Street Household", direction: "Household interview · This door", position: [-11, 2.85, -8.72], yaw: 0, zone: {x:-11,z:-7.15,radius:.65}, door: true },
];

export const returnTravelRoutes: WorldTravelRoute[] = [
  // Fixed exits in panorama scenes; the modeled interiors also have walk-in doorway zones.
  { id:"household-return", from:"household", to:"broad-street", title:"Return to Broad Street", direction:"Leave the household", position:[1.25,2.8,2.8],labelWidth:1.45,yaw:Math.PI, zone:{x:1.25,z:2.4,radius:.32}, door:true },
  { id:"brewery-return", from:"brewery", to:"broad-street", title:"Return to Broad Street", direction:"Leave the brewery", position:[1.3,1.35,3.2],yaw:Math.PI },
  { id:"workhouse-return", from:"workhouse", to:"broad-street", title:"Return to Broad Street", direction:"Leave via Poland Street", position:[0,2.8,9.8],labelWidth:1.45,yaw:Math.PI, zone:{x:0,z:9.2,radius:.45}, door:true },
  { id:"registrar-return", from:"registrar", to:"snow-desk", title:"Return to Snow's Desk", direction:"Take the copied records to Snow", position:[2.1,2.87,4.0],labelWidth:1.45,yaw:Math.PI, zone:{x:2.1,z:3.5,radius:.35}, door:true },
  { id:"snow-street", from:"snow-desk", to:"broad-street", title:"Go to Broad Street", direction:"Leave the office for the pump", position:[1.65,2.8,3.0],labelWidth:1.45,yaw:Math.PI, zone:{x:1.65,z:2.58,radius:.33}, door:true },
];
export const worldTravelRoutes = [...streetTravelRoutes, ...returnTravelRoutes];

/** Trigger only on entry; unlocking or closing a panel while standing in a zone cannot fire it. */
export class TravelZoneTracker {
  private inside = new Set<string>();
  reset(): void { this.inside.clear(); }
  update(x: number, z: number, routes: WorldTravelRoute[], enabled: (route: WorldTravelRoute) => boolean): WorldTravelRoute | undefined {
    const now = new Set(routes.filter(({zone}) => zone && Math.hypot(x-zone.x,z-zone.z) <= zone.radius).map(r=>r.id));
    const entered = routes.find(r=>now.has(r.id) && !this.inside.has(r.id) && enabled(r));
    this.inside = now;
    return entered;
  }
}
