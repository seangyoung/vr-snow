# VR Snow

Design workspace for **The Broad Street Inquiry**, an educational WebXR mystery game about the 1854 Soho cholera outbreak and John Snow's investigation.

The current deliverable is a vertical slice prototype plus a source-backed game design document:

- [docs/game-design.md](docs/game-design.md)

## Run the Prototype

```bash
npm install
npm run dev
```

Open the local Vite URL, usually `http://127.0.0.1:5173/`.

## Published Versions

The GitHub Pages deployment builds two branches into one site:

- Stable experience from `main`: <https://seangyoung.github.io/vr-snow/>
- Walkable prototype from `walkable-prototype`: <https://seangyoung.github.io/vr-snow/walkable/>

Pushes to `main` publish both versions immediately. Pushes to `walkable-prototype` first run its build check; a successful check then triggers the `main` deployment workflow to rebuild and publish both versions. Shared fixes should normally be committed to `main`, then brought into the prototype with:

```bash
git switch walkable-prototype
git merge main
git push
```

Walkable-only work remains on `walkable-prototype` until it is deliberately merged into `main`.

## Walkable branch: street and office

On `walkable-prototype`, Broad Street is a textured, source-informed reconstruction of the pump junction, with an editable Blender environment and a selectable pump. Snow’s office is a compact furnished 3D room with desk interaction and a doorway to Broad Street; see [office scope and headset checks](docs/walkable-office.md). Other locations retain the panorama experience. See [the reconstruction sources and asset workflow](docs/broad-street-reconstruction.md) and [the headset test card](docs/walkable-pump-test.md) for controls, scope, and acceptance checks.

Run `npm run test:walkable` for movement, obstruction, input mapping, and evidence regression checks. The walkable validation workflow runs these checks before deployment eligibility.

## Concept

Players are an apprentice to John Snow during the 1854 Broad Street outbreak. In immersive 360 scenes, they interview residents, collect case records, compare hypotheses, build a map, and present evidence to the parish authorities. The goal is to teach field epidemiology, historical uncertainty, public health decision-making, and the power of visualizing data.

## Design Direction

- WebXR-first, with desktop browser fallback.
- Stationary 360 environments with interactive hotspots for VR comfort.
- Plain Three.js, TypeScript, Vite, and DOM overlays for implementation.
- Authored interviews where player questions unlock source-tagged evidence.
- Snow's Desk synthesis board for comparing theories before presenting to the Board.
- Historically careful mystery structure: no modern lab proof, no lone-genius framing, and no claim that removing the pump handle alone "solved" the outbreak.
