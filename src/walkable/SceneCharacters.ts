import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import definitions from "./scene-characters.json" with { type: "json" };
import { loadBakedRoomLighting } from "./BakedRoomLighting";
import { crossesRectangle, inRectangle } from "./WalkableArea";

export type CharacterScene = keyof typeof definitions;
export { definitions as characterDefinitions };

/** Original interpretive figures; selection and collision never depend on animated meshes. */
export class SceneCharacters {
  readonly group = new THREE.Group();
  readonly targets: THREE.Mesh[] = [];
  readonly labelPosition = new THREE.Vector3();
  private loading?: Promise<void>;
  private heads: Array<{ object: THREE.Object3D; yaw: number }> = [];
  private readonly footprints: Array<{ minX: number; maxX: number; minZ: number; maxZ: number }> = [];
  constructor(readonly key: CharacterScene) {
    const definition = definitions[key];
    this.group.name = `${key} figures`;
    for (const actor of definition.actors) {
      const [x,y,z] = actor.position;
      const target = new THREE.Mesh(new THREE.BoxGeometry(.57,actor.height,.63),new THREE.MeshBasicMaterial({visible:false}));
      target.position.set(x,y+actor.height/2,z+.08);
      target.name=actor.id;this.targets.push(target);this.group.add(target);
      this.footprints.push({minX:x-.46,maxX:x+.46,minZ:z-.40,maxZ:z+.57});
      this.labelPosition.add(new THREE.Vector3(x,y+actor.labelHeight,z));
    }
    this.labelPosition.divideScalar(definition.actors.length);
  }
  get ready(): boolean { return this.group.userData.characterStatus === "ready"; }
  loadVisuals(basePath: string): Promise<void> { return this.loading ??= this.load(basePath); }
  private async load(basePath: string): Promise<void> {
    let model: THREE.Group | undefined;
    try {
      const {asset,actors} = definitions[this.key];
      model=(await new GLTFLoader().loadAsync(`${basePath}models/${asset}.glb`)).scene;
      await loadBakedRoomLighting(model,basePath,{lightMap:`${asset}-lightmap.png`,environment:`${asset}-environment.png`,preserveVertexColors:true});
      for (const actor of actors) {
        const object=model.getObjectByName(`${actor.id}_head`);
        if(object)this.heads.push({object,yaw:object.rotation.y});
      }
      this.group.add(model);this.group.userData.characterStatus="ready";
    } catch(error) {
      model?.traverse(object=>{
        if(object instanceof THREE.Mesh){object.geometry.dispose();for(const material of Array.isArray(object.material)?object.material:[object.material])material.dispose();}
      });
      this.group.userData.characterStatus="unavailable";
      console.warn(`${this.key} figures could not load; existing scene interactions remain available.`,error);
    }
  }
  pick(raycaster: THREE.Raycaster): THREE.Intersection | undefined {
    return this.ready ? raycaster.intersectObjects(this.targets,false)[0] : undefined;
  }
  owns(object: THREE.Object3D): boolean { return this.ready && this.targets.includes(object as THREE.Mesh); }
  blocks(point: THREE.Vector3): boolean { return this.ready && this.footprints.some(rect=>inRectangle(point,rect)); }
  blocksPath(from: THREE.Vector3,to: THREE.Vector3): boolean {
    return this.ready && this.footprints.some(rect=>{
      if(inRectangle(from,rect)) {
        // A figure finishing its load must not trap a visitor already at its feet.
        const cx=(rect.minX+rect.maxX)/2,cz=(rect.minZ+rect.maxZ)/2;
        return inRectangle(to,rect) && Math.hypot(to.x-cx,to.z-cz)<=Math.hypot(from.x-cx,from.z-cz);
      }
      return crossesRectangle(from,to,rect);
    });
  }
  update(time: number,reducedMotion: boolean): void {
    this.heads.forEach(({object,yaw},index)=>{object.rotation.y=yaw+(reducedMotion?0:Math.sin(time*.31+index*2.1)*.009);});
  }
}
