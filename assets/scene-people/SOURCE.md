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

## Workhouse doorway revision

The steward now stands beside the closed administrative door with a ledger tucked
under his left arm and his right arm relaxed. `pose_workhouse_steward.py` records
the one-time edit of the approved anatomical source. His face, hair, clothing and
packed textures are retained. The ledger reuses existing brown, linen and metal
materials to preserve the per-person batch budget. Normal exports read this saved
pose; they do not regenerate it from `appearance.json` or the earlier seated pose.

## Brewery standing revision

Edward and John stand beside a side-wall accounts table instead of sitting at a
desk in the center of the brewhouse. `pose_brewery_owners.py` resets the saved rig
to a settled standing stance, with relaxed wrists and hands beside the thighs.
Their distinct faces, hair, clothing and packed textures are preserved. Normal
exports read these saved sources rather than recreating the earlier seated pose.

## Inquiry prototype: Whitehead and the Board

`whitehead.blend` adds a younger, dark-haired local curate with a distinct face;
this is an interpretive figure, not a claimed portrait reconstruction. The three
`board-chair`, `board-tradesman` and `board-guardian` sources are unnamed
representative officials with distinct profiles and lap-resting seated poses.
Their individual wrist heights are recorded in `refine_character_poses.py`.
Whitehead uses the relaxed standing pose from `pose_brewery_owners.py`.
His corrected profile uses the adult part of MakeHuman's age slider (.54): .30
blended child and young-adult targets, shortening the anatomy beneath adult-sized
clothing and invalidating the standing wrist targets. The figure represents a
29-year-old adult; the slider is not a fraction of a century. Adult head, collar
and shoulder alignment are checked in the exported GLB, alongside front/side
portrait and runtime idle review.

`board-snow.blend` derives from the approved `assets/snow-character/snow-source.blend`,
reposed to stand with relaxed hands using `pose_brewery_owners.py`; it preserves
Snow's portrait-derived anatomy and textures. Hair has an explicit neutral .95
multiplicative export tint. It is not generated from another person's profile.

Export with `build_scene_characters.py -- board` or `-- street`. Board lighting
comes from the interpretive `assets/board-room/board-room.blend`, generated with
`build_board_room.py`. The saved sources, including packed textures, remain the
editable authority; one-time authoring scripts are not rerun for routine exports.
See `docs/inquiry-next.md` for historical boundaries and the pending Quest review.

## Inquiry household composites

`water-householder.blend` and `away-householder.blend` are fictional adults,
created with the existing MakeHuman anatomical and clothing pipeline. The
appearance profiles use adult age targets (.60 and .68), distinct facial
proportions and coat colors, and relaxed standing poses. Neither claims a likeness
to a documented household member. Their rooms, possessions and testimony are
explicit teaching composites. Export with `build_scene_characters.py --
household-routines` or `-- household-away`; room source files and lightmap reports
are in the corresponding `assets/household-*-room` folders.

### Clerical appearance refinement, 16 October 2026

Whitehead's added beard, moustache, white neckcloth/bands and frock-coat skirts are
original authored geometry (`scripts/assets/refine_whitehead_clerical.py`). The
beard strand image is generated deterministically and packed into the source.
The full-beard reference is the [1884 Scott and Sons photograph](https://commons.wikimedia.org/wiki/File:Whitehead_henry1884.jpg),
not a photograph from the outbreak; this remains an interpretive younger figure.
Four runtime background residents share the two street residents' geometry and
textures; daily placements and garment tints are separate from the source models.
