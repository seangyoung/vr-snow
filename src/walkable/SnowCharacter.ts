import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { loadBakedRoomLighting } from "./BakedRoomLighting";

/** An interpretive seated figure, with a stable selection proxy independent of animation. */
export class SnowCharacter {
  readonly group = new THREE.Group();
  readonly target = new THREE.Mesh(new THREE.BoxGeometry(.6,1.35,.70),new THREE.MeshBasicMaterial({visible:false}));
  private loading?: Promise<void>;
  private head?: THREE.Object3D;
  private upper?: THREE.Object3D;
  private headYaw = 0;
  private upperY = 0;
  constructor() {
    this.group.name="Seated John Snow";
    this.target.position.set(-.65,.96,-2.15);
    this.group.add(this.target);
  }
  loadVisuals(basePath: string): Promise<void> {
    return this.loading ??= this.load(basePath);
  }
  private async load(basePath: string): Promise<void> {
    try {
      const gltf=await new GLTFLoader().loadAsync(`${basePath}models/snow-character.glb`);
      // Do not display an unlit figure over the room if its lighting is unavailable.
      try {
        await loadBakedRoomLighting(gltf.scene,basePath,{
          lightMap:"snow-character-lightmap.png",environment:"snow-character-environment.png", preserveVertexColors:true,
        });
      } catch(error) {
        gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
        throw error;
      }
      this.head=gltf.scene.getObjectByName("Snow_head");
      this.upper=gltf.scene.getObjectByName("Snow_upper");
      this.headYaw=this.head?.rotation.y??0;this.upperY=this.upper?.position.y??0;
      this.group.add(gltf.scene);this.group.userData.characterStatus="ready";
    } catch(error) {
      this.group.userData.characterStatus="unavailable";
      console.warn("Snow's figure could not load; the desk conversation remains available.",error);
    }
  }
  update(seconds: number, reducedMotion=false): void {
    if(!this.group.visible)return;
    // Tiny breathing and a slow head movement, not lip-sync or simulated speech.
    if(this.upper)this.upper.position.y=this.upperY+(reducedMotion?0:Math.sin(seconds*1.3)*.0015);
    if(this.head)this.head.rotation.y=this.headYaw+(reducedMotion?0:Math.sin(seconds*.37)*.014);
  }
}
