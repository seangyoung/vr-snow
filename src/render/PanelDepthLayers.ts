import * as THREE from 'three';

type Drawable = (THREE.Mesh | THREE.Sprite | THREE.Line);
type Record = { source: THREE.Material | THREE.Material[]; overlay: THREE.Material | THREE.Material[]; order: number };
const materials=(value: THREE.Material | THREE.Material[])=>Array.isArray(value)?value:[value];
const visibleInWorld=(object:THREE.Object3D):boolean=>{
  for(let node:THREE.Object3D|null=object;node;node=node.parent)if(!node.visible)return false;
  return true;
};

/** Scenery -> depth-writing panel -> depth-tested people/hardware, in one render.
 * The panel replaces scenery depth only inside its rectangle. Foreground meshes
 * then pass only where they are physically nearer, including in each XR eye.
 * Clone materials so holding a prop never changes its shared room material.
 */
export class PanelDepthLayers {
  private records=new Map<Drawable,Record>();
  update(roots:THREE.Object3D[],active:boolean):void {
    for(const [object,record] of this.records){object.material=record.source;object.renderOrder=record.order;}
    const next=new Map<Drawable,Record>();
    if(active)for(const root of roots){
      if(!visibleInWorld(root))continue;
      root.traverseVisible(object=>{
        if(!(object instanceof THREE.Mesh || object instanceof THREE.Sprite || object instanceof THREE.Line) || next.has(object))return;
        let record=this.records.get(object);
        if(record && record.source!==object.material){materials(record.overlay).forEach(m=>m.dispose());record=undefined;}
        if(!record){
          const clone=(m:THREE.Material)=>{
            const copy=m.clone();copy.transparent=true;copy.depthTest=true;copy.depthFunc=THREE.LessEqualDepth;
            copy.forceSinglePass=true;return copy;
          };
          record={source:object.material,overlay:Array.isArray(object.material)?object.material.map(clone):clone(object.material),order:object.renderOrder};
        }
        // Controller callout opacity changes while looking at the hands.
        materials(record.overlay).forEach((m,i)=>{const source=materials(record!.source)[i];m.opacity=source.opacity;m.visible=source.visible;});
        object.material=record.overlay;object.renderOrder=101;next.set(object,record);
      });
    }
    for(const [object,record] of this.records)if(!next.has(object))materials(record.overlay).forEach(m=>m.dispose());
    this.records=next;
  }
}

/** Visible character geometry blocks panel selection, just as it blocks its pixels. */
export function foregroundBefore(ray:THREE.Raycaster,distance:number,roots:THREE.Object3D[]):boolean {
  const meshes:THREE.Mesh[]=[];
  for(const root of roots){
    if(!visibleInWorld(root))continue;
    root.updateWorldMatrix(true,true);
    root.traverseVisible(object=>{
      if(object instanceof THREE.Mesh && materials(object.material).some(m=>m.visible && m.opacity>0))meshes.push(object);
    });
  }
  return ray.intersectObjects(meshes,false).some(hit=>hit.distance<distance-.015);
}
