# Snow's study and the General Register Office

This pass distinguishes the two rooms by purpose, scale and furnishings while preserving the investigation flow. Both interiors remain interpretive environments, not surveyed reconstructions.

## Snow's domestic medical study

The 5.8 × 6.4 m room retains its writing desk, rug, fireplace and warm daylight. A narrower bookcase leaves space for a medical side table containing a small cylindrical inhaler, flexible tube and metal facepiece, two stoppered bottles and a case book. A simple anatomical line study hangs above it. These props are decorative; the desk remains the conversation and evidence-review target.

The inhaler is informed by Snow's 1848 description of a portable water-bath instrument with an elastic tube and metal facepiece: [Snow's publications, article 29, UCLA](https://epi-snow.ph.ucla.edu/Stream1_introduction_d2.html). The [Science Museum Group Snow-type inhaler](https://collection.sciencemuseumgroup.org.uk/objects/co75826/snow-type-chloroform-inhaler), catalogued 1848–1870, supplies additional object context. This is a simplified interpretation, not an exact replica of a documented item in Snow's room. The room layout, bottles, case book and anatomical drawing are original illustrative choices; no patient information is invented.

## General Register Office, Somerset House

The registrar is now an 8 × 14 m room with a 4.3 m ceiling. A public ledger table and counter lead visually into four clerical workstations. Tall repeated windows, blue-grey painted counter panels, cooler daylight, larger registers and document pigeonholes establish a records-office setting. Each workstation has a writing surface, ledger, returns and inkwell. The exact dimensions, desk count and furniture arrangement are design choices.

[UCLA's Broad Street outbreak account](https://epi-snow.ph.ucla.edu/Stream2_BSPoutbreak_d.html) describes Snow obtaining deaths information from the General Register Office. [Somerset House's history](https://www.somersethouse.org.uk/about-us/history) places that institution there during this period. These sources support the institution and location, not this floor plan. The original registrar panorama is a visual reference for a larger clerical workplace, not historical evidence.

The map marker and Broad Street travel sign now say Somerset House, and the map/HUD explain that it is an onward journey beyond the Soho map. Its existing off-map direction and travel unlock rules remain in use. The ledger still awards the same timeline evidence, and the relocated return door takes the player to Snow's office. The role label reads Mortality returns.

## Assets and validation

Both models use the existing [procedural finish library](interior-visual-pass.md), packed textures and offline vertex shading. No real-time shadow passes, new dependencies or new interactions were added. The medical table and all four clerical desks/chairs have shared Blender/runtime collision footprints. Registrar arrival, target and exit positions follow the expanded layout.

| Room | Triangles | Material batches | GLB bytes |
| --- | ---: | ---: | ---: |
| Snow's office | 10,336 | 15 | 1,242,744 |
| General Register Office | 16,656 | 13 | 1,732,200 |

The reduced book and shelf geometry offsets the additional props. Both files are smaller than the preceding finish-pass versions. Textures remain 256 × 256, except the 512 × 512 office rug; every exported primitive has vertex color and all materials are opaque.

Rebuild using `scripts/assets/build_snow_office.py` and `scripts/assets/build_registrar_room.py` in Blender, then run `npm run test:walkable` and `VITE_BASE_PATH=/vr-snow/walkable/ npm run build`. The current 47 checks cover asset budgets, shared layouts, furniture collision, targeting, travel, state and controls. Browser checks cover the room appearances, registrar ledger dialogue and evidence collection, map labels and scene return. Quest performance, perceived scale and prop readability require an on-device check.
