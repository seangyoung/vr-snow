import * as THREE from 'three';
import { grabReach, propFor, type InspectableProp } from './InspectableProps';

type TargetBounds = {expanded:THREE.Box3; sticky:THREE.Box3; samples:THREE.Vector3[]; small:boolean};
/** Invisible hit assistance, confirmed against visible geometry rather than collision boxes. */
export class PropTargeting {
  private readonly bounds = new WeakMap<InspectableProp, TargetBounds>();
  private readonly point = new THREE.Vector3();
  private readonly check = new THREE.Raycaster();
  private readonly previous = new WeakMap<THREE.Raycaster, InspectableProp>();
  private cache(prop:InspectableProp):TargetBounds {
    const box=new THREE.Box3().setFromObject(prop.group),size=box.getSize(new THREE.Vector3());
    const small=!box.isEmpty() && Math.max(size.x,size.y,size.z)<=.5;
    const samples:THREE.Vector3[]=[];
    if(small)prop.group.traverse(object=>{
      if(!(object instanceof THREE.Mesh))return;
      const geometry=object.geometry,position=geometry.getAttribute('position'),index=geometry.index;
      const triangles=Math.floor((index?.count??position.count)/3);
      // Actual triangle centroids work on tubes, rings and open cases whose box
      // center is empty. Sampling is cached; only nearby candidate items are tested.
      for(let t=0;t<triangles;t+=Math.max(1,Math.ceil(triangles/16))) {
        const center=new THREE.Vector3();
        for(let corner=0;corner<3;corner++)center.add(new THREE.Vector3().fromBufferAttribute(position,index?index.getX(t*3+corner):t*3+corner));
        samples.push(center.multiplyScalar(1/3).applyMatrix4(object.matrixWorld));
      }
    });
    const result={expanded:box.clone().expandByScalar(.035),sticky:box.clone().expandByScalar(.045),samples,small};
    this.bounds.set(prop,result);return result;
  }
  pick(ray: THREE.Raycaster, direct: THREE.Intersection | undefined, props: InspectableProp[],
      pickWorld: (ray: THREE.Raycaster) => THREE.Intersection | undefined): THREE.Intersection | undefined {
    if (direct && propFor(direct.object)) { this.previous.set(ray, propFor(direct.object)!); return direct; }
    const previous = this.previous.get(ray);
    let best: {hit: THREE.Intersection; prop: InspectableProp; score: number} | undefined;
    for (const prop of props) {
      if (prop.held || prop.returning) continue;
      const bounds=this.bounds.get(prop)??this.cache(prop);
      if (!bounds.small) continue;
      const point=ray.ray.intersectBox(previous===prop?bounds.sticky:bounds.expanded,this.point);
      if (!point || point.distanceTo(ray.ray.origin)>grabReach) continue;
      // Coarse furniture proxies can enclose props. Do not reject against that
      // proxy; instead cast toward real surfaces and let the room check its art.
      const candidates=bounds.samples.map(p=>({p,score:ray.ray.distanceSqToPoint(p)})).sort((a,b)=>a.score-b.score).slice(0,6);
      for(const candidate of candidates) {
        const check=this.check;
        check.ray.origin.copy(ray.ray.origin);check.ray.direction.copy(candidate.p).sub(ray.ray.origin).normalize();
        const surface=check.intersectObject(prop.group,true)[0];
        if(!surface || surface.distance>grabReach)continue;
        const obstruction=pickWorld(check);
        if(obstruction && obstruction.distance<surface.distance-.005)continue;
        const miss=ray.ray.distanceToPoint(surface.point);
        if(miss>(previous===prop ? .045 : .035))continue;
        const score=miss-(previous===prop ? .012 : 0);
        if(!best || score<best.score)best={prop,score,hit:surface};
        break;
      }
    }
    if (best) { this.previous.set(ray, best.prop); return best.hit; }
    this.previous.delete(ray); return direct;
  }
}
