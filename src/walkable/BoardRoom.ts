import layout from "./board-layout.json" with { type: "json" };
import { FurnishedRoom, roomArea } from "./FurnishedRoom";
import * as THREE from 'three';
import { InspectableProp } from './InspectableProps';
export const boardArea = roomArea(layout);
/** The Board room and unnamed officials are an interpretation, not a surveyed reconstruction. */
export class BoardRoom extends FurnishedRoom {
  private boardAssets?: Promise<void>;
  constructor() {
    super({ name: "Parish Board room", asset: "board-room.glb", layout, area: boardArea,
      characters: "board", hotspot: "board-hearing", interactionFurniture: "meeting-table",
      bakedLighting: { lightMap: "board-room-lightmap.png", environment: "board-room-environment.png" } });
  }

  override loadVisuals(basePath: string): Promise<void> {
    return this.boardAssets ??= this.loadBoardAssets(basePath);
  }

  private async loadBoardAssets(basePath: string): Promise<void> {
    const [, map] = await Promise.allSettled([
      super.loadVisuals(basePath),
      new THREE.TextureLoader().loadAsync(`${basePath}maps/board-table-map.png`),
    ]);
    if(map.status!=='fulfilled') {
      this.group.userData.mapStatus='fallback';
      console.warn('Board map print could not load; retaining the schematic sheet.',map.reason);
      return;
    }
    const texture=map.value;
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy=4;
    let prop=this.props.find(prop=>prop.name==='Street map');
    if(prop) {
      // Permanently hide its old batched grid markings, including after pickup/return.
      prop.activate();
      prop.setBatchVisibility(()=>{prop!.group.visible=true;});
      for(const child of [...prop.group.children]) {
        prop.group.remove(child);
        if(child instanceof THREE.Mesh)child.geometry.dispose();
      }
    } else {
      const group=new THREE.Group();group.position.set(0,.88,-.5);
      this.group.add(group);prop=new InspectableProp(group,'Street map');this.props.push(prop);
    }
    prop.group.name="Snow's Board map";
    const paper=new THREE.Mesh(new THREE.BoxGeometry(1.4,.008,1.9),new THREE.MeshBasicMaterial({color:'#b7a780'}));
    const print=new THREE.Mesh(new THREE.PlaneGeometry(1.4,1.9),new THREE.MeshBasicMaterial({map:texture,color:'#ddd4bf'}));
    print.name='Snow map print';print.rotation.x=-Math.PI/2;print.position.y=.0045;
    prop.group.add(paper,print);
    prop.group.traverse(object=>{object.userData.inspectableProp=prop;});
    this.group.userData.mapStatus='ready';
  }
}
