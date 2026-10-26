# Snow's office: window depth and working instruments

The office now has a modeled exterior beyond the east window. The former opaque luminous pane is removed; paving, area railings, nearby return walls, opposite brick houses, sash windows and chimneys occupy different depths. Camera translation therefore changes their relative alignment through the sash. A distant opaque sky enclosure closes the view. This is an interpretive Georgian London prospect, not a surveyed reconstruction of the view from Snow's rooms. The exterior is decorative and is not a new travel area: the existing wall ray proxy, floor bounds and movement constraints remain intact.

The ether apparatus follows the Royal College of Physicians photograph: a squat dark chamber with flanged base and rolled lid, brass outlet and filler neck, a long loop of checked cloth-covered hose, and a hollow dark facepiece with a reddish padded rim. Its open timber case has red lining, hinges, clasp, and a small maker disc. These are original modeled details; no museum photograph is included in the app. The writing desk has a 238 mm wooden monaural stethoscope with a hollow chest bell and ear plate, plus a ruled observation sheet. Labeled experimental bottles, a thermometer and the case book remain on the medical table; further instruments are arranged on the cabinet (see [the medical collection](office-medical-collection.md)). The apparatus and case are separate complete pickups, using the existing furniture footprint. The apparatus inspection note identifies Snow’s 1847 ether design and links to the RCP collection.

## Historical basis and limits

- **Current apparatus reference:** [Royal College of Physicians, Medical collections](https://history.rcp.ac.uk/collections/art-and-objects/medical-collections), captioned “Benjamin Ward Richardson’s apparatus for the vapourisation of anaesthetic ether, designed by John Snow, 1847.” The photograph guides the silhouette, hose, facepiece and case, superseding the earlier chloroform model below. It does not supply dimensions, internal construction, or proof that this particular object stood in Snow’s office. Scale and fine details are interpretive. The photograph remains on the RCP site (© RCP, photography Mike Fear); only our original geometry ships.

- Earlier chloroform-model reference: [Snow's 1848 description, article 29 in UCLA's collection](https://epi-snow.ph.ucla.edu/Stream1_introduction_d2.html): a compact water-bath inhaler, short elastic tube and metal facepiece. This supports the instrument's general form, not every modeled fitting.
- Earlier chloroform-model reference: [Science Museum Group: Snow-type chloroform inhaler, A625273](https://collection.sciencemuseumgroup.org.uk/objects/co75826/snow-type-chloroform-inhaler): 1848–1870, brass canister and cloth-covered tubing, approximately 150 mm canister height. The catalogue describes a brass facepiece with velvet lining; its pictured facepiece is from another example. The modeled prop combines these documented characteristics and is not an exact replica of an instrument proven to have stood in Snow's office. Museum photographs are not embedded in the asset.
- [Science Museum Group: monaural stethoscope, A135433](https://collection.sciencemuseumgroup.org.uk/objects/co91099/monaural-stethoscope): 1840–1850, wood and pale mounts, 238 mm length and 51 mm ear-plate diameter. These dimensions guide the prop. The modeled material appearance is an interpretation, not a reproduction of a particular surviving object or a claim of Snow's ownership.
- [Australian Museum: Stethoscopes](https://australian.museum/about/history/exhibitions/death-the-last-taboo/stethoscopes/): single-ear stethoscopes were established examination instruments by the 1850s. This makes one a defensible furnishing for an 1854 medical practice.
- Case notes, stoppered bottles and a small instrument case are restrained contextual furnishings, not documented personal possessions. Notes contain generic rules rather than invented patient records or medical instructions.

For a future scientific-workbench pass, a period microscope is worth investigating separately. Snow's own [1855 account reproduced by UCLA](https://epi-snow.ph.ucla.edu/Stream2_BSPoutbreak_a.html) credits Dr. Hassall with examining the Broad Street water microscopically. A microscope prop or future interaction must not suggest that Snow identified the cholera organism in that water. Measuring glassware and experimental notes would also connect to the research described in Snow's 1848 paper; they would require individual form/date references before modeling.

The later [baked-lighting pilot](snow-office-baked-lighting.md) changes office materials, trim and export size. The following counts describe this earlier window/instrument pass.

## Rebuild and budgets

The RCP-inspired ether revision, before the additional [medical collection](office-medical-collection.md): 26,056 triangles, 16 material batches, and a 3,034,780-byte GLB. The hose stays a continuous mesh during baking, then separates by material with preserved corner normals for export batching; this avoids black seams between the woven checks. Regenerate `portable-props.json` after rebuilding the office.

Validation of this revision: all 282 walkable tests, the production build, and web-app checks pass. Browser review uses the actual office loader and baked materials, checking the table close-up and complete apparatus pickup/return. Quest review remains separate. Counts and validation below describe the earlier window/instrument pass.

`build_snow_office.py` calls `snow_office_details.py`; both use Three.js metre coordinates. The packed editable source and merged GLB remain in their existing locations. The exterior brick reuses the project's original procedural street texture. Existing interior finishes and offline vertex colors are retained. All materials remain opaque; no reflection capture, extra runtime light, realtime shadow or transparency pass is introduced.

The export contains 25,696 triangles in 16 material batches, within the existing office limits of 30,000 and 16. This is an increase from the prior 10,336 triangles/15 batches; the window view adds actual geometry and approximately doubles the GLB download size to 2.59 MB. Quest performance remains an acceptance check rather than an inferred result.

```sh
blender --background --factory-startup --python scripts/assets/build_snow_office.py
npm run test:walkable
VITE_BASE_PATH=/vr-snow/walkable/ npm run build
```

Validation: the 47 existing walkable tests and production build pass. Offline Blender review covers two window viewpoints and instrument close-ups. That review caught an overlap between the stethoscope and inkwell and coplanar window-frame faces, which were corrected. Blender review lighting is not the runtime lighting. Browser visual verification was unavailable because the browser tool had blocked the local preview; runtime appearance and headset parallax/comfort still require review in the refreshed preview.
