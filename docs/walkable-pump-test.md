# Pump approach experiment

Broad Street's panorama is replaced with a source-informed reconstruction of the Broad/Cambridge Street junction. Movement remains around the intersection while modeled streets extend into the distance. See [the reconstruction notes](broad-street-reconstruction.md) for references, inferred dimensions and asset rebuilding. The pump dialogue and evidence card retain their existing wording and unlock behavior.

## Controls

First speak with Snow and ask where to begin. Open the map and travel to Broad Street Pump.

- **Headset:** close the panel, aim at clear ground, and use the controller's primary select action to teleport. A `Move here` label identifies accepted destinations; `Blocked` identifies ground without enough clearance. Select the pump itself to open its dialogue.
- **Turning:** move a standard thumbstick/touchpad horizontally. Turns are 45 degrees around the tracked viewer.
- **Tools:** squeeze the controller grip to toggle the existing panel, map, and notebook. Selecting the pump also opens its dialogue panel. Movement is disabled while the panel is open.
- **Desktop keyboard:** W/S or Up/Down walk forward/back; A/D strafe left/right; Left/Right turn. Hold keys for continuous movement. Diagonal movement has the same speed as straight movement. Movement stops at the pump and street boundaries, while overlays are open, or when keyboard focus leaves the scene. Release and press again to resume after a focus change.
- **Desktop/touch:** drag to look, click/tap clear ground to teleport, and click/tap the pump to inspect. Dragging does not also teleport. The existing map and notebook buttons remain available. Enter/Space can activate the pump when centered; keyboard shortcuts do not fire through open overlays or focused UI controls.

The implementation uses WebXR `select`/`squeeze` events and the [standard gamepad mapping](https://www.w3.org/TR/webxr-gamepads-module-1/). It does not check headset brand or assume left/right controller order. Artificial turning requires the standard gamepad mapping; unknown mappings retain physical head/body turning. Quest controllers are the first intended hardware target; other WebXR controller systems remain unverified. Articulated hand interaction is outside this slice.

## Five-minute headset check

1. Receive Snow's assignment, enter VR, travel to Broad Street, and close the panel. Confirm the pump has depth as you lean sideways.
2. Select three ground positions, including one beside and one behind the pump. Confirm arrival is under your head, not offset by where you started in the physical room. The viewpoint should retain its height and heading.
3. Aim near the base and building fronts and the ends of the walkable slice. Confirm `Blocked` destinations do nothing; pointing at solid geometry never teleports through it.
4. Take a small physical step to one side, then turn in both directions using the stick. Confirm there are no persistent Tools or turn buttons following your head. Confirm there is no sideways jump. Repeat with the other controller.
5. Select the pump, ask what the water sample showed, and verify **Pump water gives no decisive visible proof** appears in the notebook. Confirm the card is collected only once.
6. Squeeze to open the panel, travel to Snow's Desk, and return. Confirm the street spawn is restored and the evidence retained. Check the map still works.
7. Exit/re-enter VR while on Broad Street, then reset the inquiry. Confirm height, panel placement, and the return to Snow's Desk. If possible, repeat seated and with only one controller active.

Record Quest model, browser version, controller setup, readability, any unexpected motion, and whether movement stays smooth. This checklist requires real hardware; desktop verification and math tests do not establish headset comfort or frame rate.

## Scope and implementation

- `src/walkable/PumpCourtyard.ts`: geometry, ray obstruction, destination boundaries and pump clearance.
- `src/walkable/locomotion.ts`: viewer-relative teleport, rotation about the viewer, and standard axis reading.
- `BroadStreetScene`: connects these modules to the existing rig, controller rays, panels and location lifecycle. Pump selection delegates to the existing `GameState` dialogue.
- `src/walkable/DesktopMovement.ts`: desktop key state, walking, turning, and swept collision checks.
- No continuous VR movement or object grabbing. Collision checks constrain desktop walking and teleport destinations; they do not prevent a person from physically walking through virtual geometry. Stay within the headset's physical play boundary.
- Tests: `npm run test:walkable`; production build: `VITE_BASE_PATH=/vr-snow/walkable/ npm run build`.

The public walkable URL changes only after this branch is committed, pushed, validated, and deployed. Local work alone does not update it.

## Verification completed

- The original twelve automated checks passed, including offset-preserving teleport and eight consecutive snap turns without viewer translation.
- The user confirmed the street-entry freeze fix on Quest. The controller-path regression now exercises pump targeting and selection, squeeze panel access, panel blocking, and ground teleportation using the actual scene methods.
- Keyboard checks cover direction, diagonal speed, turning, swept pump collision, wall sliding, released keys, focus-state clearing, and frame timing. Browser checks confirmed forward movement, arrow turning, and no movement from arrow input while the map was open.
- Production build passed with `/vr-snow/walkable/` as its asset base.
- Desktop production preview: Snow assignment, map travel, ground teleport, drag-to-look, geometry selection, evidence collection, notebook entry, and return to Snow's panorama passed. No browser console errors were reported during that check.
- The floating controls were removed after Quest feedback. Their removal, VR panel placement after movement, one-controller operation, seated use, and other headsets still need hardware verification.


## Reconstruction check (September 2026)

Repeat the headset checklist with the new environment. Confirm the pump is immediately visible on arrival, the continuous terrace stands opposite the Cambridge mouth, rooflines have no missing faces, and the ground remains comfortable when crossing a curb. Inspect loading on a fresh headset tab, then travel to the desk and back. Record performance separately from the earlier schematic street. The reconstruction itself retains the existing pump interaction; the scene connections below add travel targets.


## In-world travel check

1. Before reviewing the registrar addresses with Snow, confirm the brewery, workhouse and household signs are locked. Selecting them or entering their rings must not travel.
2. Use the southbound registrar sign, collect the ledger evidence, and use its return target to reach Snow. Review the plotted addresses. Return to Broad Street and confirm the three field destinations unlock.
3. Enter each marked street ring by walking on desktop or by ground teleport/physical movement in VR. Confirm one scene change, preserved evidence, and return to the normal street spawn. Select a sign with each controller as an alternative.
4. Select the highlighted household door itself. Confirm it opens the same household scene as the map. Use its return target, then test the map again.
5. Open a panel while in a ring, then close it. Confirm there is no surprise jump. Leave and re-enter to travel. Repeat scene entry and check for accidental repeat transitions.
6. Inspect stationary return labels in the household, brewery, workhouse and registrar scenes. They should remain fixed as you turn your head, and should not block interview targets.

Automated coverage includes actual controller selection, tracked viewer zone entry with a room-scale offset, panel blocking, unlock-while-inside behavior, duplicate desktop-transition prevention, occlusion, reachable approach centers and evidence retention. Browser checks exercise sign/door selection, return travel and the existing map. Automatic travel comfort and sign readability still require the headset check.

For the travel-target revision, all 21 automated checks and the production build passed. The browser check confirmed locked signs, registrar travel and return, household door entry, map travel, visible ground rings, and non-overlapping household/brewery labels. No browser warning/error messages were recorded. Quest testing remains outstanding.

Snow’s office now also supports walking and teleportation. See [the office test card](walkable-office.md) for the furnished room, doorway and shared movement changes.
