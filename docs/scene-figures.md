# Witness figures and Broad Street residents

Seven MakeHuman-based figures accompany the portrait-inspired Snow model:

| Scene | Figure and visual identity |
| --- | --- |
| Registrar | Standing registrar with a long, lean face, receding hair and older skin detail |
| Household | Seated adult survivor with softer cheeks, brown eyes, swept-back hair and a low bun; plain long dress |
| Workhouse | Standing steward at the courtyard doorway with a ledger, broader jaw and nose, fuller cheeks and grey hair |
| Brewery | Edward has a rounder, mature face and fuller swept hair; John has a longer, younger face and narrower nose |
| Broad Street | One broad-jawed resident with fuller dark hair and one older, leaner resident with a receding hairline |

These are interpretive characters, not verified likenesses. The household witness
remains a composite, and the Huggins names come from the authored interview rather
than from a new identification of their appearances. Snow alone is informed by
his known portraits. No source portrait pixels are embedded in the characters.

## Interaction and movement

Selecting a witness with the mouse, keyboard reticle or controller ray opens the
existing interview. Both brewery owners lead to the same shared interview. Small
nameplates appear only while aiming at a visible witness and hide during panels.
Furniture still occludes rays. Its original conversation action remains available
if character art fails to load. Selection heights and hover labels accommodate
the new seated figures.

The street residents are background figures with no dialogue or evidence.
Selection and collision use stable volumes independent of animated meshes.
Walking and ground teleport cannot enter occupied space; a visitor overlapping a
figure when loading completes can still move away. Map travel, exit zones, clues,
dialogue and progression retain their existing behavior.

Models and lighting load once on first entry, independently of room loading.
Failed loads retain furniture interaction without invisible blockers. Hidden
scenes do not animate. Small head movement honors reduced motion; the runtime
has no skeleton, speech generation or lip sync.

## Assets and reproduction

The [authored source guide](../assets/scene-people/SOURCE.md) documents the seven
editable Blender files, appearance profiles, licensing and build commands.
`build_scene_characters.py` exports those saved sources without regenerating them.
The [Snow source](../assets/snow-character/SOURCE.md) remains separately authored.
`character_geometry.py` describes the superseded procedural approach and is no
longer used by either character exporter.

Each character has anatomical hands and a continuous body beneath its tailored
clothing. Separate age, face, build, hair and eye settings provide variety.
The household skirt shares its waist with the bodice and drapes over the seated
lap; the bun is a solid, overlapping volume. Arms have low elbows and relaxed
fingers, with hands placed beside thighs or against laps and tables. Men's stock long ties
are replaced with high waistcoats and cravats. These are period-inspired wardrobe
adaptations, not verified possessions or institutional uniforms.

Each scene retains a 1024-square light atlas and a 256-by-128 reflection capture.
The embedded skin, eye, brow and hair textures add memory compared with the old
vertex-color figures. Every actor stays below 30,000 triangles, 12 mesh batches,
and 3 MiB of GLB data. There are no new dynamic lights or shadow maps. The head
and hands retain their anatomical texture charts and receive separate lighting
regions for each figure, including scenes with two people.

## Validation

Automated checks cover witness targeting, both brewery targets, furniture
fallback, hover suppression during panels, collision/teleport clearance, loading
failure, source/export consistency, embedded texture bindings, head pivots,
clothed torsos, lower bodies, standing wrist clearance, seated palm/lap contact,
continuous waist coverage, opaque bun material, desktop finger clearance and
asset budgets.

Offline room, front, side and face renders check every figure, including both
owners and both residents. Review scripts preserve eye/hair alpha coverage.
These renders do not reproduce the browser's complete rendering pipeline.

Quest stereo appearance, controller selection, scene-entry stalls and frame rate
remain device checks. Visit each scene, approach and circle its people, select
both brewery owners, open and dismiss panels, and revisit previously loaded rooms.
