# VR movement, height and compact menus — October 10, 2026

## Quest controls

| Input | Action |
| --- | --- |
| Left stick | Head-relative forward/backward walking and strafing |
| Right stick | 45-degree snap turns |
| Left X | Open/close Map |
| Left Y | Open/close Notebook |
| Right A | Stand/crouch view toggle |
| Right B | Open/close Settings |
| Trigger | Select people, objects, menu items or clear ground for teleport |
| Grip/squeeze | Open the main menu or close the current panel |
| Stick click while reading | Left: previous text page; right: next text page; on-panel arrows remain |

Movement uses existing scene collision/path tests, including furniture, pump clearance and figures. Walking is 1.35 m/s at full input with an 18% deadzone, normalized diagonals and a 50 ms maximum frame delta. It pauses for panels, loss of focus, travel and unavailable walkable geometry. Release to center after entering VR, connecting a controller, closing a panel, resuming, or changing scenes before walking again. Settings → Controls can disable stick walking; teleportation remains available. The left stick no longer snap-turns. Right/unhanded standard controllers can turn; controller array order is not used to assign hands.

## Viewing height

The first A press (or Settings → View height → Stand) places the current virtual eye level at 1.62 m, useful when playing seated. The next press targets a 1.15 m crouched view. Raise/Lower moves the viewing rig in 10 cm steps. Tracked height removes the offset. Rig offset is bounded to −0.8 through +1.4 m.

The adjustment moves the camera and controllers together; headset tracking remains active, so physical head motion still changes the view naturally. Teleportation, snap turns, recentering and travel preserve the height offset. It lasts for the current XR session; exiting VR resets it and restores the 1.62 m desktop camera. It does not edit the headset's floor calibration or persist a potentially unsuitable offset into a later session.

## Menus and leaving VR

The ordinary main menu is now 1.15 m high instead of 2.05 m, approximately **44% shorter**, with Map, Notebook and Settings. Settings, View height and Controls are 1.55 m high, approximately **24% shorter**. Canvas bounds and hit targets match the reduced surfaces; text is not globally scaled down. Conversations, map, notebook, sound and final evidence panels retain their existing reading area. Utility shortcuts preserve the active conversation answer.

Settings provides Sound, View height, Controls, Recenter and **Exit VR**. Exit VR is also available at the end of the scenario. It calls `XRSession.end()` and returns to the existing desktop game without resetting evidence or progression. Duplicate exit requests are suppressed; a rejected request shows a retry message and retains the session. Closing the entire browser tab is outside this action.

## Controller compatibility and source

Two additional face buttons per hand are **not guaranteed** by WebXR. The standard reserves trigger, squeeze, touchpad and thumbstick slots; optional extra buttons use profile-specific assignments, and the browser/platform can reserve physical buttons. See [the WebXR Gamepads specification](https://www.w3.org/TR/webxr-gamepads-module-1/).

`VrInput.ts` uses standard stick axes and a small local projection of the [WebXR Input Profiles Registry](https://github.com/immersive-web/webxr-input-profiles/tree/f4992299601614adbfefd398dc8e281556bb7444/packages/registry/profiles). Quest Touch variants, Pico variants and HP mixed-reality profiles provide X/Y and A/B bindings. The registered Valve Index layout provides only A to this app; Microsoft mixed-reality has no face-button bindings here. Runtime button-array length is checked. Unknown profiles, missing buttons, hands and nonstandard mappings do not get guessed face-button assignments. Panel actions remain available through the existing grip/ray interface. Additional headset and hand-only interaction support is not established by this pass.

The Controls panel lists the recognized buttons for connected devices. The [registry source notice](../public/licenses/webxr-input-profiles.txt) records the revision and license. No remote profile fetch or headset-vendor SDK is needed at runtime.

## Validation

114 automated checks cover existing gameplay and new profile/missing-button handling, edge-triggered shortcuts, handedness, deadzone/diagonal input, focus/panel release gates, frame caps, collision sliding, tracked-height/controller alignment, preservation through every scene, session-end cleanup, dialog-answer retention, panel bounds, and exit success/failure handling. TypeScript, the production build and deployed-path PWA checks are run separately.

The actual panel drawing code was rendered offline to review menu layout, text and clipping. These are canvas renders, not headset screenshots. Quest controller input, seated calibration, eye comfort, stereo readability, frame rate and actual session exit remain hardware acceptance checks.

1. Begin seated, close the menu and move with the left stick; verify right-stick turning and wall/furniture blocking.
2. Hold the left stick while opening/closing a panel. Movement must wait for a return to center.
3. Try X, Y and B during a conversation, then return to it; the answer should remain available.
4. Press A to stand, press again to crouch, then try 10 cm adjustments and Tracked height. Travel and teleport between scenes; the chosen offset should remain.
5. Use only grip and ray selection to reach map, notebook, height, sound and Exit VR. Try with one controller disconnected.
6. Open the headset system menu while holding inputs, return and release them; there should be no jump or repeated action.
7. Exit VR from Settings and at completion. Confirm desktop view, retained progress and normal height on re-entry.
