# Whitehead facial hair refinement — 29 October 2026

The adult MakeHuman face, standing pose, clerical clothing and scalp hair are
unchanged. The facial hair now wraps around the actual cheeks and jaw, with a
rounded chin, fine tapered silhouette strands, a feathered growth edge and a
moustache following the upper lip. The mouth remains exposed. This replaces the
old smooth pointed shell and separate ribbon moustache.

All hair geometry and texture pixels are authored procedurally in
`scripts/assets/refit_whitehead_face.py`. The packed 1024 px colour/coverage and
normal maps contain irregular curved fibres rather than repeating vertical
stripes. Cutout coverage avoids blended-transparency sorting; no runtime hair
simulation or extra lights are introduced. All beard and moustache parts join
the existing head material batch and follow its idle movement. Centreline
vertices now receive the same cheek illumination as surrounding facial hair,
fixing a dark lighting seam.

The appearance remains an interpretation. The previously documented portrait is
from 1884, not evidence of Whitehead's exact appearance in September 1854.
No portrait pixels or new third-party assets are included.

## Rebuild

Run Blender in background mode with these scripts, in order:

1. `scripts/assets/refit_whitehead_face.py`
2. `scripts/assets/build_scene_characters.py -- street`

The first updates `assets/scene-people/whitehead.blend`; the second rebuilds the
street GLB, baked lighting, combined Blender source and build report. Repeated
refits replace facial hair without cumulatively changing the anatomical face.

The street export contains 200,641 triangles (previously 196,569) and retains 83
material batches. Front and three-quarter source renders and the exported baked
figure were reviewed. Automated checks cover head attachment, masked materials,
normal-map export, cheek/chin fit, exposed lips and the centre lighting seam.
Headset appearance and performance still require device review.
