# Brewery: walkable brewhouse prototype

The brewery panorama is replaced on `walkable-prototype` with a 10 × 12 m brick brewhouse and 4.5 m ceiling. Copper brewing vessels, a timber vat, two-tier cask rack, sacks, flagstones, exposed ceiling beams and high windows carry forward the panorama's appearance. These dimensions and fittings are interpretive design choices, not a surveyed reconstruction of Lion Brewery in 1854. Detailed period textures and lighting remain a later art pass.

## Interaction and travel

The existing unlock condition, map location and eastbound Broad Street travel target are preserved. Arrival faces a marked owners' table. Select the table or Brewery owners label to open the existing Edward and John Huggins interview. Its drink-source question awards the same brewery exception evidence. Equipment, mugs and the account book introduce no new evidence or actions.

The central aisle remains clear between the copper vessels. WASD/arrows, clear-floor teleportation, controller rays, squeeze panels and snap turns use the shared room controls. Collision envelopes include vessels, vat, rack, sacks, table, stools and bench, with 25 cm clearance. They constrain artificial movement; physical room-scale movement follows the headset and its real-world boundary.

The marked doorway returns to Broad Street by selection or automatic travel upon entering its ring. Arrival is outside the ring, and closing an interview while inside it cannot trigger travel. Map travel remains available.

## Editable assets

- `src/walkable/brewery-layout.json`: shared room, furniture, arrival, interview and exit positions.
- `scripts/assets/build_brewery_room.py`: deterministic Blender generator.
- `assets/brewery-room/brewery-room.blend`: packed, editable source with named pieces.
- `public/models/brewery-room.glb`: approximately 716 KiB, 13,280 triangles, 13 material batches.
- `assets/brewery-room/build-report.json`: geometry counts and exported layout.
- `src/walkable/BreweryRoom.ts`: existing furnished-room behavior configured for the brewery.

The model reuses project brick, stone and timber textures. Copper uses a simple material; no real-time shadows, animated steam, physics or new dependencies are introduced. A furnished fallback remains available if model loading fails.

```sh
blender --background --factory-startup --python scripts/assets/build_brewery_room.py
npm run test:walkable
VITE_BASE_PATH=/vr-snow/walkable/ npm run build
```

## Validation and headset check

All 43 automated checks and the production build pass. Brewery checks cover the interview approach, central aisle, furniture collision, seated and standing ray selection, controller dialogue, evidence retention, automatic exit, panel blocking, map re-entry and asset budgets. The scene lifecycle check now follows real inquiry prerequisites into the remaining Board panorama and back to the modeled scenes.

Browser checks confirmed normal unlock progression, room rendering, physical table selection, brewery evidence, clear-floor teleportation, automatic ring travel, direct door selection and map re-entry with evidence retained. No browser warnings or errors were recorded.

On Quest, check load performance, perceived vessel/room scale, table and label selection, floor teleport beside equipment, doorway/ring operation, panel placement, snap turns and repeated brewery-to-street travel. Desktop checks do not validate headset comfort or frame rate.
