import { InspectableProp } from "./InspectableProps";
import { SnowCharacter } from "./SnowCharacter";
import * as THREE from "three";
import layout from "./office-layout.json" with { type: "json" };
import { FurnishedRoom, roomArea } from "./FurnishedRoom";

export const officeArea = roomArea(layout);
export const officeSpawn = new THREE.Vector3(...layout.spawn);
export const officeDeskTarget = new THREE.Vector3(...layout.deskTarget);

export class SnowOffice extends FurnishedRoom {
  readonly character = new SnowCharacter();
  private characterVisuals?: Promise<void>;
  constructor() {
    super({name: "Snow's walkable office", asset: "snow-office.glb", layout, area: officeArea,
      rayHeights: {cabinet:1.32}, interactionFurniture: "desk", hotspot: "john-snow", daylight: "#f4eee2", fill: 2.5,
      bakedLighting: {lightMap: "snow-office-lightmap.png", environment: "snow-office-environment.png"}});
    this.group.add(this.character.group);
  }
  override loadVisuals(basePath: string): Promise<void> {
    return this.characterVisuals ??= this.loadOfficeAssets(basePath);
  }
  private async loadOfficeAssets(basePath: string): Promise<void> {
    const [, , image] = await Promise.allSettled([
      super.loadVisuals(basePath), this.character.loadVisuals(basePath),
      new THREE.TextureLoader().loadAsync(`${basePath}maps/south-london-water-supply.jpg`),
    ]);
    if(image.status!=='fulfilled'){
      this.group.userData.waterMapStatus='unavailable';
      console.warn('South London map could not load; retaining the existing desk.',image.reason);return;
    }
    const texture=image.value;texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
    // Move complete portable props, including their return poses. Keep their old batch triangles hidden.
    const move=(name:string,position:THREE.Vector3,yaw=0)=>{
      const prop=this.props.find(p=>p.name===name);if(!prop)return;
      prop.activate();prop.setBatchVisibility(()=>{prop.group.visible=true;});
      prop.group.position.copy(position);prop.group.rotation.y=yaw;
      prop.home.copy(prop.group.position);prop.homeRotation.copy(prop.group.quaternion);
    };
    move('Open case ledger',new THREE.Vector3(.08,.873,-1.32),Math.PI/2);
    move('Clinical notes',new THREE.Vector3(-.03,.835,-.81));
    move('Pen',new THREE.Vector3(-1.40,.835,-1.57));
    const group=new THREE.Group();group.name='South London water-supply map';
    group.position.set(-.78,.841,-1.18);
    const width=.86,depth=width*1670/2048;
    const paper=new THREE.Mesh(new THREE.BoxGeometry(width,.004,depth),new THREE.MeshBasicMaterial({color:'#caba94'}));
    const print=new THREE.Mesh(new THREE.PlaneGeometry(width,depth),new THREE.MeshBasicMaterial({map:texture,color:'#eee4cd'}));
    print.name='South London map print';print.rotation.x=-Math.PI/2;print.position.y=.0025;
    group.add(paper,print);this.group.add(group);
    const prop=new InspectableProp(group,'South London water-supply map');
    group.traverse(object=>{object.userData.inspectableProp=prop;});this.props.push(prop);
    this.group.userData.waterMapStatus='ready';
  }
  override pick(raycaster: THREE.Raycaster): THREE.Intersection | undefined {
    this.deskPrompt.layers.mask=this.character.group.userData.characterStatus==="ready"?0:1;
    const furniture=super.pick(raycaster);
    if(!this.group.visible || this.character.group.userData.characterStatus!=="ready")return furniture;
    this.group.updateMatrixWorld(true);
    const person=raycaster.intersectObject(this.character.target,false)[0];
    return person && (!furniture || person.distance<furniture.distance)?person:furniture;
  }
  override hotspotFor(object: THREE.Object3D): string | undefined {
    return object===this.character.target?"john-snow":super.hotspotFor(object);
  }
}
