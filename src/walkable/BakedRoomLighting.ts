import * as THREE from "three";

/** Atlas pixels contain diffuse illumination / 4, encoded as sRGB.
 * Three's diffuse BRDF divides irradiance by PI; the Blender bake already did so.
 */
export function applyBakedRoomLighting(
  root: THREE.Object3D, lightMap: THREE.Texture, environment: THREE.Texture, preserveVertexColors = false,
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
      if (!object.geometry.hasAttribute("uv1")) throw new Error("Baked scene mesh is missing its lightmap UVs");
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
      if (!preserveVertexColors) material.vertexColors = false;
      material.needsUpdate = true;
    }
  });
}

export type BakedLightingConfig = { lightMap: string; environment: string; preserveVertexColors?: boolean };

/** Keep the authored GLB usable when either supplemental texture fails. */
export async function loadBakedRoomLighting(
  root: THREE.Object3D, basePath: string, config: BakedLightingConfig,
): Promise<THREE.Texture> {
  const loader = new THREE.TextureLoader();
  const loaded = await Promise.allSettled([
    loader.loadAsync(`${basePath}models/${config.lightMap}`),
    loader.loadAsync(`${basePath}models/${config.environment}`),
  ]);
  try {
    if (loaded[0].status !== "fulfilled" || loaded[1].status !== "fulfilled") {
      throw new Error("Scene lighting texture could not load");
    }
    applyBakedRoomLighting(root, loaded[0].value, loaded[1].value, config.preserveVertexColors);
    return loaded[1].value;
  } catch (error) {
    for (const result of loaded) if (result.status === "fulfilled") result.value.dispose();
    throw error;
  }
}
