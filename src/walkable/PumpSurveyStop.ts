import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WalkableArea, type WalkableEnvironment } from './WalkableArea';
/** Compact interpretive endpoint, not a reconstruction of every intervening street. */
export class PumpSurveyStop implements WalkableEnvironment {
 readonly group=new THREE.Group();readonly spawn=new THREE.Vector3(0,0,2.7);
 readonly floor:THREE.Mesh;private solids:THREE.Mesh[]=[];
 private readonly area=new WalkableArea({minX:-4.6,maxX:4.6,minZ:-3.6,maxZ:3.6},[{minX:-.65,maxX:.65,minZ:-2.65,maxZ:-1.35}]);
 readonly canWalkBetween=this.area.canWalkBetween;
 private wallMaterial?:THREE.MeshStandardMaterial;private pavingMaterial?:THREE.MeshStandardMaterial;private visuals?:Promise<void>;
 loadVisuals(base:string):Promise<void>{return this.visuals??=Promise.all([
  ['stock-brick.jpg',this.wallMaterial],['flags.jpg',this.pavingMaterial]
 ].map(async([file,material])=>{try{const t=await new THREE.TextureLoader().loadAsync(`${base}textures/survey/${file}`);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;const m=material as THREE.MeshStandardMaterial;m.map=t;m.color.set('#ffffff');m.needsUpdate=true;}catch{ /* Retain usable plain materials if a texture is unavailable. */ }})).then(()=>{});}

 constructor(readonly key:'marlborough-pump'|'rupert-pump') {
  const wall=new THREE.MeshStandardMaterial({color:key==='marlborough-pump'?'#8b7864':'#827464',roughness:1});
  const iron=new THREE.MeshStandardMaterial({color:'#343d3b',roughness:.8});
  const paving=new THREE.MeshStandardMaterial({color:'#8c8c7c',roughness:1});
  this.wallMaterial=wall;this.pavingMaterial=paving;
  this.floor=new THREE.Mesh(new THREE.PlaneGeometry(10,8),paving);const floorUv=this.floor.geometry.attributes.uv;for(let i=0;i<floorUv.count;i++)floorUv.setXY(i,floorUv.getX(i)*5,floorUv.getY(i)*4);this.floor.rotation.x=-Math.PI/2;this.group.add(this.floor);
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material)=>{const geometry=new THREE.BoxGeometry(w,h,d);
   if(mat===wall){const uv=geometry.attributes.uv,normal=geometry.attributes.normal;for(let i=0;i<uv.count;i++){const nx=Math.abs(normal.getX(i)),ny=Math.abs(normal.getY(i));uv.setXY(i,uv.getX(i)*(nx>.5?d:w)/2,uv.getY(i)*(ny>.5?d:h)/2);}}
   const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);this.group.add(m);this.solids.push(m);return m;};
  box(0,2.8,-4.1,10,5.6,.2,wall);box(-5,2.8,0,.2,5.6,8,wall);box(5,2.8,0,.2,5.6,8,wall);
  for(const x of [-3.6,-1.8,1.8,3.6])for(const y of [1.6,3.7]){box(x,y,-3.94,.92,1.25,.08,iron);box(x,y,-3.88,.035,1.25,.03,paving);box(x,y,-3.88,.92,.035,.03,paving);}
  const trim=new THREE.MeshStandardMaterial({color:'#b1aa94',roughness:1});
  for(const x of [-3.6,-1.8,1.8,3.6])for(const y of [1.6,3.7]){box(x,y-.67,-3.84,1.08,.10,.24,trim);box(x,y+.67,-3.84,1.08,.12,.18,trim);}
  box(0,.22,-3.85,10,.44,.25,trim);box(0,5.4,-3.9,10,.18,.35,trim);
  box(-4.9,.17,0,.25,.34,8,trim);box(4.9,.17,0,.25,.34,8,trim);
  // Batch static architecture by material: hundreds of pavers should not mean
  // hundreds of draw calls on a standalone headset. Keep the pump selectable.
  const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
  for(const mesh of this.solids) {
    mesh.updateMatrix();mesh.geometry.applyMatrix4(mesh.matrix);
    const material=mesh.material as THREE.Material;
    batches.set(material,[...(batches.get(material)??[]),mesh.geometry]);this.group.remove(mesh);
  }
  this.solids=[];
  for(const [material,parts] of batches) {
    const mesh=new THREE.Mesh(mergeGeometries(parts)!,material);
    this.group.add(mesh);this.solids.push(mesh);parts.forEach(part=>part.dispose());
  }
  // A period-style cast-iron pump, interpreted rather than a documented replica.
  const profile=[[.19,0],[.19,.08],[.12,.14],[.11,.88],[.15,.92],[.12,1],[.17,1.08],[.17,1.65],[.20,1.69],[.17,1.77],[.17,1.92],[.21,1.96],[.17,2.03],[.06,2.13],[.07,2.19],[0,2.26]];
  const shaft=new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),20),iron);shaft.position.set(0,0,-2);this.group.add(shaft);this.solids.push(shaft);
  box(0,.025,-2,.65,.05,.65,trim);
  const tube=(points:number[][],radius:number)=>{const m=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(([x,y,z])=>new THREE.Vector3(x,y,z))),16,radius,8,false),iron);m.position.set(0,0,-2);this.group.add(m);this.solids.push(m);};
  tube([[0,1.3,.13],[0,1.31,.27],[0,1.27,.42],[0,1.16,.45]],.05);
  tube([[-.13,1.72,0],[-.3,1.73,0],[-.45,1.5,0],[-.5,1.1,0],[-.45,.85,.05]],.035);
  const contact=new THREE.Mesh(new THREE.CircleGeometry(.43,24),new THREE.MeshBasicMaterial({color:'#606255'}));contact.rotation.x=-Math.PI/2;contact.position.set(0,.006,-2);this.group.add(contact);
  this.group.add(new THREE.HemisphereLight('#dce3e5','#8d8879',2.5));const sun=new THREE.DirectionalLight('#e6e8e2',1.4);sun.position.set(-3,7,4);this.group.add(sun);
  this.group.visible=false;
 }
 pick(ray:THREE.Raycaster):THREE.Intersection|undefined {if(!this.group.visible)return;this.group.updateMatrixWorld(true);return ray.intersectObjects([this.floor,...this.solids],false)[0];}
 hotspotFor(object:THREE.Object3D):string|undefined {return this.solids.includes(object as THREE.Mesh) && Math.abs(object.position.x)<.6 && object.position.z===-2 ? `survey-${this.key}`:undefined;}
 canTeleport(hit:THREE.Intersection):boolean{return hit.object===this.floor&&this.area.isValidDestination(hit.point);}
}
