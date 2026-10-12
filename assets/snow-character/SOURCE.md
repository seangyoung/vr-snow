# Snow's MakeHuman source

`snow-source.blend` is the authoritative, editable character. It contains the
MakeHuman anatomical mesh, portrait-inspired shape keys, an editable seated
game-engine rig, fitted clothing, and packed textures. Edit this file in Blender.
It opens without MPFB installed; the saved shape keys, modifiers and rig use
ordinary Blender data. Install MPFB only if its modeling controls are needed.

`snow-character.blend`, `build-report.json`, and `public/models/snow-character*`
are generated outputs. The output Blender file includes the office as a lighting
reference; only the figure is exported to GLB. No office geometry, helper meshes,
rig, or hidden unclothed body is shipped in the GLB.

## Normal build

From the repository root:

```sh
blender -b --factory-startup --python-exit-code 1 --python scripts/assets/build_snow_character.py
npm run test:walkable
VITE_BASE_PATH=/vr-snow/walkable/ npm run build
```

The resting-pose refinement brings Snow forward in the chair, lowers his elbows,
and places relaxed hands over the desk edge. It preserves the approved face and
textures; `refine_character_poses.py` records this one-time source authoring step.

The exporter reads the source without saving over it. It evaluates the pose and
clothing masks, reduces clothing/shoe geometry, retains the skin UVs, bakes a
separate office-lighting atlas, and batches materials under the existing idle
motion pivots. The app still uses ordinary static GLB meshes and its existing
conversation target, desktop controls, controller rays, and reduced-motion setting.

## Upstream assets and licensing

- Anatomical base, morph targets and game-engine rig: [MPFB](https://github.com/makehumancommunity/mpfb2),
  revision `d0a32e57a7f915cb2f2b95410e2117648c7bbb7e`.
- Skin, eyes, eyebrows, swept hair, garment and shoes: the
  [MakeHuman CC0 system assets](https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html).
- Input hashes and download location: `makehuman-provenance.json`.
- Asset license: `public/licenses/makehuman-assets.txt` (CC0-1.0).
  MPFB's authoring software is separately GPLv3; it is not bundled in the app.

The source uses the middle-aged light-skinned male texture, high-poly eye base
with grey iris texture, eyebrow001, short04 hair, shoes02, and a modified
male_elegantsuit01 garment. The stock striped necktie is removed; a high-buttoned
waistcoat and folded dark cravat are added, linen is distinguished from the coat,
and the side/back hem is extended. Clothing, eye color, build, hair and pose remain
interpretations, not verified possessions or a measured reconstruction of Snow.
The historical visual reference remains the portrait discussed by
[UCLA](https://epi-snow.ph.ucla.edu/Stream1_introduction_b.html).

The portrait refinement adds a higher, receding hairline and long cheek-side
whiskers, narrows the chin and lips, and adjusts the nose, cheeks and eye area.
The 1846 painted portrait and the later photograph (usually dated 1857, sometimes
1856) inform the likeness; the latter is a later reference for the 1854 scenario.
These are interpretive sculpting choices, not a scan or an exact reconstruction.
The sideburns reuse the hair material and follow the anatomical surface.

## Recreating the initial import (not a normal build)

Clone the pinned MPFB revision and extract the CC0 system pack outside the repo.
With the paths to those directories:

```sh
blender -b --factory-startup --python-exit-code 1 --python scripts/assets/author_snow_makehuman.py -- /path/to/mpfb2 /path/to/system-assets
```

The importer refuses to overwrite an existing source. `--replace-source` is only
for intentionally restarting the import; it discards subsequent source edits.
Use an isolated Blender user-resource directory for this optional import. The
normal exporter requires neither MPFB nor a network connection.

To reproduce the subsequent portrait study from a copy of the initial import:

```sh
blender -b --factory-startup --python-exit-code 1 --python scripts/assets/refine_snow_portrait.py -- /path/to/mpfb2 /path/to/system-assets /path/to/initial-source.blend /path/to/refined-source.blend
```

The refinement refuses inputs already marked as refined. It preserves the
tailored clothing and seated pose, and refits only the facial accessories.
Normal builds export the saved source and do not repeat either authoring step.

## Review

Use the packed source to review the anatomy and the generated office-reference
file to inspect conversation-distance appearance, tabletop contact, chair fit,
eye/hair alpha masks, and lightmap seams. Offline renders and asset checks do not
replace a Quest review of texture shimmer, readability, or scene-entry performance.
