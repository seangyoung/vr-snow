# Workhouse: walkable courtyard prototype

The workhouse panorama is replaced on `walkable-prototype` with an enclosed, open-air courtyard. It follows the existing panorama's visual setting: stock-brick institutional wings, sash windows, cobbled ground, perimeter paving, a separate water-supply feature and benches. A marked steward's table opens the existing interview. The 18 × 20 m yard, 8.8 m wings, furniture, covered well and pump are interpretive design choices, not a surveyed reconstruction or documentation of the actual 1854 fittings. The water feature is scenery; the steward's testimony remains the evidence source.

## Interaction and travel

The existing Snow review prerequisite and workhouse map location are unchanged. Enter by map or the east-then-north Poland Street target on Broad Street. Arrival faces the steward's table. Select the table or Steward label to ask the existing water-source question and collect the workhouse exception card.

WASD/arrows, clear-ground teleportation, controller selection, squeeze panels and snap turning use the shared navigation. Walls, benches, the table, chair, planting bed, storage chest and well constrain artificial movement with 25 cm clearance. A clear route surrounds the well. Virtual obstacles do not stop physical room-scale movement; the headset's real-world play boundary still applies.

The marked entrance door returns to Broad Street via Poland Street. Select it or enter its floor ring. Arrival is outside the ring; closing a panel while inside cannot trigger unexpected travel. Other doors are closed scenery. Map travel remains available.

## Editable assets

- `src/walkable/workhouse-layout.json`: courtyard dimensions, collision footprints, arrival, steward and exit positions.
- `scripts/assets/build_workhouse_courtyard.py`: deterministic Blender generator.
- `assets/workhouse-courtyard/workhouse-courtyard.blend`: packed editable source with named pieces.
- `public/models/workhouse-courtyard.glb`: browser export, approximately 1.8 MiB, 20,356 triangles and 14 material batches.
- `assets/workhouse-courtyard/build-report.json`: geometry counts and the exported layout.
- `src/walkable/WorkhouseCourtyard.ts`: shared room navigation with a courtyard sky.

The model reuses original project brick, cobble, paving, slate and timber textures. It has no real-time shadow maps and no new dependency. The environment and sky load once; failures retain bounded fallback geometry and an overcast background. Material refinement, richer weathering and more specific historical detailing remain for a later art pass.

```sh
blender --background --factory-startup --python scripts/assets/build_workhouse_courtyard.py
npm run test:walkable
VITE_BASE_PATH=/vr-snow/walkable/ npm run build
```

## Validation and headset checks

All 39 automated checks and the production build pass. Automated coverage includes a clear approach to the steward, a route around the well, collision and teleport exclusion, seated and standing ray targets, controller interview activation, workhouse evidence retention, panel blocking, automatic return, map re-entry, repeated scene changes and embedded asset budgets.

Browser checks confirmed map prerequisites, courtyard rendering, physical table selection, water-source evidence, ground teleport, automatic exit, direct door selection, evidence retention and repeat entry. The final asset was also inspected from both ends after closing the wing corner seams. No browser warnings or errors were recorded.

On Quest, check courtyard loading and frame rate, scale, distant window shimmer, steward/table readability, floor teleport around the well, return door/ring operation and repeated travel to Broad Street. Desktop validation cannot establish headset comfort or performance.
