# Snow's office: baked-lighting pilot

The office is the first room using a dedicated light atlas and static room reflection capture. The goal is to make window light, furniture contact shadows and material highlights visible in the walkable game, rather than only in offline presentation renders. Other rooms retain their existing lighting until the pilot is reviewed on a headset.

## Appearance

- A broad daylight source outside the modeled window, with a restrained warm room fill and several diffuse bounces.
- Actual baked occlusion by furniture and architecture: desk and chair shadows, darker shelf interiors and gradual changes across walls and floor.
- A static room environment for view-dependent highlights on brass, pewter, wood and leather. Roughness and metalness now differ more clearly among those surfaces.
- Softer desk and mantel bevels, a small molding beneath the mantel and deeper window trim.

The lighting is an artistic interpretation. It does not claim to reproduce the historical room, weather or time of day.

## Asset workflow

`build_snow_office.py` calls `bake_office_lighting.py` after the original surface finishes. The latter creates a second UV set across temporary joined copies of interior objects and transfers the packed atlas coordinates back to the original editable pieces. The exterior occupies a reserved neutral lighting patch. The original surface texture coordinates are retained.

Cycles bakes direct and indirect diffuse illumination without surface color, using 256 samples and up to four diffuse bounces. A two-pixel-radius separable filter reduces remaining sampling noise; atlas gutters exceed that radius. Illumination is divided by four, limited to the PNG range and encoded as sRGB in a 2048 × 2048 PNG. A separate 1024 × 512 room panorama supplies the static reflection environment. Editable bake lamps and the packed lightmap remain in the Blender file; lamps are excluded from the GLB.

At runtime `BakedRoomLighting.ts` binds the atlas to UV channel 1, disables the earlier vertex occlusion contribution to avoid double shading, and restores intensity with `4 * Math.PI`. The PI factor compensates for Three.js's Lambertian diffuse BRDF. The reflection image is attached to the office materials, not the global scene. Three.js prepares its filtered reflection representation when needed. There is no per-frame capture or real-time shadow map.

The old lights are hidden only after both textures load and the mesh UVs validate. Missing textures or invalid UVs leave the original room lighting and vertex shading available. Switching to another scene does not transfer the office's environment to it.

## Cost and acceptance

The room contains 26,128 triangles in 16 material batches, below the existing 30,000-triangle budget. Its GLB is 3,041,180 bytes; the separate lightmap is 2,074,236 bytes and the reflection panorama is 568,739 bytes. Added texture memory is the main tradeoff: the 2048-square lightmap is roughly 16 MiB as RGBA8, or about 21.3 MiB with mipmaps, before the reflection texture/filtering and existing textures. These are estimates, not headset measurements. First-use reflection preparation and shader compilation must also be checked on Quest.

The 50 automated tests cover the existing interactions, collision and travel, exported atlas UVs and texture dimensions, successful lighting activation, single loading, texture-failure fallback and atomic rejection of missing UVs. The production build and Blender atlas review are required before handoff. Offline atlas review validates the shadow placement and seams; it is not a substitute for testing the browser renderer.

On Quest and desktop, review:

1. Office load on a fresh session; absence of a persistent dark or frozen view.
2. Desk, shelf and fireplace readability from seated height and room corners.
3. Soft shadows under furniture, with no speckling, dark UV seams or shimmer when moving.
4. Metal and wood highlights shifting with viewpoint without overwhelming the surface colors.
5. Travel out and back, panel legibility, and unchanged conversation/exit behavior.
6. First-load and steady frame times and texture memory before applying this workflow elsewhere.

Browser visual verification is currently blocked by the browser tool's local-preview access restriction. The rebuilt preview is available for manual review. No on-device performance claim is made.
