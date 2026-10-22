# VR Snow

Design workspace for **The Broad Street Inquiry**, an educational WebXR mystery game about the 1854 Soho cholera outbreak and John Snow's investigation.

The main app is a walkable WebXR inquiry with desktop keyboard and mouse support. The source-backed game design document is available here:

- [docs/game-design.md](docs/game-design.md)

## Three-day inquiry

The main experience spans September 5–7: daily assignments and recaps, conversations with residents and Whitehead, three households, the manufactory, a map-table pump-access comparison, and a walkable Board hearing. Browser-local saves offer Continue and New Inquiry. See [implementation, historical sources and validation notes](docs/inquiry-next.md).

The former [inquiry preview](https://seangyoung.github.io/vr-snow/preview/inquiry/) redirects to the main app. Visiting that address copies its saved inquiry only if no main-app save exists, retaining the original preview save. The app validates saves before offering Continue.

## Run the App

```bash
npm ci
npm run dev
```

Open the local Vite URL, usually `http://127.0.0.1:5173/`.

## Published App and Development History

The current app is published from `main` at <https://seangyoung.github.io/vr-snow/>.
The former `/vr-snow/walkable/` and `/vr-snow/preview/inquiry/` addresses redirect there. Pushes to `main` run the interaction tests, production build and web app checks before deployment. Pull requests run the same checks without publishing.

Earlier experiences are frozen milestones, not maintained branches. See the [development milestone record](docs/development-milestones.md) for named source tags, downloadable runnable snapshots, presentation screenshots and reproduction instructions.

## Walkable street and interiors

Broad Street is a textured, source-informed reconstruction of the pump junction, with an editable Blender environment and a selectable pump. Snow’s office is a compact furnished 3D room with desk interaction and a doorway to Broad Street; see [office scope and headset checks](docs/walkable-office.md). The [registrar’s records room](docs/walkable-registrar.md) also supports walking, ledger interaction and doorway return to Snow. The [household interior](docs/walkable-household.md) adds a compact domestic room, a marked interview chair and a return doorway to Broad Street. The [workhouse courtyard](docs/walkable-workhouse.md) adds an open-air yard, steward interview and a Poland Street exit back to Broad Street. The [brewery interior](docs/walkable-brewery.md) supports walking around copper vessels, the owners’ interview and a doorway back to Broad Street. The Board meeting takes place in a walkable room with Snow and three members, a map on the table, and a staged hearing. See [the reconstruction sources and asset workflow](docs/broad-street-reconstruction.md) and [the headset test card](docs/walkable-pump-test.md) for controls, scope, and acceptance checks.

Desktop keyboard controls: WASD moves, all four arrows look, and Space/Enter selects the centered target. M opens the map; N opens the notebook. Panels use Tab/Shift+Tab or arrows to choose, Enter/Space to activate, Escape to close, and Page Up/Down to scroll. See [keyboard controls and test card](docs/desktop-keyboard.md).

The [interior visual pass](docs/interior-visual-pass.md) adds textured plaster, timber and fabrics plus precomputed contact shading to the office, registrar and household. The [office and registrar identity pass](docs/office-and-registrar-identity.md) distinguishes Snow’s medical study from the larger registrar’s records room. Snow’s [window and instrument pass](docs/snow-office-window-and-instruments.md) adds a view with perspective depth and period medical props. All six walkable scenes use [baked lighting and material reflections](docs/walkable-baked-lighting.md). The [brewery detail, seated Snow and sound pass](docs/presence-and-sound.md) adds refined brewery props, a selectable seated Snow figure, subtle idle motion and optional spatial ambience/interaction sounds. The [scene ambience pass](docs/ambience-pass.md) adds recorded foley, sparse moving street sounds and reduced ambience while reading, with [audio source credits](public/audio/credits.html). Sound settings are available from the desktop tool rail or chapter panel and the VR panel header, with mute and separate ambience/effects levels. The [VR controller pass](docs/vr-controls.md) adds left-stick walking, seated height adjustment, profile-aware map/notebook/settings shortcuts, compact menus and Exit VR. The [scene figure pass](docs/scene-figures.md) adds the registrar, household survivor, workhouse steward, both brewery owners and two Broad Street residents, with hover labels and existing interview actions.

Run `npm run test:walkable` for movement, obstruction, input mapping, and evidence regression checks. The deployment workflow runs these checks before publishing.

Scene instructions identify selectable people and the pump. Snow's review shows only the strongest collected support and challenge for each theory; the Field Notebook retains the full evidence. Choose a theory, prepare the argument, then present it—there is no confidence-level selection. The desktop and VR reviews share the same evidence summaries and progression rules.

## Save as a web app

The app includes a web app manifest, install icons, maskable icon and Apple touch icon. Supporting browsers can save it as **The Broad Street Inquiry**, launching directly into the main app. See [installation details and icon workflow](docs/web-app-installation.md). Network access is still required; Quest library installation and relaunch should be checked on device after deployment.

## Concept

Players are an apprentice to John Snow during the 1854 Broad Street outbreak. Across walkable 3D scenes and the final Board hearing, they interview residents, collect case records, compare hypotheses, build a map, and present evidence to the parish authorities. The goal is to teach field epidemiology, historical uncertainty, public health decision-making, and the power of visualizing data.

## Design Direction

- WebXR-first, with desktop browser fallback.
- Walkable environments with teleportation, smooth movement and desktop fallback.
- Plain Three.js, TypeScript, Vite, and DOM overlays for implementation.
- Authored interviews where player questions unlock source-tagged evidence.
- Snow's Desk synthesis board for comparing theories before presenting to the Board.
- Historically careful mystery structure: no modern lab proof, no lone-genius framing, and no claim that removing the pump handle alone "solved" the outbreak.
