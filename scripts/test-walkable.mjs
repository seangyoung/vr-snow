import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { test } from "node:test";
import ts from "typescript";
import * as THREE from "three";

// Compile into the ignored dependency cache; no additional test dependency.
const output = resolve("node_modules/.cache/walkable-tests");
for (const name of ["render/BroadStreetScene", "walkable/WalkableArea", "walkable/SnowOffice", "walkable/SnowCharacter", "audio/Soundscape", "walkable/FurnishedRoom", "walkable/BakedRoomLighting", "walkable/RegistrarRoom", "walkable/HouseholdRoom", "walkable/WorkhouseCourtyard", "walkable/BreweryRoom", "walkable/DesktopMovement", "walkable/locomotion", "walkable/PumpCourtyard", "walkable/WorldTravelTargets", "walkable/TravelRoutes", "simulation/gameState", "simulation/content", "simulation/types"]) {
  const source = await readFile(`src/${name}.ts`, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    .replace(/from "(\.\.?\/[^".]+)"/g, 'from "$1.js"');
  await mkdir(resolve(output, name, ".."), { recursive: true });
  await writeFile(resolve(output, `${name}.js`), compiled);
}
for (const name of ["office-layout", "registrar-layout", "household-layout", "workhouse-layout", "brewery-layout"]) await copyFile(`src/walkable/${name}.json`, resolve(output, `walkable/${name}.json`));
await writeFile(resolve(output, "package.json"), '{"type":"module"}');
const load = (name) => import(pathToFileURL(resolve(output, `${name}.js`)).href);
const { teleportViewer, turnViewer, standardTurnAxis } = await load("walkable/locomotion");
const { DesktopMovement } = await load("walkable/DesktopMovement");
const { PumpCourtyard, isValidDestination, canWalkBetween, pumpPosition, streetSpawn } = await load("walkable/PumpCourtyard");
const { GameState } = await load("simulation/gameState");
const { BroadStreetScene } = await load("render/BroadStreetScene");

test("VR street entry supports pump selection, squeeze panel access, and teleport", () => {
  // Exercise the actual scene controller methods without a GPU or XR session.
  const scene = Object.create(BroadStreetScene.prototype);
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.62, 0);
  const playerRig = new THREE.Group();
  playerRig.add(camera);
  const controller = new THREE.Group();
  controller.position.copy(camera.position);
  playerRig.add(controller);
  const courtyard = new PumpCourtyard();
  courtyard.group.visible = true;
  Object.assign(scene, {
    camera, playerRig, courtyard,
    gameState: new GameState(), renderer: { xr: { isPresenting: true } },
    controllerRaycaster: new THREE.Raycaster(),
    controllerWorldPosition: new THREE.Vector3(),
    controllerWorldQuaternion: new THREE.Quaternion(),
    controllerWorldDirection: new THREE.Vector3(),
    vrPanelVisible: false, vrPanelButtons: [],
  });
  camera.updateWorldMatrix(true, false);
  let opened = 0;
  scene.showVrPanel = () => { opened++; scene.vrPanelVisible = true; };
  scene.hideVrPanel = () => { scene.vrPanelVisible = false; };
  let inspected;
  scene.activateVrHotspot = (hotspot) => { inspected = hotspot.id; scene.showVrPanel(); };
  controller.position.set(pumpPosition.x, 1.62, 6);
  for (let frame = 0; frame < 10; frame++) {
    assert.ok(courtyard.isPump(scene.pickVrPointerHit(controller).object));
  }
  scene.selectFromVrController(controller);
  assert.equal(inspected, "broad-street-pump");
  assert.equal(opened, 1);
  scene.toggleVrPanel();
  assert.equal(scene.vrPanelVisible, false);
  scene.toggleVrPanel();
  assert.equal(scene.vrPanelVisible, true);
  assert.equal(opened, 2);
  // The panel blocks teleportation until it is closed.
  controller.position.set(-2, 1.62, 0);
  controller.rotation.x = -Math.PI / 4;
  scene.selectFromVrController(controller);
  assert.equal(playerRig.position.length(), 0);
  scene.toggleVrPanel();
  const ground = scene.pickVrPointerHit(controller);
  assert.ok(courtyard.canTeleport(ground));
  scene.selectFromVrController(controller);
  const viewer = camera.getWorldPosition(new THREE.Vector3());
  assert.ok(Math.abs(viewer.x - ground.point.x) < 1e-10);
  assert.ok(Math.abs(viewer.z - ground.point.z) < 1e-10);
});

test("teleport preserves head height and orientation with a room-scale offset", () => {
  const rig = new THREE.Group();
  const head = new THREE.PerspectiveCamera();
  head.position.set(0.7, 1.4, -0.6);
  rig.add(head);
  rig.rotation.y = 0.8;
  rig.position.set(2, 0, 1);
  const beforeRotation = head.getWorldQuaternion(new THREE.Quaternion());
  teleportViewer(rig, head, new THREE.Vector3(-2, 0, -3));
  const position = head.getWorldPosition(new THREE.Vector3());
  assert.ok(position.distanceTo(new THREE.Vector3(-2, 1.4, -3)) < 1e-10);
  assert.ok(head.getWorldQuaternion(new THREE.Quaternion()).angleTo(beforeRotation) < 1e-7);
});

test("eight snap turns keep the room-scale viewer in place", () => {
  const rig = new THREE.Group();
  const head = new THREE.PerspectiveCamera();
  head.position.set(1.1, 1.65, -0.8);
  rig.add(head);
  rig.position.set(-1, 0, -4);
  const before = head.getWorldPosition(new THREE.Vector3());
  for (let i = 0; i < 8; i++) {
    turnViewer(rig, head, Math.PI / 4);
    assert.ok(head.getWorldPosition(new THREE.Vector3()).distanceTo(before) < 1e-10);
  }
});

test("destinations exclude boundaries, pump footprint and invalid coordinates", () => {
  for (const [x, z] of [[0, 0], [-3, -5], [4.2, 6], [7.5, 10]]) assert.ok(isValidDestination(new THREE.Vector3(x, 0, z)));
  for (const [x, z] of [[16, 0], [0, -9], [-1, 4], [12, 4], [-3.8, 1.3], [-3.3, 1.3], [NaN, 0]]) assert.equal(isValidDestination(new THREE.Vector3(x, 0, z)), false);
});

test("ray selection hits solid pump and walls before ground behind them", () => {
  const street = new PumpCourtyard();
  street.group.visible = true;
  const from = new THREE.Vector3(pumpPosition.x, 1.62, -3);
  const ray = new THREE.Raycaster(from, new THREE.Vector3(0, -0.5, 4.3).normalize());
  const pumpHit = street.pick(ray);
  assert.ok(street.isPump(pumpHit.object));
  assert.equal(street.canTeleport(pumpHit), false);
  ray.set(new THREE.Vector3(0, 1.62, 0), new THREE.Vector3(0, 0, -1));
  assert.equal(street.canTeleport(street.pick(ray)), false);
  ray.set(new THREE.Vector3(-2, 1.62, 0), new THREE.Vector3(0, -1, -1).normalize());
  assert.ok(street.canTeleport(street.pick(ray)));
  street.group.visible = false;
  assert.equal(street.pick(ray), undefined);
});

test("standard thumbstick and touchpad inputs work without vendor or hand assumptions", () => {
  const source = (mapping, axes) => ({ gamepad: { mapping, axes } });
  assert.equal(standardTurnAxis(source("xr-standard", [0, 0, 0.9, 0])), 0.9);
  assert.equal(standardTurnAxis(source("xr-standard", [-0.8, 0])), -0.8);
  assert.equal(standardTurnAxis(source("", [1, 0])), 0);
  assert.equal(standardTurnAxis(), 0);
});

test("pump slice respects assignment and retains evidence through travel and resets", () => {
  const game = new GameState();
  assert.equal(game.travelToLocation("broad-street").traveled, false);
  game.inspectHotspot("john-snow");
  game.askQuestion("snow-method-question");
  assert.ok(game.travelToLocation("broad-street").traveled);
  assert.ok(game.inspectHotspot("broad-street-pump").dialogue);
  assert.equal(game.askQuestion("pump-caution-question").evidence.id, "pump-water-inspection");
  game.travelToLocation("snow-desk");
  game.travelToLocation("broad-street");
  assert.ok(game.hasEvidence("pump-water-inspection"));
  game.inspectHotspot("broad-street-pump");
  game.askQuestion("pump-caution-question");
  assert.equal(game.getCollectedEvidence().length, 1);
  game.reset();
  assert.equal(game.hasEvidence("pump-water-inspection"), false);
  assert.equal(game.getCurrentLocation().id, "snow-desk");
});

test("keyboard movement follows yaw, preserves height and normalizes diagonals", () => {
  const controls = new DesktopMovement();
  const start = new THREE.Vector3(0, 1.62, 0);
  controls.press("KeyW");
  const forward = controls.update(start, 0, 0.05).position;
  assert.ok(forward.z < 0);
  assert.equal(forward.y, start.y);
  controls.press("KeyD");
  const diagonal = controls.update(start, 0, 0.05).position;
  assert.ok(diagonal.x > 0 && diagonal.z < 0);
  assert.ok(Math.abs(diagonal.distanceTo(start) - forward.distanceTo(start)) < 1e-10);
  controls.release("KeyD");
  const turned = controls.update(start, Math.PI / 2, 0.05).position;
  assert.ok(turned.x < 0 && Math.abs(turned.z) < 1e-10);
});

test("all arrow keys look without translating; WASD remains horizontal movement", () => {
  const controls = new DesktopMovement();
  const start = new THREE.Vector3();
  controls.press("ArrowUp");
  assert.deepEqual(controls.update(start, 0, 0.05).position, start);
  assert.ok(controls.update(start, 0, 0.05).pitch > 0);
  controls.press("KeyW");
  assert.ok(Math.abs(controls.update(start, 0, 0.05).position.z + 0.1) < 1e-10);
  controls.clear();
  controls.press("ArrowDown");
  assert.deepEqual(controls.update(start, 0, 0.05).position, start);
  assert.ok(controls.update(start, 0, 0.05).pitch < 0);
  controls.clear();
  controls.press("ArrowLeft");
  assert.ok(controls.update(start, 0, 0.05).yaw > 0);
  assert.deepEqual(controls.update(start, 0, 0.05).position, start);
  controls.clear();
  controls.press("ArrowRight");
  assert.ok(controls.update(start, 0, 0.05).yaw < 0);
});

test("walking stops at the pump and walls; swept tests reject crossing the pump", () => {
  assert.equal(canWalkBetween(new THREE.Vector3(-6, 0, 1.3), new THREE.Vector3(-2, 0, 1.3)), false);
  const controls = new DesktopMovement();
  controls.press("KeyS");
  let position = new THREE.Vector3(pumpPosition.x, 1.62, -3);
  for (let i = 0; i < 200; i++) {
    position = controls.update(position, 0, 0.05).position;
    assert.ok(isValidDestination(position));
  }
  assert.ok(position.z < pumpPosition.z - 0.64);
  controls.clear();
  controls.press("KeyD");
  position.set(0, 1.62, 0);
  for (let i = 0; i < 200; i++) position = controls.update(position, 0, 0.05).position;
  assert.ok(position.x <= 15 && position.x > 14.8);
  controls.press("KeyW");
  const sliding = controls.update(position, 0, 0.05).position;
  assert.ok(isValidDestination(sliding) && sliding.z < position.z);
});

test("released and cleared keys stop movement; auto-repeat cannot resume a cleared key", () => {
  const controls = new DesktopMovement();
  const start = new THREE.Vector3();
  controls.press("KeyW");
  controls.release("KeyW");
  assert.deepEqual(controls.update(start, 0, 0.05).position, start);
  controls.press("KeyA");
  controls.clear();
  controls.press("KeyA", true);
  assert.deepEqual(controls.update(start, 0, 0.05).position, start);
  controls.press("KeyA");
  assert.ok(controls.update(start, 0, 0.05).position.x < 0);
  controls.clear();
  controls.press("w");
  assert.ok(controls.update(start, 0, 0.05).position.z < 0);
  controls.release("W");
  assert.deepEqual(controls.update(start, 0, 0.05).position, start);
});

test("movement is frame-rate independent and a stalled frame cannot jump across the street", () => {
  const controls = new DesktopMovement();
  controls.press("KeyW");
  const simulate = (frames) => {
    let position = new THREE.Vector3();
    for (let i = 0; i < frames; i++) position = controls.update(position, 0, 1 / frames).position;
    return position;
  };
  assert.ok(simulate(30).distanceTo(simulate(120)) < 1e-10);
  assert.ok(controls.update(new THREE.Vector3(), 0, 60).position.length() <= 0.1);
});


test("junction footprint admits Cambridge but rejects facade corner cutting", () => {
  assert.ok(isValidDestination(streetSpawn));
  assert.ok(canWalkBetween(new THREE.Vector3(1,0,2), new THREE.Vector3(1,0,5)));
  assert.equal(canWalkBetween(new THREE.Vector3(-2,0,2), new THREE.Vector3(1,0,5)), false);
  assert.equal(canWalkBetween(new THREE.Vector3(14,0,2), new THREE.Vector3(7.5,0,5)), false);
  assert.equal(isValidDestination(new THREE.Vector3(4,0,14)), false);
});

test("exported street stays within its geometry budget and embeds its textures", async () => {
  const bytes = await readFile('public/models/broad-street.glb');
  assert.equal(bytes.toString('utf8',0,4), 'glTF');
  assert.ok(bytes.length < 20 * 1024 * 1024, 'Keep the preload below 20 MiB');
  const gltf = JSON.parse(bytes.toString('utf8',20,20 + bytes.readUInt32LE(12)));
  const primitives = gltf.meshes.flatMap(mesh => mesh.primitives);
  const triangles = primitives.reduce((sum,p) => sum + gltf.accessors[p.indices].count/3,0);
  assert.ok(primitives.length <= 20 && triangles < 180_000);
  assert.ok(gltf.images.length >= 12);
  assert.ok(gltf.images.every(image => image.bufferView !== undefined && !image.uri));
  assert.ok(primitives.every(p => p.attributes.NORMAL !== undefined && p.attributes.TEXCOORD_0 !== undefined));
  // Shopfront color is now authored in its embedded paint texture rather than
  // a constant baseColorFactor. Contact shading must also survive the export.
  assert.ok(gltf.materials.some(m => m.name === 'Painted shopfront' && m.pbrMetallicRoughness?.baseColorTexture));
  assert.ok(primitives.every(p => p.attributes.COLOR_0 !== undefined));
  assert.ok(gltf.materials.every(m => (m.alphaMode ?? 'OPAQUE') === 'OPAQUE'));
});

test("generated building envelopes do not occupy any permitted walking position", async () => {
  const report = JSON.parse(await readFile('assets/broad-street/build-report.json','utf8'));
  const points = [streetSpawn, pumpPosition];
  for(let x=-13; x<=15; x+=.5) for(let z=-7.5; z<=13; z+=.5) {
    const point = new THREE.Vector3(x,0,z);
    if(isValidDestination(point)) points.push(point);
  }
  for(const point of points) for(const r of report.footprints) {
    assert.equal(point.x > r.minX && point.x < r.maxX && point.z > r.minZ && point.z < r.maxZ, false,
      `Building overlaps the street at ${point.x}, ${point.z}`);
  }
});

const { streetTravelRoutes, returnTravelRoutes, TravelZoneTracker } = await load('walkable/TravelRoutes');
const { WorldTravelTargets } = await load('walkable/WorldTravelTargets');
function fieldGame(unlocked=false) {
  const game=new GameState();game.inspectHotspot('john-snow');game.askQuestion('snow-method-question');
  if(unlocked) {
    game.travelToLocation('registrar');game.inspectHotspot('registrar-ledger');game.askQuestion('ledger-timeline-question');
    game.travelToLocation('snow-desk');game.inspectHotspot('john-snow');game.askQuestion('pump-cluster-question');
  }
  game.travelToLocation('broad-street');return game;
}

test('automatic travel fires once on entry, including after ground teleport, and does not fire on unlock',()=>{
  const tracker=new TravelZoneTracker();const route=streetTravelRoutes.find(r=>r.to==='brewery');const z=route.zone;
  assert.equal(tracker.update(0,0,streetTravelRoutes,()=>true),undefined);
  assert.equal(tracker.update(z.x,z.z,streetTravelRoutes,()=>false),undefined);
  assert.equal(tracker.update(z.x,z.z,streetTravelRoutes,()=>true),undefined,'unlock while inside must not trigger');
  tracker.update(0,0,streetTravelRoutes,()=>true);
  assert.equal(tracker.update(z.x,z.z,streetTravelRoutes,()=>true).to,'brewery');
  assert.equal(tracker.update(z.x,z.z,streetTravelRoutes,()=>true),undefined);
  tracker.reset();
  assert.equal(tracker.update(z.x,z.z,streetTravelRoutes,()=>false),undefined,'blocked panel consumes entry');
  assert.equal(tracker.update(z.x,z.z,streetTravelRoutes,()=>true),undefined,'closing a panel cannot trigger travel');
});

test('all street approach rings are reachable and outside spawn and each other',()=>{
  for(const a of streetTravelRoutes) {
    assert.ok(isValidDestination(new THREE.Vector3(a.zone.x,0,a.zone.z)));
    assert.ok(Math.hypot(streetSpawn.x-a.zone.x,streetSpawn.z-a.zone.z)>a.zone.radius+1);
    for(const b of streetTravelRoutes) if(a!==b) assert.ok(Math.hypot(a.zone.x-b.zone.x,a.zone.z-b.zone.z)>a.zone.radius+b.zone.radius);
  }
  assert.ok(streetTravelRoutes.find(r=>r.to==='brewery').zone.x>pumpPosition.x);
  assert.ok(streetTravelRoutes.find(r=>r.to==='workhouse').direction.includes('Poland'));
  assert.ok(streetTravelRoutes.find(r=>r.to==='snow-desk').zone.z>pumpPosition.z);
  assert.ok(streetTravelRoutes.find(r=>r.to==='household').zone.z<pumpPosition.z);
});

test('world travel shares map prerequisites and cannot bypass Board preparation',()=>{
  const game=fieldGame();
  for(const id of ['household','brewery','workhouse']) assert.equal(game.travelToLocation(id).traveled,false);
  const unlocked=fieldGame(true);
  for(const route of streetTravelRoutes) assert.ok(unlocked.canTravelToLocation(route.to));
  assert.equal(unlocked.canTravelToLocation('board-room'),false);
  assert.ok(returnTravelRoutes.every(r=>r.to==='broad-street'||r.to==='snow-desk'));
  assert.equal(unlocked.getLocation('household').title,'Broad Street Household');
  assert.ok(unlocked.getLocation('household').mapPoint.y<unlocked.getLocation('broad-street').mapPoint.y);
});

test('target picking respects building occlusion, active scene, and marked household door',()=>{
  const game=fieldGame(true);const street=new PumpCourtyard();street.group.visible=true;
  const targets=new WorldTravelTargets(()=>new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));targets.refresh(game);
  const ray=new THREE.Raycaster(new THREE.Vector3(-11,1.3,-6),new THREE.Vector3(0,0,-1));
  let hit=targets.pick(ray,'broad-street',street.pick(ray));
  assert.equal(targets.routeFor(hit.object).to,'household');
  ray.set(new THREE.Vector3(10,1.65,-1.5),new THREE.Vector3(1,0,0));
  hit=targets.pick(ray,'broad-street',street.pick(ray));assert.equal(targets.routeFor(hit.object).to,'brewery');
  const wall={distance:1,object:new THREE.Object3D()};
  assert.equal(targets.pick(ray,'broad-street',wall),wall);
  assert.equal(targets.pick(ray,'snow-desk'),undefined);
});

test('actual controller travel honors locked targets and panel blocking, then travels once unlocked',()=>{
  const game=fieldGame();const street=new PumpCourtyard();street.group.visible=true;
  const targets=new WorldTravelTargets(()=>new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));targets.refresh(game);
  const camera=new THREE.PerspectiveCamera();const rig=new THREE.Group();rig.add(camera);
  const controller=new THREE.Group();controller.position.set(10,1.65,-1.5);
  controller.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),new THREE.Vector3(1,0,0));
  const scene=Object.create(BroadStreetScene.prototype);
  Object.assign(scene,{camera,playerRig:rig,courtyard:street,worldTravel:targets,gameState:game,
    renderer:{xr:{isPresenting:true}},desktopMovement:new DesktopMovement(),controllerRaycaster:new THREE.Raycaster(),
    controllerWorldPosition:new THREE.Vector3(),controllerWorldQuaternion:new THREE.Quaternion(),controllerWorldDirection:new THREE.Vector3(),
    vrPanelVisible:false,vrPanelButtons:[],hotspotVisuals:new Map(),worldTravelPending:false,
    hideVrPanel:()=>{scene.vrPanelVisible=false;}});
  scene.selectFromVrController(controller);assert.equal(game.getCurrentLocation().id,'broad-street');
  const unlocked=fieldGame(true);scene.gameState=unlocked;targets.refresh(unlocked);
  scene.vrPanelVisible=true;scene.selectFromVrController(controller);assert.equal(unlocked.getCurrentLocation().id,'broad-street');
  scene.vrPanelVisible=false;scene.selectFromVrController(controller);assert.equal(unlocked.getCurrentLocation().id,'brewery');
  assert.ok(unlocked.hasEvidence('pump-cluster'));
  scene.activateWorldTravel(streetTravelRoutes[0]);assert.equal(unlocked.getCurrentLocation().id,'brewery');
});

test('scene automatic travel uses tracked viewer position, blocks panels and deduplicates desktop fades',()=>{
  const game=fieldGame(true), scene=Object.create(BroadStreetScene.prototype);
  const camera=new THREE.PerspectiveCamera(), rig=new THREE.Group();rig.add(camera);
  const street=new PumpCourtyard();street.group.visible=true;
  Object.assign(scene,{gameState:game,camera,playerRig:rig,courtyard:street,cameraWorldPosition:new THREE.Vector3(),
    renderer:{xr:{isPresenting:true}},travelZones:new TravelZoneTracker(),worldTravelPending:false,
    vrPanelVisible:true,desktopMovement:new DesktopMovement(),hideVrPanel:()=>{}});
  const route=streetTravelRoutes.find(r=>r.to==='brewery'), zone=route.zone;
  // A physical head offset plus rig translation lands in the same world-space zone.
  rig.position.set(zone.x-.4,0,zone.z);camera.position.set(.4,1.62,0);
  scene.updateWorldTravelZones();assert.equal(game.getCurrentLocation().id,'broad-street');
  scene.vrPanelVisible=false;scene.updateWorldTravelZones();assert.equal(game.getCurrentLocation().id,'broad-street');
  rig.position.x-=2;scene.updateWorldTravelZones();rig.position.x+=2;
  scene.updateWorldTravelZones();assert.equal(game.getCurrentLocation().id,'brewery');
  game.travelToLocation('broad-street');scene.travelZones.reset();scene.renderer.xr.isPresenting=false;
  scene.canUseDesktopMovement=()=>true;
  let fades=0;scene.onWorldTravel=(id)=>{assert.equal(id,'brewery');fades++;};
  scene.updateWorldTravelZones();scene.updateWorldTravelZones();scene.activateWorldTravel(route);
  assert.equal(fades,1);assert.ok(scene.worldTravelPending);
});

const { BreweryRoom, breweryArea, brewerySpawn, breweryOwnersTarget } = await load("walkable/BreweryRoom");
const { WorkhouseCourtyard, workhouseArea, workhouseSpawn, workhouseStewardTarget } = await load("walkable/WorkhouseCourtyard");
const { HouseholdRoom, householdArea, householdSpawn, householdInterviewTarget } = await load("walkable/HouseholdRoom");
const { RegistrarRoom, registrarArea, registrarSpawn, registrarLedgerTarget } = await load("walkable/RegistrarRoom");
const { SnowOffice, officeArea, officeSpawn, officeDeskTarget } = await load('walkable/SnowOffice');
const officeLayout=JSON.parse(await readFile('src/walkable/office-layout.json','utf8'));

test('office spawn, desk approach and exit are reachable without crossing furniture',()=>{
  const door=returnTravelRoutes.find(r=>r.id==='snow-street').zone;
  const route=[officeSpawn,new THREE.Vector3(1.65,0,.3),new THREE.Vector3(-.65,0,.3)];
  for(let i=1;i<route.length;i++) assert.ok(officeArea.canWalkBetween(route[i-1],route[i]));
  assert.ok(officeArea.canWalkBetween(officeSpawn,new THREE.Vector3(door.x,0,door.z)));
  assert.ok(Math.hypot(officeSpawn.x-door.x,officeSpawn.z-door.z)>door.radius+.4);
  for(const f of officeLayout.furniture) assert.equal(officeArea.isValidDestination(new THREE.Vector3(f.x,0,f.z)),false,f.id);
  for(const p of [[3,0],[0,3.2],[NaN,0],[0,-3.2]]) assert.equal(officeArea.isValidDestination(new THREE.Vector3(p[0],0,p[1])),false);
  assert.equal(officeArea.canWalkBetween(new THREE.Vector3(-2.15,0,-1.2),new THREE.Vector3(.85,0,-1.2)),false,'cannot cross the desk between clear endpoints');
});

test('desktop walking uses office clearance rather than street bounds',()=>{
  const keys=new DesktopMovement();keys.press('w');
  let position=new THREE.Vector3(-.65,1.62,.5);
  for(let i=0;i<100;i++) position=keys.update(position,0,.05,officeArea.canWalkBetween).position;
  assert.ok(position.z>=-.425 && position.z<-.3,'stop before the desk front');
  assert.equal(position.y,1.62);
  keys.clear();keys.press('d');
  for(let i=0;i<100;i++) position=keys.update(position,0,.05,officeArea.canWalkBetween).position;
  assert.ok(position.x<=2.65 && position.x>2.5,'stop at the room wall');
});

test('office ray proxies select the desk and block floor behind furniture and walls',()=>{
  const office=new SnowOffice();office.group.visible=true;
  const ray=new THREE.Raycaster(new THREE.Vector3(-.65,1.62,1),officeDeskTarget.clone().setY(.78).sub(new THREE.Vector3(-.65,1.62,1)).normalize());
  let hit=office.pick(ray);assert.equal(office.hotspotFor(hit.object),'john-snow');assert.equal(office.canTeleport(hit),false);
  ray.set(new THREE.Vector3(-.65,1.62,1),officeDeskTarget.clone().add(new THREE.Vector3(0,.35,0)).sub(new THREE.Vector3(-.65,1.62,1)).normalize());
  assert.equal(office.hotspotFor(office.pick(ray).object),'john-snow','floating label is selectable too');
  ray.set(new THREE.Vector3(1.65,1.62,1),new THREE.Vector3(0,-1,-.2).normalize());
  hit=office.pick(ray);assert.ok(office.canTeleport(hit));
  ray.set(new THREE.Vector3(1.65,1.62,1),new THREE.Vector3(1,-.2,0).normalize());
  hit=office.pick(ray);assert.equal(office.canTeleport(hit),false);
  office.group.visible=false;assert.equal(office.pick(ray),undefined);
});

test('actual office controller path selects desk, respects panels, teleports and exits once assigned',()=>{
  const game=new GameState(), office=new SnowOffice(), courtyard=new PumpCourtyard();office.group.visible=true;
  const camera=new THREE.PerspectiveCamera();camera.position.set(0,1.62,0);
  const rig=new THREE.Group();rig.add(camera);
  const controller=new THREE.Group();controller.position.set(-.65,1.62,1);
  controller.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),officeDeskTarget.clone().setY(.78).sub(controller.position).normalize());
  const targets=new WorldTravelTargets(()=>new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));targets.refresh(game);
  const scene=Object.create(BroadStreetScene.prototype);
  Object.assign(scene,{camera,playerRig:rig,courtyard,office,worldTravel:targets,gameState:game,
    renderer:{xr:{isPresenting:true}},desktopMovement:new DesktopMovement(),controllerRaycaster:new THREE.Raycaster(),
    controllerWorldPosition:new THREE.Vector3(),controllerWorldQuaternion:new THREE.Quaternion(),controllerWorldDirection:new THREE.Vector3(),
    cameraWorldPosition:new THREE.Vector3(),travelZones:new TravelZoneTracker(),vrPanelVisible:false,vrPanelButtons:[],
    hotspotVisuals:new Map(),worldTravelPending:false,hideVrPanel:()=>{},activateVrHotspot:(h)=>game.inspectHotspot(h.id)});
  assert.equal(scene.walkable,office);
  scene.selectFromVrController(controller);assert.ok(game.hasInspected('john-snow'));
  controller.position.set(1.65,1.62,1);controller.rotation.set(-Math.PI/4,0,0);
  scene.vrPanelVisible=true;scene.selectFromVrController(controller);assert.equal(rig.position.length(),0);
  scene.vrPanelVisible=false;scene.selectFromVrController(controller);assert.ok(rig.position.length()>0);
  const zone=returnTravelRoutes.find(r=>r.id==='snow-street').zone;
  teleportViewer(rig,camera,new THREE.Vector3(zone.x,0,zone.z));
  scene.updateWorldTravelZones();assert.equal(game.getCurrentLocation().id,'snow-desk','exit locked before assignment');
  game.askQuestion('snow-method-question');scene.updateWorldTravelZones();assert.equal(game.getCurrentLocation().id,'snow-desk','unlock while inside does not travel');
  teleportViewer(rig,camera,officeSpawn);scene.updateWorldTravelZones();
  teleportViewer(rig,camera,new THREE.Vector3(zone.x,0,zone.z));scene.updateWorldTravelZones();
  assert.equal(game.getCurrentLocation().id,'broad-street');
});

test('office/street/panorama lifecycle restores scene geometry, lighting and arrival',()=>{
  const game=fieldGame(true),scene=Object.create(BroadStreetScene.prototype);
  for (const [location,hotspot,questions] of [
    ['household','broad-street-household',['household-water-question','household-pattern-question']],
    ['workhouse','poland-workhouse',['workhouse-water-question']],
    ['brewery','broad-street-brewery',['brewery-drink-question']],
  ]) {
    game.travelToLocation(location);game.inspectHotspot(hotspot);for(const question of questions) game.askQuestion(question);
  }
  game.travelToLocation('snow-desk');game.selectHypothesis('waterborne');game.setSynthesisConfidence('proportionate');
  assert.ok(game.prepareBoardArgument().prepared);
  const rig=new THREE.Group(),camera=new THREE.PerspectiveCamera();camera.position.y=1.62;rig.add(camera);
  const courtyard=new PumpCourtyard(),office=new SnowOffice(),registrar=new RegistrarRoom(),household=new HouseholdRoom(),workhouse=new WorkhouseCourtyard(),brewery=new BreweryRoom();
  Object.assign(scene,{gameState:game,playerRig:rig,camera,courtyard,office,registrar,household,workhouse,brewery,desktopMovement:new DesktopMovement(),
    travelZones:new TravelZoneTracker(),scene:new THREE.Scene(),panoramaLighting:new THREE.Group(),panoramaSky:new THREE.Group(),
    renderer:{xr:{isPresenting:false}},primeMotionLookReference:()=>{},applyPanorama:()=>{},refreshLocationObjects:()=>{},
    refreshHotspots:()=>{},markVrPanelDirty:()=>{}});
  for(const id of ['snow-desk','broad-street','registrar','household','workhouse','brewery','board-room','brewery','workhouse','household','broad-street','snow-desk']) {
    if(id==='board-room') assert.ok(game.presentToBoard().accepted);
    else assert.ok(game.travelToLocation(id).traveled);
    scene.applyCurrentLocation();
    assert.equal(office.group.visible,id==='snow-desk');assert.equal(courtyard.group.visible,id==='broad-street');assert.equal(registrar.group.visible,id==='registrar');assert.equal(household.group.visible,id==='household');assert.equal(workhouse.group.visible,id==='workhouse');assert.equal(brewery.group.visible,id==='brewery');
    assert.equal(scene.panoramaSky.visible,id==='board-room');assert.equal(scene.panoramaLighting.visible,id==='board-room');
    const spawn=id==='snow-desk'?officeSpawn:id==='broad-street'?streetSpawn:id==='registrar'?registrarSpawn:id==='household'?householdSpawn:id==='workhouse'?workhouseSpawn:id==='brewery'?brewerySpawn:new THREE.Vector3();
    const viewer=camera.getWorldPosition(new THREE.Vector3());assert.ok(Math.hypot(viewer.x-spawn.x,viewer.z-spawn.z)<1e-10);
    assert.equal(scene.worldTravelPending,false);
    if(id==='board-room') game.finishBoard();
  }
});

test('authored office fits a small mesh budget and matches the runtime furniture layout',async()=>{
  const report=JSON.parse(await readFile('assets/snow-office/build-report.json','utf8'));
  assert.deepEqual(report.layout,officeLayout);assert.ok(report.triangles<30000);assert.ok(report.materialBatches<=16);
  const glb=await readFile('public/models/snow-office.glb');assert.equal(glb.readUInt32LE(0),0x46546c67);
  const json=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
  assert.ok(json.meshes.length>0);assert.ok(json.images.every(image=>image.bufferView!==undefined),'textures embedded');
  for(const mesh of json.meshes) for(const primitive of mesh.primitives) {
    assert.notEqual(primitive.attributes.TEXCOORD_1,undefined,'exported lighting UVs must survive GLB export');
    assert.equal(json.accessors[primitive.attributes.TEXCOORD_1].count,json.accessors[primitive.attributes.POSITION].count);
  }
  for(const [name,width,height] of [['lightmap',2048,2048],['environment',1024,512]]) {
    const png=await readFile(`public/models/snow-office-${name}.png`);
    assert.equal(png.subarray(1,4).toString(),'PNG');
    assert.equal(png.readUInt32BE(16),width);assert.equal(png.readUInt32BE(20),height);
  }

});

const registrarLayout=JSON.parse(await readFile('src/walkable/registrar-layout.json','utf8'));
test('registrar approach and return door are reachable while furniture blocks walking',()=>{
  const zone=returnTravelRoutes.find(r=>r.id==='registrar-return').zone;
  assert.ok(registrarArea.canWalkBetween(registrarSpawn,new THREE.Vector3(0,0,3.5)));
  assert.ok(registrarArea.canWalkBetween(registrarSpawn,new THREE.Vector3(zone.x,0,zone.z)));
  assert.ok(Math.hypot(registrarSpawn.x-zone.x,registrarSpawn.z-zone.z)>zone.radius+.5);
  for(const f of registrarLayout.furniture) assert.equal(registrarArea.isValidDestination(new THREE.Vector3(f.x,0,f.z)),false,f.id);
  assert.equal(registrarArea.canWalkBetween(new THREE.Vector3(-1.7,0,2.3),new THREE.Vector3(1.7,0,2.3)),false,'no cutting through table');
  assert.equal(registrarArea.canWalkBetween(new THREE.Vector3(-2.8,0,.65),new THREE.Vector3(2.8,0,.65)),false,'no cutting through counter');
  const keys=new DesktopMovement();keys.press('w');let p=new THREE.Vector3(0,1.62,3.7);
  for(let i=0;i<80;i++) p=keys.update(p,0,.05,registrarArea.canWalkBetween).position;
  assert.ok(p.z>=3.15 && p.z<3.3,'stop at ledger table');
});

test('registrar ledger, label, floor and return door have unobstructed intended ray targets',()=>{
  const room=new RegistrarRoom();room.group.visible=true;const game=fieldGame();game.travelToLocation('registrar');
  const targets=new WorldTravelTargets(()=>new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));targets.refresh(game);
  const from=registrarSpawn.clone().setY(1.62);const ray=new THREE.Raycaster();
  for(const y of [.82,1.35]) {
    ray.set(from,new THREE.Vector3(0,y,2.3).sub(from).normalize());
    const hit=room.pick(ray);assert.equal(room.hotspotFor(hit.object),'registrar-ledger');assert.equal(room.canTeleport(hit),false);
  }
  ray.set(new THREE.Vector3(2.1,1.3,5.2),new THREE.Vector3(0,0,1));
  const hit=targets.pick(ray,'registrar',room.pick(ray));assert.equal(targets.routeFor(hit.object).to,'snow-desk');
  ray.set(from,new THREE.Vector3(0,-1,0));assert.ok(room.canTeleport(room.pick(ray)));
  ray.set(from,new THREE.Vector3(1,0,0));assert.equal(room.canTeleport(room.pick(ray)),false,'window/wall cannot be crossed');
});

test('actual registrar controller and doorway preserve the ledger-to-Snow inquiry sequence',()=>{
  const game=fieldGame();game.travelToLocation('registrar');
  const room=new RegistrarRoom();room.group.visible=true;
  const camera=new THREE.PerspectiveCamera();camera.position.set(0,1.62,0);
  const rig=new THREE.Group();rig.add(camera);teleportViewer(rig,camera,registrarSpawn);
  const controller=new THREE.Group();controller.position.copy(registrarSpawn).setY(1.62);
  controller.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),registrarLedgerTarget.clone().setY(.82).sub(controller.position).normalize());
  const targets=new WorldTravelTargets(()=>new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));targets.refresh(game);
  const scene=Object.create(BroadStreetScene.prototype);
  Object.assign(scene,{camera,playerRig:rig,courtyard:new PumpCourtyard(),office:new SnowOffice(),registrar:room,worldTravel:targets,gameState:game,
    renderer:{xr:{isPresenting:true}},desktopMovement:new DesktopMovement(),controllerRaycaster:new THREE.Raycaster(),
    controllerWorldPosition:new THREE.Vector3(),controllerWorldQuaternion:new THREE.Quaternion(),controllerWorldDirection:new THREE.Vector3(),
    cameraWorldPosition:new THREE.Vector3(),travelZones:new TravelZoneTracker(),vrPanelVisible:false,vrPanelButtons:[],
    hotspotVisuals:new Map(),worldTravelPending:false,hideVrPanel:()=>{},activateVrHotspot:h=>game.inspectHotspot(h.id)});
  scene.selectFromVrController(controller);assert.ok(game.hasInspected('registrar-ledger'));
  game.askQuestion('ledger-timeline-question');assert.ok(game.hasEvidence('attack-timeline'));
  const zone=returnTravelRoutes.find(r=>r.id==='registrar-return').zone;
  scene.vrPanelVisible=true;teleportViewer(rig,camera,new THREE.Vector3(zone.x,0,zone.z));scene.updateWorldTravelZones();
  assert.equal(game.getCurrentLocation().id,'registrar');scene.vrPanelVisible=false;scene.updateWorldTravelZones();
  assert.equal(game.getCurrentLocation().id,'registrar','closing dialogue cannot trigger surprise return');
  teleportViewer(rig,camera,registrarSpawn);scene.updateWorldTravelZones();
  teleportViewer(rig,camera,new THREE.Vector3(zone.x,0,zone.z));scene.updateWorldTravelZones();
  assert.equal(game.getCurrentLocation().id,'snow-desk');assert.ok(game.hasEvidence('attack-timeline'));
  game.inspectHotspot('john-snow');game.askQuestion('pump-cluster-question');assert.ok(game.hasEvidence('pump-cluster'));
});

test('registrar asset uses the runtime layout, embedded textures and a modest geometry budget',async()=>{
  const report=JSON.parse(await readFile('assets/registrar-room/build-report.json','utf8'));
  assert.deepEqual(report.layout,registrarLayout);assert.ok(report.triangles<30000);assert.ok(report.materialBatches<=16);
  const glb=await readFile('public/models/registrar-room.glb');assert.equal(glb.readUInt32LE(0),0x46546c67);
  const json=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
  assert.ok(json.meshes.length>0);assert.ok(json.images.every(image=>image.bufferView!==undefined));
});

const householdLayout=JSON.parse(await readFile('src/walkable/household-layout.json','utf8'));
test('household aisle, interview approach and exit remain clear around domestic furniture',()=>{
  const zone=returnTravelRoutes.find(r=>r.id==='household-return').zone;
  assert.ok(householdArea.canWalkBetween(householdSpawn,new THREE.Vector3(.25,0,.2)));
  assert.ok(householdArea.canWalkBetween(householdSpawn,new THREE.Vector3(zone.x,0,zone.z)));
  assert.ok(Math.hypot(householdSpawn.x-zone.x,householdSpawn.z-zone.z)>zone.radius+.4);
  for(const f of householdLayout.furniture) assert.equal(householdArea.isValidDestination(new THREE.Vector3(f.x,0,f.z)),false,f.id);
  assert.equal(householdArea.canWalkBetween(new THREE.Vector3(-.75,0,-1.4),new THREE.Vector3(-2.35,0,-1.4)),false,'bed blocks passage');
  const keys=new DesktopMovement();keys.press('w');let p=new THREE.Vector3(.25,1.62,.5);
  for(let i=0;i<80;i++) p=keys.update(p,0,.05,householdArea.canWalkBetween).position;
  assert.ok(p.z>=.025 && p.z<.15,'stop before the interview chair');
});

test('household seated and standing rays reach chair, label, clear floor and return door',()=>{
  const room=new HouseholdRoom();room.group.visible=true;const game=fieldGame(true);game.travelToLocation('household');
  const targets=new WorldTravelTargets(()=>new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));targets.refresh(game);
  const ray=new THREE.Raycaster();
  for(const eyeHeight of [1.15,1.62]) {
    const from=householdSpawn.clone().setY(eyeHeight);
    for(const y of [.8,1.5]) {
      ray.set(from,householdInterviewTarget.clone().setY(y).sub(from).normalize());
      const hit=room.pick(ray);assert.equal(room.hotspotFor(hit.object),'broad-street-household');assert.equal(room.canTeleport(hit),false);
    }
    ray.set(from,new THREE.Vector3(0,-1,0));assert.ok(room.canTeleport(room.pick(ray)));
  }
  ray.set(new THREE.Vector3(1.25,1.3,1.6),new THREE.Vector3(0,0,1));
  const hit=targets.pick(ray,'household',room.pick(ray));assert.equal(targets.routeFor(hit.object).to,'broad-street');
  ray.set(householdSpawn.clone().setY(1.62),new THREE.Vector3(1,0,0));assert.equal(room.canTeleport(room.pick(ray)),false);
});

test('household controller interview retains both evidence cards and returns through the marked exit',()=>{
  const game=fieldGame(true);game.travelToLocation('household');
  const room=new HouseholdRoom();room.group.visible=true;
  const camera=new THREE.PerspectiveCamera();camera.position.set(0,1.62,0);
  const rig=new THREE.Group();rig.add(camera);teleportViewer(rig,camera,householdSpawn);
  const controller=new THREE.Group();controller.position.copy(householdSpawn).setY(1.62);
  controller.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),householdInterviewTarget.clone().setY(.8).sub(controller.position).normalize());
  const targets=new WorldTravelTargets(()=>new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));targets.refresh(game);
  const scene=Object.create(BroadStreetScene.prototype);
  Object.assign(scene,{camera,playerRig:rig,courtyard:new PumpCourtyard(),office:new SnowOffice(),registrar:new RegistrarRoom(),household:room,worldTravel:targets,gameState:game,
    renderer:{xr:{isPresenting:true}},desktopMovement:new DesktopMovement(),controllerRaycaster:new THREE.Raycaster(),
    controllerWorldPosition:new THREE.Vector3(),controllerWorldQuaternion:new THREE.Quaternion(),controllerWorldDirection:new THREE.Vector3(),
    cameraWorldPosition:new THREE.Vector3(),travelZones:new TravelZoneTracker(),vrPanelVisible:false,vrPanelButtons:[],
    hotspotVisuals:new Map(),worldTravelPending:false,hideVrPanel:()=>{},activateVrHotspot:h=>game.inspectHotspot(h.id)});
  scene.selectFromVrController(controller);assert.ok(game.hasInspected('broad-street-household'));
  game.askQuestion('household-water-question');assert.ok(game.hasEvidence('household-exposure'));
  game.askQuestion('household-pattern-question');assert.ok(game.hasEvidence('household-water-pattern'));
  const zone=returnTravelRoutes.find(r=>r.id==='household-return').zone;
  scene.vrPanelVisible=true;teleportViewer(rig,camera,new THREE.Vector3(zone.x,0,zone.z));scene.updateWorldTravelZones();
  scene.vrPanelVisible=false;scene.updateWorldTravelZones();assert.equal(game.getCurrentLocation().id,'household','closing interview does not trigger travel');
  teleportViewer(rig,camera,householdSpawn);scene.updateWorldTravelZones();
  teleportViewer(rig,camera,new THREE.Vector3(zone.x,0,zone.z));scene.updateWorldTravelZones();
  assert.equal(game.getCurrentLocation().id,'broad-street');assert.ok(game.hasEvidence('household-exposure'));assert.ok(game.hasEvidence('household-water-pattern'));
  assert.ok(game.travelToLocation('household').traveled,'map return remains available');
});

test('household asset shares navigation layout and stays within the room geometry budget',async()=>{
  const report=JSON.parse(await readFile('assets/household-room/build-report.json','utf8'));
  assert.deepEqual(report.layout,householdLayout);assert.ok(report.triangles<30000);assert.ok(report.materialBatches<=16);
  const glb=await readFile('public/models/household-room.glb');assert.equal(glb.readUInt32LE(0),0x46546c67);
  const json=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
  assert.ok(json.meshes.length>0);assert.ok(json.images.every(image=>image.bufferView!==undefined));
});

test('workhouse controller interview retains the separate-supply evidence and returns through the marked exit',()=>{
  const game=fieldGame(true);game.travelToLocation('workhouse');
  const room=new WorkhouseCourtyard();room.group.visible=true;
  const camera=new THREE.PerspectiveCamera();camera.position.set(0,1.62,0);
  const rig=new THREE.Group();rig.add(camera);teleportViewer(rig,camera,workhouseSpawn);
  const controller=new THREE.Group();controller.position.copy(workhouseSpawn).setY(1.62);
  controller.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),workhouseStewardTarget.clone().setY(.8).sub(controller.position).normalize());
  const targets=new WorldTravelTargets(()=>new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));targets.refresh(game);
  const scene=Object.create(BroadStreetScene.prototype);
  Object.assign(scene,{camera,playerRig:rig,courtyard:new PumpCourtyard(),office:new SnowOffice(),registrar:new RegistrarRoom(),household:new HouseholdRoom(),workhouse:room,worldTravel:targets,gameState:game,
    renderer:{xr:{isPresenting:true}},desktopMovement:new DesktopMovement(),controllerRaycaster:new THREE.Raycaster(),
    controllerWorldPosition:new THREE.Vector3(),controllerWorldQuaternion:new THREE.Quaternion(),controllerWorldDirection:new THREE.Vector3(),
    cameraWorldPosition:new THREE.Vector3(),travelZones:new TravelZoneTracker(),vrPanelVisible:false,vrPanelButtons:[],
    hotspotVisuals:new Map(),worldTravelPending:false,hideVrPanel:()=>{},activateVrHotspot:h=>game.inspectHotspot(h.id)});
  scene.selectFromVrController(controller);assert.ok(game.hasInspected('poland-workhouse'));
  game.askQuestion('workhouse-water-question');assert.ok(game.hasEvidence('workhouse-exception'));
  const zone=returnTravelRoutes.find(r=>r.id==='workhouse-return').zone;
  scene.vrPanelVisible=true;teleportViewer(rig,camera,new THREE.Vector3(zone.x,0,zone.z));scene.updateWorldTravelZones();
  scene.vrPanelVisible=false;scene.updateWorldTravelZones();assert.equal(game.getCurrentLocation().id,'workhouse','closing interview does not trigger travel');
  teleportViewer(rig,camera,workhouseSpawn);scene.updateWorldTravelZones();
  teleportViewer(rig,camera,new THREE.Vector3(zone.x,0,zone.z));scene.updateWorldTravelZones();
  assert.equal(game.getCurrentLocation().id,'broad-street');assert.ok(game.hasEvidence('workhouse-exception'));
  assert.ok(game.travelToLocation('workhouse').traveled,'map return remains available');
});

const workhouseLayout=JSON.parse(await readFile('src/walkable/workhouse-layout.json','utf8'));
test('workhouse yard has clear approaches around the well, steward table and exit',()=>{
  const zone=returnTravelRoutes.find(r=>r.id==='workhouse-return').zone;
  assert.ok(workhouseArea.canWalkBetween(workhouseSpawn,new THREE.Vector3(-2.2,0,.1)));
  assert.ok(workhouseArea.canWalkBetween(workhouseSpawn,new THREE.Vector3(zone.x,0,zone.z)));
  const loop=[[1.8,5.9],[5.2,1],[5.2,-4],[.9,-4],[.9,1],[1.8,5.9]].map(([x,z])=>new THREE.Vector3(x,0,z));
  for(let i=1;i<loop.length;i++) assert.ok(workhouseArea.canWalkBetween(loop[i-1],loop[i]),'clear path around separate water supply');
  assert.ok(Math.hypot(workhouseSpawn.x-zone.x,workhouseSpawn.z-zone.z)>zone.radius+1);
  for(const f of workhouseLayout.furniture) assert.equal(workhouseArea.isValidDestination(new THREE.Vector3(f.x,0,f.z)),false,f.id);
  assert.equal(workhouseArea.canWalkBetween(new THREE.Vector3(.9,0,-1.8),new THREE.Vector3(5.2,0,-1.8)),false,'cannot cut through the well');
  assert.equal(workhouseArea.isValidDestination(new THREE.Vector3(9,0,0)),false,'wing wall bounds');
  const keys=new DesktopMovement();keys.press('w');let p=new THREE.Vector3(-2.2,1.62,1);
  for(let i=0;i<100;i++) p=keys.update(p,0,.05,workhouseArea.canWalkBetween).position;
  assert.ok(p.z>=-.4 && p.z<-.25,'stop before steward table');
});

test('workhouse seated and standing rays select steward, exit and ground but cannot cross the well',()=>{
  const room=new WorkhouseCourtyard();room.group.visible=true;const game=fieldGame(true);game.travelToLocation('workhouse');
  const targets=new WorldTravelTargets(()=>new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));targets.refresh(game);
  const ray=new THREE.Raycaster();
  for(const eyeHeight of [1.15,1.62]) {
    const from=workhouseSpawn.clone().setY(eyeHeight);
    for(const y of [.8,1.45]) {
      ray.set(from,workhouseStewardTarget.clone().setY(y).sub(from).normalize());
      const hit=room.pick(ray);assert.equal(room.hotspotFor(hit.object),'poland-workhouse');assert.equal(room.canTeleport(hit),false);
    }
    ray.set(from,new THREE.Vector3(0,-1,0));assert.ok(room.canTeleport(room.pick(ray)));
  }
  ray.set(new THREE.Vector3(0,1.3,7.8),new THREE.Vector3(0,0,1));
  const hit=targets.pick(ray,'workhouse',room.pick(ray));assert.equal(targets.routeFor(hit.object).to,'broad-street');
  ray.set(new THREE.Vector3(3,1.62,1),new THREE.Vector3(0,-.15,-1).normalize());
  const well=room.pick(ray);assert.equal(room.canTeleport(well),false);assert.equal(room.hotspotFor(well.object),undefined,'well is scenery, not a second evidence source');
  room.group.visible=false;assert.equal(room.pick(ray),undefined);
});

test('workhouse authored courtyard matches navigation layout and embeds modest asset geometry',async()=>{
  const report=JSON.parse(await readFile('assets/workhouse-courtyard/build-report.json','utf8'));
  assert.deepEqual(report.layout,workhouseLayout);assert.ok(report.triangles<30000);assert.ok(report.materialBatches<=16);
  const glb=await readFile('public/models/workhouse-courtyard.glb');assert.equal(glb.readUInt32LE(0),0x46546c67);
  const json=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
  assert.ok(json.meshes.length>0);assert.ok(json.images.every(image=>image.bufferView!==undefined));
});

test('brewery controller interview retains the workers evidence and returns through the marked exit',()=>{
  const game=fieldGame(true);game.travelToLocation('brewery');
  const room=new BreweryRoom();room.group.visible=true;
  const camera=new THREE.PerspectiveCamera();camera.position.set(0,1.62,0);
  const rig=new THREE.Group();rig.add(camera);teleportViewer(rig,camera,brewerySpawn);
  const controller=new THREE.Group();controller.position.copy(brewerySpawn).setY(1.62);
  controller.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),breweryOwnersTarget.clone().setY(.8).sub(controller.position).normalize());
  const targets=new WorldTravelTargets(()=>new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));targets.refresh(game);
  const scene=Object.create(BroadStreetScene.prototype);
  Object.assign(scene,{camera,playerRig:rig,courtyard:new PumpCourtyard(),office:new SnowOffice(),registrar:new RegistrarRoom(),household:new HouseholdRoom(),workhouse:new WorkhouseCourtyard(),brewery:room,worldTravel:targets,gameState:game,
    renderer:{xr:{isPresenting:true}},desktopMovement:new DesktopMovement(),controllerRaycaster:new THREE.Raycaster(),
    controllerWorldPosition:new THREE.Vector3(),controllerWorldQuaternion:new THREE.Quaternion(),controllerWorldDirection:new THREE.Vector3(),
    cameraWorldPosition:new THREE.Vector3(),travelZones:new TravelZoneTracker(),vrPanelVisible:false,vrPanelButtons:[],
    hotspotVisuals:new Map(),worldTravelPending:false,hideVrPanel:()=>{},activateVrHotspot:h=>game.inspectHotspot(h.id)});
  scene.selectFromVrController(controller);assert.ok(game.hasInspected('broad-street-brewery'));
  game.askQuestion('brewery-drink-question');assert.ok(game.hasEvidence('brewery-exception'));
  const zone=returnTravelRoutes.find(r=>r.id==='brewery-return').zone;
  scene.vrPanelVisible=true;teleportViewer(rig,camera,new THREE.Vector3(zone.x,0,zone.z));scene.updateWorldTravelZones();
  scene.vrPanelVisible=false;scene.updateWorldTravelZones();assert.equal(game.getCurrentLocation().id,'brewery','closing interview does not trigger travel');
  teleportViewer(rig,camera,brewerySpawn);scene.updateWorldTravelZones();
  teleportViewer(rig,camera,new THREE.Vector3(zone.x,0,zone.z));scene.updateWorldTravelZones();
  assert.equal(game.getCurrentLocation().id,'broad-street');assert.ok(game.hasEvidence('brewery-exception'));
  assert.ok(game.travelToLocation('brewery').traveled,'map return remains available');
});

const breweryLayout=JSON.parse(await readFile('src/walkable/brewery-layout.json','utf8'));
test('brewery has an accessible interview, exit and central aisle while vessels block walking',()=>{
  const zone=returnTravelRoutes.find(r=>r.id==='brewery-return').zone;
  assert.ok(breweryArea.canWalkBetween(brewerySpawn,new THREE.Vector3(0,0,2.1)));
  assert.ok(breweryArea.canWalkBetween(brewerySpawn,new THREE.Vector3(zone.x,0,zone.z)));
  const aisle=[[1.1,4.25],[2.1,2.2],[2.1,-.4],[0,-.8],[0,-4.8]].map(([x,z])=>new THREE.Vector3(x,0,z));
  for(let i=1;i<aisle.length;i++) assert.ok(breweryArea.canWalkBetween(aisle[i-1],aisle[i]),'route around table and between copper vessels');
  assert.ok(Math.hypot(brewerySpawn.x-zone.x,brewerySpawn.z-zone.z)>zone.radius+.5);
  for(const f of breweryLayout.furniture) assert.equal(breweryArea.isValidDestination(new THREE.Vector3(f.x,0,f.z)),false,f.id);
  assert.equal(breweryArea.canWalkBetween(new THREE.Vector3(2.35,0,-.7),new THREE.Vector3(2.35,0,-4.5)),false,'no crossing the copper between valid endpoints');
  const keys=new DesktopMovement();keys.press('w');let p=new THREE.Vector3(0,1.62,2.2);
  for(let i=0;i<100;i++) p=keys.update(p,0,.05,breweryArea.canWalkBetween).position;
  assert.ok(p.z>=1.825 && p.z<1.95,'stop before owners table');
});

test('brewery seated and standing rays select owners, floor and door but not equipment as evidence',()=>{
  const room=new BreweryRoom();room.group.visible=true;const game=fieldGame(true);game.travelToLocation('brewery');
  const targets=new WorldTravelTargets(()=>new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));targets.refresh(game);
  const ray=new THREE.Raycaster();
  for(const eyeHeight of [1.15,1.62]) {
    const from=brewerySpawn.clone().setY(eyeHeight);
    for(const y of [.8,1.45]) {
      ray.set(from,breweryOwnersTarget.clone().setY(y).sub(from).normalize());
      const hit=room.pick(ray);assert.equal(room.hotspotFor(hit.object),'broad-street-brewery');assert.equal(room.canTeleport(hit),false);
    }
    ray.set(from,new THREE.Vector3(0,-1,0));assert.ok(room.canTeleport(room.pick(ray)));
  }
  ray.set(new THREE.Vector3(1.8,1.3,4.25),new THREE.Vector3(0,0,1));
  const hit=targets.pick(ray,'brewery',room.pick(ray));assert.equal(targets.routeFor(hit.object).to,'broad-street');
  ray.set(new THREE.Vector3(2.35,1.62,-.6),new THREE.Vector3(0,-.2,-1).normalize());
  const copper=room.pick(ray);assert.equal(room.canTeleport(copper),false);assert.equal(room.hotspotFor(copper.object),undefined);
  room.group.visible=false;assert.equal(room.pick(ray),undefined);
});

test('brewery model matches its collision layout and stays within the authored room budget',async()=>{
  const report=JSON.parse(await readFile('assets/brewery-room/build-report.json','utf8'));
  assert.deepEqual(report.layout,breweryLayout);assert.ok(report.triangles<30000);assert.ok(report.materialBatches<=16);
  const glb=await readFile('public/models/brewery-room.glb');assert.equal(glb.readUInt32LE(0),0x46546c67);
  const json=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
  assert.ok(json.meshes.length>0);assert.ok(json.images.every(image=>image.bufferView!==undefined));
});

test("VR modal panels overlay scenery and keep controller actions modal", () => {
  // Exercise the real panel factory; no browser/GPU is needed to paint an empty
  // background. The browser regression fixture verifies the rendered result.
  const originalDocument = globalThis.document;
  const context = { createLinearGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) };
  const scene = Object.create(BroadStreetScene.prototype);
  const camera = new THREE.PerspectiveCamera();
  const controller = new THREE.Group();
  Object.assign(scene, {
    camera, vrPanel: new THREE.Group(), vrPanelButtons: [], vrPanelDrawCommands: [], vrPanelVisible: true,
    controllerRaycaster: new THREE.Raycaster(), controllerWorldPosition: new THREE.Vector3(),
    controllerWorldQuaternion: new THREE.Quaternion(), controllerWorldDirection: new THREE.Vector3(),
  });
  try {
    scene.addVrPanelSurface();
    const surface = scene.vrPanelSurface;
    assert.equal(surface.material.transparent, true, 'Panel must render after transparent scenery, too');
    assert.equal(surface.material.opacity, 1, 'Scenery must not show through the panel');
    assert.equal(surface.material.depthTest, false, 'Nearer desks and walls must not hide UI');
    assert.equal(surface.material.depthWrite, false);
    assert.ok(surface.renderOrder > 95, 'Panel must cover world labels and idle sprites');
    scene.addVrPanelHitbox(0, 0, .4, .4, { type: 'close-panel' });
    scene.vrPanel.position.z = -2;
    scene.vrPanel.updateMatrixWorld(true);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(4, 4, .2), new THREE.MeshBasicMaterial());
    wall.position.z = -1;
    wall.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, 0, -1));
    assert.ok(ray.intersectObject(wall)[0].distance < ray.intersectObject(surface)[0].distance);
    let actions = 0;
    scene.handleVrButton = action => { assert.equal(action.type, 'close-panel'); actions++; };
    assert.equal(scene.pickVrPointerHit(controller).object, scene.vrPanelButtons[0]);
    scene.selectFromVrController(controller);
    assert.equal(actions, 1, 'Button still activates through foreground furniture');
    controller.position.x = .8;
    assert.equal(scene.pickVrPointerHit(controller).object, surface);
    scene.selectFromVrController(controller);
    controller.position.x = 3;
    scene.selectFromVrController(controller);
    assert.equal(actions, 1, 'Panel background and outside-panel rays cannot activate scenery');
    scene.clearVrPanel();
    wall.geometry.dispose(); wall.material.dispose();
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

test('exported workhouse has one ground surface and soil behind the stone edging', async () => {
  const bytes = await readFile('public/models/workhouse-courtyard.glb');
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength));
  // Keep the actual exported geometry/transforms, but omit image loading in Node.
  gltf.materials = gltf.materials.map(m => ({ name: m.name }));
  delete gltf.images; delete gltf.textures; delete gltf.samplers;
  const json = Buffer.from(JSON.stringify(gltf));
  const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20); json.copy(padded);
  const bin = bytes.subarray(20 + jsonLength);
  const header = Buffer.alloc(20);
  header.write('glTF'); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + padded.length + bin.length, 8);
  header.writeUInt32LE(padded.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const buffer = Buffer.concat([header, padded, bin]);
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const model = (await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '')).scene;
  model.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(); ray.far = .2;
  // Non-diagonal samples avoid double hits along the triangles' shared edge.
  for (const [x,z] of [[8.71,-5.13],[8.21,9.23],[-8.31,-9.17],[.37,.19]]) {
    ray.set(new THREE.Vector3(x,.1,z), new THREE.Vector3(0,-1,0));
    assert.equal(ray.intersectObject(model,true).length, 1, `Single ground layer at ${x}, ${z}`);
  }
  const soil = model.getObjectByName('Soil'); assert.ok(soil);
  const soilBounds = new THREE.Box3().setFromObject(soil);
  const layout = JSON.parse(await readFile('src/walkable/workhouse-layout.json','utf8'));
  const bed = layout.furniture.find(f => f.id === 'garden-bed');
  assert.ok(soilBounds.min.x > bed.x-bed.width/2+.04 && soilBounds.max.x < bed.x+bed.width/2-.04);
  assert.ok(soilBounds.min.z > bed.z-bed.depth/2+.04 && soilBounds.max.z < bed.z+bed.depth/2-.04);
  model.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
});


test("keyboard pitch is bounded, movement stays horizontal and look works without a walkable floor", () => {
  const keys = new DesktopMovement();
  const start = new THREE.Vector3(0,1.62,0);
  keys.press('ArrowUp'); keys.press('KeyW');
  let state = {position:start, yaw:0, pitch:0};
  for(let frame=0;frame<200;frame++) state=keys.update(state.position,state.yaw,.05,()=>false,state.pitch);
  assert.equal(state.pitch,1.15);
  assert.deepEqual(state.position,start);
  const walk=keys.update(start,0,.05,()=>true,state.pitch);
  assert.equal(walk.position.y,1.62);
  assert.ok(Math.abs(walk.position.z+.1)<1e-10);
  keys.clear(); keys.press('ArrowDown');
  for(let frame=0;frame<200;frame++) state=keys.update(state.position,state.yaw,.05,()=>false,state.pitch);
  assert.equal(state.pitch,-1.15);
  keys.clear(); keys.press('ArrowDown',true);
  assert.equal(keys.update(start,0,.05,()=>false,state.pitch).pitch,state.pitch,'held look cannot resume after a panel closes');
});

test("brief arrow taps are applied once and discarded when focus changes", () => {
  const keys = new DesktopMovement();
  const start = new THREE.Vector3(0,1.62,0);
  keys.press('ArrowDown'); keys.release('ArrowDown');
  const look = keys.update(start,0,1/60,()=>false);
  assert.ok(look.pitch < 0);
  assert.equal(keys.update(start,0,1/60,()=>false,look.pitch).pitch,look.pitch);
  keys.press('ArrowUp'); keys.release('ArrowUp'); keys.clear();
  assert.equal(keys.update(start,0,1/60,()=>false,look.pitch).pitch,look.pitch);
});


test('office and character lighting load once and replace fallback lights after textures load',async(t)=>{
  const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
  const root=new THREE.Group(),geometry=new THREE.BoxGeometry();
  geometry.setAttribute('uv1',geometry.getAttribute('uv').clone());
  const material=new THREE.MeshStandardMaterial({vertexColors:true});
  root.add(new THREE.Mesh(geometry,material));
  t.mock.method(GLTFLoader.prototype,'loadAsync',async(url)=>({scene:url.includes('snow-character')?new THREE.Group():root}));
  let count=0;
  t.mock.method(THREE.TextureLoader.prototype,'loadAsync',async()=>{count++;return new THREE.Texture();});
  const room=new SnowOffice();
  await Promise.all([room.loadVisuals('/'),room.loadVisuals('/')]);
  assert.equal(count,4);assert.equal(room.group.userData.lightingStatus,'baked');
  assert.equal(room.character.group.userData.characterStatus,'ready');
  assert.equal(room.group.userData.environmentStatus,'ready');
  assert.equal(material.lightMap.channel,1);assert.equal(material.vertexColors,false);
  const lights=room.group.children.find(o=>o.children.some(c=>c.isLight));
  assert.equal(lights.visible,false,'no duplicate direct lighting over the bake');
});

test('failed lighting texture keeps the furnished office and original lights usable',async(t)=>{
  const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
  const root=new THREE.Group(),material=new THREE.MeshStandardMaterial({vertexColors:true});
  root.add(new THREE.Mesh(new THREE.BoxGeometry(),material));
  t.mock.method(GLTFLoader.prototype,'loadAsync',async(url)=>({scene:url.includes('snow-character')?new THREE.Group():root}));
  const texture=new THREE.Texture();let disposed=false;texture.addEventListener('dispose',()=>{disposed=true;});
  t.mock.method(THREE.TextureLoader.prototype,'loadAsync',async(url)=>{
    if(url.includes('environment')) throw new Error('simulated missing texture');return texture;
  });
  t.mock.method(console,'warn',()=>{});
  const room=new SnowOffice();await room.loadVisuals('/');
  assert.equal(room.group.userData.lightingStatus,'fallback');
  assert.equal(room.group.userData.environmentStatus,'ready');assert.ok(room.group.children.includes(root));
  assert.equal(material.vertexColors,true);assert.equal(material.lightMap,null);assert.equal(disposed,true);
  const lights=room.group.children.find(o=>o.children.some(c=>c.isLight));assert.equal(lights.visible,true);
});

test('invalid baked UVs cannot partially replace original room materials',async()=>{
  const {applyBakedRoomLighting}=await load('walkable/BakedRoomLighting');
  const root=new THREE.Group(),geometry=new THREE.BoxGeometry();
  geometry.setAttribute('uv1',geometry.getAttribute('uv').clone());
  const material=new THREE.MeshStandardMaterial({vertexColors:true});
  root.add(new THREE.Mesh(geometry,material),new THREE.Mesh(new THREE.BoxGeometry(),material.clone()));
  assert.throws(()=>applyBakedRoomLighting(root,new THREE.Texture(),new THREE.Texture()),/UVs/);
  assert.equal(material.lightMap,null);assert.equal(material.vertexColors,true);
});

for (const [asset, size] of [['registrar-room',2048],['household-room',1024],['brewery-room',2048],['workhouse-courtyard',2048],['broad-street',2048]]) {
  test(`${asset} exports a complete lightmap UV set and bounded lighting textures`, async () => {
    const bytes=await readFile(`public/models/${asset}.glb`);
    const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
    for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
      assert.notEqual(primitive.attributes.TEXCOORD_0,undefined,'base texture UVs preserved');
      assert.notEqual(primitive.attributes.TEXCOORD_1,undefined,`${mesh.name} needs atlas coordinates`);
      const uv=gltf.accessors[primitive.attributes.TEXCOORD_1];
      assert.equal(uv.count,gltf.accessors[primitive.attributes.POSITION].count);
      // UV accessor bounds are optional in glTF; inspect the actual binary values.
      assert.equal(uv.componentType,5126);assert.equal(uv.type,'VEC2');
      const view=gltf.bufferViews[uv.bufferView];
      const binStart=28+bytes.readUInt32LE(12);
      const start=binStart+(view.byteOffset??0)+(uv.byteOffset??0);
      for(let i=0;i<uv.count;i++) for(let axis=0;axis<2;axis++) {
        const value=bytes.readFloatLE(start+i*(view.byteStride??8)+axis*4);
        assert.ok(Number.isFinite(value)&&value>=0&&value<=1,`${mesh.name} atlas UV out of bounds`);
      }
    }
    for(const [kind,width,height] of [['lightmap',size,size],['environment',512,256]]) {
      const png=await readFile(`public/models/${asset}-${kind}.png`);
      assert.equal(png.subarray(1,4).toString(),'PNG');
      assert.equal(png.readUInt32BE(16),width);assert.equal(png.readUInt32BE(20),height);
    }
    const report=JSON.parse(await readFile(`assets/${asset}/build-report.json`,'utf8'));
    assert.equal(report.bakedLighting.size,size);assert.equal(report.bakedLighting.normalization,4);
  });
}

test('remaining furnished scenes use separate baked environments and load their lighting once', async(t)=>{
  const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
  const roots=[];const loaded=[];
  t.mock.method(GLTFLoader.prototype,'loadAsync',async()=>{
    const root=new THREE.Group(),geometry=new THREE.BoxGeometry();
    geometry.setAttribute('uv1',geometry.getAttribute('uv').clone());
    root.add(new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true})));
    roots.push(root);return {scene:root};
  });
  t.mock.method(THREE.TextureLoader.prototype,'loadAsync',async(url)=>{loaded.push(url);return new THREE.Texture();});
  const rooms=[new RegistrarRoom(),new HouseholdRoom(),new BreweryRoom(),new WorkhouseCourtyard()];
  for(const room of rooms) {
    await Promise.all([room.loadVisuals('/'),room.loadVisuals('/')]);
    assert.equal(room.group.userData.lightingStatus,'baked');
    assert.equal(room.group.userData.environmentStatus,'ready');
    assert.equal(room.group.children.find(o=>o.children.some(c=>c.isLight)).visible,false);
  }
  assert.equal(loaded.filter(url=>url.includes('-lightmap')).length,4);
  assert.equal(loaded.filter(url=>url.includes('-environment')).length,4);
  assert.equal(new Set(roots.map(root=>root.children[0].material.envMap)).size,4);
});

test('street keeps weathering and pump selection while adopting its baked environment',async(t)=>{
  const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
  const root=new THREE.Group(),geometry=new THREE.BoxGeometry();
  geometry.setAttribute('uv1',geometry.getAttribute('uv').clone());
  const material=new THREE.MeshStandardMaterial({vertexColors:true});root.add(new THREE.Mesh(geometry,material));
  t.mock.method(GLTFLoader.prototype,'loadAsync',async(url)=>({scene:url.includes('snow-character')?new THREE.Group():root}));
  let loads=0;t.mock.method(THREE.TextureLoader.prototype,'loadAsync',async()=>{loads++;return new THREE.Texture();});
  const street=new PumpCourtyard();
  await Promise.all([street.loadVisuals('/'),street.loadVisuals('/')]);
  assert.equal(loads,3,'two lighting textures and sky, once each');
  assert.equal(street.group.userData.lightingStatus,'baked');assert.equal(material.vertexColors,true);
  assert.equal(material.lightMap.channel,1);
  const pumpMesh=street.pump.children.find(o=>o.material?.isMeshStandardMaterial);
  assert.equal(pumpMesh.material.envMap,material.envMap);assert.equal(pumpMesh.material.lightMap,null);
  street.group.visible=true;street.group.updateMatrixWorld(true);
  const origin=pumpPosition.clone().add(new THREE.Vector3(0,1.4,-2));
  const hit=street.pick(new THREE.Raycaster(origin,new THREE.Vector3(0,0,1)));
  assert.ok(street.isPump(hit.object),'procedural pump remains the interactive target');
  assert.equal(street.group.children.find(o=>o.children.some(c=>c.isLight)).visible,false);
});

test('street lighting failure retains its art, original lights and selectable pump',async(t)=>{
  const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
  const root=new THREE.Group();root.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial()));
  t.mock.method(GLTFLoader.prototype,'loadAsync',async(url)=>({scene:url.includes('snow-character')?new THREE.Group():root}));
  const atlas=new THREE.Texture();let disposed=false;atlas.addEventListener('dispose',()=>{disposed=true;});
  t.mock.method(THREE.TextureLoader.prototype,'loadAsync',async(url)=>{
    if(url.endsWith('-environment.png'))throw new Error('simulated missing environment');
    return url.endsWith('-lightmap.png')?atlas:new THREE.Texture();
  });
  t.mock.method(console,'warn',()=>{});
  const street=new PumpCourtyard();await street.loadVisuals('/');
  assert.equal(street.group.userData.lightingStatus,'fallback');assert.equal(disposed,true);
  assert.equal(street.group.userData.environmentStatus,'ready');assert.ok(street.group.children.includes(root));
  assert.equal(street.group.children.find(o=>o.children.some(c=>c.isLight)).visible,true);
  assert.equal(street.pump.children[0].material.envMap,null);
});

test('Snow figure is independently selectable and remains behind the desk collision',async()=>{
  const room=new SnowOffice();room.group.visible=true;room.character.group.userData.characterStatus='ready';
  const ray=new THREE.Raycaster(new THREE.Vector3(-.65,1.5,1),new THREE.Vector3(0,0,-1));
  const hit=room.pick(ray);assert.ok(hit.object===room.character.target,'ray selects the figure');assert.equal(room.hotspotFor(hit.object),'john-snow');
  assert.equal(room.canTeleport(hit),false);
  ray.set(new THREE.Vector3(-.65,.7,1),new THREE.Vector3(0,0,-1));
  assert.notEqual(room.pick(ray).object,room.character.target,'desk occludes the figure at desk height');
  room.group.visible=false;assert.equal(room.pick(ray),undefined);
  room.group.visible=true;room.character.group.userData.characterStatus='unavailable';
  ray.set(new THREE.Vector3(-.65,1.5,1),new THREE.Vector3(0,0,-1));
  assert.notEqual(room.pick(ray)?.object,room.character.target,'no invisible person target when its art fails');
});

function snowHoverScene() {
  const scene=Object.create(BroadStreetScene.prototype),office=new SnowOffice();
  office.group.visible=true;office.character.group.userData.characterStatus='ready';
  const camera=new THREE.PerspectiveCamera(60,1,.1,100);camera.position.set(-.65,1.5,1);camera.updateMatrixWorld(true);
  const label=new THREE.Sprite(),mesh=new THREE.Mesh(new THREE.SphereGeometry(),new THREE.MeshStandardMaterial());
  mesh.userData.hotspot={id:'john-snow'};
  Object.assign(scene,{office,camera,hotspotVisuals:new Map([['john-snow',{label,mesh}]]),
    gameState:new GameState(),renderer:{xr:{isPresenting:false}},pointer:new THREE.Vector2(),
    raycaster:new THREE.Raycaster(),cameraWorldPosition:new THREE.Vector3(),cameraDirection:new THREE.Vector3(),
    canvas:{getBoundingClientRect:()=>({left:0,top:0,width:800,height:800})},
    vrControllers:[],vrInputSources:new Map(),controllerRaycaster:new THREE.Raycaster(),
    controllerWorldPosition:new THREE.Vector3(),controllerWorldQuaternion:new THREE.Quaternion(),controllerWorldDirection:new THREE.Vector3(),
    markVrPanelDirty(){}});
  Object.defineProperty(scene,'walkable',{get:()=>office.group.visible?office:undefined});
  return {scene,office,camera,label};
}

test('Snow label follows mouse or keyboard aim at the figure, not the desk, and hides for panels and travel',()=>{
  const originalDocument=globalThis.document;
  globalThis.document={body:{dataset:{}}};
  try {
    const {scene,office,camera,label}=snowHoverScene();
    scene.refreshHotspots();assert.equal(label.visible,false,'no persistent nameplate');
    scene.updateSnowHoverLabel();assert.equal(label.visible,true,'keyboard reticle on figure');
    camera.position.y=.7;camera.updateMatrixWorld(true);
    scene.updateSnowHoverLabel();assert.equal(label.visible,false,'desk action does not show figure label');
    camera.position.y=1.5;camera.updateMatrixWorld(true);
    scene.snowHoverPointer={x:400,y:400};scene.updateSnowHoverLabel();assert.equal(label.visible,true);
    scene.snowHoverPointer={x:790,y:400};scene.updateSnowHoverLabel();assert.equal(label.visible,false,'mouse takes precedence over center aim');
    scene.snowHoverPointer=null;scene.updateSnowHoverLabel();assert.equal(label.visible,false,'mouse left canvas');
    scene.snowHoverPointer=undefined;scene.updateSnowHoverLabel();assert.equal(label.visible,true);
    document.body.dataset.overlayOpen='true';scene.updateSnowHoverLabel();assert.equal(label.visible,false);
    document.body.dataset.overlayOpen='false';scene.updateSnowHoverLabel();assert.equal(label.visible,true);
    office.group.visible=false;scene.updateSnowHoverLabel();assert.equal(label.visible,false);
    office.group.visible=true;office.character.group.userData.characterStatus='unavailable';
    scene.updateSnowHoverLabel();assert.equal(label.visible,false,'missing actor has no floating label');
  } finally {
    if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;
  }
});

test('Snow hover accepts either connected controller and hides behind the VR panel',()=>{
  const {scene,label}=snowHoverScene();scene.renderer.xr.isPresenting=true;
  const aim=new THREE.Group(),miss=new THREE.Group();aim.position.set(-.65,1.5,1);miss.position.set(2,1.5,1);
  scene.vrControllers=[aim,miss];scene.vrInputSources.set(miss,{});
  scene.updateSnowHoverLabel();assert.equal(label.visible,false,'disconnected controller cannot show label');
  scene.vrInputSources.set(aim,{});scene.updateSnowHoverLabel();assert.equal(label.visible,true,'other hand missing does not hide label');
  scene.vrPanelVisible=true;scene.updateSnowHoverLabel();assert.equal(label.visible,false);
  scene.vrPanelVisible=false;aim.position.y=.7;scene.updateSnowHoverLabel();assert.equal(label.visible,false,'desk occludes controller aim');
});

test('Snow idle motion is small, bounded and disabled for reduced motion',async()=>{
  const {SnowCharacter}=await load('walkable/SnowCharacter');const person=new SnowCharacter();
  person.head=new THREE.Group();person.upper=new THREE.Group();person.upperY=.69;person.headYaw=0;
  for(let t=0;t<300;t+=.37){person.update(t);assert.ok(Math.abs(person.head.rotation.y)<=.014);assert.ok(Math.abs(person.upper.position.y-.69)<=.001501);}
  person.update(2,true);assert.equal(person.head.rotation.y,0);assert.equal(person.upper.position.y,.69);
});

test('seated Snow exports only its own meshes with lightmap UVs and a compact asset budget',async()=>{
  const bytes=await readFile('public/models/snow-character.glb');
  const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  const names=gltf.nodes.map(n=>n.name);assert.ok(names.includes('Snow_head'));assert.ok(names.includes('Snow_upper'));
  assert.ok(gltf.nodes.filter(n=>n.mesh!==undefined).every(n=>n.name.startsWith('Snow_')),'reference office is not exported with actor');
  assert.ok(bytes.length<3*1024*1024);
  let triangles=0;
  for(const mesh of gltf.meshes)for(const p of mesh.primitives){assert.notEqual(p.attributes.TEXCOORD_1,undefined);assert.notEqual(p.attributes.COLOR_0,undefined,'authored skin and cloth albedo survives export');triangles+=gltf.accessors[p.indices].count/3;}
  assert.ok(triangles<30000);assert.ok(gltf.meshes.length<=12);
  for(const [type,width,height] of [['lightmap',1024,1024],['environment',256,128]]) {
    const png=await readFile(`public/models/snow-character-${type}.png`);assert.equal(png.readUInt32BE(16),width);assert.equal(png.readUInt32BE(20),height);
  }
});


async function exportedSnow() {
  const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
  const bytes=await readFile('public/models/snow-character.glb');
  const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  scene.updateMatrixWorld(true);return scene;
}

test('exported Snow has a solid coat across chest and abdomen from front and back',async()=>{
  const root=await exportedSnow(),coat=root.getObjectByName('Snow_upper_Coat');
  assert.ok(coat?.isMesh);
  for(const height of [.75,.9,1.02,1.10])for(const offset of [-.13,0,.13]) {
    const front=new THREE.Raycaster(new THREE.Vector3(-.65+offset,height,-1.5),new THREE.Vector3(0,0,-1)).intersectObject(coat,false)[0];
    const back=new THREE.Raycaster(new THREE.Vector3(-.65+offset,height,-2.8),new THREE.Vector3(0,0,1)).intersectObject(coat,false)[0];
    assert.ok(front,`missing torso front at ${offset}, ${height}`);
    assert.ok(back,`missing torso back at ${offset}, ${height}`);
    assert.ok(front.point.z-back.point.z>.10,'torso has real depth, not just a front sheet');
  }
});

test('exported Snow palms are flattened and fingers rest just above the desk',async()=>{
  const root=await exportedSnow(),skin=root.getObjectByName('Snow_upper_Skin');
  assert.ok(skin?.isMesh);
  for(const side of [-1,1]) {
    const cx=-.65+side*.20,z=-2.28+.571;
    const top=new THREE.Raycaster(new THREE.Vector3(cx,1,z),new THREE.Vector3(0,-1,0)).intersectObject(skin,false)[0];
    const bottom=new THREE.Raycaster(new THREE.Vector3(cx,.7,z),new THREE.Vector3(0,1,0)).intersectObject(skin,false)[0];
    assert.ok(top&&bottom,'palm has top and bottom surfaces');
    const thickness=top.point.y-bottom.point.y;
    assert.ok(thickness>.018&&thickness<.033,'palm is anatomically flattened rather than a ball');
    for(let i=0;i<4;i++) {
      const x=cx+side*(-.025+i*.017)+side*(i-1.3)*.0015;
      const hit=new THREE.Raycaster(new THREE.Vector3(x,1,-2.28+.631),new THREE.Vector3(0,-1,0)).intersectObject(skin,false)[0];
      assert.ok(hit,`finger ${i} is present`);
      assert.ok(hit.point.y>.82&&hit.point.y<.851,'fingers rest at tabletop height');
    }
  }
});

test('Snow keeps authored skin and cloth colors when baked lighting loads',async(t)=>{
  const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
  const {SnowCharacter}=await load('walkable/SnowCharacter');
  const root=new THREE.Group(),geometry=new THREE.BoxGeometry();
  geometry.setAttribute('uv1',geometry.getAttribute('uv').clone());
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count*3).fill(.5),3));
  const material=new THREE.MeshStandardMaterial({vertexColors:true});root.add(new THREE.Mesh(geometry,material));
  t.mock.method(GLTFLoader.prototype,'loadAsync',async()=>({scene:root}));
  t.mock.method(THREE.TextureLoader.prototype,'loadAsync',async()=>new THREE.Texture());
  const actor=new SnowCharacter();await actor.loadVisuals('/');
  assert.equal(actor.group.userData.characterStatus,'ready');assert.equal(material.vertexColors,true);
  assert.equal(material.lightMap.channel,1);assert.ok(actor.group.children.includes(root));
});

test('failed character lighting does not remove the office or its desk interaction',async(t)=>{
  const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
  t.mock.method(GLTFLoader.prototype,'loadAsync',async()=>({scene:new THREE.Group()}));
  t.mock.method(THREE.TextureLoader.prototype,'loadAsync',async(url)=>{if(url.includes('snow-character'))throw Error('missing actor texture');return new THREE.Texture();});
  t.mock.method(console,'warn',()=>{});
  const room=new SnowOffice();await room.loadVisuals('/');room.group.visible=true;
  assert.equal(room.group.userData.environmentStatus,'ready');assert.equal(room.group.userData.lightingStatus,'baked');
  assert.equal(room.character.group.userData.characterStatus,'unavailable');
  const ray=new THREE.Raycaster(new THREE.Vector3(-.65,.7,1),new THREE.Vector3(0,0,-1));
  assert.equal(room.hotspotFor(room.pick(ray).object),'john-snow');
});

const {Soundscape,FootstepTracker,sanitizeSoundSettings}=await load('audio/Soundscape');
function fakeAudioContext() {
  const param=(value=0)=>({value,setTargetAtTime(v){this.value=v;},setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},exponentialRampToValueAtTime(v){this.value=v;},cancelScheduledValues(){}});
  const node=()=>({connections:[],connect(other){this.connections.push(other);return other;},disconnect(){this.connections=[];}});
  const c={state:'suspended',currentTime:1,destination:node(),sources:[],buffers:[],gains:[],resumeCount:0,suspendCount:0,
    async resume(){this.resumeCount++;this.state='running';},async suspend(){this.suspendCount++;this.state='suspended';},async close(){this.state='closed';},
    createGain(){const n={...node(),gain:param()};this.gains.push(n);return n;},
    createBiquadFilter:()=>({...node(),frequency:param(),Q:param()}),
    createPanner:()=>({...node(),positionX:param(),positionY:param(),positionZ:param()}),
    createBuffer(channels,length,rate){const data=new Float32Array(length);const b={length,sampleRate:rate,getChannelData:()=>data};this.buffers.push(b);return b;},
    createBufferSource(){const source={...node(),playbackRate:param(1),started:false,stopped:false,start(){this.started=true;},stop(time){this.stopped=true;this.stopAt=time;}};this.sources.push(source);return source;},
    listener:Object.fromEntries(['positionX','positionY','positionZ','forwardX','forwardY','forwardZ','upX','upY','upZ'].map(name=>[name,param()]))};return c;
}

test('sound preferences reject invalid stored values and clamp both volume channels',()=>{
  assert.deepEqual(sanitizeSoundSettings(null),{muted:false,ambience:.2,effects:.35});
  assert.deepEqual(sanitizeSoundSettings({muted:'yes',ambience:-2,effects:8}),{muted:false,ambience:0,effects:1});
  assert.deepEqual(sanitizeSoundSettings({muted:true,ambience:NaN,effects:Infinity}),{muted:true,ambience:.2,effects:.35});
});

test('footsteps follow distance but never fire on teleport, turning or panel close',()=>{
  const steps=new FootstepTracker();const p={x:0,y:1.62,z:0};assert.equal(steps.update(p,true),false);
  for(let i=0;i<20;i++)assert.equal(steps.update({...p,y:1.5+i*.01},true),false,'head height changes are not steps');
  assert.equal(steps.update({...p,x:.25},true),false);assert.equal(steps.update({...p,x:.50},true),false);assert.equal(steps.update({...p,x:.75},true),true);
  assert.equal(steps.update({...p,x:8},true),false);assert.equal(steps.update({...p,x:8.3},false),false);
  assert.equal(steps.update({...p,x:8.4},true),false);steps.reset();assert.equal(steps.update({...p,x:2},true),false);
});

test('audio is gesture-started, generated samples are finite, and location loops crossfade and dispose',async()=>{
  const c=fakeAudioContext();let created=0;const audio=new Soundscape(()=>{created++;return c;});
  audio.setLocation('brewery');audio.effect('paper');assert.equal(created,0);
  await Promise.all([audio.unlock(),audio.unlock()]);assert.equal(created,1);assert.equal(c.state,'running');
  assert.equal(audio.active.length,1);
  for(const b of c.buffers){let peak=0;for(const v of b.getChannelData(0)){assert.ok(Number.isFinite(v));peak=Math.max(peak,Math.abs(v));}assert.ok(peak>0&&peak<=1);}
  const old=audio.active[0];audio.setLocation('broad-street');assert.equal(audio.active.length,2);assert.ok(old.source.stopped);assert.equal(old.source.stopAt,c.currentTime+.4);
  audio.update({x:1,y:2,z:3},{x:0,y:0,z:-1},{x:0,y:1,z:0},false);assert.equal(c.listener.positionX.value,1);assert.equal(c.listener.forwardZ.value,-1);
  audio.dispose();assert.equal(c.state,'closed');assert.ok(c.sources.every(s=>s.stopped));assert.equal(audio.allSources.size,0);
  const count=c.sources.length;audio.setLocation('household');await audio.unlock();assert.equal(c.sources.length,count);
});

test('mute, independent levels and background suspension suppress sound without changing game state',async()=>{
  const c=fakeAudioContext(),audio=new Soundscape(()=>c);await audio.unlock();
  audio.setLevel('ambience',.6);audio.setLevel('effects',.1);
  assert.equal(audio.ambience.gain.value,.6);assert.equal(audio.effects.gain.value,.1);
  audio.toggleMuted();const initial=c.sources.length;audio.effect('paper');assert.equal(c.sources.length,initial);assert.equal(audio.master.gain.value,0);
  audio.toggleMuted();audio.effect('paper');assert.equal(c.sources.length,initial+1);
  audio.setHidden(true);assert.equal(audio.master.gain.value,0);assert.equal(c.suspendCount,1);audio.effect('step');assert.equal(c.sources.length,initial+1);
  audio.setHidden(false);await Promise.resolve();assert.equal(c.state,'running');
  audio.dispose();
});

test('unsupported audio and a blocked resume remain non-fatal and can be retried',async()=>{
  const unsupported=new Soundscape(()=>{throw new Error('no Web Audio');});await unsupported.unlock();unsupported.effect('select');assert.equal(unsupported.failed,true);
  const c=fakeAudioContext();let resumes=0;c.resume=async()=>{if(++resumes===1)throw new Error('gesture needed');c.state='running';};
  const retry=new Soundscape(()=>c);await retry.unlock();assert.equal(retry.failed,false);await retry.unlock();assert.equal(c.state,'running');retry.dispose();
});

test('VR sound controls adjust preferences without clearing evidence or a dialogue answer',()=>{
  const game=fieldGame(true);game.travelToLocation('brewery');game.inspectHotspot('broad-street-brewery');game.askQuestion('brewery-drink-question');
  const answer=game.getActiveDialogueAnswer(),evidence=game.getCollectedEvidence().length;
  const scene=Object.create(BroadStreetScene.prototype),sound=new Soundscape();
  Object.assign(scene,{gameState:game,sound,vrPanelMode:'home',getDefaultVrStatus(){return '';},showVrPanel(){},refreshHotspots(){},markVrPanelDirty(){}});
  scene.handleVrButton({type:'mode',mode:'sound'});assert.deepEqual(game.getActiveDialogueAnswer(),answer);
  scene.handleVrButton({type:'sound-level',channel:'ambience',delta:.1});assert.ok(Math.abs(sound.getSettings().ambience-.3)<1e-8);
  scene.handleVrButton({type:'sound-mute'});assert.equal(sound.getSettings().muted,true);assert.equal(game.getCollectedEvidence().length,evidence);
});


test('XR system-menu visibility stays muted when document visibility returns',async()=>{
  const c=fakeAudioContext(),sound=new Soundscape(()=>c);await sound.unlock();
  sound.setHidden(true,'xr');sound.setHidden(true,'document');sound.setHidden(false,'document');
  await Promise.resolve();assert.equal(sound.hidden,true);assert.equal(sound.master.gain.value,0);
  sound.setHidden(false,'xr');await Promise.resolve();assert.equal(sound.hidden,false);assert.equal(c.state,'running');sound.dispose();
});
