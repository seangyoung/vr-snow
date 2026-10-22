import { streetPlacement } from '../simulation/streetPopulation';
import type { InquiryDay } from '../simulation/campaign';
import * as THREE from "three";
import { CharacterIdle } from "./CharacterIdle";
import { createStreetNewspaper } from "./StreetNewspaper";
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
  private day: InquiryDay = 1;
  private model?: THREE.Group;
  private newspaper?: THREE.Group;
  private patientCoverlet?: THREE.Object3D;
  private patientCoverletY = 0;
  private idles: CharacterIdle[] = [];
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
      this.model=model;
      if(this.key==='household') {
        // This family member rests in the bed; the seated relative remains the interview target.
        // A missing supplemental asset must not disable the witness or the investigation.
        try {
          const patient=(await new GLTFLoader().loadAsync(`${basePath}models/household-patient.glb`)).scene;
          await loadBakedRoomLighting(patient,basePath,{lightMap:'household-patient-lightmap.png',environment:'household-patient-environment.png'});
          this.patientCoverlet=patient.getObjectByName('patient_breathing_coverlet');
          this.patientCoverletY=this.patientCoverlet?.position.y ?? 0;
          model.add(patient);
        } catch(error) { console.warn('Resting household member could not load.',error); }
      }
      if(this.key==='street') {
        const reader=model.getObjectByName('resident-west_root');
        if(reader) { this.newspaper=createStreetNewspaper();reader.add(this.newspaper); }
      }
      this.setDay(this.day);
      for (const [index, actor] of actors.entries()) {
        const root=model.getObjectByName(`${actor.id}_root`);
        if(root)this.idles.push(new CharacterIdle(root,index*2.17+actor.id.length*.7,actor.pose!=="standing"));
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
  setDay(day: InquiryDay): void {
    this.day=day;
    if(this.key!=="street")return;
    if(this.newspaper)this.newspaper.visible=day===3;
    this.footprints.length=0;
    const footprint=(x:number,z:number)=>this.footprints.push({minX:x-.46,maxX:x+.46,minZ:z-.40,maxZ:z+.57});
    for(const actor of definitions.street.actors) {
      const placement=streetPlacement(day,actor.id)!;const [x,y,z]=placement.position;
      const target=this.targets.find(t=>t.name===actor.id)!;
      target.position.set(x,y+actor.height/2,z+.08);footprint(x,z);
      const root=this.model?.getObjectByName(`${actor.id}_root`);
      if(root) { root.position.set(x,y,z);root.rotation.set(0,placement.yaw,0); }
    }
    this.group.updateMatrixWorld(true);
  }
  pick(raycaster: THREE.Raycaster): THREE.Intersection | undefined {
    return this.group.visible && this.ready ? raycaster.intersectObjects(this.targets,false)[0] : undefined;
  }
  owns(object: THREE.Object3D): boolean { return this.group.visible && this.ready && this.targets.includes(object as THREE.Mesh); }
  blocks(point: THREE.Vector3): boolean { return this.group.visible && this.ready && this.footprints.some(rect=>inRectangle(point,rect)); }
  blocksPath(from: THREE.Vector3,to: THREE.Vector3): boolean {
    return this.group.visible && this.ready && this.footprints.some(rect=>{
      if(inRectangle(from,rect)) {
        // A figure finishing its load must not trap a visitor already at its feet.
        const cx=(rect.minX+rect.maxX)/2,cz=(rect.minZ+rect.maxZ)/2;
        return inRectangle(to,rect) && Math.hypot(to.x-cx,to.z-cz)<=Math.hypot(from.x-cx,from.z-cz);
      }
      return crossesRectangle(from,to,rect);
    });
  }
  update(time: number,reducedMotion: boolean): void {
    this.idles.forEach(idle=>idle.update(time,reducedMotion));
    if(this.patientCoverlet)this.patientCoverlet.position.y=this.patientCoverletY+(reducedMotion?0:Math.sin(time*1.15)*.0015);
  }
}
