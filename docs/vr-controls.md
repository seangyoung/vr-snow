# VR movement, height and compact menus — October 10, 2026

## Quest controls

| Input | Action |
| --- | --- |
| Left stick | Head-relative forward/backward walking and strafing |
| Right stick | Forward: aim, then return to centre to teleport; sideways: 45-degree snap turns. Spin/tilt while holding an object. |
| Left X | Open/close Map |
| Left Y | Open/close Notebook |
| Right A | Stand/crouch view toggle |
| Right B | Open/close Settings |
| Trigger | Select people, pump handles and menu items. Ground teleport is a fallback when no standard right thumbstick is connected. |
| Grip/squeeze | Hold to grab a portable object within 5 metres; release to return it |
| Stick click | Open/close the menu, except while holding an item or paging through text |
| Stick click while reading | Left: previous text page; right: next text page; on-panel arrows remain |

Movement uses existing scene collision/path tests, including furniture, pump clearance and figures. Walking is 1.35 m/s at full input with an 18% deadzone, normalized diagonals and a 50 ms maximum frame delta. It pauses for modal menus, loss of focus, travel and unavailable walkable geometry. Conversations allow walking, snap turning, nearby teleportation and grip pickup without moving the conversation panel. Release to center after entering VR, connecting a controller, closing a panel, resuming, or changing scenes before walking again. Settings → Controls can disable stick walking; teleportation remains available. The left stick no longer snap-turns. Right/unhanded standard controllers can turn; controller array order is not used to assign hands.

## Viewing height

The first A press (or Settings → View height → Stand) places the current virtual eye level at 1.62 m, useful when playing seated. The next press targets a 1.15 m crouched view. Raise/Lower moves the viewing rig in 10 cm steps. Tracked height removes the offset. Rig offset is bounded to −0.8 through +1.4 m.

The adjustment moves the camera and controllers together; headset tracking remains active, so physical head motion still changes the view naturally. Teleportation, snap turns, recentering and travel preserve the height offset. It lasts for the current XR session; exiting VR resets it and restores the 1.62 m desktop camera. It does not edit the headset's floor calibration or persist a potentially unsuitable offset into a later session.

## Menus and leaving VR

The ordinary main menu is now 1.15 m high instead of 2.05 m, approximately **44% shorter**, with Map, Notebook and Settings. Settings, View height and Controls are 1.55 m high, approximately **24% shorter**. Canvas bounds and hit targets match the reduced surfaces; text is not globally scaled down. Conversation panels are scaled to 78% (85% for map recaps), and face the player’s eye position when opened. Map, notebook, sound and final evidence panels retain their existing reading area. Utility shortcuts preserve the active conversation answer.

Settings provides Sound, View height, Controls, Recenter and **Exit VR**. Exit VR is also available at the end of the scenario. It calls `XRSession.end()` and returns to the existing desktop game without resetting evidence or progression. Duplicate exit requests are suppressed; a rejected request shows a retry message and retains the session. Closing the entire browser tab is outside this action.

## Controller compatibility and source

Two additional face buttons per hand are **not guaranteed** by WebXR. The standard reserves trigger, squeeze, touchpad and thumbstick slots; optional extra buttons use profile-specific assignments, and the browser/platform can reserve physical buttons. See [the WebXR Gamepads specification](https://www.w3.org/TR/webxr-gamepads-module-1/).

`VrInput.ts` uses standard stick axes and a small local projection of the [WebXR Input Profiles Registry](https://github.com/immersive-web/webxr-input-profiles/tree/f4992299601614adbfefd398dc8e281556bb7444/packages/registry/profiles). Quest Touch variants, Pico variants and HP mixed-reality profiles provide X/Y and A/B bindings. The registered Valve Index layout provides only A to this app; Microsoft mixed-reality has no face-button bindings here. Runtime button-array length is checked. Unknown profiles, missing buttons, hands and nonstandard mappings do not get guessed face-button assignments. Panel actions remain available through the stick-click menu and ray interface. Additional headset and hand-only interaction support is not established by this pass.

The Controls panel lists the recognized buttons for connected devices. The [registry source notice](../public/licenses/webxr-input-profiles.txt) records the revision and license. No remote profile fetch or headset-vendor SDK is needed at runtime.

## Validation

114 automated checks cover existing gameplay and new profile/missing-button handling, edge-triggered shortcuts, handedness, deadzone/diagonal input, focus/panel release gates, frame caps, collision sliding, tracked-height/controller alignment, preservation through every scene, session-end cleanup, dialog-answer retention, panel bounds, and exit success/failure handling. TypeScript, the production build and deployed-path PWA checks are run separately.

The actual panel drawing code was rendered offline to review menu layout, text and clipping. These are canvas renders, not headset screenshots. Quest controller input, seated calibration, eye comfort, stereo readability, frame rate and actual session exit remain hardware acceptance checks.

1. Begin seated, close the menu and move with the left stick; verify right-stick turning and wall/furniture blocking.
2. Hold the left stick while opening/closing a panel. Movement must wait for a return to center.
3. Try X, Y and B during a conversation, then return to it; the answer should remain available.
4. Press A to stand, press again to crouch, then try 10 cm adjustments and Tracked height. Travel and teleport between scenes; the chosen offset should remain.
5. Use only stick click and ray selection to reach map, notebook, height, sound and Exit VR. Try with one controller disconnected.
6. Open the headset system menu while holding inputs, return and release them; there should be no jump or repeated action.
7. Exit VR from Settings and at completion. Confirm desktop view, retained progress and normal height on re-entry.

Object inspection now uses grip rather than trigger. Right-stick turning resumes only after releasing the object and centering the stick. See [portable-object controls](tactile-interactions.md) for the current inventory and source cards.

## Tracked controller models and button reminders — October 17, 2026

The controllers now use the runtime's WebXR input profile and the matching
left/right model in tracked **grip space**. Ray selection remains in target-ray
space. Buttons and sticks animate from the real gamepad input. Models use a small
shared studio environment for visibility in rooms with baked lighting; this does
not add lighting to the room itself.

Looking toward a nearby controller for 0.3 seconds fades in compact labels with
short leader lines to its controls. Labels are 8.5 cm wide (half their previous size), positioned from the actual button anchors with an 8 mm edge gap and minimal vertical spacing to avoid overlap. Looking away fades them out. This uses head direction,
not eye tracking. Labels remain available while the user looks at the controller;
there is no timer requiring them to read quickly. The reminders follow the current
bindings: map/notebook, height/settings, stick movement or held-item rotation,
menu/page clicks, trigger selection, and grip grab/return. Locked map access is indicated.
The free grip offers “Take item” while the other hand holds an object. Bring it close to the object or aim at it and squeeze to transfer; only the current holding hand can release it. System buttons are never presented as app shortcuts.

The profile, handedness, actual button count, and available model component nodes
are checked. Unknown face-button mappings are not guessed; hand-tracking input
never displays a controller model. Generic profiles provide fallback models. If a
model fails to load, a small neutral grip marker and the existing ray remain usable.
The Index's pressure grip has no drawable button node in this asset, so it gets no
misleading leader line. Disconnects remove models and callouts; late asynchronous
loads cannot reattach an old model to a new controller connection.

Assets are served from the app's own `controllers/` folder using the deployment's
base URL. Only the connected profile's model loads during play. The export retains
all applicable notices in [controller asset provenance](../public/controllers/SOURCE.txt)
and [the MIT license](../public/controllers/LICENSE.txt).

Design references:

- [Meta controller guidance](https://developers.meta.com/vr/design/controllers/): one-to-one tracking, grip for grabbing, trigger selection, and consistent mappings.
- [Meta tooltips](https://developers.meta.com/vr/design/tooltips/): short labels near associated controls, visible when needed. The gaze/distance thresholds above are this app's design choices.
- [Meta input visuals](https://developers.meta.com/vr/documentation/iwsdk/concepts/xr-input/input-visuals/): profile-driven assets, grip-space alignment, live button/axis animation.
- [WebXR Input Profiles assets](https://github.com/immersive-web/webxr-input-profiles/tree/main/packages/assets): model metadata and license.

Validation includes mapping/state tests, bundled model/component checks, disconnect
and late-load behavior, and rendered Chrome review of two Touch Plus controllers.
Quest checks remain: physical alignment, label readability with both hands nearby,
seated/standing viewing, tracking loss, object holding, and performance.

## Broad Street exploration edge

Attempting to cross an outer street limit fades in a small “Turn back — Return toward the Broad Street pump” label, a translucent amber strip and a short edge line. The label is placed once, two metres ahead in the current view and slightly below eye height (including when strafing or backing into an edge). It remains in world space as the head turns. The cue fades out after 2.5 seconds without another outward attempt, or sooner when turning away or moving inward. Panels, travel and backgrounding clear it. Reduced-motion mode uses immediate visibility changes.

Keyboard and left-stick movement retain their existing collision checks; room-scale motion is observed for the same cue without repositioning the tracked camera. Furniture, figures, pump collisions and teleport jumps do not trigger it. Decorative geometry does not intercept selection rays. This indicates the inquiry's virtual extent and does not replace, reproduce or modify the headset's physical-space boundary.

Design references: [Meta Comfort](https://developers.meta.com/vr/design/comfort/) recommends clear boundaries/visual cues, comfortable seated and standing use, and avoiding unnatural camera movement; [Locomotion Best Practices](https://developers.meta.com/vr/design/locomotion-best-practices/) emphasizes minimizing acceleration and maintaining stable performance. The amber strip and wording are this app's implementation of that guidance, not a prescribed Meta boundary treatment. Quest review must confirm text readability, fade comfort and room-scale behavior at each edge.

## Thumbstick teleport

On a tracked right-hand controller using the [WebXR standard mapping](https://www.w3.org/TR/webxr-gamepads-module-1/), push the thumbstick forward, point at clear ground, and release it to centre. The ray turns green for a valid destination and shows “Release stick to move”; blocked targets turn red. Only the current valid release target, within 12 metres, is used. Pull back or sideways to cancel.

The gesture requires neutral after connection, travel, focus loss, menus or object handling. Trigger/grip actions cancel an aim. Holding an item reserves the stick for rotation. Walking and snap turns pause during aiming; conversations still permit teleporting away. Desktop click teleport is unchanged. Controllers without a suitable right stick retain ground-trigger teleport; no vendor axis order is guessed. Quest acceptance should cover valid/invalid releases, cancellation, menus, grabbing, sideways turns, seated play and room-scale offsets.

## Interaction polish — October 29, 2026

- Quest B is **Back** while a panel is open, and opens Settings otherwise. Sound,
  Controls and Height return to Settings. Utility panels return to a suspended
  conversation when present; another Back closes the exchange. Controller labels
  follow this context. Explicit close controls and outside-click dismissal remain.
- Successful grabs, hand transfers, teleports and pump strokes give short,
  rate-limited controller pulses when WebXR haptics are available. Settings offers
  a Vibration toggle (session only). Unsupported/disconnected actuators are harmless.
- Small portable objects get 3.5 cm of hit assistance, extended to 4.5 cm for the
  current target to reduce jitter. Direct object hits take precedence. Reach stays
  at 5 m; assistance requires a visible surface and cannot bypass an obstruction. Hollow objects are checked against sampled mesh surfaces rather than their empty box centers.
  Name-only hover labels identify the selected object. Outlines and per-object pickup instructions were removed after user review.
- Desktop **1 / 2 / 3** select the displayed conversation choices once per key press.
  Tab/arrows and Enter still work. Escape releases mouse capture first, then closes
  a panel or goes back from Sound to Settings; in the scene it opens Settings.
- The desktop Mouse look button (also in Settings) opts into browser pointer lock.
  Mouse motion turns the camera and clicks target the center reticle. Escape frees
  the pointer; utility panels, travel and VR entry also release it. Browser failure
  shows a notice; drag-to-look and keyboard navigation remain available.

Walking speed, snap angle, sensitivity, grip-hold behavior and stick-click mappings
are unchanged. Quest acceptance still needs physical haptic strength, Back behavior,
small-object selection and performance checks. Desktop browser acceptance should
include pointer-lock permission/failure, Escape, modal opening and numbered choices.

Validation for this pass: 289 automated walkable checks, TypeScript/production
build, and PWA checks. Browser review covered numbered dialogue activation and
layout, Escape's Settings/Sound hierarchy, and graceful pointer-lock rejection.
In foreground Chrome, mouse capture activated successfully; Escape released it
without opening Settings, a second Escape opened Settings, and opening the
notebook released capture. Physical Quest feedback and targeting remain unverified.
