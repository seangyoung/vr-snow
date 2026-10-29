import * as THREE from 'three';
import { grabReach, propFor, type InspectableProp } from './InspectableProps';

/** Small, occlusion-checked hit assistance. Direct hits always take precedence. */
export class PropTargeting {
  private readonly bounds = new WeakMap<InspectableProp, {box:THREE.Box3; expanded:THREE.Box3; sticky:THREE.Box3; center:THREE.Vector3; small:boolean}>();
  private readonly point = new THREE.Vector3();
  private readonly check = new THREE.Raycaster();
  private readonly previous = new WeakMap<THREE.Raycaster, InspectableProp>();
  pick(ray: THREE.Raycaster, direct: THREE.Intersection | undefined, props: InspectableProp[],
      pickWorld: (ray: THREE.Raycaster) => THREE.Intersection | undefined): THREE.Intersection | undefined {
    if (direct && propFor(direct.object)) { this.previous.set(ray, propFor(direct.object)!); return direct; }
    const previous = this.previous.get(ray);
    let best: {hit: THREE.Intersection; prop: InspectableProp; score: number} | undefined;
    for (const prop of props) {
      if (prop.held || prop.returning) continue;
      let bounds = this.bounds.get(prop);
      if (!bounds) {
        const box = new THREE.Box3().setFromObject(prop.group),size=box.getSize(new THREE.Vector3());
        bounds={box,expanded:box.clone().expandByScalar(.022),sticky:box.clone().expandByScalar(.035),
          center:box.getCenter(new THREE.Vector3()),small:!box.isEmpty() && Math.max(size.x,size.y,size.z)<=.5};
        this.bounds.set(prop,bounds);
      }
      if (!bounds.small) continue;
      const point=ray.ray.intersectBox(previous===prop?bounds.sticky:bounds.expanded,this.point);
      if (!point) continue;
      const distance = point.distanceTo(ray.ray.origin);
      if (distance > grabReach || (direct && distance > direct.distance + .005)) continue;
      // Verify an actual surface on this object is visible, rather than allowing
      // an expanded box to leak through a shelf, another prop, or a wall.
      const check=this.check;
      check.ray.origin.copy(ray.ray.origin);
      check.ray.direction.copy(bounds.center).sub(ray.ray.origin).normalize();
      const surface = check.intersectObject(prop.group, true)[0];
      if (!surface) continue;
      const obstruction = pickWorld(check);
      if (obstruction && obstruction.distance < surface.distance - .005) continue;
      const score = ray.ray.distanceToPoint(surface.point) - (previous === prop ? .012 : 0);
      if (!best || score < best.score) best = {prop, score, hit: {...surface, point:point.clone(), distance}};
    }
    if (best) { this.previous.set(ray, best.prop); return best.hit; }
    this.previous.delete(ray); return direct;
  }
}
