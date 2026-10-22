# Household environment pass — October 2026

This pass gives the three composite households different domestic identities while preserving their locations, scene boundaries, evidence identifiers, and conversation progression. Developed on `codex/household-environments`, it was approved and promoted to `main` on 22 October 2026. The implementation is preserved in commit `322a2d5009234971a932a0e8ab74546fa1597dec`.

## Three interiors

- **Household 1:** subdued plaster, a partly drawn curtain, bedside linen, a feeding boat, and an ill father resting under a coverlet. His daughter describes nursing him after losing her sister. This is authored composite testimony, not an identified historical family. The father has no separate interview or evidence reward. A very small coverlet movement suggests breathing and respects reduced-motion settings.
- **Household 2:** cream walls, green cloth, a shelf of fabric remnants, scissors, pins, and a solid flat iron on a pressing cloth. The furnishings suggest paid mending and domestic work without changing the witness's evidence.
- **Household 3:** faded geometric wallpaper, red-brown curtains and cloth, picture rails, a hearth rug, tea caddy, travel case, and stored warming pan. The wallpaper is an original interpretive pattern, not a reproduced historic design.

The sash windows now have openings and neighboring masonry beyond them, producing parallax as the player moves. Existing layouts and furniture collision bounds remain authoritative; new furnishings are kept around those footprints.

## Pickups and collection references

New portable groups include linen, spare blankets, cloth remnants, candlesticks, a feeding boat, flat iron, scissors, pincushion, tea caddy, travel case, and warming pan. The occupied bed's pillow is fixed. Interesting objects use the existing nonmodal held-object panel; ordinary belongings retain their hover labels. Existing inkwells in other scenes also gain a short collection-backed note.

The models are original, simplified geometry. Collection photographs are linked from the notes, not copied into the app:

- [Southwark Heritage: flat iron, 1850–1900](https://heritage.southwark.gov.uk/objects/21726/flatiron)
- [Historic Odessa: English warming pan, 1790–1850](https://historicodessa.org/collections/museum/warming-pan-or-bed-warmer-1971-944)
- [Wellcome Collection: pap boat and feeding cup, c.1850](https://wellcomecollection.org/works/v89pgj6q)
- [Museum of the Home: wooden tea caddy, c.1750–1800](https://collections.museumofthehome.org.uk/object18568)
- [London Museum: nineteenth-century glass inkwell](https://www.londonmuseum.org.uk/collections/v/object-500513/inkwell/)

Older collection objects illustrate items that could remain in use, rather than establishing ownership by these fictional households. No extra historical caveat panels are added to the experience.

## Materials, lighting, and people

Original procedural plaster, timber, woven cloth, and paper textures now have base-colour, roughness, and subtle normal detail. Colour and roughness maps are 512 px; normal maps are 256 px. The three rooms use 2048 px baked-lighting atlases with different window/bounce illumination. There are no new realtime shadow lights. Room GLBs remain below the existing 4 MiB budget; the supplementary patient has its own small mesh and 1024 px lightmap.

The household witnesses have different clothing palettes, body proportions, lower-face shaping, and hair colour. Their previously approved anatomical poses and interaction targets are preserved. The resting father derives from the existing MakeHuman anatomy under the same asset provenance; his torso and legs are covered by an original authored nightshirt/coverlet rather than exposed incomplete anatomy.

## Editable sources and rebuilding

- `scripts/assets/build_household_room.py` and `household_details.py`: room geometry, domestic props, textures, and lighting.
- `scripts/assets/refine_household_people.py`: idempotent authoring adjustments to the saved household figures. Routine exports read those saved sources.
- `scripts/assets/build_household_patient.py`: resting figure and bed coverlet.
- `assets/scene-people/*.blend`: authoritative witness sources.
- `assets/household*-room/`, `assets/household*-characters/`, and `assets/household-patient/`: packed Blender exports and reports.
- `src/walkable/portable-props.json`: generated pickup bounds and mesh groups.

```sh
for scene in household household-routines household-away; do
  blender -b --factory-startup --python-exit-code 1 --python scripts/assets/build_household_room.py -- "$scene"
  blender -b --factory-startup --python-exit-code 1 --python scripts/assets/build_scene_characters.py -- "$scene"
done
blender -b --factory-startup --python-exit-code 1 --python scripts/assets/build_household_patient.py
blender -b --factory-startup --python-exit-code 1 --python scripts/assets/build_prop_manifest.py
npm run test:walkable
npm run build
node scripts/test-web-app.mjs dist /vr-snow/
```

## Validation boundaries

All 273 automated checks, the production build, and web-app installation checks pass. Automated coverage includes scene/character budgets, reachability, dialogue convergence and single rewards, patient placement within the bed, reduced-motion breathing, the fixed occupied pillow, and complete artifact pickup/rotation/return. Browser review covers all three interiors and actual desktop pickup clicks, inspection panels, release, and the revised interview.

Quest performance, texture clarity at headset resolution, perceived bedside anatomy, and seated/standing controller reach still require device review. The pass does not claim photorealism or a measured headset frame rate.
