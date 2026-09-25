# Broad Street junction reconstruction

This is a source-informed, approximate 1854 environment, not a surveyed model or a claim that every frontage is documented. The existing panorama supplies the muted brick, dark timber, stone and overcast atmosphere. The street network comes from historical mapping, checked against present-day views. The original panorama remains unchanged.

## Evidence and interpretation

References inspected on 24 September 2026:

| Reference | Use in this scene | Limits |
| --- | --- | --- |
| [UCLA Stream 2 photo tour](https://epi-snow.ph.ucla.edu/Stream2_BSPoutbreak_c.html) and its [annotated historical map](https://epi-snow.ph.ucla.edu/graphics/BroadStreet_drawing_map.jpg) | Broad Street runs past a southward Cambridge Street junction; the pump is west of that junction. Dufour's Place is offset to the west, Poland Street to the east. | Relative topology, not measured coordinates. |
| [Calvert facade illustration reproduced by UCLA](https://epi-snow.ph.ucla.edu/graphics/BroadStreet_drawing.jpg) | Seven narrow northern frontages, old numbers 21–15, sash windows, railings, dormers, varied parapets and chimney pots. Nos. 18/19 face the pump area. | An undated artistic view, attributed on the site to the 1830s–40s. Its green overlay identifies properties; it is not evidence of green paint. |
| [UCLA pump photograph](https://epi-snow.ph.ucla.edu/graphics/Broad_Street_Pump052124_800px.jpg) | Slender lower stem, shouldered upper barrel, bands, dome, finial and downward spout. | A modern replica; exact original dimensions and handle shape are not established. |
| [LSHTM account of the pump's return](https://www.lshtm.ac.uk/newsevents/news/2019/john-snow-memorial-pump-marking-historic-cholera-outbreak-reinstalled-its) | Corroborates the returned pump's relationship to the original site beside the present pub. | Does not supply an 1854 measured drawing. |
| [Google Street View, Broadwick Street](https://www.google.com/maps/@?api=1&map_action=pano&pano=_bWWLvgYh5pDmLHIa8vvJQ&heading=215.4&pitch=0&fov=75) | Viewed the August 2024 panorama at 46 Broadwick Street, including the southwest corner, western street corridor and opposite terrace. Checked the T-junction, pavement relationship and enclosed sight lines. | Modern surface treatment, frontage, signage and traffic are not historical evidence. No Google imagery is included in the assets. |

The modern pub building dates later than the story, so the corner is an inferred, restrained period frontage. The reconstruction omits the modern John Snow name, plaques, memorial plinth, vehicles, road markings and modern towers. A working pump handle is an inferred pre-removal detail. Shop windows, material colors and weathering are artistic interpretations, not identified businesses or sampled historical paint.

## Working dimensions

Coordinates use metres, with east approximately +X and south +Z in a street-aligned frame, not geographic bearings. Broad Street's frontage separation is 12 m; Cambridge's is 8.4 m. Most terrace bays are 6 m wide. Pavements are approximately 1.5–1.6 m wide, building parapets 9–11 m high, and the pump 2.27 m high. These are explicit modeling estimates derived from proportions, not measurements extracted from Street View.

The pump is at (-3.8, 0, 1.3), beside the southern curb. Arrival is (1.6, 0, -2), facing the pump across the junction. Movement is limited to a roughly 28 m wide section of Broad Street and the near Cambridge mouth. The roads and buildings continue beyond it for perspective. The travel targets described below mark routes out of this slice.

The visual road is 13 cm below the pavement. Teleport and walking retain a common height datum, so camera height does not bob at the curb. Physical step simulation and precise pavement elevations remain future work.

## Asset workflow

- `assets/broad-street/broad-street.blend`: packed, editable Blender source; geometry grouped by material for efficient export.
- `scripts/assets/build_broad_street.py`: deterministic modular model generator; change dimensions and facade arrangements here and regenerate.
- `scripts/assets/make_street_textures.py`: original procedural color/normal maps and sky, requiring Python, Pillow and NumPy. No third-party photo textures.
- `public/models/broad-street.glb`: browser asset, with embedded textures; no Blender dependency at runtime.
- `assets/broad-street/build-report.json`: mesh counts and building footprints produced by the same generator.
- `src/walkable/PumpCourtyard.ts`: pump geometry, lighting, one-time GLB loading, selection proxies and intersection movement footprint.

Rebuild from the repository root:

```sh
python3 scripts/assets/make_street_textures.py
blender --background --factory-startup --python scripts/assets/build_broad_street.py
npm run test:walkable
VITE_BASE_PATH=/vr-snow/walkable/ npm run build
```

On this Mac, Blender is `/Applications/Blender.app/Contents/MacOS/Blender`. Generated textures are also packed into the `.blend`. Source generation uses seed 1854. The GLB has 16 material batches and approximately 165,000 triangles for the entire visible street network, including distant scenery. Selection raycasts use simple envelopes and the small pump mesh, not all the architectural detail. Glazing is opaque; the street uses no real-time shadow maps or postprocessing. Loading starts at Snow's desk and retains a simple usable street if the asset fails.

## Verification and remaining limits

Automated checks cover movement, facade corner cutting, pump clearance, controller selection, scene travel and evidence retention. Asset checks verify embedded textures, geometry budgets and agreement between generated building footprints and the walking area. Desktop rendering must also be inspected after rebuilding; math checks alone cannot detect a reversed facade or a poor arrival composition.

Quest frame rate, stereo scale, loading and comfort require a fresh on-device check for this more detailed asset. The previous simple street's headset result does not validate this reconstruction. Materials are deliberately economical; measured facade surveys, more specific shopfront evidence and professionally authored surface detail could improve fidelity further.

For this revision, all 15 automated checks and the production build passed. The desktop production preview loaded the authored model without console warnings/errors; pump selection, evidence collection, ground teleportation, travel to Snow's desk and return were exercised. The final exported doors, corner windows and street sight lines were inspected in the browser. These checks do not establish an XR frame-rate result.


## In-world scene connections

Broad Street is the navigation hub. Enter an unlocked marked ring to travel automatically, or select its sign, ring or highlighted household door with the cursor/controller ray. Map travel remains available with the same evidence prerequisites. Locked targets are gray. Opening a panel blocks automatic travel; closing it or unlocking a destination while already inside a ring does not trigger a jump. Leave and re-enter the ring instead.

| Destination | Route from the pump intersection | Basis and limit |
| --- | --- | --- |
| Lion Brewery | East along Broad Street | Existing inquiry map and UCLA's Stream 2 tour. The marker is an exit, not the brewery building. |
| St. James Workhouse | East along Broad Street, then north via Poland Street | [UCLA Stream 2, workhouse section](https://epi-snow.ph.ucla.edu/Stream2_BSPoutbreak_d.html) identifies the small entrance on Poland Street. The route follows the entrance rather than a straight line to the map marker. |
| Snow's desk | South via Cambridge Street, then onward | An off-map connection consistent with the existing map's southern marker; no measured route or travel time is claimed. |
| Registrar | South via Cambridge Street, then onward | An off-map records-office connection, not a claim that the office stood at the end of Cambridge Street. |
| Household | Marked northern frontage, west of the pump | A representative interview location, not an identified family's documented address. Its map marker has moved to Broad Street. The highlighted door is part of the modeled no. 19 frontage. |

East/south are approximate street-relative directions, consistent with the model axes. Door placement and exit distances remain illustrative. The household, brewery and workhouse panoramas have stationary selectable return targets to Broad Street. The registrar returns to Snow for records review. Household, brewery and workhouse remain stationary panorama viewpoints, so their return targets require selection. The registrar is now a walkable records room with a doorway back to Snow; see [registrar notes](walkable-registrar.md). Snow’s office is now a furnished 3D room with a selectable door and automatic doorway approach zone; see [office notes](walkable-office.md). The Board remains behind the existing Snow-review flow.

Routes and approach zones are defined in `src/walkable/TravelRoutes.ts`; `WorldTravelTargets.ts` creates small runtime meshes and labels. No Blender asset rebuild is required to reposition them. Panorama return markers are world-fixed wayfinding labels, not calibrated physical door geometry or compass bearings.
