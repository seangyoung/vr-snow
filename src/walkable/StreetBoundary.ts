import * as THREE from 'three';

/** Shared with street collision checks; this is a story boundary, not the XR safety boundary. */
export const streetBounds = { minX:-13, maxX:15, minZ:-7.85, maxZ:13 };
type Contact = { point:THREE.Vector3; normal:THREE.Vector3; edge:string };
export function streetBoundaryContact(from:THREE.Vector3,to:THREE.Vector3):Contact|undefined {
  if(![from.x,from.z,to.x,to.z].every(Number.isFinite) || from.distanceToSquared(to)>1)return;
  const b=streetBounds;
  const edges=[
    {axis:'x' as const,value:b.minX,sign:-1,edge:'west'},
    {axis:'x' as const,value:b.maxX,sign:1,edge:'east'},
    {axis:'z' as const,value:b.minZ,sign:-1,edge:'north'},
    {axis:'z' as const,value:b.maxZ,sign:1,edge:'south'},
  ];
  for(const {axis,value,sign,edge} of edges) {
    if((to[axis]-from[axis])*sign<=.00001 || (to[axis]-value)*sign<0 || Math.abs(from[axis]-value)>.3)continue;
    const point=to.clone();point[axis]=value;point.y=0;
    // South of Broad Street, only the Poland Street opening is walkable.
    if((axis==='x' && point.z>2.6) || (edge==='south' && (point.x<.4 || point.x>8)))continue;
    const normal=new THREE.Vector3();normal[axis]=sign;
    return {point,normal,edge};
  }
}

/** A quiet, world-anchored cue. Never moves the camera or captures input. */
export class StreetBoundary {
  readonly group=new THREE.Group();
  private readonly bandMaterial=new THREE.MeshBasicMaterial({color:'#dbbb7a',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
  private readonly band=new THREE.Mesh(new THREE.PlaneGeometry(3.6,.55),this.bandMaterial);
  private readonly lineMaterial=new THREE.MeshBasicMaterial({color:'#ebce93',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
  private readonly line=new THREE.Mesh(new THREE.PlaneGeometry(3.6,.045),this.lineMaterial);
  private readonly labelMaterial=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthTest:false,depthWrite:false});
  private readonly label=new THREE.Mesh(new THREE.PlaneGeometry(1.45,.305),this.labelMaterial);
  private contact?:Contact;
  private previous?:THREE.Vector3;
  private readonly heading=new THREE.Vector3();
  private placeLabel=false;
  private remaining=0;
  private opacity=0;
  constructor() {
    this.group.name='Broad Street inquiry boundary';this.group.visible=false;
    this.label.renderOrder=1000;this.group.add(this.band,this.line,this.label);
    // Pure geometry and lifecycle checks also run without a DOM.
    if(typeof document!=='undefined') {
      const canvas=document.createElement('canvas');canvas.width=950;canvas.height=200;
      const ctx=canvas.getContext('2d');
      if(ctx) {
        ctx.fillStyle='#222c2b';ctx.beginPath();ctx.roundRect(2,2,946,196,22);ctx.fill();
        ctx.strokeStyle='#d6b57b';ctx.lineWidth=3;ctx.stroke();ctx.textAlign='center';
        ctx.fillStyle='#f6e7cb';ctx.font='600 48px Arial';ctx.fillText('Turn back',475,76);
        ctx.fillStyle='#f3f0e8';ctx.font='36px Arial';ctx.fillText('Return toward the Broad Street pump.',475,143);
        const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;this.labelMaterial.map=texture;
      }
    }
    // This decoration must never intercept a ray, travel target or portable item.
    this.group.traverse(object=>object.raycast=()=>{});
  }
  blocked(from:THREE.Vector3,to:THREE.Vector3):void {
    const contact=streetBoundaryContact(from,to);if(!contact)return;
    if(!this.contact || this.contact.edge!==contact.edge || !this.group.visible) {
      this.contact=contact;
      this.band.position.copy(contact.point).add(new THREE.Vector3(0,.3,0));
      this.band.rotation.y=Math.atan2(contact.normal.x,contact.normal.z);
      this.line.position.copy(contact.point).add(new THREE.Vector3(0,.045,0));this.line.rotation.copy(this.band.rotation);
      this.placeLabel=true;
    }
    this.remaining=2.5;
  }
  update(position:THREE.Vector3,forward:THREE.Vector3,elapsed:number,enabled:boolean,reducedMotion=false):void {
    if(!enabled){this.reset();return;}
    if(this.previous)this.blocked(this.previous,position); // Also observe actual room-scale walking.
    this.previous=position.clone();
    if(this.placeLabel && this.contact) {
      // Visible even when the player strafes or backs into an edge; anchor once,
      // rather than following their head throughout the notification.
      this.heading.set(forward.x,0,forward.z);
      if(this.heading.lengthSq()<.01)this.heading.copy(this.contact.normal);
      this.heading.normalize();
      this.label.position.copy(position).addScaledVector(this.heading,2);this.label.position.y=position.y-.4;
      this.label.lookAt(position.x,this.label.position.y,position.z);this.placeLabel=false;
    }
    const dt=Number.isFinite(elapsed)?THREE.MathUtils.clamp(elapsed,0,.05):0;
    this.remaining=Math.max(0,this.remaining-dt);
    if(this.contact && (forward.dot(this.heading)<.4 || Math.abs(position.clone().sub(this.contact.point).dot(this.contact.normal))>1))this.remaining=0;
    const target=this.remaining>0?1:0;
    this.opacity=reducedMotion?target:THREE.MathUtils.clamp(this.opacity+(target?dt*4:-dt*2),0,1);
    this.group.visible=this.opacity>0;
    this.labelMaterial.opacity=this.opacity*.96;this.bandMaterial.opacity=this.opacity*.12;this.lineMaterial.opacity=this.opacity*.7;
    if(!this.group.visible)this.contact=undefined;
  }
  reset():void {this.contact=undefined;this.previous=undefined;this.placeLabel=false;this.remaining=0;this.opacity=0;this.group.visible=false;}
}
