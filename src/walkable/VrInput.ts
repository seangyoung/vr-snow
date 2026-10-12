import * as THREE from "three";
import buttonProfiles from "./controller-buttons.json" with { type: "json" };

export type VrShortcut = "map" | "notebook" | "settings" | "height";
type ButtonBinding = {index:number;label:string};
type Layout = {primary?:ButtonBinding;secondary?:ButtonBinding};
const profiles:Record<string,Record<string,Layout>>=buttonProfiles;

/** Extra buttons are profile-specific, not part of xr-standard's guaranteed slots. */
export function controllerButtons(source?:XRInputSource):Layout {
  if(source?.gamepad?.mapping!=="xr-standard" || source.hand || source.handedness==="none")return {};
  for(const id of source.profiles??[]) {
    const profile=profiles[id];
    if(profile) {
      const layout=profile[source.handedness]??profile["left-right"]??{};
      const count=source.gamepad.buttons.length;
      return {
        ...(layout.primary&&layout.primary.index<count?{primary:layout.primary}:{}),
        ...(layout.secondary&&layout.secondary.index<count?{secondary:layout.secondary}:{}),
      };
    }
  }
  return {};
}
export class VrShortcutTracker {
  private readonly previous=new Map<XRInputSource,boolean[]>();
  forget(source:XRInputSource):void {this.previous.delete(source);}
  clear():void {this.previous.clear();}
  update(source:XRInputSource,enabled:boolean):VrShortcut[] {
    const bindings=controllerButtons(source),buttons=source.gamepad?.buttons??[];
    const next=[bindings.primary,bindings.secondary].map(binding=>Boolean(binding&&buttons[binding.index]?.pressed));
    const previous=this.previous.get(source);this.previous.set(source,next);
    // A controller first connected with a held button must be released first.
    if(!enabled||!previous)return [];
    const actions:VrShortcut[]=source.handedness==="left"?["map","notebook"]:["height","settings"];
    return actions.filter((_,index)=>next[index]&&!previous[index]);
  }
}
export function leftStick(source?:XRInputSource):THREE.Vector2 {
  const pad=source?.gamepad;
  if(source?.handedness!=="left"||source.hand||pad?.mapping!=="xr-standard")return new THREE.Vector2();
  const x=pad.axes[2]??0,y=pad.axes[3]??0;
  if(!Number.isFinite(x)||!Number.isFinite(y))return new THREE.Vector2();
  const vector=new THREE.Vector2(x,y),length=vector.length();
  if(length<=.18)return vector.set(0,0);
  return vector.multiplyScalar(Math.min(1,(length-.18)/.82)/length);
}

/** Horizontal, head-relative walking with the same swept collision checks as desktop. */
export class VrWalking {
  private armed=false;
  reset():void {this.armed=false;}
  update(position:THREE.Vector3,forward:THREE.Vector3,stick:THREE.Vector2,elapsed:number,
      allowed:boolean,canWalk:(from:THREE.Vector3,to:THREE.Vector3)=>boolean):THREE.Vector3 {
    if(!allowed){this.armed=false;return position.clone();}
    if(stick.lengthSq()===0){this.armed=true;return position.clone();}
    if(!this.armed)return position.clone();
    const dt=Number.isFinite(elapsed)?THREE.MathUtils.clamp(elapsed,0,.05):0;
    const direction=new THREE.Vector3(forward.x,0,forward.z);
    if(direction.lengthSq()<.0001)return position.clone();
    direction.normalize();
    const right=new THREE.Vector3(-direction.z,0,direction.x);
    const delta=direction.multiplyScalar(-stick.y).addScaledVector(right,stick.x).multiplyScalar(1.35*dt);
    const next=position.clone().add(delta);
    if(canWalk(position,next))return next;
    next.copy(position);
    const candidate=position.clone();candidate.x+=delta.x;
    if(canWalk(next,candidate))next.copy(candidate);
    candidate.copy(next);candidate.z+=delta.z;
    if(canWalk(next,candidate))next.copy(candidate);
    return next;
  }
}
export function adjustViewerHeight(rig:THREE.Group,delta:number):number {
  if(Number.isFinite(delta))rig.position.y=THREE.MathUtils.clamp(rig.position.y+delta,-.8,1.4);
  rig.updateMatrixWorld(true);return rig.position.y;
}
export function setViewerEyeHeight(rig:THREE.Group,camera:THREE.Camera,height:number):number {
  if(!Number.isFinite(height))return rig.position.y;
  return adjustViewerHeight(rig,height-camera.getWorldPosition(new THREE.Vector3()).y);
}
