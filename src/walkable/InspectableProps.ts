import * as THREE from "three";

type PropSpec = { name: string; min: number[]; max: number[] };
// Bounds isolate complete authored objects above the furniture, in scene metres.
// The original geometry, textures and UVs are retained; no duplicate prop remains.
export const propSpecs: Record<string, PropSpec[]> = {
  "snow-office.glb": [
    { name: "Wooden stethoscope", min: [-1.56,.83,-1.14], max: [-1.50,.89,-.88] },
    { name: "Medical case book", min: [1.59,.828,-2.43], max: [1.89,.88,-2.19] },
  ],
  "registrar-room.glb": [
    { name: "Returns ledger", min: [-.48,.866,2.05], max: [.48,.957,2.72] },
  ],
  "household-room.glb": [
    { name: "Water jug", min: [1.67,.784,-1.18], max: [2.06,1.18,-.86] },
    { name: "Drinking cup", min: [1.32,.784,-.88], max: [1.48,.90,-.72] },
  ],
  "brewery-room.glb": [
    { name: "Account book", min: [-4.78,.845,3.78], max: [-4.21,.925,4.22] },
    { name: "Drinking mug", min: [-4.45,.839,3.21], max: [-4.25,1.005,3.45] },
    { name: "Drinking mug", min: [-4.45,.839,2.78], max: [-4.25,1.005,3.02] },
  ],
};

export class InspectableProp {
  readonly home = new THREE.Vector3();
  readonly homeRotation = new THREE.Quaternion();
  returning = false;
  held = false;
  private returnTime = 0;
  private readonly start = new THREE.Vector3();
  private readonly startRotation = new THREE.Quaternion();
  constructor(readonly group: THREE.Group, readonly name: string) {
    this.home.copy(group.position); this.homeRotation.copy(group.quaternion);
  }
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
    if (t === 1) this.returning = false;
  }
}

/** Split only complete triangles from the material-batched environment, once on load. */
export function extractProps(model: THREE.Object3D, parent: THREE.Group, asset: string, specs = propSpecs[asset] ?? []): InspectableProp[] {
  const result: InspectableProp[] = [];
  model.updateWorldMatrix(true, true);
  for (const spec of specs) {
    const bounds = new THREE.Box3(new THREE.Vector3(...spec.min), new THREE.Vector3(...spec.max));
    const center = bounds.getCenter(new THREE.Vector3());
    const group = new THREE.Group(); group.name = spec.name; group.position.copy(center);
    model.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const geometry: THREE.BufferGeometry = object.geometry;
      const position = geometry.getAttribute("position"), index = geometry.getIndex();
      const count = index ? index.count : position.count;
      const taken: number[] = [], kept: number[] = [];
      const point = new THREE.Vector3();
      for (let i = 0; i < count; i += 3) {
        const ids = [0,1,2].map(j => index ? index.getX(i+j) : i+j);
        const inside = ids.every(id => bounds.containsPoint(point.fromBufferAttribute(position,id).applyMatrix4(object.matrixWorld)));
        (inside ? taken : kept).push(...ids);
      }
      if (!taken.length) return;
      const part = new THREE.BufferGeometry();
      for (const [name, attribute] of Object.entries(geometry.attributes)) {
        // Compact the extracted mesh rather than copying an entire room batch
        // (whose unused vertices would also give it room-sized bounding volumes).
        const data = new Float32Array(taken.length * attribute.itemSize);
        for (let i=0;i<taken.length;i++)for(let j=0;j<attribute.itemSize;j++)
          data[i*attribute.itemSize+j]=attribute.getComponent(taken[i],j);
        part.setAttribute(name,new THREE.BufferAttribute(data,attribute.itemSize));
      }
      part.applyMatrix4(new THREE.Matrix4().makeTranslation(-center.x,-center.y,-center.z).multiply(object.matrixWorld));
      part.computeBoundingBox(); part.computeBoundingSphere();
      const mesh = new THREE.Mesh(part, object.material);
      mesh.name = spec.name; group.add(mesh);
      geometry.setIndex(kept); geometry.computeBoundingSphere();
    });
    if (!group.children.length) {
      console.warn(`Inspectable object unavailable: ${asset}: ${spec.name}`); continue;
    }
    const prop = new InspectableProp(group,spec.name);
    group.traverse(object => { object.userData.inspectableProp = prop; });
    parent.add(group); result.push(prop);
  }
  return result;
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
    this.prop = prop; this.anchor = anchor; this.distance = desktop ? .65 : .38;
    anchor.getWorldQuaternion(this.orientation);
    this.rotation.copy(this.orientation).invert().multiply(prop.group.getWorldQuaternion(new THREE.Quaternion()));
    prop.held=true;
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
  rotate(delta: number): void { this.rotation.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),delta)); }
  release(immediate = false): void {
    if(this.prop)this.prop.held=false;
    this.prop?.release(immediate); this.prop = undefined; this.anchor = undefined;
  }
}
