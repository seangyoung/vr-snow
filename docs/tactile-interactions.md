# Tactile interactions in the walkable prototype

## Controls

- Broad Street and workhouse: approach the pump and select its handle (mouse, Space/Enter on the center target, or controller trigger or grip). Each press runs one lift-and-press cycle, with a short water burst and a synchronized recorded pouring/splashing sound. The sound follows the Effects volume and mute settings, and stops when flow ends, on travel, or when the app loses visibility. Select the pump body for its investigation panel. The Broad Street handle is unavailable after its removal by the Board.
- VR objects: aim at a portable object within 5 metres and hold the grip. Move/turn the controller or use the right stick to spin and tilt it. To pass it to the other hand, bring the free hand near the item (within 18 cm of its bounds), or aim at the item, and squeeze that grip. Ownership transfers without returning home or resetting orientation. Releasing the former hand has no effect; releasing the receiving hand returns it. Stick click opens the menu (or pages through an open multipage panel).
- Desktop objects: click, or aim with the center target and press Space/Enter, to lift. Q/E spins and R/F tilts it; another click, Space/Enter, or Escape returns it. Dragging still turns the view without selecting anything.
- Opening panels, scene travel, reset, controller disconnect, leaving VR, or losing page focus restores held objects. Releasing never activates a person or teleport destination behind the object.

The inventory contains 258 portable items across eight furnished scenes, including shelf books, desk papers, instruments, bottles, household belongings, workhouse buckets and Board papers. Heavy furniture, fixed fittings, filled grain sacks and brewing equipment remain scenery. Selected objects display a small non-modal information card; the stethoscope and inhaler include museum collection references. While held, ordinary objects retain a name label that follows them, without release or rotation instructions. Objects with an information card omit this duplicate name label. These optional interactions neither award evidence nor change the investigation's progression.

## Rendering and animation

`InspectableProps.ts` extracts the existing object triangles from material-batched room meshes once during loading. It preserves textures, normals and baked UVs and removes those triangles from the static mesh. Resting objects are combined into shared material batches. A held/returning item renders separately while its home triangles are hidden, then rejoins the resting batch. Objects retain their baked surface lighting; static contact shading on furniture is not dynamically rebaked. No physics engine, throwing, breakage or persistent object inventory is involved. A bounded 0.6-second easing returns each item to its original position and rotation; reduced motion returns it immediately.

`PumpAction.ts` uses a pivot for the existing iron handle and one instanced mesh containing 28 water drops/splashes. It allocates no particles during animation and stops after a single stroke. Trigger/select or a grip squeeze starts one pump stroke; holding the grip does not repeat strokes or detach the handle. This remains a bounded animation rather than a constrained hand-tracked lever simulation. The 42 KB public-domain pouring excerpt is bundled with the app and loads first after an audio gesture; generated water remains a fallback for download/decode failures. See `public/audio/credits.html` and `sources.json` for provenance.

`CharacterIdle.ts` applies gentle breathing, head turns and weight shifts in a common coordinate system across each actor's meshes. This avoids seams from independently moving the face, neck, hands or garments. Feet and selection/collision volumes remain stable. All characters honor the OS reduced-motion preference. This is idle movement, not speech animation.

## Validation

Automated coverage includes actual exported room geometry and UV preservation, exact return transforms, single-object ownership, tracked rotation, reduced motion, pump lifecycle, range/occlusion, input consumption and scene/interruption cleanup. The existing investigation, keyboard, outside-panel dismissal and locomotion checks remain required.

Headset review still needs to confirm controller reach/rotation, grip-release event timing and right-stick spin/tilt, opening a panel while holding, disconnect/session interruption, water visibility, idle motion and frame rate on Quest. Build and desktop checks do not establish headset performance.
