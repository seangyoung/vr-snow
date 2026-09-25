# Snow's office: first walkable interior

A compact furnished room replaces the office panorama on `walkable-prototype`. The desk opens the existing John Snow conversation and, when ready, the existing evidence review. Map and notebook access, assignment prerequisites, and the Board preparation gate are unchanged.

This is an interpretive room based on the existing panorama's timber, books, writing desk, fireplace and daylight palette. It is not a documented reconstruction of Snow's actual office, furniture or floor plan. The first milestone establishes scale, movement and interactions; detailed surface art and a character representation remain future work. The original panorama is retained in the repository.

## Layout and interaction

- Room: 5.8 × 6.4 m, ceiling 3.25 m. These are design dimensions, not historical measurements.
- Arrival: near the door, facing the desk, outside the exit zone. A clear aisle runs from the door to the desk's front/right side.
- Desk, chair, bookcase, fireplace and cabinet block artificial movement. A 25 cm clearance surrounds their footprints and the room perimeter. Sweep checks reject crossing furniture even between two valid endpoints.
- Select the desk or its Snow label to talk/review. Books and decorative items have no new actions.
- Select the modeled door or enter its marked ring to reach Broad Street after receiving the assignment. Opening a panel, unlocking while inside a ring, and returning to the office do not cause an automatic exit.
- Desktop: WASD walking; Up/Down forward/back and Left/Right turning; drag to look; select clear floor to teleport. Enter/Space activates the centered desk/exit.
- WebXR: existing controller-ray select, floor teleport, squeeze panel access and snap turning. All essential interaction is possible by ray from a seated position; there is no requirement to reach over the desk.
- Collision constrains artificial movement. It cannot stop a person physically walking through furniture; use the headset's real play boundary.

## Source and rebuild

`src/walkable/office-layout.json` is the shared layout read by the Blender generator and runtime furniture proxies. `WalkableArea.ts` provides reusable rectangular bounds and swept collision. `SnowOffice.ts` supplies the room, selection, lighting, model loading and a usable furnished fallback. `BroadStreetScene` chooses the active street/office environment for input, scene entry, controller targeting and focus.

```sh
blender --background --factory-startup --python scripts/assets/build_snow_office.py
npm run test:walkable
VITE_BASE_PATH=/vr-snow/walkable/ npm run build
```

The editable source is `assets/snow-office/snow-office.blend`, with separate named pieces and packed texture data. The export `public/models/snow-office.glb` joins geometry into 14 material batches, totals 12,144 triangles and is approximately 1 MB. It reuses the project's original timber texture. `assets/snow-office/build-report.json` records geometry counts and the layout used to generate the asset. No realtime shadows, transparency layers, physics engine or additional package dependencies are introduced.

## Verification

All 27 automated checks passed, including the existing street regressions, office floor/furniture clearance, controller desk targeting and teleporting, automatic exit prerequisites, duplicate-transition protection, office/street/panorama lifecycle, and the GLB budget/layout check. The production build passed. Browser checks exercised arrival, the desk label and assignment dialogue, floor teleport beside the desk, the modeled exit door, correct street arrival, and map return to the furnished office.

## Headset acceptance check

1. Load a fresh tab and enter VR. Confirm arrival is clear of furniture, Snow's desk is visible, and scale/eye height feel plausible.
2. Select the desk with each controller while seated and standing. Receive the assignment; reopen the dialogue after moving.
3. Teleport to the front and right of the desk. Aim beneath the desk, at the chair, through the bookcase and outside the room. Invalid destinations must not move you.
4. Take a small tracked step and snap turn both ways. Confirm turning does not shift your position. Squeeze the panel open and verify it appears in front of your current position; movement must stop while it is open.
5. Select the door, return from Broad Street, then enter the door ring. Confirm one transition each time. Repeat map travel through a panorama scene and back to the office, retaining evidence and the 3D room.
6. Once enough evidence is collected, select the desk and complete the normal Snow review before the Board. Confirm the review UI is reachable after moving around the office.

On-device frame rate, seated readability, furniture scale and transition comfort remain unverified. Record those before treating this room as ready for learners.
