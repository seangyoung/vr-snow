# Witness figures and Broad Street residents

Seven original figures extend the seated Snow model to the remaining walkable scenes:

| Scene | Figures and placement | Geometry / material batches |
| --- | --- | --- |
| Registrar | One registrar standing behind the service counter | 23,427 triangles / 12 |
| Household | One seated adult survivor in a plain dark dress, with hands in their lap | 20,137 triangles / 11 |
| Workhouse | One grey-haired steward seated behind the interview table | 22,709 triangles / 12 |
| Brewery | Edward and John Huggins seated at the owners' table | 46,291 triangles / 24 |
| Broad Street | Two background residents near the north street edge | 46,855 triangles / 24 |

Face proportions, hair, clothing colors and poses vary between figures. These are interpretive characters, not verified likenesses. The household witness remains a composite; neither the chosen appearance nor dress identifies a documented survivor. The Huggins names come from the existing authored interview, while their appearances are invented.

The [Old Treasury Building's 1850s day dress discussion](https://www.oldtreasurybuilding.org.au/past-exhibitions/gold-rush/1850s-day-dress/) provides a period reference for a high neckline, long sleeves and gathered skirt, and distinguishes practical clothing from more elaborate fashionable dress. Its Australian garment is a silhouette reference, not evidence of the clothes worn by a specific London household. The scene uses a modest skirt, without a later wire crinoline frame or claims about an institutional uniform.

## Interaction and movement

Selecting a witness with the desktop mouse, keyboard reticle or controller ray opens that scene's existing interview. Both brewery owners lead to the same shared interview. Small nameplates appear only while aiming at a visible witness; opening a panel hides them. Furniture continues to occlude rays, and its original conversation action remains available if character art fails to load.

Street residents are background figures with no new dialogue or evidence. Figures have simple stable selection volumes and horizontal clearance envelopes. Walking and ground teleport cannot enter their occupied space. A visitor overlapping a figure when loading completes can still move away. Existing map travel, exit zones, clues, dialogue and progression are unchanged.

Models and their lighting load once on the first entry to each scene, independently of room loading. Failed loads retain the existing furniture interaction and do not leave invisible blockers. Hidden scenes do not animate. Head movement is deliberately small and honors reduced motion; there is no skeleton, speech generation or lip sync.

## Assets and reproducibility

`src/walkable/scene-characters.json` is the shared placement/appearance manifest used by Blender and the runtime. `SceneCharacters.ts` handles loading, selection, collision and small idle motion. `FurnishedRoom` supplies the shared witness integration; the street uses the same character system for its non-interactive residents.

`character_geometry.py` supplies the shared construction, retaining the repaired closed torso and flattened hands. The character design pass rebuilds Snow and all seven scene figures from this source. `build_scene_characters.py` creates the pose and wardrobe variants, reduces their geometry and bakes them against the relevant furnished scene. Packed Blender sources retain the reference room for editing, but GLBs export only the figures.

Each scene has a 1024-square light atlas and a 256 by 128 reflection capture. Albedo variation is stored in vertex colors, with no downloaded textures. Thin lapels use a neutral lighting patch; outdoor patch intensity is reduced to match the darker courtyard/street illumination. Eyes, brows, lips and hair instead sample the face atlas at triangle interiors, away from the texture gutters. Hair uses a consistent exposed-forehead sample so it does not inherit shadows from beneath the cap or vary abruptly between adjacent triangles. Tiny facial overlays are hidden during the bake so they cannot cast shadows into the face lighting they later inherit. Each overlay triangle samples a single atlas region to avoid dark streaks from interpolation between separate texture islands. Each atlas occupies about 5.33 MiB with RGBA8 mipmaps. Each figure stays below the existing 24,000-triangle and 3 MiB scene-figure budgets. All five atlases together add about 26.7 MiB if every scene has been visited. Figures introduce no dynamic shadow maps or new lights.

```sh
# Build or review any of: registrar household workhouse brewery street
blender --background --factory-startup --python scripts/assets/build_scene_characters.py -- household
blender --background --factory-startup --python scripts/assets/review_scene_characters.py -- household
npm run test:walkable
VITE_BASE_PATH=/vr-snow/walkable/ npm run build
```

## Validation

Automated checks cover the existing game and new witness targeting, both brewery targets, furniture fallback, hover suppression during panels, collision/teleport clearance, safe escape after loading, one-time loading, lighting failure, vertex colors, solid exported torsos, head pivots and asset budgets. Offline room and close-up renders check pose, clothing, hands and road contact. Those renders do not reproduce the browser's complete rendering pipeline.

Desktop visual acceptance and Quest controller, stereo, loading-stall and frame-rate checks remain separate. Review each witness from the doorway and near their furniture, select both brewery owners, open and dismiss the notebook/dialogue, revisit the room, and walk around the street residents.

## Character design refinement

Coat-wearing figures now use a fitted waistcoat profile, smaller folded collars and lapels, smaller buttons, pocket welts and restrained sleeve folds. The household dress has a smaller neckcloth, simple front fastenings and a waist seam. Distinct jaw shapes, nasal profiles, age cues and hairlines are authored in the placement manifest; the household witness has a center-parted style and bun. These are artistic variations, not new claims about the identities or appearances of historical witnesses.

The face keeps more geometry than less visible clothing details when reducing the scene figures. Narrower eye openings and face-matched lighting reduce the previous bright, staring-eye effect. Existing flat palms, torso closure, head pivots, selection volumes, poses and travel clearance remain in place. There are no additional runtime lights, skeletons or texture allocations.

Period references: [FIT's 1850s fashion overview](https://fashionhistory.fitnyc.edu/1850-1859/) for waistcoats, frock coats and center-parted women's hair, and [UCLA's Snow portraits](https://epi-snow.ph.ucla.edu/Stream1_introduction_b.html) for the existing interpretive Snow design. No source imagery is embedded in the models.

The offline review now includes a separate face close-up for every scene, in addition to the room and portrait views. These renders check the asset and baked-lighting combination, not actual headset performance or stereo appearance.

## Anatomy and facial variety pass

Standing figures now have authored shoulder/elbow/wrist positions and hands rotated together in an orthonormal frame. Palms face the thighs, fingers point downward with a slight curl, and the registrar no longer uses a seated desk pose while standing. Seated desk, table and lap poses also have individually placed forearms instead of stretching the completed body mesh.

The pelvis, thighs, knees and shins form a single remeshed trouser surface. Standing coat hems overlap the hips; the waist remains covered during the existing small idle motion. The dress retains its continuous skirt. These changes preserve the current actor placements, selection volumes and room clearance.

The manifest now varies cheek fullness, jaw and chin, nose width and projection, eye spacing, mouth width, lip fullness and brow slope. The registrar has a narrower face, the steward a broader jaw, and the two brewery owners have fuller and leaner facial structures. The street residents also differ in their facial structure. These remain interpretive appearances rather than documented likenesses.

Faces receive dedicated continuous UV charts within the existing 1024-square light atlas, with the seam behind the head. This removes the visible square seams around the brewery eyes. Hair and outer-ear overlays use a consistent exposed-forehead lighting sample rather than shadowed temple texels; vertex albedo retains the hair color and strand variation. No texture allocation, material batch, dynamic light or skeleton is added.

For a fast geometry review without overwriting shipped assets, append `--draft` to either builder. The draft review renders front, side and face views without furniture. The finished-asset review scripts also show each actor separately with the actual baked lighting; append `--anatomy-only` to skip room views. Export tests check pelvis coverage, uninterrupted leg surfaces and downward, inward-facing standing hands in actor coordinates, including rotated street residents. Offline render acceptance does not establish Quest stereo appearance or performance.
