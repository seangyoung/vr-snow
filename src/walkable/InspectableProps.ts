import * as THREE from "three";

import manifest from "./portable-props.json" with { type: "json" };
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

type Bounds = { min: number[]; max: number[] };
type PropSpec = Bounds & { name: string; regions?: Bounds[] };
export const propSpecs: Record<string, PropSpec[]> = manifest;
export const grabReach = 5;

export class InspectableProp {
  readonly home = new THREE.Vector3();
  readonly homeRotation = new THREE.Quaternion();
  private showActive?: (active: boolean) => void;
  returning = false;
  held = false;
  private returnTime = 0;
  private readonly start = new THREE.Vector3();
  private readonly startRotation = new THREE.Quaternion();
  constructor(readonly group: THREE.Group, readonly name: string) {
    this.home.copy(group.position); this.homeRotation.copy(group.quaternion);
  }
  setBatchVisibility(toggle: (active: boolean) => void): void { this.showActive = toggle; toggle(false); }
  activate(): void { this.showActive?.(true); }
  release(immediate = false): void {
    this.start.copy(this.group.position); this.startRotation.copy(this.group.quaternion);
    this.returnTime = 0; this.returning = true;
    if (immediate) this.update(1, true);
  }
  update(delta: number, reducedMotion: boolean): void {
    if (!this.returning) return;
    this.returnTime += Math.max(0, delta);
    const t = reducedMotion ? 1 : Math.min(1, this.returnTime / .6);
    // Monotonic easing avoids overshooting through the table or bouncing forever.
    const ease = 1 - Math.pow(1 - t, 3);
    this.group.position.lerpVectors(this.start, this.home, ease);
    this.group.quaternion.slerpQuaternions(this.startRotation, this.homeRotation, ease);
    if (t === 1) { this.returning = false; this.showActive?.(false); }
  }
}

/** Split complete authored triangles once; a spatial index keeps large shelves cheap to load. */
export function extractProps(model: THREE.Object3D, parent: THREE.Group, asset: string, specs = propSpecs[asset] ?? [], batch = true): InspectableProp[] {
  model.updateWorldMatrix(true, true);
  const box = (b: Bounds) => new THREE.Box3(new THREE.Vector3(...b.min),new THREE.Vector3(...b.max));
  const entries = specs.map(spec => {
    const center = box(spec).getCenter(new THREE.Vector3());
    const group = new THREE.Group(); group.name = spec.name; group.position.copy(center);
    return {spec, center, group, bounds: (spec.regions ?? [spec]).map(box)};
  });
  const cells = new Map<string,number[]>();
  const cell = (v: number) => Math.floor(v * 2);
  specs.forEach((spec,i) => {
    for(let x=cell(spec.min[0]);x<=cell(spec.max[0]);x++)
      for(let y=cell(spec.min[1]);y<=cell(spec.max[1]);y++)
        for(let z=cell(spec.min[2]);z<=cell(spec.max[2]);z++) {
          const key=`${x},${y},${z}`; const list=cells.get(key)??[];list.push(i);cells.set(key,list);
        }
  });
  model.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const geometry: THREE.BufferGeometry = object.geometry;
    const position=geometry.getAttribute("position"), index=geometry.getIndex();
    const count=index?index.count:position.count;
    const world: THREE.Vector3[]=[];
    for(let i=0;i<position.count;i++)world.push(new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(object.matrixWorld));
    const kept:number[]=[], taken=entries.map(()=>[] as number[]);
    for(let i=0;i<count;i+=3) {
      const a=index?index.getX(i):i,b=index?index.getX(i+1):i+1,c=index?index.getX(i+2):i+2;
      const v=world[a];
      const candidates=cells.get(`${cell(v.x)},${cell(v.y)},${cell(v.z)}`)??[];
      const owner=candidates.find(j=>entries[j].bounds.some(bounds=>bounds.containsPoint(v)&&bounds.containsPoint(world[b])&&bounds.containsPoint(world[c])));
      (owner===undefined?kept:taken[owner]).push(a,b,c);
    }
    for(let j=0;j<entries.length;j++) {
      const ids=taken[j];if(!ids.length)continue;
      const {center,group,spec}=entries[j],part=new THREE.BufferGeometry();
      for(const [name,attribute] of Object.entries(geometry.attributes)) {
        const data=new Float32Array(ids.length*attribute.itemSize);
        for(let i=0;i<ids.length;i++)for(let k=0;k<attribute.itemSize;k++)data[i*attribute.itemSize+k]=attribute.getComponent(ids[i],k);
        part.setAttribute(name,new THREE.BufferAttribute(data,attribute.itemSize));
      }
      part.applyMatrix4(new THREE.Matrix4().makeTranslation(-center.x,-center.y,-center.z).multiply(object.matrixWorld));
      part.computeBoundingBox();part.computeBoundingSphere();
      const mesh=new THREE.Mesh(part,object.material);mesh.name=spec.name;group.add(mesh);
    }
    geometry.setIndex(kept);geometry.computeBoundingSphere();
  });
  const props:InspectableProp[]=[];
  for(const {group,spec} of entries) {
    if(!group.children.length){console.warn(`Inspectable object unavailable: ${asset}: ${spec.name}`);continue;}
    const prop=new InspectableProp(group,spec.name);
    group.traverse(o=>{o.userData.inspectableProp=prop;});parent.add(group);props.push(prop);
  }
  if(batch)batchRestingProps(props,parent);
  return props;
}

/** Hundreds of shelf items still cost only one draw per material while at rest.
 * Hidden individual meshes remain ray targets. Only the held/returning item renders
 * separately, with its home triangles suppressed until it has returned.
 */
function batchRestingProps(props: InspectableProp[], parent: THREE.Group): void {
  const materials=new Map<THREE.Material,Array<{prop:InspectableProp;geometry:THREE.BufferGeometry}>>();
  const toggles=new Map<InspectableProp,Array<(active:boolean)=>void>>();
  for(const prop of props)for(const child of prop.group.children) {
    const mesh=child as THREE.Mesh;
    const material=mesh.material as THREE.Material;
    const list=materials.get(material)??[];
    list.push({prop,geometry:mesh.geometry.clone().translate(...prop.home.toArray())});materials.set(material,list);
  }
  for(const [material,parts] of materials) {
    const geometry=mergeGeometries(parts.map(p=>p.geometry))!;
    const count=geometry.getAttribute("position").count;
    geometry.setIndex(Array.from({length:count},(_,i)=>i));
    const index=geometry.getIndex()!;index.setUsage(THREE.DynamicDrawUsage);
    const mesh=new THREE.Mesh(geometry,material);mesh.name="Resting portable objects";parent.add(mesh);
    let start=0;
    for(const {prop,geometry:part} of parts) {
      const offset=start,length=part.getAttribute("position").count;
      const list=toggles.get(prop)??[];
      list.push(active=>{
        for(let i=offset;i<offset+length;i++)index.setX(i,active?0:i);
        index.addUpdateRange(offset,length);index.needsUpdate=true;
      });toggles.set(prop,list);start+=length;part.dispose();
    }
  }
  for(const prop of props)prop.setBatchVisibility(active=>{
    prop.group.visible=active;for(const toggle of toggles.get(prop)??[])toggle(active);
  });
}

export function propFor(object?: THREE.Object3D): InspectableProp | undefined {
  return object?.userData.inspectableProp;
}

/** One held object; release is independent of a ray hit or a controller select event. */
export class PropHold {
  prop?: InspectableProp;
  anchor?: THREE.Object3D;
  private rotation = new THREE.Quaternion();
  private readonly position = new THREE.Vector3();
  private readonly orientation = new THREE.Quaternion();
  private distance = .65;
  begin(prop: InspectableProp, anchor: THREE.Object3D, desktop: boolean): boolean {
    if (this.prop || prop.returning) return false;
    this.prop = prop; this.anchor = anchor; this.distance = Math.max(desktop ? .65 : .38, new THREE.Box3().setFromObject(prop.group).getSize(new THREE.Vector3()).length()*.6);
    anchor.getWorldQuaternion(this.orientation);
    this.rotation.copy(this.orientation).invert().multiply(prop.group.getWorldQuaternion(new THREE.Quaternion()));
    prop.activate();prop.held=true;
    return true;
  }
  update(delta: number): void {
    if (!this.prop || !this.anchor) return;
    this.anchor.getWorldPosition(this.position); this.anchor.getWorldQuaternion(this.orientation);
    this.position.add(new THREE.Vector3(0,-.10,-this.distance).applyQuaternion(this.orientation));
    const parent = this.prop.group.parent!;
    parent.worldToLocal(this.position);
    const fraction = 1 - Math.exp(-Math.min(.05,Math.max(0,delta))*14);
    this.prop.group.position.lerp(this.position,fraction);
    this.prop.group.quaternion.slerp(parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(this.orientation).multiply(this.rotation),fraction);
  }
  rotate(yaw: number, pitch = 0): void {
    this.rotation.premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch,yaw,0,"YXZ"))).normalize();
  }
  release(immediate = false): void {
    if(this.prop)this.prop.held=false;
    this.prop?.release(immediate); this.prop = undefined; this.anchor = undefined;
  }
}
