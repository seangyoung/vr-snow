# Development milestones

This is the presentation and preservation record for **The Broad Street Inquiry**. The walkable experience became the main app on 2026-10-15. `main` is the maintained branch; earlier versions are frozen Git tags and downloadable builds.

[Current app](https://seangyoung.github.io/vr-snow/) · [Download the milestone collection](https://github.com/seangyoung/vr-snow/releases/tag/milestone%2F06-tactile-interactions)

## Selected milestones

Dates below are the selected commits' dates, not claims about the start or duration of each development phase. The exact commits, tags and descriptions are also in [the machine-readable index](milestones/index.json).

| Milestone | Commit date | What changed | Source | Runnable build | Presentation views |
| --- | --- | --- | --- | --- | --- |
| Panorama experience | 2026-09-24 | Stationary panorama scenes, map travel and evidence inquiry. | [`milestone/01-panorama`](https://github.com/seangyoung/vr-snow/tree/milestone/01-panorama) · [`c84f246`](https://github.com/seangyoung/vr-snow/commit/c84f246d535beb95b20bd4d6d1d008ce0d88f4ba) | [ZIP](https://github.com/seangyoung/vr-snow/releases/download/milestone%2F06-tactile-interactions/01-panorama.zip) | [Office](milestones/media/01-panorama-office.png) · [Street](milestones/media/01-panorama-street.png) |
| First walkable street | 2026-09-24 | Early geometric pump courtyard with desktop and WebXR movement; includes the initial headset-freeze fix. | [`milestone/02-first-walkable-street`](https://github.com/seangyoung/vr-snow/tree/milestone/02-first-walkable-street) · [`e346826`](https://github.com/seangyoung/vr-snow/commit/e346826bc0a472dc471d4c70ec1663b5248a23be) | [ZIP](https://github.com/seangyoung/vr-snow/releases/download/milestone%2F06-tactile-interactions/02-first-walkable-street.zip) | [Office](milestones/media/02-first-walkable-street-office.png) · [Street](milestones/media/02-first-walkable-street-street.png) |
| Walkable interiors | 2026-09-28 | Broad Street plus the office, registrar, household, workhouse and brewery interiors. | [`milestone/03-walkable-interiors`](https://github.com/seangyoung/vr-snow/tree/milestone/03-walkable-interiors) · [`ea3ab44`](https://github.com/seangyoung/vr-snow/commit/ea3ab44c1d7243a7b9975438d709051cd87c9d8e) | [ZIP](https://github.com/seangyoung/vr-snow/releases/download/milestone%2F06-tactile-interactions/03-walkable-interiors.zip) | [Office](milestones/media/03-walkable-interiors-office.png) · [Street](milestones/media/03-walkable-interiors-street.png) |
| Baked lighting | 2026-10-01 | Textured period interiors, depth beyond the office window and baked lighting across six scenes. | [`milestone/04-baked-lighting`](https://github.com/seangyoung/vr-snow/tree/milestone/04-baked-lighting) · [`575793a`](https://github.com/seangyoung/vr-snow/commit/575793ad7210fad38be235302fefe383ed9c458c) | [ZIP](https://github.com/seangyoung/vr-snow/releases/download/milestone%2F06-tactile-interactions/04-baked-lighting.zip) | [Office](milestones/media/04-baked-lighting-office.png) · [Street](milestones/media/04-baked-lighting-street.png) |
| Anatomical characters | 2026-10-15 | MakeHuman-based people, revised poses and plausible workhouse and brewery staging. | [`milestone/05-anatomical-characters`](https://github.com/seangyoung/vr-snow/tree/milestone/05-anatomical-characters) · [`b9b97b8`](https://github.com/seangyoung/vr-snow/commit/b9b97b8cd3fdf9bd82338cde33e9ad1e39bfc6e6) | [ZIP](https://github.com/seangyoung/vr-snow/releases/download/milestone%2F06-tactile-interactions/05-anatomical-characters.zip) | [Office](milestones/media/05-anatomical-characters-office.png) · [Street](milestones/media/05-anatomical-characters-street.png) |
| Tactile interactions | 2026-10-15 | Working pump, returning inspectable props and subtle character idle movement. | [`milestone/06-tactile-interactions`](https://github.com/seangyoung/vr-snow/tree/milestone/06-tactile-interactions) · [`f701694`](https://github.com/seangyoung/vr-snow/commit/f7016949c777dc6eaf1f625ea4fc5b9fa1bf68c6) | [ZIP](https://github.com/seangyoung/vr-snow/releases/download/milestone%2F06-tactile-interactions/06-tactile-interactions.zip) | [Office](milestones/media/06-tactile-interactions-office.png) · [Street](milestones/media/06-tactile-interactions-street.png) |

## Using a snapshot for a presentation

1. Download the ZIP for the desired stage and extract it.
2. Open a terminal in the extracted milestone folder and run:

   ```sh
   python3 -m http.server 8080 --bind 127.0.0.1 --directory site
   ```

3. Open `http://127.0.0.1:8080/`. Capture screenshots or record the browser window with the operating system's screen recorder. Stop the server with Ctrl+C before opening a different milestone on the same port.

These are prebuilt sites: no Node installation, npm install, Blender export or source checkout is needed to replay them. Opening `index.html` directly with `file://` will not work correctly. For headset capture, publish the chosen `site/` folder to an HTTPS host; desktop localhost is not accessible from a separate headset.

The ZIP includes the historical site, exact commit, Node/npm versions, dependency lockfile, build log and per-file SHA-256 checksums. [Build provenance and ZIP hashes](milestones/build-provenance.json) provide an independent record in Git. Large site bundles are GitHub Release assets, not copies in the source tree. Keep a downloaded copy with presentation materials for offline access.

## Presentation images and a suggested narrative

The linked screenshots show each version's default office spawn and default Broad Street arrival after accepting Snow's assignment and using the map. They use a consistent 1440 × 900 viewport. Camera placement changed during development, so these are consistent entry views rather than identical world-coordinate viewpoints. No game state or historical source code was altered for capture. Headless Chrome uses software rendering; these are desktop comparisons, not Quest performance evidence. [Browser checks](milestones/browser-checks.json) record the tested builds and runtime failures, if any.

A useful presentation sequence is:

1. **Panoramas:** richly illustrated surroundings and a working evidence narrative, with fixed viewpoints and abstract markers.
2. **First walkable street:** test movement, scale and presence before investing in detailed geometry.
3. **Walkable interiors:** extend movement and spatial travel throughout the inquiry.
4. **Lighting and materials:** improve depth, contact shadows and the identity of period rooms.
5. **People and staging:** replace markers with distinct characters and revise implausible furniture/poses using feedback.
6. **Responsive objects:** add the pump, inspectable items and subtle idle movement without changing the evidence logic.

For short clips, replay a frozen build and record the interaction that distinguishes it. No edited video clips are included in this initial archive; the screenshot collection is ready to use.

## Rebuilding or adding milestones

Git tags preserve source history without maintaining separate branches. Do not move or overwrite a published milestone tag. To inspect a historical source tree without changing the active checkout:

```sh
git worktree add --detach /tmp/vr-snow-history milestone/01-panorama
```

For a new milestone, select a reviewed commit, add its full SHA and description to `docs/milestones/index.json`, and create an annotated tag. Rebuild from the exact tracked inputs and historical lockfile with:

```sh
python3 scripts/archive/build_milestones.py --only 06-tactile-interactions --output /tmp/vr-snow-archive
```

Omit `--only` to build all milestones. This requires Python 3.12+, Git, Node and npm, plus network access for locked dependencies. The script refuses to overwrite an existing snapshot folder. It builds with a relative Vite base (`./`) for portable hosting, without changing historical source. Source authoring files remain available through the tags; prebuilt snapshots contain runtime assets only. Browser compatibility can change, which is why the archive also includes captured images.

For repeatable screenshots, serve the archive root on port 4180, provide a separately installed Playwright package through `PLAYWRIGHT_MODULE`, and run `node scripts/archive/capture_milestones.cjs`. The script expects system Chrome. It replaces the generated screenshots/check report, so review the diff before committing refreshed captures.

When adding a milestone, publish its runnable ZIP and screenshots to a GitHub Release, verify the downloaded asset/hash and browser rendering, and update this document with a short description of what actually changed. Record headset observations separately from build and desktop checks.

## Main-app transition

The promotion preserves the full development ancestry; it does not squash or rewrite earlier commits. Deployment now builds and tests `main` once, serves the walkable app at `/vr-snow/`, and redirects `/vr-snow/walkable/` to it while preserving query strings and fragments. Pull requests validate without publishing. The former prototype branch is retired only after successful deployment and a live-site check.

Older installed shortcuts still reach the redirect. Because the main URL has a different manifest scope/app identity, reinstall from the main site if a legacy installation opens outside its standalone window. See [web app installation](web-app-installation.md).
