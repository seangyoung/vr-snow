# Household: walkable interior prototype

The household panorama is replaced on `walkable-prototype` by an illustrative 5.4 × 6 m domestic room with a 3.15 m ceiling. These are design dimensions, not historical measurements. It contains a timber bed, wool coverlet, cold hearth, small table with a water jug and cup, clothes chest, washstand and a marked interview chair. The mourning ribbon echoes the existing dialogue. This remains a composite household, not a reconstruction of an identified family's interior. Period texture and lighting refinement is deferred, as with the office and registrar prototypes.

## Interaction and travel

The existing unlock condition, map position and representative Broad Street entrance are retained. Arrival faces the marked chair. Select the chair or Household label with the cursor or controller ray to open the existing survivor interview. The two existing questions still collect household exposure and the aggregate household water-use pattern. The jug, bed and other furnishings are scenery, not additional evidence sources.

WASD/arrows, clear-floor teleport, controller selection, squeeze panels and snap turning use the shared room controls. Walls and furniture block artificial movement with 25 cm clearance. Physical room-scale movement follows the headset and its real-world play boundary. Selecting the return door or entering its marked ring returns to Broad Street. Arrival is outside the ring, and closing an interview while inside it cannot cause unexpected travel. Map travel remains available.

## Editable assets

- `src/walkable/household-layout.json`: shared room, furniture, arrival, interview and door positions.
- `scripts/assets/build_household_room.py`: deterministic Blender generator.
- `assets/household-room/household-room.blend`: packed editable source with named pieces.
- `public/models/household-room.glb`: roughly 462 KiB, 5,324 triangles, 13 material batches.
- `assets/household-room/build-report.json`: geometry counts and exported layout.
- `src/walkable/HouseholdRoom.ts`: configures the existing furnished-room implementation.

The model reuses the project's original timber texture, uses simple materials without real-time shadows, and has a furnished fallback if loading fails.

```sh
blender --background --factory-startup --python scripts/assets/build_household_room.py
npm run test:walkable
VITE_BASE_PATH=/vr-snow/walkable/ npm run build
```

## Validation

All 35 automated checks and the production build pass. Household checks cover furniture clearance, a reachable interview approach and exit, seated and standing ray selection, controller interview activation, both evidence cards, panel blocking, automatic return, map re-entry and asset budgets. The lifecycle check includes repeated household visits alongside the other modeled rooms and a remaining panorama.

Browser checks confirmed the modeled room, physical chair selection, both interview questions, evidence retention, floor teleport into the automatic exit and map re-entry.

Quest validation remains necessary for perceived room scale, frame rate, chair/label readability, floor teleport, panel reach, snap turning and repeated household-to-street travel.
