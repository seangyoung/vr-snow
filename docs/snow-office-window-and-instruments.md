# Snow's office: window depth and working instruments

The office now has a modeled exterior beyond the east window. The former opaque luminous pane is removed; paving, area railings, nearby return walls, opposite brick houses, sash windows and chimneys occupy different depths. Camera translation therefore changes their relative alignment through the sash. A distant opaque sky enclosure closes the view. This is an interpretive Georgian London prospect, not a surveyed reconstruction of the view from Snow's rooms. The exterior is decorative and is not a new travel area: the existing wall ray proxy, floor bounds and movement constraints remain intact.

The revised inhaler has a turned brass canister, rolled metal seams, shoulder, cap, hose coupling, curved ribbed cloth-covered tube and hollow brass facepiece with a dark fabric edge. A lined wooden instrument case sits beside it. The writing desk has a 238 mm wooden monaural stethoscope with a hollow chest bell and ear plate, plus a ruled observation sheet. The pre-existing stoppered bottles and case book remain on the medical table. All props are decorative and use the existing furniture footprints.

## Historical basis and limits

- [Snow's 1848 description, article 29 in UCLA's collection](https://epi-snow.ph.ucla.edu/Stream1_introduction_d2.html): a compact water-bath inhaler, short elastic tube and metal facepiece. This supports the instrument's general form, not every modeled fitting.
- [Science Museum Group: Snow-type chloroform inhaler, A625273](https://collection.sciencemuseumgroup.org.uk/objects/co75826/snow-type-chloroform-inhaler): 1848–1870, brass canister and cloth-covered tubing, approximately 150 mm canister height. The catalogue describes a brass facepiece with velvet lining; its pictured facepiece is from another example. The modeled prop combines these documented characteristics and is not an exact replica of an instrument proven to have stood in Snow's office. Museum photographs are not embedded in the asset.
- [Science Museum Group: monaural stethoscope, A135433](https://collection.sciencemuseumgroup.org.uk/objects/co91099/monaural-stethoscope): 1840–1850, wood and pale mounts, 238 mm length and 51 mm ear-plate diameter. These dimensions guide the prop. The modeled material appearance is an interpretation, not a reproduction of a particular surviving object or a claim of Snow's ownership.
- [Australian Museum: Stethoscopes](https://australian.museum/about/history/exhibitions/death-the-last-taboo/stethoscopes/): single-ear stethoscopes were established examination instruments by the 1850s. This makes one a defensible furnishing for an 1854 medical practice.
- Case notes, stoppered bottles and a small instrument case are restrained contextual furnishings, not documented personal possessions. Notes contain generic rules rather than invented patient records or medical instructions.

For a future scientific-workbench pass, a period microscope is worth investigating separately. Snow's own [1855 account reproduced by UCLA](https://epi-snow.ph.ucla.edu/Stream2_BSPoutbreak_a.html) credits Dr. Hassall with examining the Broad Street water microscopically. A microscope prop or future interaction must not suggest that Snow identified the cholera organism in that water. Measuring glassware and experimental notes would also connect to the research described in Snow's 1848 paper; they would require individual form/date references before modeling.

The later [baked-lighting pilot](snow-office-baked-lighting.md) changes office materials, trim and export size. The following counts describe this earlier window/instrument pass.

## Rebuild and budgets

`build_snow_office.py` calls `snow_office_details.py`; both use Three.js metre coordinates. The packed editable source and merged GLB remain in their existing locations. The exterior brick reuses the project's original procedural street texture. Existing interior finishes and offline vertex colors are retained. All materials remain opaque; no reflection capture, extra runtime light, realtime shadow or transparency pass is introduced.

The export contains 25,696 triangles in 16 material batches, within the existing office limits of 30,000 and 16. This is an increase from the prior 10,336 triangles/15 batches; the window view adds actual geometry and approximately doubles the GLB download size to 2.59 MB. Quest performance remains an acceptance check rather than an inferred result.

```sh
blender --background --factory-startup --python scripts/assets/build_snow_office.py
npm run test:walkable
VITE_BASE_PATH=/vr-snow/walkable/ npm run build
```

Validation: the 47 existing walkable tests and production build pass. Offline Blender review covers two window viewpoints and instrument close-ups. That review caught an overlap between the stethoscope and inkwell and coplanar window-frame faces, which were corrected. Blender review lighting is not the runtime lighting. Browser visual verification was unavailable because the browser tool had blocked the local preview; runtime appearance and headset parallax/comfort still require review in the refreshed preview.
