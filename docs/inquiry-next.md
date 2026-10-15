# Three-day inquiry expansion

Branch: `codex/inquiry-next`. Production remains `main` at `/vr-snow/`.
Preview: `/vr-snow/preview/inquiry/`.

## Current review checkpoint — 15 October 2026

Implemented steps 1 and 2 of the accepted plan:

- Walkable, baked-light Board room inspired by the earlier panorama: long timber
  table, chairs, tall windows, fireplace, papers, schematic map, and circulation
  around the table. Snow stands near the visitor; three distinct representative
  Guardians sit with hands resting on their laps. All use the existing anatomical
  pipeline and restrained idle movement. The room loads on first entry.
- Board arrival no longer counts as presentation. An explicit Begin hearing action
  precedes the existing conclusion. The three-objection hearing is still step 4.
- Shared typed conversation definitions, choices, graph cursor, conclusion guard,
  and view model, owned by GameState. Snow's initial briefing and Whitehead's street
  conversation branch briefly and reconverge. Closing and reopening preserves the
  current beat during the session. Stale/double-click choices cannot advance twice.
- Compact desktop bottom overlay and a world-positioned VR panel beside the
  speaker. Panels retain the existing geometry-occlusion protection, close button,
  outside-click dismissal, keyboard navigation and controller-ray selection.
  Artificial walking and snap turning pause while the conversation is open;
  physical head movement remains available.

**This is a prototype review checkpoint, not the completed three-day campaign.**
The original seven-card progression and other interviews remain in place. Browser
reload persistence is not implemented yet. The user-approved sequence requires
reviewing this presentation in desktop and seated/standing Quest before converting
the remaining interviews. Do not merge the branch on the strength of desktop tests.

### Review links and checks

- Normal start: `https://seangyoung.github.io/vr-snow/preview/inquiry/`
- Room inspection: `https://seangyoung.github.io/vr-snow/preview/inquiry/?review=board`
  This explicit preview fixture grants no evidence or hearing credit. Close the
  arrival panel to walk; Reset returns to Snow. In a normal inquiry the Board is
  still reached through Snow's prepared argument.
- Talk with Snow, choose either opening, interrupt with Close/Escape/grip or a
  deliberate outside click, and resume. Try keyboard-only choices and controller
  rays. Check seated and standing readability without covering the character.
- Visit Broad Street and turn toward the opposite pavement. Whitehead stands near
  the household side of the street, closer to the pump than the western resident.
  He has a hover label, individual actor target and optional conversation; no card.
- Walk around the Board table and inspect faces, hands, chairs, loading, light and
  performance. Confirm Snow is recognizable. Try smooth movement and teleport.

Automated validation covers every graph path, shared conclusions, interrupted
exchanges, stale selections, assignment timing, no Whitehead reward, safe Board
arrival, all four existing hypothesis endings, room circulation, poses, asset
budgets, desktop/VR lifecycle, keyboard focus, and the existing interaction suite.
Headless Chrome checks are desktop/SwiftShader checks, not headset frame-rate tests.

## Remaining implementation, in the accepted order

### Step 3 — Campaign, households and saving

- Typed days for September 5–7, 1854; explicit objective completion replaces the
  evidence-count threshold. Keep earlier locations revisitable; gate future rewards.
- September 5: registrar and existing household; return to Snow, plot addresses,
  earn `pump-cluster`, and discuss what the pattern can establish.
- September 6: pump sample, second household's preferences/routines, workhouse;
  recap inconclusive inspection, corroborating testimony and separate supply.
- September 7: brewery, third household's nonlocal exposure, walking-access
  exercise; return to Snow, prepare the case and attend the Board.
- Preserve the existing seven evidence IDs; add nonlocal exposure and walking
  access. Revise `household-water-pattern` and every dependent hypothesis summary
  so illustrative interviews do not purport to establish the existing 68/75 tally.
- Two modular household variants with distinct layouts, possessions, occupants
  and composite testimony/source notes. Convert interviews to actor/object graphs;
  evidence once at a common conclusion, no exhaustive-questioning requirement.
- Optional day-specific Whitehead and two separately addressable street residents
  (chloride of lime, disrupted routines); no compulsory cards.
- Completed objectives prompt, but never force, a return. Recap plus explicit End
  day advances days 1 and 2. Day 3 uses Attend the meeting.
- Day opening date, assignments and preceding-day deaths from **Snow's 1855 Table
  I**, verified against the original table. Label these retrospective context,
  not instant registrar reports or new attacks. Do not substitute Whitehead's later
  counts. Explain compressed chronology at the beginning and in historical notes.
- Versioned browser-local save after choices, awards, travel and transitions;
  Continue/New Inquiry, validated restoration at safe spawns, no held objects or
  controller transients. Invalid/unavailable storage must be harmless. Derive a
  separate preview save namespace from the base path.

### Step 4 — Fieldwork, hearing and history

- Compact Marlborough and Rupert Street pump stops via map/world travel.
- Two paired comparisons, Broad/Marlborough and Broad/Rupert, with an identical
  marked origin within each pair. Source-cited polylines and calibrated distances
  separate from scene geometry; visit linked stops, explicitly record, draw routes.
- Disclose the 1.2 m/s teaching assumption. Results never use joystick speed,
  teleport duration, elapsed reading time or the player's real walking pace.
- Reveal existing historical `PumpServiceArea` after both comparisons on both maps;
  explicitly a historical walking-access boundary, not a polygon derived from four
  sample walks. Conclude that access is not consumption: preferences, work, errands
  and carried water matter; Snow discussed poor alternatives and circuitous routes.
- Separate arrival, beginning hearing, three objections and completed presentation.
  Objections: foul air, unaffected neighbors, distant cases. Evidence responses
  reconverge with Snow clarifying as needed. Retain hypothesis choice and explicitly
  historical versus alternate endings. Whitehead's later discoveries stay epilogue-only.

## Acceptance before merge

Test all graph paths/rewards/resume, different fieldwork orders, optional talks,
reloads and interrupted recaps; all days must complete without count-based gates.
Verify UI/map/notebook/save parity, paired route origins and invariant distances,
all hypothesis endings, and no credit for Board arrival. Keep movement, pickup/
return, pump, keyboard, dismissal and installation tests passing. Review new
geometry, loading, poses, occlusion and performance. Require a complete Quest
playthrough, seated/standing dialogue acceptance and 30–45 minute pacing review.
Only then merge main, verify production, record a development milestone, redirect
this preview and retire the branch.

## Deployment isolation

The Pages workflow builds `main` at `/vr-snow/`, resolves the feature branch to a
commit, tests/builds that checkout with `/vr-snow/preview/inquiry/`, and nests its
output under the production build. A failed preview prevents the whole publication;
GitHub retains the previous Pages artifact. Production pushes also include the
preview while the branch exists, so they cannot erase it accidentally.

Pages currently allows deployment only from main. A successful feature validation
run triggers the workflow on main through `workflow_run`; feature runs never deploy
themselves. The second run revalidates the exact revision it resolves. Pull requests
validate without publishing. One shared Pages concurrency group serializes runs.
`revision.txt` in the preview identifies the published feature commit. There are no
changes to repository environment protections. Once the feature branch is retired,
remove the temporary trigger and provide the preview redirect in production.

## Historical and asset sources

- Snow, *On the Mode of Communication of Cholera* (1855):
  https://www.academia.dk/MedHist/Biblioteket/Print/snow_1855.html
- UCLA John Snow archive, Stream 2e (Board, Whitehead and his later inquiry):
  https://epi-snow.ph.ucla.edu/Stream2_BSPoutbreak_e.html
- Existing `public/panoramas/board-room.jpg` supplies visual inspiration only.
  Architecture and unnamed officials are interpretations, not documented likenesses.
- Whitehead's dialogue is authored reconstruction informed by his local familiarity
  and initial opposition: he expected investigation to refute Snow. The opening
  and common conclusion preserve that disagreement on every dialogue path; his
  later conversion remains outside this opening encounter. His appearance is interpretive; Snow reuses the approved portrait
  study. Sources, editable rigs and licenses: `assets/scene-people/SOURCE.md` and
  `assets/snow-character/SOURCE.md`.

No generated dialogue, voice acting, lip sync, timed failure, exhaustive questioning,
continuous neighborhood simulation, cloud accounts or synchronized saves are planned.
