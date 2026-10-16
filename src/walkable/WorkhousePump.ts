import * as THREE from 'three';
import { PumpAction } from './PumpAction';
import { extractProps } from './InspectableProps';

/** Match the authored well fitting, replacing its static pump while retaining the well and buckets. */
export class WorkhousePump {
  readonly group = new THREE.Group();
  readonly action = new PumpAction(this.group, new THREE.Vector3(-.43,1.20,0), .425);
  private readonly iron = new THREE.MeshStandardMaterial({color:'#39433b',metalness:.35,roughness:.5});
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
  replaceStaticPump(model: THREE.Group): void {
    // Complete triangles are removed from the material batches; UVs and all other courtyard art stay intact.
    const removed=new THREE.Group();
    const parts=extractProps(model,removed,'workhouse-courtyard.glb',[
      {name:'Static workhouse pump',min:[2.49,.40,-6.01],max:[4.01,1.82,-5.59]},
    ]);
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
