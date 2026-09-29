# Desktop keyboard interaction

The walkable branch supports keyboard navigation through scene interaction, interviews, evidence, the map, notebook, Snow's review and the Board. Existing mouse, touch and standard WebXR controls remain available.

| Context | Keys | Action |
| --- | --- | --- |
| Scene | W / S, A / D | Walk forward/back and strafe, with existing collisions |
| Scene | Left / Right, Up / Down | Turn and look up/down; pitch is bounded |
| Scene | Space / Enter | Activate the target under the center reticle |
| Tools | M / N | Open or toggle map / notebook |
| Panel | Tab / Shift+Tab, arrows | Cycle enabled choices, with visible focus |
| Panel | Enter / Space | Activate the focused button |
| Panel | Escape | Close a dismissible panel and return focus to the scene |
| Panel | Page Up / Down | Scroll content; Up/Down also scroll the notebook |
| Tool rail | Escape | Return focus to the scene |

The Board panorama supports keyboard looking but has no walking floor. Mandatory chapter/Board steps must be completed using their buttons. Disabled locations are skipped. Keyboard movement stops when a panel opens, the page is hidden or focus enters a UI control; release and press a held key again to resume. Quick arrow taps receive one rendered frame even if released between frames.

`DesktopKeyboard` delegates actions to the existing DOM buttons and `GameState`. It traps panel focus, preserves selected controls when content redraws, keeps them in view and makes the background UI inert while a modal is open. The scene handler respects consumed UI events; desktop panel shortcuts are suspended during immersive XR and travel transitions.

## Browser acceptance sequence

1. Start a fresh local preview without using the mouse. Space opens Snow's interview; Enter receives the assignment. Escape returns focus to the canvas.
2. M opens the map. Use arrows or Tab to select the registrar and Enter to travel. Confirm disabled destinations are skipped. Space opens the ledger; Enter collects its evidence.
3. Return to Snow with M and review the addresses. Visit household, pump, workhouse and brewery, selecting their marked objects with the center reticle. Use arrows to adjust aim as necessary. Confirm each answer collects the expected evidence without repeated activation.
4. N opens the notebook; Page Down/Up reads all cards. Escape restores scene control. M can switch directly from notebook to map. Verify arrows in panels do not move the camera and that holding a movement key across panel opening does not resume movement automatically.
5. At Snow's review, select an explanation and confidence, prepare the argument, read feedback and present to the Board. Tab and Shift+Tab must wrap within the panel. Focus must remain visible after each redraw, including controls lower down in a scrolled panel.
6. Complete the Board and reach the final chapter screen; replay using the keyboard. Confirm reset, map and notebook remain reachable by Tab from the scene.

Run `npm run test:walkable` and `VITE_BASE_PATH=/vr-snow/walkable/ npm run build`. Automated checks cover pitch limits, horizontal walking while looking up/down, brief taps, focus-state clearing and existing travel/VR regressions. Browser checks establish desktop interaction; they do not establish screen-reader accessibility or new headset validation.

## Validation completed

- 47 automated tests and the production build passed.
- A fresh production-preview browser playthrough used only keyboard input from Snow's assignment through all seven evidence cards, the hypothesis/confidence review, Board presentation, completion and replay. No game state was injected.
- Verified quick Down taps aimed at the workhouse table, Space and Enter activated interviews and answers, M switched from notebook to map, Page Up/Down scrolled evidence, and Tab/Shift+Tab wrapped within Snow's review. The selected confidence remained visible after redraw.
- Reset was reachable by Tab; Escape returned focus to the canvas. No browser warnings or errors were captured during the playthrough.
