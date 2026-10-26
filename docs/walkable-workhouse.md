# Workhouse: courtyard interview

The walkable workhouse is an enclosed, open-air institutional yard. The steward
stands beside a closed administrative door with a ledger tucked under his left
arm and his right arm relaxed at his side. The door is solid scenery; there is
no visible office interior beyond the courtyard.
The outdoor desk, chair and raised garden bed have been removed.

The separate water supply remains visible beside the encounter. Its covered base
and pump are at working height, with two wooden buckets, a small trough and a
drain grate. Perimeter benches, storage and a narrow gutter give the yard a
practical function. The 18 × 20 m yard, 8.8 m wings, doorway, ledger, fittings and
positions are interpretive choices, not a measured reconstruction.

Snow recorded both a pump-well on the premises and a supply from the Grand
Junction Water Works, and that inmates did not fetch water from Broad Street.
The visible pump represents the separate supply; the existing steward interview
remains the evidence source. It does not add a second collectible.

- [Snow's account, UCLA transcription](https://epi-snow.ph.ucla.edu/Stream1_introduction_d9.html)
- [St. James workhouse history and later site plan](https://www.workhouses.org.uk/StJames/)

The latter source describes reconstruction of the north wing in 1858 and shows
an 1867 plan. Neither establishes the office location or the precise 1854 water
fittings used in this scene. No claim is made that Snow met this particular
steward in the yard.

## Navigation and interaction

Arrival faces the doorway encounter. Approach and select the steward using a
controller ray, desktop pointer, or center reticle to open the existing interview.
The map, Snow-review prerequisite, evidence card and marked return to Broad
Street are unchanged. The well remains an obstacle, with clear routes around it.
The standing character's footprint blocks walking and teleporting through him
when loaded. If his asset fails, the small fallback interaction target remains at
the interview location; there is no invisible desk occupying the yard.

## Assets and editing

- `src/walkable/workhouse-layout.json`: collision, arrival, interview and exit layout.
- `src/walkable/scene-characters.json`: standing steward placement and ledger role.
- `scripts/assets/build_workhouse_courtyard.py`: environment generator.
- `assets/scene-people/steward.blend`: authoritative editable person and ledger.
- `scripts/assets/pose_workhouse_steward.py`: one-time pose authoring from the approved source; preserves his face and textures.
- `assets/workhouse-courtyard/`: editable environment and generated build report.
- `assets/workhouse-characters/`: posed, scene-lit export and source checksums.
- `public/models/workhouse-*`: runtime models, lighting and reflection images.

```sh
blender -b --factory-startup --python-exit-code 1 --python scripts/assets/build_workhouse_courtyard.py
blender -b --factory-startup --python-exit-code 1 --python scripts/assets/build_scene_characters.py -- workhouse
blender -b --factory-startup --python-exit-code 1 --python scripts/assets/review_scene_characters.py -- workhouse
npm run test:walkable
VITE_BASE_PATH=/vr-snow/walkable/ npm run build
```

Rebuild the person after rebuilding the yard so his lighting matches the new
setting. Automated checks cover interview/evidence continuity, fallback and loaded
selection, well and character collision, exit travel, the closed door,
single floor surfaces, source/export consistency and geometry budgets. Offline
renders inspect the pose and environment; headset appearance and comfort remain
device checks.
## Detailed working pump (October 2026)

The workhouse fitting now loads a simplified version of the user-supplied
`Hand pump.blend`, independently of the Broad Street replica-based pump.
`scripts/assets/prepare_workhouse_pump.py` evaluates the original modifiers,
simplifies the meshes, repairs normals, replaces procedural materials with cast
iron, and exports separate body/lever meshes. The editable output is in
`assets/workhouse-hand-pump/`; the runtime model is
`public/models/workhouse-hand-pump.glb` (6,604 triangles, two meshes, no textures).

`WorkhousePump` retains the existing well position and collision envelope. It
fits the new lever to the shared pump action, adds a reachable grip proxy, and
animates a piston rod between the moving joint and the lid guide. Water starts
at the new spout. Trigger, grip, mouse and keyboard retain the shared pump
interaction; sample evidence and sound still use the existing water event.
The procedural pump remains the loading/error fallback. The courtyard's baked
environment is shared by the new fitting without applying the old lightmap to
its new geometry.

Source/licensing: [Hand pump by Mdfaizan](https://blendswap.com/blend/23714)
lists **CC-BY**, verified on 26 October 2026. The listing does not specify a
license version; none is inferred. `source.json` records this verification
and the source file hash. Public attribution and a description of the adaptation
are in `public/licenses/workhouse-hand-pump.txt`, linked from Sound settings.

Validation covers the loaded lever's reach and classification, rod motion and
return, one water event per stroke, disabled-handle behavior, load failure,
existing interaction checks, and browser appearance. Quest validation remains
separate from these desktop checks.
