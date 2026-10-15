import * as THREE from "three";

/** A bounded stroke and short burst of water; fixed geometry, no particle allocation. */
export class PumpAction {
  readonly handle = new THREE.Group();
  readonly water = new THREE.Group();
  private elapsed = Infinity;
  private readonly drops: THREE.InstancedMesh;
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private enabled = true;
  constructor(pump: THREE.Group) {
    this.handle.name = "Working pump handle";
    this.handle.position.set(.13,1.72,0);
    this.water.name = "Pump water"; this.water.visible = false;
    const waterMaterial = new THREE.MeshBasicMaterial({color:"#b8d9dd",transparent:true,opacity:.72,depthWrite:false});
    this.drops = new THREE.InstancedMesh(new THREE.SphereGeometry(1,6,4),waterMaterial,28);
    this.drops.frustumCulled = false;
    this.water.add(this.drops); pump.add(this.handle,this.water);
  }
  owns(object?: THREE.Object3D): boolean {
    for (let node=object; node; node=node.parent??undefined) if (node===this.handle) return this.enabled;
    return false;
  }
  stroke(): boolean {
    if (!this.enabled || this.elapsed < 1.05) return false;
    this.elapsed=0; return true;
  }
  reset(enabled = true): void {
    this.enabled=enabled; this.handle.visible=enabled;
    // Invisible objects are still raycast by Three.js; disable their layers too.
    this.handle.traverse(object=>object.layers.mask=enabled?1:0);
    this.elapsed=Infinity; this.handle.rotation.z=0; this.water.visible=false;
  }
  update(delta: number, reducedMotion: boolean): void {
    if (!Number.isFinite(this.elapsed)) return;
    this.elapsed += Math.max(0, Math.min(delta,.05));
    const t=this.elapsed;
    // Raise once, then press down; no autonomous pumping or unbounded particles.
    this.handle.rotation.z= t<1.05 ? .55*Math.sin(Math.PI*Math.min(1,t/1.05)) : 0;
    this.water.visible=t>.55 && t<1.5;
    if (this.water.visible) {
      for(let i=0;i<28;i++) {
        const f=((reducedMotion?0:t)*1.6+i/28)%1;
        const splash=i>=22;
        this.position.set(splash?Math.sin(i*2.4)*f*.20:Math.sin(i*3.1)*.008,
          splash?-.055+Math.sin(f*Math.PI)*.07:1.145-f*f*1.23,
          -.45+(splash?Math.cos(i*2.4)*f*.20:0));
        this.scale.set(splash?.012:.016,splash?.009:.045,splash?.012:.016);
        this.matrix.compose(this.position,this.rotation,this.scale); this.drops.setMatrixAt(i,this.matrix);
      }
      this.drops.instanceMatrix.needsUpdate=true;
    }
    if(t>=1.5)this.elapsed=Infinity;
  }
}
