# Authored MakeHuman scene figures

The seven `.blend` files in this folder are the authoritative, editable sources.
They contain MakeHuman anatomy, individual facial shape keys, fitted clothing,
packed textures, and an editable FK rig. They open in Blender without MPFB.
Normal exports do not regenerate or overwrite them.

`appearance.json` records the initial artistic choices, independently of the
runtime placement/interaction manifest, `src/walkable/scene-characters.json`.
The registrar, steward, two owners, household survivor, and two residents have
different age cues, head/jaw shapes, nose proportions, cheek fullness, eye
spacing, hairlines, hair colors and iris colors. These are interpretive designs,
not documented portraits. The household survivor remains a composite character.
Snow's approved portrait study has its own source and is not regenerated here.

The original garment sources are adapted rather than presented as historical
reconstructions: men's modern ties are removed, high waistcoats and cravats are
added, and coat hems are extended. The household figure uses a plain long-sleeved
bodice joined at shared waist vertices to a seated, draped skirt, and swept-back
hair with a solid low bun overlapping the scalp. No modern logo/striped clothing
textures are shipped.

The resting-pose revision lowers elbows and relaxes fingers, with standing hands
beside the thighs, seated hands on the lap, and one hand per brewery owner reaching
the table. Snow retains two hands at his desk. `refine_character_poses.py` records
this one-time authoring operation; it requires a pre-refinement source copy and
must not run as part of normal exports. Subsequent edits belong in the saved rigs.

## Build and review

```sh
# Any of registrar, household, workhouse, brewery, street:
blender -b --factory-startup --python-exit-code 1 --python scripts/assets/build_scene_characters.py -- registrar
blender -b --factory-startup --python-exit-code 1 --python scripts/assets/review_scene_characters.py -- registrar
npm run test:walkable
VITE_BASE_PATH=/vr-snow/walkable/ npm run build
```

Each export evaluates the source rig and clothing masks, preserves the face and
hand texture UVs, and bakes lighting from its scene. Skin, eyes, brows and hair
have embedded base-color textures. Hair cards and eyes use binary alpha coverage;
the closed bun is opaque so the hair-card mask cannot cut holes through it.
Head, hand and garment lightmap regions are separate for each actor. Eye meshes
reuse nearby cheek illumination to avoid dark socket artifacts in tiny UV islands. Only static meshes
and the existing idle-motion pivots are shipped; no runtime skeleton, helper
geometry or reference-room geometry is exported.

Generated outputs live under `assets/<scene>-characters/` and `public/models/`.
Build reports record a SHA-256 for each authored source so stale exports can be
detected. The per-person limits are 30,000 triangles, 12 mesh batches, and 3 MiB
of GLB data. Each scene retains a 1024-square lighting atlas and small reflection
capture. Embedded skin/hair textures add memory compared with the former
procedural figures; headset frame rate and scene-entry stalls need device review.

## Optional initial authoring

With the pinned MPFB checkout and extracted system assets recorded in
`makehuman-provenance.json`:

```sh
blender -b --factory-startup --python-exit-code 1 --python scripts/assets/author_scene_people.py -- /path/to/mpfb2 /path/to/system-assets registrar
```

An existing source is protected. `--replace-source` deliberately restarts one
actor from the profile and discards later Blender edits. Use an isolated Blender
user-resource directory for this optional step. MPFB is needed only for authoring.

The anatomy, morph targets and bundled system assets use CC0-1.0; the license is
in `public/licenses/makehuman-assets.txt`. MPFB authoring software is separately
GPLv3 and is not bundled in the app. See the provenance file for upstream links,
pinned revision, asset archive checksum and individual input checksums.
