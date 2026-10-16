# Three-day inquiry expansion

Branch: `codex/inquiry-next`. Production remains `main` at `/vr-snow/`.
Preview: `/vr-snow/preview/inquiry/`.

## Implementation checkpoint — 16 October 2026

The approved conversation prototype now extends through the campaign, fieldwork,
and hearing. This remains a feature preview pending complete Quest and pacing
acceptance; automated or desktop results do not establish headset readiness.

- **September 5:** Snow assigns registrar records and the bereaved household.
  Returning for the recap plots the addresses and awards the cluster finding.
- **September 6:** pump sample, water-routines household, workhouse comparison.
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
- [Original Table I image](https://www.academia.dk/MedHist/Biblioteket/Grafik/Snow_1855/table1.gif):
  preceding-day **deaths** for the three openings are 71 (Sept 4), 45 (Sept 5), and
  37 (Sept 6). These are explicitly retrospective context, not instant registrar
  reports or new attacks. The registrar’s evidence now describes the sudden surge
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

## Required daily briefings — 16 October 2026

Each morning’s “Speak with Snow” action now opens that day’s assignment conversation
immediately. Until its shared concluding beat grants the assignment, all inter-scene
travel and map access are locked against the current day, including earlier locations,
world exits, desktop map shortcuts and VR controller/menu shortcuts. The mandatory
briefing cannot be dismissed by Escape, outside selection or controller grip; head
movement and VR settings shortcuts remain available. Normal dialogue dismissal returns once Snow
has given the assignment. The notebook shortcut also remains available.

Reloading an unfinished briefing resumes its saved beat at Snow’s office. Older preview
saves made outside the office before the current day’s assignment are safely returned
there without discarding evidence or previous daily work. New day progression still
requires the prior day’s fieldwork, recap and explicit End day action.

All 197 automated checks pass, including all three daily locks, shared conversation
conclusions, legacy save recovery and VR dismissal/shortcut guards.

Desktop browser checks passed on all three days: automatic briefing, blocked map
shortcut, dismissal guard, reload/resume and travel unlocked after the assignment.
Production-base and preview-base builds and web-app packaging checks also pass.

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
