# Scene ambience — October 10, 2026

The six walkable scenes now have different sound profiles, defined in `src/audio/ambience.ts` and played through the existing `Soundscape` controller. No scene action or clue depends on hearing.

| Location | Background details | Time between events |
| --- | --- | --- |
| Broad Street | A wagon passing in either direction along the street, short distant walking sequences, an occasional distant door | 12–26 seconds |
| Snow's office | Muffled wagon traffic at the window, quiet furniture/floor creaks | 20–38 seconds |
| Registrar | Pages handled around other desks, wooden knocks, creaks and quieter window traffic | 9–20 seconds |
| Household | Sparse cloth movement and creaks, muffled street traffic | 27–46 seconds |
| Workhouse | Short courtyard walking sequences, distant doors and traffic beyond the entrance | 16–31 seconds |
| Brewery | Wood handling by the barrel area, metal vessel sounds, cloth and timber creaks | 10–23 seconds |

The first opportunity is 4–9 seconds after entry/unlock. Events vary slightly in speed and level, avoid consecutive identical kinds and alternate recorded variants where available. Street wagon and courtyard footstep emitters move through world space. Interior traffic stays at the relevant opening and is low-pass filtered; this is authored placement/filtering, not dynamic acoustic occlusion. Air remains a soft synthesized bed. No voices, music, continuous pump-water loop, or claims of documented historical sound are added.

## Reading, controls and lifecycle

Conversation/evidence and other reading panels reduce ambience to 22% of the chosen level, then restore it smoothly. They suppress new incidental events, preventing a backlog when closed. The Sound settings panel is exempt so volume adjustments reflect normal playback. Saved volumes are never changed by ducking.

Existing mute and separate ambience/effects controls work on desktop and in XR. Headset/system-menu and document visibility combine correctly; restoring one cannot override the other's mute. Scene travel fades old sources and cancels their remaining activity. Playback uses the audio clock through the existing render update, not recurring timers; returning from a hidden state cannot fire a backlog. At most two incidental events are active, plus one air bed. Retired-source overlap is bounded even during rapid travel. Local effects use recorded footstep and page variants when available, with original generated fallback.

## Sources and preparation

The app ships [audio credits](../public/audio/credits.html), linked from desktop Sound settings, plus a [file manifest](../public/audio/sources.json) with source URLs, author, license, changes and checksums.

- [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds) and [RPG Audio](https://kenney.nl/assets/rpg-audio): CC0; original notices are retained. Concrete footsteps are an illustrative hard-paving substitute, not claimed recordings of historical cobbles.
- [WWS Woodenwagon](https://commons.wikimedia.org/wiki/File:WWS_Woodenwagon.ogg): Work With Sounds / Museum of Municipal Engineering, recordist Monika Widzicka; CC BY 4.0. This is a modern educational wagon pushed by people at a Polish museum. It supplies a plausible wooden-wheel texture, not historical London provenance or a horse recording.

Fifteen clips total **874,052 bytes** and **19.80 seconds**, mono PCM16 at 22,050 Hz. They download only after an input gesture, two at a time, with a 20-second overall timeout. Missing/unsupported clips do not prevent gameplay or leave an unhandled rejection. Disposal aborts loads and rejects late results. At 48 kHz browser decoding the recorded buffer budget is about 3.63 MiB, plus roughly 0.70 MiB for cached short walking sequences and 2.04 MiB for generated fallback buffers. Device sample rates affect decoded memory; no audio runtime package was added.

Rebuild with Python `numpy` and `soundfile` installed (asset preparation only):

```sh
python scripts/assets/prepare_ambience.py /tmp/vr-snow-audio
npm run test:walkable
VITE_BASE_PATH=/vr-snow/walkable/ npm run build
node scripts/test-web-app.mjs dist /vr-snow/walkable/
```

The preparation script caches original downloads outside the repository, selects only credited files, converts to mono, filters/downsamples, normalizes peaks, and adds edge fades. The wagon uses seconds 1–13. The manifest records source and processed hashes.

## Validation and listening review

103 automated checks include source hashes/WAV structure and budget, bounded concurrent loads, failed/late loads, event intervals/variation/movement, scene cleanup, silence on mute/zero volume/background, panel ducking without preference changes, and desktop/XR integration. TypeScript and the production build are checked separately.

No live listening or headset test is claimed. Review the local preview with headphones: leave the Sound panel open to adjust normal levels, then compare the street with Snow's room, open/close a conversation and notebook, travel repeatedly, mute/unmute, and enter/leave the headset system menu. Check perceived loudness, directional cues, repetition and comfort on Quest before judging the mix final. Spatialization and loudness cannot be established by the automated audio-node tests.
