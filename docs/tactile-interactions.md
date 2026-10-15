# Tactile interactions in the walkable prototype

## Controls

- Broad Street: approach the pump and select its handle (mouse, Space/Enter on the center target, or controller trigger). Each selection runs one lift-and-press cycle, with a short water burst and a quiet synthesized water sound. Select the pump body for its existing investigation panel. The handle is unavailable after the completed scenario.
- VR objects: aim at an inspectable object within 2.4 metres and hold the trigger. Move and turn the controller to inspect it. Release to return it. Grip continues to open the menu.
- Desktop objects: click, or aim with the center target and press Space/Enter, to lift. Q/E rotates it; another click, Space/Enter, or Escape returns it. Dragging still turns the view without selecting anything.
- Opening panels, scene travel, reset, controller disconnect, leaving VR, or losing page focus restores held objects. Releasing never activates a person or teleport destination behind the object.

The first set consists of Snow's wooden stethoscope and medical case book; the registrar's open returns ledger; the household jug and cup; and the brewery account book and two mugs. Other furniture remains scenery. These optional interactions neither award evidence nor change the investigation's progression.

## Rendering and animation

`InspectableProps.ts` extracts the existing object triangles from material-batched room meshes once during loading. It preserves textures, normals and baked UVs and removes those triangles from the static mesh. The compact extracted buffers add only the relevant material batches. Objects retain their baked surface lighting; static contact shading on furniture is not dynamically rebaked. No physics engine, throwing, breakage or persistent object inventory is involved. A bounded 0.6-second easing returns each item to its original position and rotation; reduced motion returns it immediately.

`PumpAction.ts` uses a pivot for the existing iron handle and one instanced mesh containing 28 water drops/splashes. It allocates no particles during animation and stops after a single stroke. The pump gesture is a trigger/select action in this version, rather than a constrained hand-tracked lever simulation.

`CharacterIdle.ts` applies gentle breathing, head turns and weight shifts in a common coordinate system across each actor's meshes. This avoids seams from independently moving the face, neck, hands or garments. Feet and selection/collision volumes remain stable. All characters honor the OS reduced-motion preference. This is idle movement, not speech animation.

## Validation

Automated coverage includes actual exported room geometry and UV preservation, exact return transforms, single-object ownership, tracked rotation, reduced motion, pump lifecycle, range/occlusion, input consumption and scene/interruption cleanup. The existing investigation, keyboard, outside-panel dismissal and locomotion checks remain required.

Headset review still needs to confirm controller reach/rotation, trigger-release event timing, opening a panel while holding, disconnect/session interruption, water visibility, idle motion and frame rate on Quest. Build and desktop checks do not establish headset performance.
