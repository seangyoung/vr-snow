# Brewery: walkable brewhouse prototype

The brewery panorama is replaced on `walkable-prototype` with a 10 × 12 m brick brewhouse and 4.5 m ceiling. Copper brewing vessels, a timber vat, two-tier cask rack, sacks, flagstones, exposed ceiling beams and high windows carry forward the panorama's appearance. These dimensions and fittings are interpretive design choices, not a surveyed reconstruction of Lion Brewery in 1854. The [baked-lighting pass](walkable-baked-lighting.md) and [close-up material/prop pass](presence-and-sound.md) now refine the original prototype.

## Interaction and travel

The existing unlock condition, map location and eastbound Broad Street travel target are preserved. Arrival faces the two owners standing beside a small accounts table against the west wall. Select either owner to open the existing Edward and John Huggins interview. Its drink-source question awards the same brewery exception evidence. Equipment, mugs and the account book introduce no new evidence or actions.

The former central desk and stools are removed. The accounts table and its book and mugs sit along the west wall; grain sacks are stored at the rear. The central working floor and aisle between the copper vessels remain clear. WASD movement, arrow-key looking, clear-floor teleportation, controller rays, squeeze panels and snap turns use the shared room controls. Collision envelopes include vessels, vat, rack, sacks, side table and loaded owners, with 25 cm clearance. They constrain artificial movement; physical room-scale movement follows the headset and its real-world boundary.

The marked doorway returns to Broad Street by selection or automatic travel upon entering its ring. Arrival is outside the ring, and closing an interview while inside it cannot trigger travel. Map travel remains available.

## Editable assets

- `src/walkable/brewery-layout.json`: shared room, furniture, arrival, interview and exit positions.
- `scripts/assets/build_brewery_room.py`: deterministic Blender generator.
- `scripts/assets/pose_brewery_owners.py`: one-time standing pose edit preserving the approved faces and clothes.
- `assets/scene-people/edward.blend` and `john.blend`: authoritative editable figures.
- `assets/brewery-room/brewery-room.blend`: packed, editable source with named pieces.
- `public/models/brewery-room.glb`: geometry and material counts are recorded in the current build report.
- `assets/brewery-room/build-report.json`: geometry counts and exported layout.
- `src/walkable/BreweryRoom.ts`: existing furnished-room behavior configured for the brewery.

The model reuses project brick and stone textures and adds original timber, copper and cloth color/roughness maps; no real-time shadows, animated steam, physics or new dependencies are introduced. A furnished fallback remains available if model loading fails.

```sh
blender --background --factory-startup --python scripts/assets/build_brewery_room.py
blender --background --factory-startup --python scripts/assets/build_scene_characters.py -- brewery
npm run test:walkable
VITE_BASE_PATH=/vr-snow/walkable/ npm run build
```

## Validation and headset check

The original brewery slice passed 43 automated checks and a production build; see the latest pass documentation for current validation. Brewery checks cover the interview approach, central aisle, furniture collision, seated and standing ray selection, controller dialogue, evidence retention, automatic exit, panel blocking, map re-entry and asset budgets. The scene lifecycle check now follows real inquiry prerequisites into the remaining Board panorama and back to the modeled scenes.

Browser checks of the original slice confirmed normal unlock progression, room rendering, the former table selection, brewery evidence, clear-floor teleportation, automatic ring travel, direct door selection and map re-entry with evidence retained. No browser warnings or errors were recorded.

On Quest, check load performance, perceived vessel/room scale, owner selection, floor teleport beside equipment, doorway/ring operation, panel placement, snap turns and repeated brewery-to-street travel. Desktop checks do not validate headset comfort or frame rate.

The standing-owner revision also checks the unobstructed central floor, approach
to both owners, loaded character collision, seated/standing viewer selection, and
that the side accounts table does not create an extra conversation target. Room
and person lighting are rebaked together, with front and side pose review.

## Supplied barrel integration (October 2026)

The eight rack casks now use an optimized version of **MatteReal's Wooden
Barrels**, supplied under CC BY 3.0. The archived license and source metadata are
in `assets/wooden-barrel/`; the public credit is
`public/licenses/wooden-barrels.txt`, linked from the Sound settings panel.
The source model's OpenFootage metal maps are excluded; the iron material is
newly authored. The wood color and normal maps are resized to 1024 pixels.

`scripts/assets/prepare_wooden_barrel.py` applies the source subdivision before
simplifying to 1,604 triangles, repairs shell normals for backface culling, and
normalizes the cask to the existing rack envelope. Its packed output,
`assets/wooden-barrel/wooden-barrel.blend`, is tracked, so ordinary room rebuilds
do not depend on a file in `tmp`. To regenerate that master from the supplied
download:

```sh
blender --background --factory-startup --disable-autoexec \
  --python scripts/assets/prepare_wooden_barrel.py -- /path/to/Wooden_Barrels_Scene.blend
```

The room generator places the eight casks, adds head bungs and paired timber
chocks beneath each barrel, and rebakes the room lighting. Cask bellies rest at
shelf height; the sixteen chocks resist rolling in either direction along the rack.
The room has 29,544 triangles and 14 mesh batches (15 material
primitives, because the cask batch has wood and iron). Its GLB is approximately
5 MB. Existing rack collision, walkways, portable objects and interactions are
unchanged. The casks remain fixed scenery.

The accompanying Broad Street pump pass retains the existing profile and
interaction mechanism. Original low-poly hinge cheeks, axle/fasteners, base
bolts, spout collar, outlet lip and a handgrip wear band add mechanical detail.
The moving wear band belongs to the removable handle; fixed fittings stay on
the body. No mesh or material from the supplied `Hand pump.blend` is shipped.

Validation: 280 walkable checks, production build and installation checks;
browser review of rack placement, cask materials and pump motion/removal. A
Quest review is still needed for close-range appearance and load performance.
