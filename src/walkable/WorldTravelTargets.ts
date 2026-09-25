import * as THREE from "three";
import type { GameState } from "../simulation/gameState";
import type { LocationId } from "../simulation/types";
import { worldTravelRoutes, type WorldTravelRoute } from "./TravelRoutes";

type LabelFactory = (route: WorldTravelRoute, enabled: boolean) => THREE.Material;
interface Target { route: WorldTravelRoute; group: THREE.Group; label: THREE.Mesh; ring?: THREE.Mesh; enabled?: boolean; }

/** Stationary scene objects, not camera children. Labels are drawn only when unlock state changes. */
export class WorldTravelTargets {
  readonly group = new THREE.Group();
  private readonly targets: Target[] = [];
  private readonly hitboxes: THREE.Object3D[] = [];
  private readonly routesByObject = new Map<THREE.Object3D,WorldTravelRoute>();
  constructor(private readonly labelFactory: LabelFactory = createTravelLabel) {
    this.group.name = "In-world travel";
    for(const route of worldTravelRoutes) {
      const group = new THREE.Group(); group.name = route.id;
      group.position.set(...route.position); group.rotation.y=route.yaw;
      const width = route.labelWidth ?? (route.door ? 1.75 : route.zone ? 2.05 : 1.4);
      const label = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 340 / 1024));
      group.add(label);
      this.routesByObject.set(label,route); this.hitboxes.push(label);
      let ring: THREE.Mesh | undefined;
      if(route.zone) {
        ring = new THREE.Mesh(new THREE.RingGeometry(route.zone.radius-.07,route.zone.radius,48), new THREE.MeshBasicMaterial({color:"#dec17b",side:THREE.DoubleSide}));
        ring.rotation.x=-Math.PI/2;
        // A separate child keeps the approach marker horizontal even when a sign is rotated.
        ring.position.set(route.zone.x,.025,route.zone.z);
        this.group.add(ring);
        this.routesByObject.set(ring,route); this.hitboxes.push(ring);
        const inset = new THREE.Mesh(new THREE.CircleGeometry(route.zone.radius-.1,40), new THREE.MeshBasicMaterial({color:"#c3a563",transparent:true,opacity:.13,depthWrite:false}));
        ring.add(inset); inset.position.z=-.002;
        this.routesByObject.set(inset,route); this.hitboxes.push(inset);
        if(route.door) {
          const door = new THREE.Mesh(new THREE.PlaneGeometry(1.12,2.45),new THREE.MeshBasicMaterial({visible:false}));
          door.position.set(0,-1.52,-.025); group.add(door);
          this.hitboxes.push(door); this.routesByObject.set(door,route);
          for(const x of [-.57,.57]) {
            const trim = new THREE.Mesh(new THREE.BoxGeometry(.025,2.45,.025),new THREE.MeshBasicMaterial({color:"#c4a56c"}));
            trim.position.set(x,-1.52,.01); group.add(trim);
          }
        } else {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,1.7,8),new THREE.MeshStandardMaterial({color:"#493e2c",roughness:1}));
          post.position.set(0,-.82,-.04);group.add(post);
        }
      }
      this.targets.push({route,group,label,ring}); this.group.add(group);
    }
  }

  refresh(game: GameState): void {
    const current=game.getCurrentLocation().id;
    for(const target of this.targets) {
      const visible=target.route.from===current;
      target.group.visible=visible;
      if(target.ring) target.ring.visible=visible;
      const enabled=game.canTravelToLocation(target.route.to);
      if(target.enabled !== enabled) {
        const old=target.label.material as THREE.MeshBasicMaterial;
        old.map?.dispose();old.dispose();
        target.label.material=this.labelFactory(target.route,enabled);
        target.enabled=enabled;
        if(target.ring) (target.ring.material as THREE.MeshBasicMaterial).color.set(enabled?"#cde8b1":"#998e79");
      }
    }
  }

  routeFor(object: THREE.Object3D): WorldTravelRoute | undefined { return this.routesByObject.get(object); }
  pick(raycaster: THREE.Raycaster, location: LocationId, obstruction?: THREE.Intersection): THREE.Intersection | undefined {
    this.group.updateMatrixWorld(true);
    const active=this.hitboxes.filter(object=>this.routesByObject.get(object)?.from===location);
    const hit=raycaster.intersectObjects(active,false)[0];
    return hit && (!obstruction || hit.distance<=obstruction.distance+.035) ? hit : obstruction;
  }
}

function createTravelLabel(route: WorldTravelRoute, enabled: boolean): THREE.Material {
  const canvas=document.createElement("canvas");canvas.width=1024;canvas.height=340;
  const ctx=canvas.getContext("2d")!;
  ctx.fillStyle=enabled?"#23332b":"#34342e";ctx.fillRect(0,0,1024,340);
  ctx.strokeStyle=enabled?"#cfb879":"#797566";ctx.lineWidth=5;ctx.strokeRect(10,10,1004,320);
  ctx.textAlign="center";ctx.fillStyle=enabled?"#fff1c7":"#c3beb0";
  ctx.font="bold 53px Georgia";ctx.fillText(route.title,512,88,940);
  ctx.font="31px sans-serif";ctx.fillText(route.direction,512,153,950);
  ctx.font="bold 32px sans-serif";
  ctx.fillStyle=enabled?"#c4e7b4":"#c0b9a9";
  const action=enabled ? route.zone ? "ENTER THE RING OR SELECT TO TRAVEL" : "SELECT TO TRAVEL" : "LOCKED · Continue the inquiry with Snow";
  ctx.fillText(action,512,245,950);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide,toneMapped:false});
}
