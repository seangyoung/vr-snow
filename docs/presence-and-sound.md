# Brewery detail, seated Snow and sound — October 2026

This pass implements the three agreed priorities in order on `walkable-prototype`. It is available for local review; deployment is a separate step.

## Brewery materials and close-up objects

The brewhouse retains its original layout and collision envelopes. Copper vessels now have subtle sheet variation, lap joints, rivet heads and firebox fittings. Timber grain follows each piece's longest axis. Casks and the vat have separate staves, recessed cask heads and board joints; the table has individual boards and pegs. Cups have handles and the sacks have irregular soft sides and stitched seams.

`brewery_finish.py` creates seeded 512-square color and roughness maps for timber, copper and sacking. These are original computed textures, not downloaded photographs. `build_brewery_room.py` packages them in the GLB and rebakes the light atlas. Small fittings use a neutral lighting patch to avoid dark, subpixel islands. Copper stays within a restrained brown/orange range rather than presenting heavy green corrosion on brewing equipment.

The room remains an interpretive brewhouse rather than a reconstruction of a surveyed Lion Brewery interior. These additions refine the existing prop vocabulary; they do not establish that any particular fitting was documented at Lion Brewery.

Geometry is 23,332 triangles and 13 material batches, within the existing 30,000-triangle / 16-batch room budget. No additional gameplay targets were introduced.

## Snow character

Snow now uses an anatomical MakeHuman base with an editable Blender rig, connected hands and fingers, textured skin, alpha-tested eyes/brows/hair, and an adapted coat, waistcoat, linen collar and cravat. His pose and face proportions are interpretive. The portrait reproduced in [UCLA's images of John Snow](https://epi-snow.ph.ucla.edu/Stream1_introduction_b.html) remains a visual reference; this is not a verified likeness or a reconstruction of his exact clothing. No portrait pixels are embedded in the game.

The authoritative source is `assets/snow-character/snow-source.blend`. Its rig, shape keys and packed textures remain editable. `scripts/assets/build_snow_character.py` reads that file, evaluates the pose and clothing masks, reduces selected geometry, bakes office lighting, and exports only the figure. It does not overwrite the authored source. The separate `snow-character.blend` is a generated office-reference preview. The asset stays within the existing 30,000-triangle, 12-batch and 3 MiB GLB limits, with 11 material batches. Four embedded surface textures supplement the existing 1024-square light atlas and 256 × 128 environment. This adds surface texture memory but no runtime skeleton, dynamic lights or shadow maps. The office's own assets are unchanged.

The imported base, rig and system assets are CC0; see the [source and build guide](../assets/snow-character/SOURCE.md), checksummed `makehuman-provenance.json`, and shipped [asset license](../public/licenses/makehuman-assets.txt). MPFB is an optional authoring dependency, not an app dependency. Other scene figures retain their existing construction until this Snow pilot is reviewed.

`SnowCharacter.ts` loads once, with no skeleton or animation mixer. The torso moves at most 1.5 mm vertically and the head turns at most 0.014 radians. A live `prefers-reduced-motion` media query disables those idle motions. The room's baked shadows remain static.

A stable selection proxy opens the existing John Snow conversation for controller rays, desktop click and the keyboard reticle. Furniture continues to occlude targeting. The old floating desk proxy is suppressed when the figure is available; the physical desk remains selectable. If either the actor model or its lighting fails, the desk interaction and office remain usable.

Snow's nameplate is now a small hover label above the figure, with no persistent floating button. It appears when the mouse, keyboard reticle or a connected controller ray hits the figure, and disappears when aiming away or opening a panel. Aiming at the desk still opens the conversation but does not show the figure's label.

## Sound and controls

`Soundscape.ts` uses standard Web Audio with original generated air and fallback effects plus 15 curated recorded foley clips. Each walkable scene has a distinct sparse sound profile; see [the ambience pass](ambience-pass.md). These are illustrative modern sounds, not recordings claimed to reproduce 1854 Soho. There is no music, speech synthesis, intelligible background dialogue, or new runtime dependency.

- Sound initializes only on pointer, keyboard or XR selection input.
- Desktop: open **Sound settings** from the tool rail or chapter panel. Tab/arrows, Enter/Space and Escape use the existing keyboard panel behavior.
- VR: open the usual panel, then **Sound** in its header. Mute and separate ambience/effects volume buttons are available there.
- Defaults are 20% ambience and 35% effects, with an additional conservative master gain. Levels are clamped and saved locally when browser storage is available.
- Footsteps follow horizontal distance while movement is allowed. Teleport-sized jumps, turning, vertical head movement and open panels do not generate steps.
- Conversation, evidence, notebook and map panels reduce ambience to 22% of its selected level, with a smooth return on closing. Sound settings retain full selected ambience for adjustment.
- Scene ambience crossfades; retired audio nodes are disconnected. Muting and background document/XR system-menu visibility silence playback. Returning document visibility alone cannot override an XR visibility mute.
- Audio initialization/resume failures remain non-fatal. A blocked resume can retry on the next gesture.
- Evidence, dialogue, action state and all clues remain available visually. Sound settings do not clear an active VR dialogue answer or alter evidence.

Three generated mono fallback buffers occupy approximately 2.04 MiB as float samples. Recorded mono WAVs add 874,052 bytes (0.83 MiB) to downloads and 19.8 seconds of decoded audio (about 3.63 MiB at 48 kHz). Two cached four-step sequences add roughly 0.70 MiB at 48 kHz. There is one current air loop and at most two current ambient events; brief fading sources overlap on travel with bounded cleanup. Recordings load after a gesture with two download/decode workers and graceful fallback. Licenses, modifications and file hashes are shipped under `public/audio/`.

## Validation and review limits

103 automated checks cover existing travel/collision/evidence, actor selection and failure handling, solid exported torso coverage from front and back, palm thickness and finger placement above the desk, retention of authored vertex albedo, mouse/reticle/controller hover labels and panel suppression, exported geometry/UV budgets, bounded idle motion, sanitized preferences, gesture-based initialization, finite audio samples, loop cleanup, mute/levels, document/XR suspension and preservation of conversation state. The production build is required before handoff. The existing Vite bundle-size advisory remains.

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
