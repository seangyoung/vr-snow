import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { XRControllerModelFactory, type XRControllerModel } from "three/addons/webxr/XRControllerModelFactory.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { controllerButtons } from "./VrInput";

type Component = { rootNodeName: string; visualResponses?: Record<string,{valueNodeName:string}>; gamepadIndices: {button?: number; xAxis?: number; yAxis?: number} };
export function controllerComponentNode(model:THREE.Object3D,component:Component):THREE.Object3D|undefined {
  // Some registry assets omit the nominal component root but expose its animated node.
  const names=[component.rootNodeName,...Object.values(component.visualResponses??{}).map(r=>r.valueNodeName)];
  return names.map(name=>model.getObjectByName(name)).find(node=>node&&!new THREE.Box3().setFromObject(node).isEmpty());
}
type MotionModel = { components: Record<string,Component> };
export type ControllerHelpContext = { held: boolean; holdingThis: boolean; panel: boolean; paged: boolean; walking: boolean; map: boolean; turning?: boolean };
export type ControllerLabel = { button: number; text: string; enabled: boolean };

/** Labels use the same bindings as input handling, never guessed face-button positions. */
export function controllerLabelSpecs(source: XRInputSource, context: ControllerHelpContext): ControllerLabel[] {
  if(source.hand || source.targetRayMode!=="tracked-pointer" || source.gamepad?.mapping!=="xr-standard")return [];
  const left=source.handedness==="left", bindings=controllerButtons(source),labels:ControllerLabel[]=[];
  if(bindings.secondary)labels.push({button:bindings.secondary.index,text:`${bindings.secondary.label} · ${left?"Notebook":"Settings"}`,enabled:true});
  if(bindings.primary)labels.push({button:bindings.primary.index,text:`${bindings.primary.label} · ${left?"Map":"Stand / crouch"}${left&&!context.map?" (locked)":""}`,enabled:!left||context.map});
  const stick=source.gamepad.axes.length>=4 && source.gamepad.buttons.length>3;
  if(stick) {
    const move=left?(context.panel?"Paused":context.walking?"Walk":"Walk off"):(context.held?"Rotate item":context.turning===false?"Paused":"Turn");
    const click=context.held?"Return item for menu":context.panel&&context.paged?(left?"Click · Previous page":"Click · Next page"):"Click · Menu";
    labels.push({button:3,text:`Stick · ${move}\n${click}`,enabled:true});
  }
  if(source.gamepad.buttons.length)labels.push({button:0,text:"Trigger · Select",enabled:true});
  if(source.gamepad.buttons.length>1)labels.push({button:1,text:context.holdingThis?"Release grip · Return":context.held?"Grip · Occupied":"Grip · Grab",enabled:!context.panel&&(!context.held||context.holdingThis)});
  return labels;
}

/** Head direction, not eye tracking; the user can raise a controller and look at it. */
export function controllerHelpInView(cameraPosition: THREE.Vector3, forward: THREE.Vector3, gripPosition: THREE.Vector3): boolean {
  const direction=gripPosition.clone().sub(cameraPosition),distance=direction.length();
  return distance>=.18 && distance<=1.15 && direction.multiplyScalar(1/distance).dot(forward)>.72;
}

// The upstream factory throws from its GLB error callback. Keep the ray and simple
// grip visible if an asset cannot load, without an unhandled exception in gameplay.
class ControllerLoader extends GLTFLoader {
  override load(url:string,onLoad:(gltf:GLTF)=>void,onProgress?:((event:ProgressEvent)=>void),_onError?:((error:unknown)=>void)):void {
    super.load(url,onLoad,onProgress,()=>console.warn("Controller model unavailable; using the simple grip."));
  }
}
export function createControllerModelFactory(basePath:string,renderer?:THREE.WebGLRenderer):XRControllerModelFactory {
  let environment:THREE.Texture|undefined;
  if(renderer) {
    const generator=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
    environment=generator.fromScene(room,.04).texture;room.dispose();generator.dispose();
  }
  return new XRControllerModelFactory(new ControllerLoader(),model=>{
    // UI hardware must remain readable in the rooms whose lighting is baked.
    // Preserve the original texture/colors without adding lights to the environment.
    model.traverse(object=>{
      if(!(object instanceof THREE.Mesh))return;
      const convert=(m:THREE.MeshStandardMaterial)=>{
        if(environment){const material=m.clone();material.envMap=environment;material.envMapIntensity=1;return material;}
        return new THREE.MeshBasicMaterial({color:m.color,map:m.map,vertexColors:m.vertexColors,
          transparent:m.transparent,opacity:m.opacity,alphaTest:m.alphaTest,side:m.side,toneMapped:false});
      };
      object.material=Array.isArray(object.material)?object.material.map(m=>convert(m as THREE.MeshStandardMaterial)):convert(object.material as THREE.MeshStandardMaterial);
      object.castShadow=false;object.receiveShadow=false;
    });
  }).setPath(`${basePath}controllers`);
}

type Callout = { button:number; anchor:THREE.Vector3; sprite:THREE.Sprite; line:THREE.Line; text:string };
export class ControllerVisuals {
  private source?:XRInputSource;
  private proxy?:THREE.Group;
  private model?:XRControllerModel;
  private readonly fallback:THREE.Mesh;
  private readonly labels=new THREE.Group();
  private callouts:Callout[]=[];
  private key="";
  private dwell=0;
  private opacity=0;
  private readonly position=new THREE.Vector3();
  private readonly eye=new THREE.Vector3();
  private readonly forward=new THREE.Vector3();
  private readonly right=new THREE.Vector3();
  private readonly up=new THREE.Vector3();
  private readonly orientation=new THREE.Quaternion();
  constructor(readonly grip:THREE.XRGripSpace,scene:THREE.Scene,private readonly factory:XRControllerModelFactory) {
    this.fallback=new THREE.Mesh(new THREE.CapsuleGeometry(.018,.075,4,8),new THREE.MeshBasicMaterial({color:0x9caaa8}));
    this.fallback.position.set(0,-.025,.02);this.fallback.visible=false;grip.add(this.fallback);
    this.labels.name="Controller button labels";this.labels.visible=false;scene.add(this.labels);
    grip.addEventListener("connected",event=>this.connect(event.data));
    grip.addEventListener("disconnected",()=>this.disconnect());
  }
  get depthRoots():THREE.Object3D[]{return [this.grip,this.labels];}
  connect(source:XRInputSource):void {
    this.disconnect();
    if(source.hand||source.targetRayMode!=="tracked-pointer"||!source.gamepad)return;
    this.source=source;this.fallback.visible=true;
    // A fresh event proxy/model per connection isolates late asynchronous loads
    // from a disconnected controller or a different device using the same slot.
    this.proxy=new THREE.Group();this.model=this.factory.createControllerModel(this.proxy);this.grip.add(this.model);
    this.proxy.dispatchEvent({type:"connected",data:source} as never);
  }
  disconnect():void {
    this.proxy?.dispatchEvent({type:"disconnected"} as never);
    if(this.model) {
      this.grip.remove(this.model);
      this.model.traverse(o=>{if(o instanceof THREE.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});
    }
    this.model=undefined;this.proxy=undefined;this.source=undefined;this.fallback.visible=false;
    this.clearLabels();this.dwell=0;this.opacity=0;
  }
  private clearLabels():void {
    for(const c of this.callouts){c.sprite.material.map?.dispose();c.sprite.material.dispose();c.line.geometry.dispose();(c.line.material as THREE.Material).dispose();}
    this.callouts=[];this.labels.clear();this.labels.visible=false;this.key="";
  }
  update(camera:THREE.Camera,delta:number,active:boolean,context:ControllerHelpContext):void {
    const model=this.model,source=this.source,motion=model?.motionController as MotionModel|undefined;
    const ready=!!model?.children.length;
    this.fallback.visible=active&&!!source&&!ready;
    if(model)model.visible=active;
    if(!source||!model||!ready||!motion||!active||!this.grip.visible){this.labels.visible=false;this.dwell=0;this.opacity=0;return;}
    const specs=controllerLabelSpecs(source,context);
    const key=specs.map(s=>`${s.button}:${s.text}:${s.enabled}`).join("|");
    if(key!==this.key) {
      this.clearLabels();this.key=key;model.updateWorldMatrix(true,true);
      for(const spec of specs) {
        const component=Object.values(motion.components).find(c=>c.gamepadIndices.button===spec.button);
        const node=component&&controllerComponentNode(model,component);if(!node)continue;
        const bounds=new THREE.Box3().setFromObject(node);if(bounds.isEmpty())continue;
        const anchor=model.worldToLocal(bounds.getCenter(new THREE.Vector3()));
        const sprite=labelSprite(spec.text,spec.enabled);
        const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),
          new THREE.LineBasicMaterial({color:0xc8d7d0,transparent:true,depthTest:false,depthWrite:false}));
        line.renderOrder=1001;this.labels.add(line,sprite);this.callouts.push({button:spec.button,anchor,sprite,line,text:spec.text});
      }
    }
    camera.getWorldPosition(this.eye);camera.getWorldDirection(this.forward);this.grip.getWorldPosition(this.position);
    const looking=controllerHelpInView(this.eye,this.forward,this.position);
    const dt=Math.min(.05,Math.max(0,delta));this.dwell=looking?this.dwell+dt:0;
    const target=this.dwell>.3?1:0;this.opacity=THREE.MathUtils.damp(this.opacity,target,14,dt);
    this.labels.visible=this.opacity>.02;if(!this.labels.visible)return;
    camera.getWorldQuaternion(this.orientation);
    this.right.set(1,0,0).applyQuaternion(this.orientation);this.up.set(0,1,0).applyQuaternion(this.orientation);
    const side=source.handedness==="left"?-1:1;
    // Follow each real button anchor, with only enough vertical separation to
    // keep neighbouring labels readable when the controller turns in the hand.
    const placements=this.callouts.map(callout=>{
      const start=model.localToWorld(callout.anchor.clone());
      return {callout,start,height:start.dot(this.up),packed:0};
    }).sort((a,b)=>b.height-a.height);
    let previous=Infinity;
    for(const item of placements){item.packed=Math.min(item.height,previous-.02525);previous=item.packed;}
    const shift=placements.length?placements.reduce((sum,item)=>sum+item.height-item.packed,0)/placements.length:0;
    placements.forEach(({callout,start,height,packed})=>{
      const {sprite,line}=callout;
      sprite.position.copy(start).addScaledVector(this.right,side*(.008+sprite.scale.x/2))
        .addScaledVector(this.up,packed+shift-height).addScaledVector(this.forward,-.008);
      sprite.material.opacity=this.opacity;
      const pressed=source.gamepad?.buttons[callout.button]?.pressed;
      sprite.material.color.set(pressed?0xffdb8b:0xffffff);
      const attribute=line.geometry.getAttribute("position") as THREE.BufferAttribute;
      const end=sprite.position.clone().addScaledVector(this.right,-side*sprite.scale.x/2);
      attribute.setXYZ(0,start.x,start.y,start.z);attribute.setXYZ(1,end.x,end.y,end.z);attribute.needsUpdate=true;
      line.geometry.computeBoundingSphere();(line.material as THREE.LineBasicMaterial).opacity=this.opacity*.8;
    });
  }
}
function labelSprite(text:string,enabled:boolean):THREE.Sprite {
  const canvas=document.createElement("canvas");canvas.width=768;canvas.height=192;
  const ctx=canvas.getContext("2d")!;ctx.fillStyle="rgba(17,28,27,.96)";ctx.beginPath();ctx.roundRect(2,2,764,188,24);ctx.fill();
  ctx.strokeStyle=enabled?"#b4c8b9":"#73847b";ctx.lineWidth=3;ctx.stroke();ctx.fillStyle=enabled?"#f7f4e8":"#aeb7b1";
  ctx.textAlign="center";ctx.textBaseline="middle";
  const lines=text.split("\n");ctx.font="600 62px system-ui";
  lines.forEach((line,i)=>ctx.fillText(line,384,lines.length===1?96:54+i*84,720));
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));
  sprite.scale.set(.085,.02125,1);sprite.renderOrder=1002;return sprite;
}
