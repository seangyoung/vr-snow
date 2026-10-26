# Snow's office: working medical collection

Original low-poly props extend the 1847 ether-apparatus revision. Five sealed bottles have a shared, original serif label atlas. The medical table holds ether, chloroform, ethyl nitrate, chloric ether and an experimental thermometer. The existing cabinet holds castor oil, two medicine spoons, a wishbone tongue scraper, a lancet case, a sick syphon and a suture-needle case. Furniture and circulation are unchanged.

All are pickups with brief source-linked inspection notes. Needle and lancet cases are compound pickups: their small contents remain attached. Bottle labels move with their bottles. The collection adds no dispensing, cutting, injection or treatment mechanics, and does not award evidence. The cabinet cloth is a fixed surface dressing.

## References and interpretation

These are plausible furnishings, not an inventory of Snow's documented possessions. Original geometry and labels are supplied; no museum images or historical trademarks are embedded. Bottle colours, label designs, arrangement and precise dimensions are interpretations. Material appearance uses opaque approximations suitable for the existing Quest renderer.

- [Snow, *On Narcotism by the Inhalation of Vapours* (1848), Wood Library-Museum](https://www.woodlibrarymuseum.org/wp-content/uploads/rare-books/S_ADRI.pdf): establishes ether, chloroform and nitrate of oxide of ethyle among substances he investigated before September 1854. Ethyl nitrate is identified as experimental, rather than presented as an ordinary clinical anaesthetic. The thermometer represents experimental temperature measurement, not a later compact clinical maximum thermometer.
- [Snow's publications, group 5, UCLA](https://epi-snow.ph.ucla.edu/Stream1_introduction_d5.html): his discussion of chloric ether identifies it as chloroform in alcohol. The label deliberately retains that confusing period name and the inspection explains it. Later amylene work is not represented in this 1854 room.
- [RCP, Symons collection](https://www.rcp.ac.uk/news-and-media/news-and-opinion/symons-collection/): feeding/medicine spoons, castor-oil spoons, oral hygiene tools and nursing devices. The two modeled spoons are simple open forms, not replicas of Gibson's covered design.
- [Science Museum, silver tongue scraper, London, 1827](https://collection.sciencemuseumgroup.org.uk/objects/co98610/silver-tongue-scraper-london-england-1827): wishbone form; approximately 120 × 41 mm.
- [Science Museum, *Not for the squeamish*](https://blog.sciencemuseum.org.uk/not-for-the-squeamish/): lancets/case dated 1750–1850 and their bloodletting context. The case is an interpretive compact arrangement, not a claim that Snow treated cholera by bloodletting.
- [Science Museum, silver sick siphon, 1801–1830](https://collection.sciencemuseumgroup.org.uk/objects/co121637/silver-sick-siphon-1801-1830): a cup-mounted drinking aid with pierced strainer, approximately 94 × 93 mm. It is not an instrument for draining a patient.
- [Science Museum, seven suture needles, nineteenth century](https://collection.sciencemuseumgroup.org.uk/objects/co169613/7-suture-needles-suture-needles): eyed steel needles in a padded case. The broad catalogue date does not date a specific specimen to 1854; our simple straight/curved set is interpretive. No modern disposable syringe or later specialist needle type is modeled.

## Rebuild

Run `scripts/assets/build_office_medicine_labels.py` with a Pillow-equipped Python to regenerate `assets/snow-office/medicine-labels.png`. It uses a locally installed Times New Roman font; set `OFFICE_LABEL_FONT` to another local serif font on other platforms. The rendered atlas is committed, so rebuilding the office does not require Pillow or a font installation. No font file ships with the app.

Then run Blender on `scripts/assets/build_snow_office.py`, followed by `scripts/assets/build_prop_manifest.py`. The labels share one additional material batch. All other geometry reuses the existing materials and offline lightmap; there are no new runtime lights or transparent glass passes.

## Validation

The expanded office exports 29,864 triangles in 17 material batches, below 30,000 triangles. The GLB is 3,448,664 bytes. All 282 walkable tests pass, including complete pickup/rotation/return of each new artifact and checks that each bottle retains its label. Production build and installation checks pass. Browser review confirms the table/cabinet arrangement, readable label orientation, source captions, and pickup/return. The preview serves the rebuilt asset; Quest performance and seated readability remain device checks.
