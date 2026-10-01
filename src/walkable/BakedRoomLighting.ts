import * as THREE from "three";

/** Atlas pixels contain diffuse illumination / 4, encoded as sRGB.
 * Three's diffuse BRDF divides irradiance by PI; the Blender bake already did so.
 */
export function applyBakedRoomLighting(
  root: THREE.Object3D, lightMap: THREE.Texture, environment: THREE.Texture,
): void {
  lightMap.colorSpace = THREE.SRGBColorSpace;
  lightMap.flipY = false;
  lightMap.channel = 1;
  environment.colorSpace = THREE.SRGBColorSpace;
  environment.mapping = THREE.EquirectangularReflectionMapping;
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial) || material.name === "Daylight") continue;
      if (!object.geometry.hasAttribute("uv1")) throw new Error("Baked office mesh is missing its lightmap UVs");
    }
  });
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial) || material.name === "Daylight") continue;
      material.lightMap = lightMap;
      material.lightMapIntensity = 4 * Math.PI;
      material.envMap = environment;
      material.envMapIntensity = material.metalness > .5 ? .65 : .16;
      // Contact shadows are already present in the atlas. Retain vertex AO only for fallback.
      material.vertexColors = false;
      material.needsUpdate = true;
    }
  });
}
