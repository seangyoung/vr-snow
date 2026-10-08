# Brewery detail, seated Snow and sound — October 2026

This pass implements the three agreed priorities in order on `walkable-prototype`. It is available for local review; deployment is a separate step.

## Brewery materials and close-up objects

The brewhouse retains its original layout and collision envelopes. Copper vessels now have subtle sheet variation, lap joints, rivet heads and firebox fittings. Timber grain follows each piece's longest axis. Casks and the vat have separate staves, recessed cask heads and board joints; the table has individual boards and pegs. Cups have handles and the sacks have irregular soft sides and stitched seams.

`brewery_finish.py` creates seeded 512-square color and roughness maps for timber, copper and sacking. These are original computed textures, not downloaded photographs. `build_brewery_room.py` packages them in the GLB and rebakes the light atlas. Small fittings use a neutral lighting patch to avoid dark, subpixel islands. Copper stays within a restrained brown/orange range rather than presenting heavy green corrosion on brewing equipment.

The room remains an interpretive brewhouse rather than a reconstruction of a surveyed Lion Brewery interior. These additions refine the existing prop vocabulary; they do not establish that any particular fitting was documented at Lion Brewery.

Geometry is 23,332 triangles and 13 material batches, within the existing 30,000-triangle / 16-batch room budget. No additional gameplay targets were introduced.

## Snow character

An original, stylized seated figure occupies the existing chair behind Snow's desk. His clothing, hair and sideburns are informed by the portrait reproduced in [UCLA's images of John Snow](https://epi-snow.ph.ucla.edu/Stream1_introduction_b.html). That page discusses uncertainty about the photograph's date (1856/1857). Clothing colors, body proportions and pose here are interpretive; the face is not a photoreal reconstruction or a verified likeness. No portrait pixels are embedded in the game.

The figure uses a dark coat, waistcoat, high collar, dark neckwear and boots. The second character pass replaces the primitive nose and facial outline with a continuous shaped surface, recessed almond-shaped eyes, small eyelids, tapered eyebrows and surface-following hair and sideburns. A shorter exposed neck and blended coat shoulders improve the seated silhouette. The torso is capped before voxel remeshing so its chest and abdomen remain solid. Palms and cuffs are flattened, fingers have tapered sections and distinct lengths, and thumbs angle away from the palm; forearms reach forward to rest the fingers on the desk. Folded lapels have thickness and consistent outward normals; their thin faces use the neutral irradiance patch to avoid black self-shadow artifacts in the atlas; original vertex colors provide restrained skin warmth and cloth/hair variation. This is a more naturalistic modeled figure, not a photoreal scan. Close-range facial quality should still be reviewed before extending characters to the other scenes.

`scripts/assets/build_snow_character.py` loads the office Blender source as a lighting reference, builds the figure, bakes a 1024-square atlas and 256 × 128 environment, then exports only the character. The packed source retains the reference office for editing. The resulting actor has 29,422 triangles and 12 material batches; the atlas requires roughly 5.33 MiB with RGBA8 mipmaps. The actor stays under 30,000 triangles, 12 batches and a 3 MiB GLB budget. The larger atlas supports the connected face without adding dynamic lights or a skeleton. The office's own assets are unchanged.

`SnowCharacter.ts` loads once, with no skeleton or animation mixer. The torso moves at most 1.5 mm vertically and the head turns at most 0.014 radians. A live `prefers-reduced-motion` media query disables those idle motions. The room's baked shadows remain static.

A stable selection proxy opens the existing John Snow conversation for controller rays, desktop click and the keyboard reticle. Furniture continues to occlude targeting. The old floating desk proxy is suppressed when the figure is available; the physical desk remains selectable. If either the actor model or its lighting fails, the desk interaction and office remain usable.

Snow's nameplate is now a small hover label above the figure, with no persistent floating button. It appears when the mouse, keyboard reticle or a connected controller ray hits the figure, and disappears when aiming away or opening a panel. Aiming at the desk still opens the conversation but does not show the figure's label.

## Sound and controls

`Soundscape.ts` uses Web Audio with no external recordings, speech synthesis or new dependencies. It generates low-level air near a window/door, a brief distant cart/hoof impression outdoors, surface-dependent footsteps, paper handling and soft selection/evidence cues. These are illustrative ambience, not recordings claimed to reproduce 1854 Soho. There is no music or voiced dialogue in this pass.

- Sound initializes only on pointer, keyboard or XR selection input.
- Desktop: open **Sound settings** from the tool rail or chapter panel. Tab/arrows, Enter/Space and Escape use the existing keyboard panel behavior.
- VR: open the usual panel, then **Sound** in its header. Mute and separate ambience/effects volume buttons are available there.
- Defaults are 20% ambience and 35% effects, with an additional conservative master gain. Levels are clamped and saved locally when browser storage is available.
- Footsteps follow horizontal distance while movement is allowed. Teleport-sized jumps, turning, vertical head movement and open panels do not generate steps.
- Scene ambience crossfades; retired audio nodes are disconnected. Muting and background document/XR system-menu visibility silence playback. Returning document visibility alone cannot override an XR visibility mute.
- Audio initialization/resume failures remain non-fatal. A blocked resume can retry on the next gesture.
- Evidence, dialogue, action state and all clues remain available visually. Sound settings do not clear an active VR dialogue answer or alter evidence.

Three generated mono buffers occupy approximately 2.04 MiB as float samples (8 s air, 16 s cart and 0.3 s effects, at 22,050 Hz). There are at most two current looping spatial sources; brief fading sources overlap on travel. No audio files add to the download.

## Validation and review limits

74 automated checks cover existing travel/collision/evidence, actor selection and failure handling, solid exported torso coverage from front and back, palm thickness and finger placement above the desk, retention of authored vertex albedo, mouse/reticle/controller hover labels and panel suppression, exported geometry/UV budgets, bounded idle motion, sanitized preferences, gesture-based initialization, finite audio samples, loop cleanup, mute/levels, document/XR suspension and preservation of conversation state. The production build is required before handoff. The existing Vite bundle-size advisory remains.

Offline Blender views were reviewed at room and close-up scales; they do not reproduce the browser's tone mapping or environment reflections. Browser visual automation was previously blocked for this local preview, so no browser screenshot or listening test is claimed. Actual sound balance, spatialization, keyboard focus, controller selection and performance require desktop/headset review.

Rebuild and preview:

```sh
blender --background --factory-startup --python scripts/assets/build_brewery_room.py
blender --background --factory-startup --python scripts/assets/build_snow_character.py
# Optional offline pose review:
blender --background --factory-startup --python scripts/assets/review_snow_character.py -- /private/tmp/snow-review
npm run test:walkable
VITE_BASE_PATH=/vr-snow/walkable/ npm run build
VITE_BASE_PATH=/vr-snow/walkable/ npm run preview -- --port 4173 --strictPort
```

Review the brewery from the table and aisle, then Snow from standing/seated height. Select Snow directly and through the desk, reopen the notebook, adjust both sound channels and mute, travel between rooms, and open/close the headset system menu. Check for audible clicks at loop seams, excessive repetition, material shimmer and first-entry stalls.
