import * as THREE from "three";

/** Continuous deformation in actor coordinates keeps the separate face, clothes and
 * hands together. Feet stay planted; no runtime skeleton or extra rendering passes. */
export class CharacterIdle {
  readonly time = { value: 0 };
  readonly amount = { value: 1 };
  constructor(root: THREE.Object3D, phase: number, seated = false) {
    root.updateWorldMatrix(true, true);
    const inverseRoot = root.matrixWorld.clone().invert();
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const actorFromMesh = inverseRoot.clone().multiply(object.matrixWorld);
      const meshFromActor = actorFromMesh.clone().invert();
      const install = (source: THREE.Material) => {
        const material = source.clone();
        material.onBeforeCompile = shader => {
          Object.assign(shader.uniforms, {
            idleTime: this.time, idleAmount: this.amount,
            idlePhase: { value: phase }, idleNeck: { value: seated ? 1.07 : 1.43 },
            actorFromMesh: { value: actorFromMesh }, meshFromActor: { value: meshFromActor },
          });
          shader.vertexShader = `
uniform float idleTime, idleAmount, idlePhase, idleNeck;
uniform mat4 actorFromMesh, meshFromActor;
mat3 idleTurn(vec3 p) {
  float angle = sin(idleTime * .32 + idlePhase) * .045 * idleAmount
    * smoothstep(idleNeck - .07, idleNeck + .13, p.y);
  float c = cos(angle), s = sin(angle);
  return mat3(c, 0., -s, 0., 1., 0., s, 0., c);
}
vec3 idlePosition(vec3 p) {
  vec3 pivot = vec3(0., idleNeck, 0.);
  vec3 moved = idleTurn(p) * (p - pivot) + pivot;
  float upper = smoothstep(.65, 1.15, p.y);
  float breath = sin(idleTime * 1.35 + idlePhase);
  moved.y += upper * breath * .0025 * idleAmount;
  moved.z += upper * breath * .002 * idleAmount;
  moved.x += smoothstep(.08, 1.65, p.y) * sin(idleTime * .46 + idlePhase) * .006 * idleAmount;
  return moved;
}
` + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace("#include <beginnormal_vertex>", `
#include <beginnormal_vertex>
vec3 actorNormal = mat3(actorFromMesh) * objectNormal;
objectNormal = mat3(meshFromActor) * idleTurn((actorFromMesh * vec4(position, 1.)).xyz) * actorNormal;
`).replace("#include <begin_vertex>", `
#include <begin_vertex>
transformed = (meshFromActor * vec4(idlePosition((actorFromMesh * vec4(transformed, 1.)).xyz), 1.)).xyz;
`);
        };
        material.customProgramCacheKey = () => "continuous-character-idle-v1";
        return material;
      };
      object.material = Array.isArray(object.material) ? object.material.map(install) : install(object.material);
    });
  }
  update(seconds: number, reducedMotion: boolean): void {
    this.time.value = seconds;
    this.amount.value = reducedMotion ? 0 : 1;
  }
}
