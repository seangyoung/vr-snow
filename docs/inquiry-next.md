# Three-day inquiry expansion

Branch: `codex/inquiry-next`. Production remains `main` at `/vr-snow/`.
Preview: `/vr-snow/preview/inquiry/`.

## Implementation checkpoint — 16 October 2026

The approved conversation prototype now extends through the campaign, fieldwork,
and hearing. This remains a feature preview pending complete Quest and pacing
acceptance; automated or desktop results do not establish headset readiness.

- **September 5:** Snow assigns registrar records and the bereaved household.
  Returning for the recap plots the addresses and awards the cluster finding.
- **September 6:** pump sample, Household 2, the manufactory at 37 Broad Street, and the workhouse comparison.
- **September 7:** Snow’s morning map comparison, then the brewery and Household 3
  outside the pump service area. Snow reviews the argument before the Board hearing.
- Explicit assignments and concluded conversations govern progression. Earlier
  places remain revisitable; future evidence cannot be collected early. Recaps
  require the day's work, and End day is an explicit action. No forced return.
- All interviews use short authored graphs with alternative approaches converging
  on essential facts and a once-only evidence award. Closing/resuming preserves
  the beat. Optional Whitehead and both street residents have daily material.
  Whitehead remains opposed to the pump explanation; later findings stay epilogue-only.
- Nine evidence cards retain the original seven IDs and add nonlocal exposure and
  walking access. Two illustrative households no longer imply a population tally.
- Two household interiors reuse modular assets, with different furniture layouts,
  possessions, adult occupants and composite testimony. They are interpretations,
  not identified families or surveyed addresses.
- Browser-local versioned saves follow choices, travel and transitions. Continue
  restores narrative state at the location's safe spawn, without held props or
  controller transients. Invalid/unavailable storage leaves a playable new inquiry.
  The base path separates production and preview saves.
- Desktop uses the compact bottom overlay; VR uses the same conversation view
  model on a stable panel beside the speaker. Keyboard navigation, rays, explicit
  close, deliberate outside dismissal and head movement remain available.
- The walkable Board has Snow and three representative officials. Arrival,
  beginning the hearing and submitting the recommendation are separate events.
  Four objections cover foul air, unaffected neighbors, distant cases and the
  declining deaths. Snow consistently urges pump closure. Alternative player
  recommendations persuade the Board against his advice; he does not adopt them.
  Supporting Snow leads to Broad Street on September 8, with the handle removed
  and a hanging Board of Guardians closure notice. Other outcomes remain at the
  Board and are explicitly fictional. Legacy completed water saves relocate to
  the pump. The precautionary reply and notice wording are authored, informed by
  Snow’s account of the September 7 meeting, September 8 removal, and uncertainty
  about renewed contamination; neither is presented as a documentary quotation.

## Pump-access exercise and reproducibility

Day three begins at Snow’s map table. He explains that he measured walking times
from two shared starting points. The player predicts the nearer pump in each pair;
Snow reveals the measurements and explains the street arrangement. Both choices
continue. The table shows the map, named pumps, and the same marked origin for each
pair, without colored route lines or travel controls.

The final map reveals the source `PumpServiceArea` boundary and marks Household 3
at map percentages (26, 61), outside it. Snow asks whether the ill person there had
a connection to Broad Street water, then assigns that interview and the brewery.
He does not reveal the household’s answer. The concluding conversation records
walking access once and unlocks travel. Marlborough and Rupert remain historical
pump symbols on the map, with no visitable scenes or street portals.

Desktop and VR consume the same comparison, points, results and choices. Reloads
resume the exact table beat or concluding Snow exchange; travel remains gated.
The version-one save envelope adds `mapExercise: 2`. Valid legacy unfinished visits
restart the comparison at Snow’s office; already completed findings and other
fieldwork survive. Saves located at either retired pump restore at the office.

`src/simulation/route-data.json` stores polylines separately from scene geometry.
Six pump anchors register SVG percentages to EPSG:27700 British National Grid metres.
The affine fit has 1.096 m anchor RMS, describing registration rather than route
accuracy. Manually traced distances, rounded to 5 m, and a 1.2 m/s teaching assumption
supply the specific dialogue timings. **These are reconstructed measurements for
the dramatization, not surviving recorded timings by Snow.** The opening disclosure
covers reconstructed walking times once. Characters and evidence stay in-world.
Snow’s account supports walking convenience, circuitous routes to Rupert Street,
water preferences and cases away from the pump; it does not supply these timings.
Run `python3 scripts/calibrate-inquiry-routes.py` to reproduce the coefficients and
timings without a download. Input coordinates and source URLs remain in the data.

The boundary is the separate historical source layer, **not calculated from the
four routes**. Desktop uses `public/maps/pump-service-area.svg`, omitting scanned
page-frame subpaths and thickening the line; VR applies the same treatment to the
original SVG. The concluding exchange distinguishes convenience from consumption
and sends the player to investigate the exception rather than explaining it away.

## History and provenance

- [Snow, *On the Mode of Communication of Cholera* (1855)](https://www.academia.dk/MedHist/Biblioteket/Print/snow_1855.html):
  Broad Street account, comparisons, distant exposures, alternative pumps and Table I.
  The seamstress and neighbor also draw on the passage beginning “The mortality
  would undoubtedly have been much greater,” describing the flight of residents.
  Their authored dialogue mentions furnished lodgings emptied first, furniture
  left for later collection, houses closed after deaths, and tradesmen sending
  their families away. Residents describe what they see rather than reciting
  Snow's retrospective three-quarters estimate; a quieter street is not presented
  as proof that the danger has passed.
- [UCLA Stream 2f, “The earliest spot map of all”](https://epi-snow.ph.ucla.edu/Stream2_BSPoutbreak_f.html),
  reproducing Brody et al. (2000), documents fears about sewer gases and sewer
  excavations disturbing an old plague burial pit. Optional street questions now
  bring up these rumors with the shopkeeper on Day 1, the seamstress on Day 2,
  and the porter on Day 3. They report hearsay in their own voices, without
  evidence awards, new objectives, or claims that the rumors were correct.
  These unnamed speakers and the exact days are authored within the compressed
  chronology; they do not report findings from the later September 26 sewer inquiry.
- On September 7, the shopkeeper carries an interpretive folded **Daily News**
  and can discuss a letter alleging that sewer builders unearthed an “immense
  quantity of human bones” in the old pesthouse fields. Date and quoted phrase
  are supported by Steven Johnson, *The Ghost Map*, conclusion
  ([transcription](https://erenow.org/modern/the-ghost-map/9.php)); the original
  issue has not been inspected. The text remains an allegation attributed to the
  letter. The generated masthead, date, column layout and section headings are
  an illustrative prop, not a facsimile. It appears only on Day 3, follows the
  shopkeeper’s hand with the existing idle movement, and adds no evidence or task.
- Whitehead’s Day 2 response to the player raising Snow’s theory now describes
  personally caring for three cholera sufferers who drank Broad Street water
  during their illness and survived. This is his skeptical objection, not a claim
  that the water cured them. Brody et al., *John Snow revisited: getting a handle
  on the Broad Street pump* (1999), describes Whitehead knowing several such
  recoveries ([account](https://www.researchgate.net/publication/13105811_John_Snow_revisited_getting_a_handle_on_the_Broad_Street_pump)).
  The specific three-person count and personal-care phrasing follow the requested
  dramatization; the exact count was not independently verified in that source.
  Dialogue remains authored and the Day 2 placement uses the compressed chronology.
- [Original Table I image](https://www.academia.dk/MedHist/Biblioteket/Grafik/Snow_1855/table1.gif):
  preceding-day **deaths** for the three openings are 71 (Sept 4), 45 (Sept 5), and
  37 (Sept 6). Snow now delivers these in his morning conversation as an authored
  report from the registrar, rather than a separate historical-context panel.
  This dramatizes the availability of retrospectively compiled figures; they count
  deaths in the local outbreak, not London-wide deaths or new attacks.
  The registrar’s evidence describes the sudden surge
  without importing the later publication’s numerical fatal-attack series.
- [UCLA John Snow Archive, Stream 2e](https://epi-snow.ph.ucla.edu/Stream2_BSPoutbreak_e.html):
  Whitehead's initial opposition, later inquiry, and neighborhood observations,
  including chloride-of-lime treatment. Dialogue is authored, not quoted testimony.
- [GeoDa Snow data](https://geodacenter.github.io/data-and-lab/snow6/) and its
  [documentation](https://geodacenter.github.io/data-and-lab/data/snow_documentation.pdf):
  digitized pump coordinates in British National Grid. The Rupert anchor is the
  southeastern pump, distinct from Warwick Street farther southwest.
- The Board panorama supplies visual inspiration. Its room and unnamed officials
  are representative interpretations. Editable characters and licensing are in
  `assets/scene-people/SOURCE.md` and `assets/snow-character/SOURCE.md`.
- Chronology is compressed into Sept 5–7; a brief opening notice discloses this.
  Historical removal of the handle is Sept 8, after the outbreak was already
  declining. Alternate endings are fictional teaching outcomes, not predictions
  of additional deaths or an asserted historical second outbreak.

## Verification and acceptance

All 188 interaction tests pass locally; production-base and preview-base builds
and web-app packaging checks pass. Automated checks cover graph paths, once-only rewards, 72 assignment visit-order
combinations, optional talks, save/reload after choices, interrupted recaps and
hearing, invalid saves, future-evidence gates, route invariance, room circulation,
asset budgets, all hypothesis endings, keyboard/controller/panel behavior, pickup,
pump and installation regressions. The two compact pump stops batch their static
geometry to keep scene drawing overhead small.

Desktop browser review uses actual safe-spawn saves to inspect the new scenes,
then exercises conversation interruption, registrar and household choices, End
day, notebook/map, route recording and Board submission. Browser checks use
Chrome/SwiftShader and cannot measure standalone headset performance.

Before merging, require a complete Quest playthrough, seated and standing panel
checks, smooth movement and teleportation, natural poses, loading/occlusion review,
and confirmation of the **30–45 minute pacing target**. Content exists end to end,
but timing is not validated by automated traversal. After acceptance: merge main,
verify production, record a development milestone, redirect this preview, and
retire the temporary branch. None of those acceptance-dependent steps is automatic.

## Deployment isolation

The feature workflow validates the preview. Its successful run triggers the Pages
workflow on main through `workflow_run`. That workflow builds main at `/vr-snow/`,
resolves and revalidates the feature revision, then nests the preview at
`/vr-snow/preview/inquiry/`. A failed preview prevents publication and leaves the
previous Pages artifact intact. Production pushes also include the preview while
this branch exists. `revision.txt` identifies its published commit. Pages
permissions and repository environment protections are unchanged.

No generated dialogue, voice acting, lip sync, timed failure, exhaustive
questioning, continuous neighborhood simulation, cloud accounts or synchronized
saves are included.


## Dialogue and notebook editorial revision — 15 October 2026

At user request, historical/source essays are removed from both notebook interfaces.
A brief opening disclosure covers compressed chronology and reconstructed dialogue,
households, settings and officials. The epilogue retains the historical outcome,
Whitehead’s later findings and the distinction between historical and alternate endings.
Full provenance remains in this document and conversation source metadata.

Witnesses now describe their own duties, experiences and routines. The shared interview
template no longer interrupts with a remote Snow field note: each witness has specific
follow-up questions. Snow interprets findings at the office and hearing; Whitehead stays
opposed to his water explanation. Pump and route observations are labeled as observations,
not spoken by an absent Snow. Evidence notes are concise and use in-world source labels.
The current map-table revision above supersedes the earlier route exercise; technical
provenance remains here rather than in character dialogue or evidence cards.

Conversation, beat, choice and evidence identifiers are unchanged, preserving existing
save cursors and rewards. Regression checks cover every interview path’s essential facts,
contemporary dialogue and removal of the extra VR notebook cards. Desktop review also
checks the notebook and witness follow-ups.

The editorial revision also preserves all 24 conversation graph structures (IDs,
choices, edges, conclusion rewards and terminal actions) against the prior preview.


## Hands-on water samples — 16 October 2026

Broad Street now requires a handle stroke that actually produces water before the
sample conversation opens. Select the handle within reach, wait for the water, then
select the pump body to inspect it. Mouse, keyboard reticle/Space and controller
selection use the same bounded stroke. Drawing water never awards evidence by itself.

The workhouse’s existing well fitting now has a working handle and water stream.
Its optional inspection is inconclusive, just like Broad Street. After both samples
are inspected, the existing water evidence card records their similar appearance;
there is no tenth card or additional required objective. The steward interview is
still required. The workhouse inspection is an authored comparison, not a claim of
a documented sample test by Snow. That provenance stays here and in source metadata.

Water-drawn state is location-specific and saved. Old saves preserve already-started
Broad Street inspections; new inquiries require pumping. An interrupted stroke before
flow cannot supply a sample. Scene changes reset animation and controller state.
The workhouse runtime removes only the old pump triangles from the material-batched
model and supplies matching interactive geometry, retaining the well, buckets, baked
courtyard and collision envelope.

Validation covers real exported mesh replacement, physical reach/occlusion, both
inspection orders, once-only rewards, partial strokes, save/resume and legacy saves.
Standalone Quest interaction still requires device testing.

All 194 automated checks, both deployment-base builds and manifest/icon checks pass.
Desktop Chrome testing activated each handle, waited for flowing water, inspected
both samples and verified saved progress, with no browser errors. Visual review
confirmed the replacement fitting and its captured-sky lighting.

## Player-initiated morning conversations — 17 October 2026

Each morning’s “Enter the office” action dismisses the date card without opening
a conversation. Players can walk, teleport around the room, and inspect or return
desk objects before selecting Snow. His assignment remains required for map access
and every exit, including controller shortcuts and automatic doorway travel.
Conversations can be closed and resumed with their saved choices intact; the same
applies to day three’s map comparison. Continue restores the office without forcing
a panel open. Legacy unbriefed saves outside the office return there safely.

Day one’s assignment recommends speaking with local people, including Reverend
Whitehead, without preannouncing his view of Snow’s theory. The opening has also
been reduced to the setting, the investigation’s purpose, and a prompt to speak
with Snow; a single short dramatization note appears at the ending.

The 222-check regression suite covers daily travel locks, voluntary initiation,
interruption, reload/resume, legacy saves, and VR panel/shortcut behavior. Physical
Quest validation remains a separate check.

## Daily destinations and street population — 16 October 2026

The registrar and Household 1 are day-one visits; Household 2 and the workhouse
are day-two visits; the brewery, Household 3 and survey pumps are day-three visits.
Snow's office and Broad Street remain available after each morning's briefing.
A completed earlier interview leaves a small check mark on both maps, with no
travel action. Future destinations and unavailable world signs/rings are hidden,
including their selection proxies. Same-day return visits remain possible.
Older saves inside an interview location from an earlier day resume on Broad
Street with their evidence intact.

The shopkeeper, neighbor and Whitehead occupy different positions each day.
`src/simulation/streetPopulation.ts` supplies shared actor placements for models,
selection/collision and conversation anchors. Four additional background residents
use shared anatomical geometry and textures, varied coat tints, stature, orientation
and daily placements. They add no interview obligations or floating markers.
Their existing subtle idle animations respect reduced-motion preferences.

Whitehead now wears a dark frock coat and white neckcloth/bands, with a fuller,
textured beard fitted to his jaw. The anatomical source remains editable in
`assets/scene-people/whitehead.blend`; `refine_whitehead_clerical.py` replaces only
these added details, and `build_scene_characters.py -- street` exports/bakes them.
The familiar [photographic reference](https://commons.wikimedia.org/wiki/File:Whitehead_henry1884.jpg)
is dated 1884. This wardrobe and beard are interpretive visual characterization,
not a claim that his appearance in September 1854 is documented by that portrait.
His skeptical dialogue is unchanged.

Validation: 200 automated checks pass, including all-day completion permutations,
day-specific destinations, invisible-exit ray rejection, earlier-save recovery,
shared desktop/VR map state, moving actor anchors/collision and clear exit zones.
Desktop browser checks passed for all three maps and archived non-button marks,
with no JavaScript errors. Runtime street/character renders were reviewed for
all three days. The production-base and preview-base builds and web-app packaging
checks pass. Quest performance and seated/standing review remain pending.

## Morning map-table acceptance — 16 October 2026

- 208 automated checks pass, including both comparison answers, every day’s field
  visit order, no premature travel, once-only evidence, retired destinations,
  legacy save migration, and Continue during each table beat and Snow assignment.
- Production-base and preview-base builds and installation manifest checks pass.
- Desktop Chrome exercised the complete comparison, an incorrect prediction,
  reload/Continue, keyboard choices, the service-area reveal, and final assignment.
  The mobile-width panel scrolls to its action. No browser exceptions occurred.
- The rendered source boundary and a sampled-contour check confirm Household 3 at
  (26%, 61%) is outside; it is explicitly highlighted at the reveal. VR panel
  textures were inspected for map, text and button overlap. These checks do not
  establish Quest readability, comfort or performance; device review is pending.

## Street residents and Whitehead — 16 October 2026

All seven Broad Street figures now have individual conversation targets. The four
former background clones are a seamstress, laundress, porter and messenger, with
optional day-specific openings and follow-up topics. These add neighborhood
context without evidence rewards or assignment gates. Choices and interruption
use the shared desktop/VR conversation and save system. Existing daily placements
now move the figures, hover labels, conversation anchors and collision targets
together.

Four independent MakeHuman sources replace the clones, including two adult women
with standing dresses and fitted buns, an apron, two work caps, and varied facial
profiles, ages and colors. Whitehead has a face-fitted full beard and moustache,
short hair and clerical clothing; his opposition to the water theory is retained.
The street remains seven figures: 196,569 triangles and 83 mesh batches, within the existing 30,000-triangle-per-person budget. The atlas is now
2048 square for legible face lighting. Independent textures increase asset memory;
Quest scene-entry and frame-rate checks remain necessary.

Validation includes all optional branches across three days, interruption/resume
without rewards, actor/target/anchor agreement, exported source hashes, geometry
budgets, browser rendering, and the existing campaign regression suite. Full
headset acceptance remains pending.

## Quiet interaction reminder — 17 October 2026

The VR reminder now waits for 30 seconds of inactivity, displays for four seconds,
and stays dismissed until another activity begins a fresh idle period. Walking,
teleportation, turning, meaningful head/controller movement, stick/button input,
held objects, pump water, open panels, day introductions and travel suppress it.
Unfocused sessions reset the timer. The text is “Click to interact with people or
objects.” Normal tracking jitter does not count as deliberate activity.

All 224 regression checks pass, including timed dismissal/rearming and activity
suppression through the VR scene's actual hint update path. Device review remains
necessary for subjective timing and readability in the Quest.

### Portable objects and controller inspection

Loose props now use a five-metre pickup reach, with actual scene geometry still
blocking grabs through furniture or walls. Hold either controller’s grip to grab;
release that grip to return the object. Triggers continue to select conversations,
buttons and pump handles. While holding an item, the right stick rotates it in
both axes; it must return to neutral before player snap-turning resumes. Stick
click opens the menu, or changes pages while reading a multipage panel. Existing
face-button shortcuts remain available. Desktop pickup/return remains click or
Space; Q/E spin and R/F tilt the held object.

The authored inventory now has 258 items across the eight furnished environments:
books and documents, instruments and bottles, household cups/jugs/cloth/spools,
workhouse buckets, brewery mugs and the account book, and Board papers/registers.
Compound parts travel together. Furniture, fixed fittings, large vats/casks and
filled grain sacks remain scenery; Broad Street currently has no separate loose
portable props. Objects are not evidence awards. They always return to their
original position and orientation rather than becoming physics debris.

`scripts/assets/build_prop_manifest.py` generates `portable-props.json` from the
semantic objects in the saved Blender files. Complete triangles retain their
original materials and baked UVs. Resting props are batched by material; only the
held/returning item draws separately. Shelf pickup checks the actual visual
geometry rather than the bookshelf’s broad collision box. This avoids adding a
draw call for every book and label.

Selected items show a small non-modal description while held. Desktop cards link
to museum collection photographs; VR cards include a short source credit. The
photographs are linked at the collection site, not redistributed with the app.
Instrument descriptions reference:

- [Science Museum Group: monaural stethoscope, 1840–1850](https://collection.sciencemuseumgroup.org.uk/objects/co91097/monaural-stethoscope).
- [Science Museum Group: Snow-type chloroform inhaler, 1848–1870](https://collection.sciencemuseumgroup.org.uk/objects/co75826/snow-type-chloroform-inhaler-inhaler).

These describe comparable collection instruments; the models are interpretations.
Controller event tests cover grip ownership, trigger independence, reach and
obstructions, two-axis rotation and neutral release. Exported-asset tests cover
all prop sets, triangle conservation, UVs and batching. Actual Quest ergonomics
and frame-rate acceptance remain a device check.

### Day-one recap map

Snow's first evening review displays the death map alongside the conversation in desktop and VR. Starting the recap reveals the plotted deaths on the normal map as well; closing the exchange or restoring a save keeps that layer available. The existing conversation cursor supplies this state, so there is no new save version or separate UI-only unlock. The cluster finding and End day still require completing the recap. The embedded map omits location/travel buttons so attention stays on the pattern being discussed.

### Between-day transition

End day now fades to black, holds briefly, then fades into the next morning's introduction. Desktop and VR share the same frame-driven sequence: roughly 0.55 seconds out, a fully black frame before advancing/saving the day, 0.25 seconds of black, then 0.65 seconds back in. Reduced-motion mode shortens this to 0.2/0.15/0.2 seconds. The desktop cover includes the HUD; the XR veil covers both eyes and follows tracked head motion without moving the camera. Input is blocked during the transition and keyboard focus returns to the next day's introduction afterward. Hidden tabs and unfocused XR sessions pause progression. Cutscenes are deferred.

## Conversation placement and free movement — 17 October 2026

Ordinary VR conversation panels are 22% smaller, face the eye position including
pitch when opened, and remain fixed in the world through head movement and snap
turns. The map recap uses a gentler 15% reduction. Desktop dialogue width is now
760px maximum. Conversations allow walking, turning, nearby ground teleportation
and prop pickup/rotation/return. Menu and notebook movement locks remain.

Switching to another person or travelling away restarts unfinished exchanges;
walking beyond speaking range does the same (4m horizontally, extended by 1.5m
beyond the initial distance if started farther away). Completed evidence and
conclusions are retained. Closing a panel while staying nearby can still resume
the same exchange. Picking up a handheld prop never switches dialogue. On desktop,
WASD returns focus to the scene, arrows look while the scene has focus, and Tab
returns to dialogue choices. The shared graph cursor saves these resets.

## Single meeting action — 17 October 2026

After selecting a theory, **Attend the meeting** now records the argument and
travels to the Board room in one action on desktop and VR. The selected theory
and completed day/recap requirements still apply. Arrival is saved atomically;
it does not start or complete the hearing. Existing saves with an already
prepared argument remain usable.

## Board speaker placement — 17 October 2026

Board hearing beats now use the matching figure positions from the character
layout, including Snow’s Board-room model. The VR dialogue panel is placed beside
the current speaker’s sight line when the speaker changes, facing the player’s
current eye position. It stays fixed during that speaker’s turn. The entire Board
room counts as the conversation area, so walking between speakers does not reset
the hearing. Desktop retains its central bottom dialogue overlay and speaker name.

## Snow's map on the Board table — 17 October 2026

The table's schematic grid sheet now displays a warm-paper print derived from
`public/maps/broad-street.svg` and the existing cleaned pump-service-area layer.
It shows streets, death bars, pump locations and the service boundary. The sheet
retains its pickup, rotation and return behavior; its old batched grid triangles
stay hidden after returning it. The replacement adds just a paper slab and printed
plane, using a 1400 × 1900 PNG rather than rasterizing the large SVG in the headset.

Regenerate `public/maps/board-table-map.png` with
`node scripts/assets/build_board_map.mjs` and the optional authoring dependency
`sharp` available (the same dependency used by the app-icon generator). Texture
failure retains the original schematic prop. Browser review confirmed placement,
texture loading, pickup and return; the walkable checks and build passed.

### Epilogue framing — 17 October 2026

- The desktop ending is a compact right-side reading panel, with a scrollable bottom panel on narrow screens. The pump and closure notice remain visible at arrival.
- VR uses a smaller paginated ending panel beside the pump's sightline, placed once and facing the viewer. Notebook and Exit VR remain available.
- Completed inquiries hide street figures, including their selection targets and collision footprints. Only Return to Snow's desk remains as a street travel exit; the desk can still return to the closed pump. Reset restores the daily population and destinations.
- Verified desktop/mobile rendering, VR panel rendering, return travel, and 257 automated tests, including seated/standing pump sightline checks. Physical Quest review remains separate.

### South London map on Snow's desk — 17 October 2026

Added the Wellcome Library scan of Snow's south London water-supply Map 2 as a portable sheet on the office writing surface. The ledger sits to the right on the correspondence; the notes and pen move clear of the map. All retain their pickup/return behaviour. The held map displays a short explanation and the collection/license credit, without adding a campaign evidence card.

The texture is local, 2048 × 1670, approximately 1.3 MB, with mipmaps and anisotropic filtering. Image-load failure retains the previous desk arrangement. The 1855 publication is used as an interpretive office prop; the source, CC BY 4.0 license, resizing details, and regeneration command are recorded in `public/maps/south-london-water-supply.source.md`.

### Dialogue depth and nearby objects — 17 October 2026

VR panels still remain readable over room scenery, but now write their actual depth using an always-pass depth function. Characters, their labels, controller models/callouts, and held objects draw afterwards with normal depth testing. A nearer person or controller covers the panel; one behind it does not. This stays in the existing single render per frame, with no extra scene pass. Temporary material copies avoid modifying materials shared with room geometry, and normal rendering is restored when panels close.

Controller button/panel rays also reject visible character or held-object geometry nearer than the panel. Invisible interaction proxies and hidden scenes do not block them. Checked WebGL pixels at left/right eye offsets and a shifted viewpoint, actual household/controller rendering, material restoration, selection depth, and 259 automated tests. Physical Quest checks remain required.

## Manufactory visit — 20 October 2026

Day 2 now has four assignments; Household 2 remains. The new workshop at 37
Broad Street offers a short interview and a tenth substantive evidence card,
“Shared workplace, deaths at home.” All approaches converge on the shared water
supply after the player asks about drinking water. The approximate “about a dozen”
losses are attributed to the worker, never treated as a precise register count.
This is an authored interim estimate: Snow's retrospective account records
18 deaths (16 men and 2 women) among approximately 200 employees. It does not
document that interim count or a named witness. Sources: Snow (1855), the paragraph
beginning “At the percussion-cap manufactory, 37 Broad Street,” also reproduced in
[UCLA Stream 2a](https://epi-snow.ph.ucla.edu/Stream2_BSPoutbreak_a.html).

The two water tubs are documented. The 8 × 8 m workshop, benches, packaged stock,
figures and furnishings are illustrative. The map pin and street travel target
are approximate wayfinding placements along Broad Street, not a verified plot
boundary or surveyed doorway. The workshop represents one small part of the
premises, not seating for the full workforce. Two existing authored MakeHuman
sources (seamstress and porter) are reused as unnamed employees with new placement
and room lighting. No manufacturing process is modeled.

`build_manufactory_room.py` regenerates the room and baked lighting;
`build_scene_characters.py -- manufactory` exports the figures;
`build_prop_manifest.py` includes 15 portable boxes, parcels, trays and a cup.
The room loads on first visit. Existing desktop/VR navigation, conversations,
pickup/return and character idles are shared with the other interiors.

Saves record campaign revision 2. Older saves that already completed the Day 2
recap retain that completion without an invented interview or evidence card.
Other existing saves gain the additional assignment. The visit is visible only
on Day 2; its visited map mark remains afterward. Production and preview saves
continue to use separate storage keys. Quest acceptance remains outstanding.
