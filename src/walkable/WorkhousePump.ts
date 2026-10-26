import * as THREE from 'three';
import { PumpAction } from './PumpAction';
import { extractProps } from './InspectableProps';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

class LinkedPumpAction extends PumpAction {
  onPoseChange?: () => void;
  override update(delta: number, reducedMotion: boolean): boolean {
    const water=super.update(delta,reducedMotion);this.onPoseChange?.();return water;
  }
  override reset(enabled=true): void { super.reset(enabled);this.onPoseChange?.(); }
}

/** Match the authored well fitting, replacing its static pump while retaining the well and buckets. */
export class WorkhousePump {
  readonly group = new THREE.Group();
  private readonly outlet = new THREE.Vector3(-.43,1.20,0);
  readonly action = new LinkedPumpAction(this.group, this.outlet, .425);
  private readonly iron = new THREE.MeshStandardMaterial({color:'#39433b',metalness:.35,roughness:.5});
  private visuals?: Promise<void>;
  constructor() {
    this.group.name='Working workhouse pump';this.group.position.set(3,0,-5.8);
    const cylinder=(y:number,r:number,h:number)=>{
      const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,16),this.iron);
      mesh.position.y=y;this.group.add(mesh);
    };
    cylinder(.46,.19,.1);cylinder(.87,.10,.8);cylinder(1.45,.16,.45);cylinder(1.72,.19,.09);
    for(const y of [1.26,1.66])cylinder(y,.18,.05);
    const tube=(points:number[][])=>new THREE.Mesh(new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),16,.032,8,false),this.iron);
    const spout=tube([[0,1.43,0],[-.29,1.43,0],[-.43,1.34,0],[-.43,1.20,0]]);
    this.group.add(spout);
    this.action.handle.position.set(.12,1.57,0);
    const handle=tube([[.12,1.57,0],[.4,1.70,0],[.72,1.26,0],[.9,.60,0],[.96,.52,0]]);
    handle.geometry.translate(-.12,-1.57,0);this.action.handle.add(handle);
    const grip=new THREE.Mesh(new THREE.CapsuleGeometry(.09,.28,4,8),new THREE.MeshBasicMaterial({visible:false}));
    grip.position.set(.77,-.86,0);this.action.handle.add(grip);
  }
  /** Keep the procedural fitting usable if the optional detailed asset fails. */
  loadVisuals(basePath: string): Promise<void> {
    return this.visuals ??= this.loadModel(basePath);
  }
  private async loadModel(basePath: string): Promise<void> {
    try {
      const gltf=await new GLTFLoader().loadAsync(`${basePath}models/workhouse-hand-pump.glb`);
      const body=gltf.scene.getObjectByName('Workhouse_pump_body');
      const lever=gltf.scene.getObjectByName('Workhouse_pump_handle');
      if(!(body instanceof THREE.Mesh) || !(lever instanceof THREE.Mesh))throw new Error('Pump body or lever is missing');
      const pivot=lever.position.clone();
      const old=[...this.group.children.filter(o=>o instanceof THREE.Mesh),...this.action.handle.children];
      for(const ob of old) {
        ob.removeFromParent();
        ob.traverse(child=>{if(child instanceof THREE.Mesh){child.geometry.dispose();if(child.material!==this.iron)for(const mat of Array.isArray(child.material)?child.material:[child.material])mat.dispose();}});
      }
      const importedMaterials=new Set<THREE.Material>();
      for(const mesh of [body,lever]) {
        for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material])importedMaterials.add(mat);
        mesh.material=this.iron;
      }
      for(const mat of importedMaterials)mat.dispose();
      this.iron.color.set('#3c493f');this.iron.metalness=.3;this.iron.roughness=.72;
      this.group.add(body);
      this.action.handle.position.copy(pivot);lever.position.set(0,0,0);this.action.handle.add(lever);
      const grip=new THREE.Mesh(new THREE.CapsuleGeometry(.075,.18,4,8),new THREE.MeshBasicMaterial({visible:false}));
      grip.position.set(.64,.77,0).sub(pivot);this.action.handle.add(grip);
      this.outlet.set(-.585,.965,0);
      // The inner lever joint drives the exposed rod into the guide in the lid.
      const rod=new THREE.Mesh(new THREE.CylinderGeometry(.013,.013,1,10),this.iron);
      rod.name='Workhouse moving piston rod';this.group.add(rod);
      const guide=new THREE.Vector3(0,1.30,0),joint=new THREE.Vector3(-.0067,1.7694,0).sub(pivot);
      const top=new THREE.Vector3(),direction=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
      this.action.onPoseChange=()=>{
        top.copy(joint).applyQuaternion(this.action.handle.quaternion).add(pivot);
        direction.subVectors(top,guide);rod.position.copy(guide).add(top).multiplyScalar(.5);
        rod.scale.y=direction.length();rod.quaternion.setFromUnitVectors(up,direction.normalize());
      };
      this.action.onPoseChange();this.group.userData.modelStatus='ready';
    } catch(error) {
      this.group.userData.modelStatus='fallback';
      console.warn('Detailed workhouse pump unavailable; using the simple working fitting.',error);
    }
  }
  replaceStaticPump(model: THREE.Group): void {
    // Complete triangles are removed from the material batches; UVs and all other courtyard art stay intact.
    const removed=new THREE.Group();
    const parts=extractProps(model,removed,'workhouse-courtyard.glb',[
      {name:'Static workhouse pump',min:[2.49,.40,-6.01],max:[4.01,1.82,-5.59]},
    ],false);
    for(const part of parts)part.group.traverse(object=>{
      if(object instanceof THREE.Mesh) {
        const material=object.material as THREE.MeshStandardMaterial;
        this.iron.envMap=material.envMap;// This moving fitting has no baked lightmap; use the captured sky as at Broad Street.
        this.iron.envMapIntensity=1.4;
        object.geometry.dispose();
      }
    });
    this.iron.needsUpdate=true;
  }
  owns(object: THREE.Object3D): boolean {
    for(let node: THREE.Object3D|null=object;node;node=node.parent)if(node===this.group)return true;
    return false;
  }
}
