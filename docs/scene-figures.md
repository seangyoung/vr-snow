# Witness figures and Broad Street residents

Seven original figures extend the seated Snow model to the remaining walkable scenes:

| Scene | Figures and placement | Geometry / material batches |
| --- | --- | --- |
| Registrar | One registrar standing behind the service counter | 19,677 triangles / 12 |
| Household | One seated adult survivor in a plain dark dress, with hands in their lap | 18,031 / 10 |
| Workhouse | One grey-haired steward seated behind the interview table | 19,983 / 12 |
| Brewery | Edward and John Huggins seated at the owners' table | 41,035 combined / 24 |
| Broad Street | Two background residents near the north street edge | 39,354 combined / 24 |

Face proportions, hair, clothing colors and poses vary between figures. These are interpretive characters, not verified likenesses. The household witness remains a composite; neither the chosen appearance nor dress identifies a documented survivor. The Huggins names come from the existing authored interview, while their appearances are invented.

The [Old Treasury Building's 1850s day dress discussion](https://www.oldtreasurybuilding.org.au/past-exhibitions/gold-rush/1850s-day-dress/) provides a period reference for a high neckline, long sleeves and gathered skirt, and distinguishes practical clothing from more elaborate fashionable dress. Its Australian garment is a silhouette reference, not evidence of the clothes worn by a specific London household. The scene uses a modest skirt, without a later wire crinoline frame or claims about an institutional uniform.

## Interaction and movement

Selecting a witness with the desktop mouse, keyboard reticle or controller ray opens that scene's existing interview. Both brewery owners lead to the same shared interview. Small nameplates appear only while aiming at a visible witness; opening a panel hides them. Furniture continues to occlude rays, and its original conversation action remains available if character art fails to load.

Street residents are background figures with no new dialogue or evidence. Figures have simple stable selection volumes and horizontal clearance envelopes. Walking and ground teleport cannot enter their occupied space. A visitor overlapping a figure when loading completes can still move away. Existing map travel, exit zones, clues, dialogue and progression are unchanged.

Models and their lighting load once on the first entry to each scene, independently of room loading. Failed loads retain the existing furniture interaction and do not leave invisible blockers. Hidden scenes do not animate. Head movement is deliberately small and honors reduced motion; there is no skeleton, speech generation or lip sync.

## Assets and reproducibility

`src/walkable/scene-characters.json` is the shared placement/appearance manifest used by Blender and the runtime. `SceneCharacters.ts` handles loading, selection, collision and small idle motion. `FurnishedRoom` supplies the shared witness integration; the street uses the same character system for its non-interactive residents.

`character_geometry.py` extracts Snow's existing construction into a shared source, retaining the repaired closed torso and flattened hands. Snow's exported assets remain unchanged. `build_scene_characters.py` creates the pose and wardrobe variants, reduces their geometry and bakes them against the relevant furnished scene. Packed Blender sources retain the reference room for editing, but GLBs export only the figures.

Each scene has a 1024-square light atlas and a 256 by 128 reflection capture. Albedo variation is stored in vertex colors, with no downloaded textures. Thin lapels and tiny facial features use a neutral lighting patch; outdoor patch intensity is reduced to match the darker courtyard/street illumination. Each atlas occupies about 5.33 MiB with RGBA8 mipmaps. The largest new GLB is about 3.46 MiB for the two brewery owners. All five atlases together add about 26.7 MiB if every scene has been visited. Figures introduce no dynamic shadow maps or new lights.

```sh
# Build or review any of: registrar household workhouse brewery street
blender --background --factory-startup --python scripts/assets/build_scene_characters.py -- household
blender --background --factory-startup --python scripts/assets/review_scene_characters.py -- household
npm run test:walkable
VITE_BASE_PATH=/vr-snow/walkable/ npm run build
```

## Validation

89 automated checks cover the existing game and new witness targeting, both brewery targets, furniture fallback, hover suppression during panels, collision/teleport clearance, safe escape after loading, one-time loading, lighting failure, vertex colors, solid exported torsos, head pivots and asset budgets. Offline room and close-up renders check pose, clothing, hands and road contact. Those renders do not reproduce the browser's complete rendering pipeline.

Desktop visual acceptance and Quest controller, stereo, loading-stall and frame-rate checks remain separate. Review each witness from the doorway and near their furniture, select both brewery owners, open and dismiss the notebook/dialogue, revisit the room, and walk around the street residents.
