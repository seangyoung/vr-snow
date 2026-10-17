import * as THREE from 'three';

/** One presentation timeline for desktop and both XR eyes; narrative changes only at black. */
export class DayTransition {
  readonly material=new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0,depthTest:false,depthWrite:false,side:THREE.BackSide,toneMapped:false,fog:false});
  readonly veil=new THREE.Mesh(new THREE.SphereGeometry(.4,16,12),this.material);
  private readonly overlay?:HTMLDivElement;
  private phase:'idle'|'out'|'black'|'hold'|'in'='idle';
  private elapsed=0;
  private reduced=false;
  private change?:()=>void;
  private finish?:()=>void;
  get active():boolean {return this.phase!=='idle';}
  constructor(camera:THREE.Camera) {
    this.veil.name='Day transition';this.veil.visible=false;this.veil.frustumCulled=false;
    this.veil.renderOrder=1000000;this.veil.raycast=()=>{};camera.add(this.veil);
    if(typeof document!=='undefined') {
      this.overlay=document.createElement('div');this.overlay.className='day-transition';this.overlay.hidden=true;
      this.overlay.setAttribute('aria-hidden','true');document.body.append(this.overlay);
    }
  }
  start(change:()=>void,finish:()=>void,reduced=false):boolean {
    if(this.active)return false;
    this.change=change;this.finish=finish;this.reduced=reduced;this.elapsed=0;this.phase='out';
    if(this.overlay){this.overlay.hidden=false;this.overlay.style.opacity='0';document.body.dataset.dayTransition='true';}
    return true;
  }
  update(delta:number,xr=false):void {
    if(!this.active)return;
    const dt=Number.isFinite(delta)?THREE.MathUtils.clamp(delta,0,.1):0;
    this.elapsed+=dt;
    if(this.phase==='out') {
      this.material.opacity=Math.min(1,this.elapsed/(this.reduced?.2:.55));
      // Leave one fully black frame on screen before changing the day/UI.
      if(this.material.opacity===1){this.phase='black';this.elapsed=0;}
    } else if(this.phase==='black') {
      const change=this.change;this.change=undefined;change?.();this.phase='hold';this.elapsed=0;
    } else if(this.phase==='hold') {
      if(this.elapsed>=(this.reduced?.15:.25)){this.phase='in';this.elapsed=0;}
    } else if(this.phase==='in') {
      this.material.opacity=Math.max(0,1-this.elapsed/(this.reduced?.2:.65));
      if(this.material.opacity===0)this.phase='idle';
    }
    this.veil.visible=this.active&&xr;
    if(this.overlay){this.overlay.style.opacity=String(this.material.opacity);this.overlay.hidden=!this.active||xr;}
    if(!this.active) {
      if(this.overlay)delete document.body.dataset.dayTransition;
      const finish=this.finish;this.finish=undefined;finish?.();
    }
  }
}
