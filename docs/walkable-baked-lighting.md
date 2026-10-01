# Baked lighting across the walkable scenes

All six walkable scenes now use static diffuse lighting and a separate environment capture for material highlights. Snow’s approved office assets are retained. Scene layouts, collision envelopes, travel targets, evidence and dialogue remain as before. The Board scene is still a panorama.

## Art direction

- Registrar: repeated cool window sources illuminate the records tables, blue-green counter and shelving.
- Household: one smaller window and restrained warm bounce ground the bed, chairs and domestic furnishings.
- Brewery: high side/rear windows illuminate the brick floor and vessels; copper is rough metal, timber and sacks are matte, pottery has a softer sheen.
- Workhouse: broad daylight creates shaded recesses, furniture contact and a readable open courtyard.
- Broad Street: diffuse daylight across the facades, shopfronts and paving, with retained authored weathering. Glazing, small trim and ironwork use a neutral atlas patch, avoiding subpixel black seams on repeated details. The procedural interactive pump uses the street reflection capture; a bake-only cylinder provides an approximate ground shadow.

These are interpretive lighting choices, not a reconstruction of historical weather or time of day.

## Rebuilding and review

Each `scripts/assets/build_<scene>.py` invokes `bake_scene_lighting.py`. The office wrapper supplies its original configuration. Run a builder with Blender 5.x, for example:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/assets/build_registrar_room.py
```

The shared baker uses 256 Cycles samples and four diffuse bounces, excludes albedo, divides lighting by four and writes an sRGB PNG. Original texture UVs remain on channel 0; the light atlas uses channel 1. Temporary joined copies preserve the editable source objects. Original materials and old lights remain available as a loading fallback. No light or camera is exported in the GLB.

The street receiver welds coincident vertices on a temporary copy so contiguous paving and facades can share UV islands. Coincident internal faces removed by that step retain neutral coordinates in the original geometry. Small repeated details are excluded from atlas packing but still cast shadows in the bake. `compact_vertex_colors.py` stores street weathering as standard normalized 8-bit glTF colors instead of 16-bit values, retaining the existing model download budget without a decoder or geometry reduction.

For an offline diffuse-atlas review:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/assets/review_baked_lighting.py -- registrar-room /private/tmp/lighting-review
```

This uses an emission shader to expose atlas seams and shadow placement without live lights masking defects. Its AgX image is a Blender preview, not a browser screenshot, and omits runtime environment highlights.

## Runtime and asset costs

`BakedRoomLighting.ts` loads both textures, validates every receiver UV before changing any material, then applies the atlas at `4 * Math.PI`. Only after success are the fallback lights hidden. A texture or UV failure disposes the supplemental textures and keeps the authored model under its old lights. Environment textures are attached to each scene’s materials rather than the global scene; loading is cached. Street weathering colors remain active; the older indoor vertex AO is disabled to avoid duplicate occlusion.

There are no real-time shadow maps or per-frame reflection captures. Triangle and material-batch counts are unchanged. Download sizes below are MiB, not GPU memory:

| Scene | Triangles / batches | Light atlas | GLB / atlas / reflection MiB |
| --- | ---: | ---: | ---: |
| Snow’s office | 26,128 / 16 | 2048² | 2.90 / 1.98 / 0.54 |
| Registrar | 16,656 / 13 | 2048² | 1.92 / 3.26 / 0.15 |
| Household | 5,324 / 13 | 1024² | 0.78 / 0.73 / 0.14 |
| Brewery | 13,280 / 13 | 2048² | 0.93 / 2.39 / 0.17 |
| Workhouse | 20,356 / 14 | 2048² | 2.10 / 2.61 / 0.16 |
| Broad Street | 175,603 / 16 | 2048² | 18.86 / 3.75 / 0.14 |

Across all six scenes, the light atlases alone require approximately 112 MiB as RGBA8 with mipmaps if all remain resident (about 90.7 MiB beyond the office pilot). Reflections add five 512 × 256 images and the office’s existing 1024 × 512 image, plus Three.js’s filtered environment textures. Base textures, geometry, decoded images and browser overhead are additional. Assets currently preload once and remain cached for return visits. Actual Quest memory and frame times have not been measured for this extension.

## Validation

- 58 automated tests pass: existing travel, keyboard/XR interaction and collision coverage; actual exported atlas UV values and image dimensions; per-room environments and single loading; street weathering and pump selection; lighting failure fallback and atomic UV validation.
- The production build passes for `/vr-snow/walkable/` (existing bundle-size advisory remains).
- Offline atlas renders reviewed for all five newly baked scenes; street packing/brightness adjusted after that review.
- Browser visual automation remains unavailable because the browser tool rejected access to the local preview. Desktop preview and Quest acceptance are separate from the checks above.

On device, visit every scene, look under tables and along wall/curb seams, check the copper/pump highlights, open dialogue and notebook panels, and return to previously visited scenes. Check first-entry stalls as well as steady motion and readability from seated height.
