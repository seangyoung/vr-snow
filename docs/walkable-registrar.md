# Registrar: walkable records-room prototype

The registrar panorama is replaced on `walkable-prototype` with a compact records room. It has a public ledger table, a counter, archive shelves, labeled drawers, a waiting bench, clerks' chairs and tall windows. This is an interpretive prototype inspired by the existing panorama, not a measured reconstruction of a documented office. Materials and lighting are deliberately at the same prototype level as Snow's office; period-specific detailing remains a later art pass. No new evidence or historical assertions are introduced by the decorative ledger ruling or drawer labels.

## Flow and controls

Receive Snow's assignment, then use the existing map or Broad Street registrar exit. Arrival faces the open ledger from the public side of the table. Select the book/table or its Ledger label to open the existing registrar dialogue and collect the timeline evidence. The door returns to Snow's office, where the same plotted-address review remains available. Selecting the door or entering its marked floor ring both work. Leaving without collecting the records remains possible, as with existing map travel.

WASD and arrow controls, floor teleportation, controller selection, squeeze panel access and snap turning are shared with the office and street. Furniture and room walls constrain artificial movement with a 25 cm clearance. The table, counter, archive cases, bench and chairs have collision envelopes; windows are not exits. Physical room-scale movement still follows the headset's real play boundary and cannot be stopped by virtual furniture. Panels suppress movement and automatic exit, and closing a panel while standing in a ring does not trigger a jump.

## Editable assets

- `src/walkable/registrar-layout.json`: 8 × 8.4 m footprint and 3.5 m ceiling, with furniture, arrival, ledger target and door positions. Dimensions are design choices, not historical measurements.
- `scripts/assets/build_registrar_room.py`: deterministic Blender generator using that layout.
- `assets/registrar-room/registrar-room.blend`: packed, editable model with individually named pieces.
- `public/models/registrar-room.glb`: merged browser export, approximately 1.4 MB, 18,976 triangles and 13 material batches.
- `assets/registrar-room/build-report.json`: geometry counts and the exact layout used during export.
- `src/walkable/RegistrarRoom.ts`: configures the shared `FurnishedRoom.ts` with registrar assets and the existing ledger hotspot.

```sh
blender --background --factory-startup --python scripts/assets/build_registrar_room.py
npm run test:walkable
VITE_BASE_PATH=/vr-snow/walkable/ npm run build
```

The room uses the project's original wood texture and simple materials, no real-time shadow maps, and no new dependency. Model loading has a usable furnished fallback. Other scenes keep their existing assets and interactions.

## Validation and headset check

All 31 automated checks and the production build passed. Tests cover the office/street/registrar/panorama lifecycle, furniture sweep collisions, reachable approaches, ledger/door targeting, controller interaction, panel blocking, automatic return, evidence retention and asset budgets. Browser checks confirmed map entry, physical ledger selection, timeline evidence collection, the return door, the next Snow dialogue, and no console warnings/errors.

On Quest, check:

1. Fresh room loading, scale and smoothness while looking along the shelves.
2. Ledger label and book selection from the arrival position and a seated height.
3. Teleporting to clear floor around the table; rejection of the counter, furniture and walls.
4. Door selection and automatic entry into its ring; exactly one return to Snow, with evidence retained.
5. Panel placement after moving, snap turning with a tracked head offset, and repeated map travel between all three 3D scenes and a panorama.

Headset frame rate, readability and comfort have not been validated by desktop checks. Detailed textures, aged surfaces, more historically specific fittings and refined lighting remain outside this prototype milestone.
