import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { test } from "node:test";
import ts from "typescript";
import * as THREE from "three";

// Compile into the ignored dependency cache; no additional test dependency.
const output = resolve("node_modules/.cache/walkable-tests");
for (const name of ["ui/createUi", "ui/DesktopKeyboard", "ui/OutsidePanelDismiss", "render/BroadStreetScene", "walkable/WalkableArea", "walkable/SnowOffice", "walkable/SnowCharacter", "walkable/SceneCharacters", "audio/Soundscape", "audio/ambience", "walkable/FurnishedRoom", "walkable/BakedRoomLighting", "walkable/RegistrarRoom", "walkable/HouseholdRoom", "walkable/WorkhouseCourtyard", "walkable/BreweryRoom", "walkable/DesktopMovement", "walkable/locomotion", "walkable/VrInput", "walkable/PumpCourtyard", "walkable/WorldTravelTargets", "walkable/TravelRoutes", "simulation/gameState", "simulation/content", "simulation/types"]) {
  const source = await readFile(`src/${name}.ts`, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    .replace(/from "(\.\.?\/[^".]+)"/g, 'from "$1.js"');
  await mkdir(resolve(output, name, ".."), { recursive: true });
  await writeFile(resolve(output, `${name}.js`), compiled);
}
for (const name of ["controller-buttons", "scene-characters", "office-layout", "registrar-layout", "household-layout", "workhouse-layout", "brewery-layout"]) await copyFile(`src/walkable/${name}.json`, resolve(output, `walkable/${name}.json`));
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
  assert.equal(scene.vrPanelVisible,false,'first outside select dismisses without teleporting');
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
  game.inspectHotspot('john-snow');game.askQuestion('snow-method-question');scene.updateWorldTravelZones();assert.equal(game.getCurrentLocation().id,'snow-desk','unlock while inside does not travel');
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
  game.travelToLocation('snow-desk');game.selectHypothesis('waterborne');
  assert.ok(game.prepareBoardArgument().prepared);
  const rig=new THREE.Group(),camera=new THREE.PerspectiveCamera();camera.position.y=1.62;rig.add(camera);
  const courtyard=new PumpCourtyard(),office=new SnowOffice(),registrar=new RegistrarRoom(),household=new HouseholdRoom(),workhouse=new WorkhouseCourtyard(),brewery=new BreweryRoom();
  for(const room of [courtyard,registrar,household,workhouse,brewery])room.characters.loadVisuals=async()=>{};
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
    scene.renderer.xr.isPresenting=true;scene.vrHeightOffset=.47;
    scene.applyCurrentLocation();assert.equal(rig.position.y,.47,`${id}: retain the seated height correction`);
    scene.renderer.xr.isPresenting=false;scene.applyCurrentLocation();assert.equal(rig.position.y,0);
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
  controller.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),workhouseStewardTarget.clone().setY(1.55).sub(controller.position).normalize());
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
test('workhouse yard has clear approaches to the standing steward, water supply and exit',()=>{
  const zone=returnTravelRoutes.find(r=>r.id==='workhouse-return').zone;
  assert.ok(workhouseArea.canWalkBetween(workhouseSpawn,new THREE.Vector3(-1.5,0,-6.4)));
  assert.ok(workhouseArea.canWalkBetween(workhouseSpawn,new THREE.Vector3(zone.x,0,zone.z)));
  const loop=[[.4,1.8],[5.2,-3.6],[5.2,-7.8],[.9,-7.8],[.9,-3.6],[.4,1.8]].map(([x,z])=>new THREE.Vector3(x,0,z));
  for(let i=1;i<loop.length;i++) assert.ok(workhouseArea.canWalkBetween(loop[i-1],loop[i]),'clear path around separate water supply');
  assert.ok(Math.hypot(workhouseSpawn.x-zone.x,workhouseSpawn.z-zone.z)>zone.radius+1);
  for(const f of workhouseLayout.furniture) assert.equal(workhouseArea.isValidDestination(new THREE.Vector3(f.x,0,f.z)),false,f.id);
  assert.equal(workhouseArea.canWalkBetween(new THREE.Vector3(.9,0,-5.8),new THREE.Vector3(5.2,0,-5.8)),false,'cannot cut through the well');
  assert.equal(workhouseArea.isValidDestination(new THREE.Vector3(9,0,0)),false,'wing wall bounds');
  const room=new WorkhouseCourtyard();room.characters.group.userData.characterStatus='ready';
  const keys=new DesktopMovement();keys.press('w');let p=new THREE.Vector3(-1.5,1.62,-5);
  for(let i=0;i<100;i++) p=keys.update(p,0,.05,room.canWalkBetween).position;
  assert.ok(p.z>=-7.23 && p.z<-7.1,'stop before the standing steward');
  assert.ok(!workhouseLayout.furniture.some(f=>/steward-table|steward-chair|garden-bed/.test(f.id)));
  assert.ok(workhouseArea.isValidDestination(new THREE.Vector3(0,0,-9.3)),'doorway approach is open');
});

test('workhouse seated and standing rays select steward, exit and ground but cannot cross the well',()=>{
  const room=new WorkhouseCourtyard();room.group.visible=true;const game=fieldGame(true);game.travelToLocation('workhouse');
  const targets=new WorldTravelTargets(()=>new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));targets.refresh(game);
  const ray=new THREE.Raycaster();
  for(const eyeHeight of [1.15,1.62]) {
    const from=workhouseSpawn.clone().setY(eyeHeight);
    for(const y of [1.4,1.6]) {
      ray.set(from,workhouseStewardTarget.clone().setY(y).sub(from).normalize());
      const hit=room.pick(ray);assert.equal(room.hotspotFor(hit.object),'poland-workhouse');assert.equal(room.canTeleport(hit),false);
    }
    ray.set(from,new THREE.Vector3(0,-1,0));assert.ok(room.canTeleport(room.pick(ray)));
  }
  ray.set(new THREE.Vector3(0,1.3,7.8),new THREE.Vector3(0,0,1));
  const hit=targets.pick(ray,'workhouse',room.pick(ray));assert.equal(targets.routeFor(hit.object).to,'broad-street');
  ray.set(new THREE.Vector3(3,1.62,-3.5),new THREE.Vector3(0,-.15,-1).normalize());
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
  const context = { createLinearGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, translate() {} };
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
    let dismissed=0;
    scene.gameState=new GameState();
    scene.hideVrPanel=()=>{dismissed++;scene.vrPanelVisible=false;};
    controller.position.x = 3;
    scene.selectFromVrController(controller);
    assert.equal(dismissed,1,'outside selection dismisses the panel');
    assert.equal(actions, 1, 'Panel background and outside-panel rays cannot activate scenery');
    scene.clearVrPanel();
    wall.geometry.dispose(); wall.material.dispose();
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

test('exported workhouse has single ground surfaces and a closed courtyard door', async () => {
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
  for (const [x,z] of [[8.51,-5.13],[8.21,9.23],[-8.31,-9.17],[.37,.19]]) {
    ray.set(new THREE.Vector3(x,.1,z), new THREE.Vector3(0,-1,0));
    assert.equal(ray.intersectObject(model,true).length, 1, `Single ground layer at ${x}, ${z}`);
  }
  assert.equal(model.getObjectByName('Soil'),undefined,'raised garden bed is removed');
  ray.far=5;
  for(const [x,y] of [[0,1.5],[-.4,.6],[.4,1.8]]) {
    ray.set(new THREE.Vector3(x,y,-8),new THREE.Vector3(0,0,-1));
    const door=ray.intersectObject(model,true)[0];
    assert.ok(door&&door.point.z>-10.1&&door.point.z<-9.8,'closed door blocks the view into the building');
  }
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
    scene.updateCharacterHoverLabels();assert.equal(label.visible,true,'keyboard reticle on figure');
    camera.position.y=.7;camera.updateMatrixWorld(true);
    scene.updateCharacterHoverLabels();assert.equal(label.visible,false,'desk action does not show figure label');
    camera.position.y=1.5;camera.updateMatrixWorld(true);
    scene.characterHoverPointer={x:400,y:400};scene.updateCharacterHoverLabels();assert.equal(label.visible,true);
    scene.characterHoverPointer={x:790,y:400};scene.updateCharacterHoverLabels();assert.equal(label.visible,false,'mouse takes precedence over center aim');
    scene.characterHoverPointer=null;scene.updateCharacterHoverLabels();assert.equal(label.visible,false,'mouse left canvas');
    scene.characterHoverPointer=undefined;scene.updateCharacterHoverLabels();assert.equal(label.visible,true);
    document.body.dataset.overlayOpen='true';scene.updateCharacterHoverLabels();assert.equal(label.visible,false);
    document.body.dataset.overlayOpen='false';scene.updateCharacterHoverLabels();assert.equal(label.visible,true);
    office.group.visible=false;scene.updateCharacterHoverLabels();assert.equal(label.visible,false);
    office.group.visible=true;office.character.group.userData.characterStatus='unavailable';
    scene.updateCharacterHoverLabels();assert.equal(label.visible,false,'missing actor has no floating label');
  } finally {
    if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;
  }
});

test('Snow hover accepts either connected controller and hides behind the VR panel',()=>{
  const {scene,label}=snowHoverScene();scene.renderer.xr.isPresenting=true;
  const aim=new THREE.Group(),miss=new THREE.Group();aim.position.set(-.65,1.5,1);miss.position.set(2,1.5,1);
  scene.vrControllers=[aim,miss];scene.vrInputSources.set(miss,{});
  scene.updateCharacterHoverLabels();assert.equal(label.visible,false,'disconnected controller cannot show label');
  scene.vrInputSources.set(aim,{});scene.updateCharacterHoverLabels();assert.equal(label.visible,true,'other hand missing does not hide label');
  scene.vrPanelVisible=true;scene.updateCharacterHoverLabels();assert.equal(label.visible,false);
  scene.vrPanelVisible=false;aim.position.y=.7;scene.updateCharacterHoverLabels();assert.equal(label.visible,false,'desk occludes controller aim');
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

test('MakeHuman Snow embeds its surface textures, uses alpha masks and matches the editable source',async()=>{
  const {createHash}=await import('node:crypto');
  const bytes=await readFile('public/models/snow-character.glb');
  const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  assert.equal(gltf.skins?.length??0,0,'the authoring rig adds no runtime skinning');
  assert.equal(gltf.images.length,4);
  for(const image of gltf.images) {
    assert.notEqual(image.bufferView,undefined,'surface textures travel with the GLB');
    assert.equal(image.uri,undefined,'no external authoring paths or network dependencies');
    const view=gltf.bufferViews[image.bufferView];assert.ok(view.byteLength>1000);
  }
  for(const name of ['Skin','Eyes','Brows','Hair']) {
    const material=gltf.materials.find(m=>m.name===name);
    assert.ok(material?.pbrMetallicRoughness.baseColorTexture,`${name} keeps its surface detail`);
    if(name!=='Skin')assert.equal(material.alphaMode,'MASK',`${name} avoids blended-card sorting`);
  }
  const report=JSON.parse(await readFile('assets/snow-character/build-report.json','utf8'));
  assert.equal(report.anatomicalBase,'MakeHuman hm08 / MPFB');
  const source=await readFile('assets/snow-character/snow-source.blend');
  assert.equal(report.sourceSha256,createHash('sha256').update(source).digest('hex'),'export is current with the authored source');
});


async function exportedSnow() {
  const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
  const bytes=await readFile('public/models/snow-character.glb');
  // These are geometry checks in Node, without a browser image decoder.
  // Validate actual texture bindings/embedded image bytes separately below.
  const loader=new GLTFLoader();loader.register(()=>({name:'offline-texture-placeholder',loadTexture:async()=>new THREE.Texture()}));
  const {scene}=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  scene.updateMatrixWorld(true);return scene;
}

test('exported Snow has a clothed torso with real depth across chest and abdomen',async()=>{
  const root=await exportedSnow(),clothes=[];
  root.traverse(o=>{if(o.isMesh&&/Snow_upper_(Coat|Waistcoat|Shirt)/.test(o.name))clothes.push(o);});
  assert.ok(clothes.length>=3);
  for(const height of [.75,.9,1.00])for(const offset of [-.12,0,.12]) {
    const front=new THREE.Raycaster(new THREE.Vector3(-.65+offset,height,-1.5),new THREE.Vector3(0,0,-1)).intersectObjects(clothes,false)[0];
    const back=new THREE.Raycaster(new THREE.Vector3(-.65+offset,height,-2.8),new THREE.Vector3(0,0,1)).intersectObjects(clothes,false)[0];
    assert.ok(front,`missing torso front at ${offset}, ${height}`);
    assert.ok(back,`missing torso back at ${offset}, ${height}`);
    assert.ok(front.point.z-back.point.z>.10,'torso has real depth, not just a front sheet');
  }
});

test('exported Snow palms are flattened and fingers rest just above the desk',async()=>{
  const root=await exportedSnow(),skin=root.getObjectByName('Snow_upper_Skin');
  assert.ok(skin?.isMesh);
  for(const side of [-1,1]) {
    const cx=-.65+side*.18,z=-2.28+.535;
    const top=new THREE.Raycaster(new THREE.Vector3(cx,1,z),new THREE.Vector3(0,-1,0)).intersectObject(skin,false)[0];
    const bottom=new THREE.Raycaster(new THREE.Vector3(cx,.7,z),new THREE.Vector3(0,1,0)).intersectObject(skin,false)[0];
    assert.ok(top&&bottom,'palm has top and bottom surfaces');
    const thickness=top.point.y-bottom.point.y;
    assert.ok(thickness>.012&&thickness<.045,'palm is anatomically flattened rather than a ball');
    const points=[];skin.updateWorldMatrix(true,false);
    const position=skin.geometry.getAttribute('position');
    for(let i=0;i<position.count;i++) {
      const p=new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(skin.matrixWorld);
      if((p.x+.65)*side>0&&p.z>-1.72)points.push(p);
    }
    assert.ok(points.length>100,'anatomical fingers extend beyond the palm');
    assert.ok(Math.min(...points.map(p=>p.y))>.818,'fingers do not penetrate the desktop');
    assert.ok(Math.max(...points.map(p=>p.y))<.90,'fingers remain close to the desktop');
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
  const param=(value=0)=>({value,automation:[],setTargetAtTime(v){this.value=v;},setValueAtTime(v){this.value=v;this.automation.push(v);},linearRampToValueAtTime(v){this.value=v;this.automation.push(v);},exponentialRampToValueAtTime(v){this.value=v;},cancelScheduledValues(){}});
  const node=()=>({connections:[],connect(other){this.connections.push(other);return other;},disconnect(){this.connections=[];}});
  const c={state:'suspended',currentTime:1,destination:node(),sources:[],buffers:[],gains:[],resumeCount:0,suspendCount:0,
    async resume(){this.resumeCount++;this.state='running';},async suspend(){this.suspendCount++;this.state='suspended';},async close(){this.state='closed';},
    createGain(){const n={...node(),gain:param()};this.gains.push(n);return n;},
    createBiquadFilter:()=>({...node(),frequency:param(),Q:param()}),
    createPanner:()=>({...node(),positionX:param(),positionY:param(),positionZ:param()}),
    createBuffer(channels,length,rate){const data=new Float32Array(length);const b={length,sampleRate:rate,duration:length/rate,getChannelData:()=>data};this.buffers.push(b);return b;},
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
  const old=audio.active[0];audio.setLocation('broad-street');assert.equal(audio.active.length,1);assert.ok(old.source.stopped);assert.equal(old.source.stopAt,c.currentTime+.4);
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

const {SceneCharacters,characterDefinitions}=await load('walkable/SceneCharacters');
const witnessRooms={registrar:RegistrarRoom,household:HouseholdRoom,workhouse:WorkhouseCourtyard,brewery:BreweryRoom};
for(const [key,Room] of Object.entries(witnessRooms))test(`${key} figures select existing interviews, respect furniture, and block walking`,()=>{
  const room=new Room();room.group.visible=true;room.characters.group.userData.characterStatus='ready';
  for(const target of room.characters.targets) {
    const origin=target.position.clone();origin.y+=target.geometry.parameters.height/2-.08;origin.z+=1.6;
    const hit=room.pick(new THREE.Raycaster(origin,new THREE.Vector3(0,0,-1)));
    assert.equal(hit?.object,target);assert.equal(room.hotspotFor(hit.object),characterDefinitions[key].hotspot);
    const feet=target.position.clone();feet.y=0;
    assert.equal(room.canTeleport({object:room.floor,point:feet}),false);
    assert.equal(room.canWalkBetween(room.spawn,feet),false);
  }
  room.characters.group.userData.characterStatus='unavailable';
  assert.equal(room.characters.pick(new THREE.Raycaster()),undefined);
  assert.equal(room.hotspotFor(room.deskPrompt),characterDefinitions[key].hotspot,'furniture remains a usable fallback');
  room.group.visible=false;assert.equal(room.pick(new THREE.Raycaster()),undefined);
});

test('background residents block teleport and walking without opening an interview',()=>{
  const street=new PumpCourtyard();street.group.visible=true;street.characters.group.userData.characterStatus='ready';
  const target=street.characters.targets[0],feet=target.position.clone();feet.y=0;
  assert.equal(isValidDestination(feet),true,'resident is on accessible pavement');
  assert.equal(street.canTeleport({object:street.floor,point:feet}),false);
  assert.equal(street.canWalkBetween(feet.clone().add(new THREE.Vector3(0,0,2)),feet),false);
  assert.equal(street.hotspotFor(target),undefined);
  assert.equal(street.characters.blocksPath(feet,feet.clone().add(new THREE.Vector3(0,0,1))),false,'late appearance cannot trap an overlapping visitor');
});

test('scene figure assets load once, preserve albedo, and fail without leaving invisible blockers',async(t)=>{
  const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
  const root=new THREE.Group(),geometry=new THREE.BoxGeometry();geometry.setAttribute('uv1',geometry.getAttribute('uv').clone());
  const material=new THREE.MeshStandardMaterial({vertexColors:true});root.add(new THREE.Mesh(geometry,material));
  let count=0;t.mock.method(GLTFLoader.prototype,'loadAsync',async()=>{count++;return {scene:root};});
  t.mock.method(THREE.TextureLoader.prototype,'loadAsync',async()=>new THREE.Texture());
  const actors=new SceneCharacters('brewery');await Promise.all([actors.loadVisuals('/'),actors.loadVisuals('/')]);
  assert.equal(count,1);assert.equal(actors.ready,true);assert.equal(material.vertexColors,true);
  t.mock.method(THREE.TextureLoader.prototype,'loadAsync',async()=>{throw Error('missing lighting');});t.mock.method(console,'warn',()=>{});
  const failed=new SceneCharacters('household');await failed.loadVisuals('/');assert.equal(failed.ready,false);
  assert.equal(failed.pick(new THREE.Raycaster()),undefined);assert.equal(failed.blocks(new THREE.Vector3(.25,0,-.55)),false);
});

for(const [key,definition] of Object.entries(characterDefinitions))test(`${key} exported figures have solid torsos, independent head pivots and bounded assets`,async()=>{
  const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
  const bytes=await readFile(`public/models/${definition.asset}.glb`);
  const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  assert.ok(bytes.length<definition.actors.length*3*1024*1024);
  let triangles=0;
  for(const mesh of gltf.meshes)for(const primitive of mesh.primitives){
    assert.notEqual(primitive.attributes.TEXCOORD_1,undefined);assert.notEqual(primitive.attributes.COLOR_0,undefined);
    triangles+=gltf.accessors[primitive.indices].count/3;
  }
  assert.ok(triangles<definition.actors.length*30000);assert.ok(gltf.meshes.length<=definition.actors.length*12);
  assert.ok(gltf.nodes.filter(node=>node.mesh!==undefined).every(node=>definition.actors.some(actor=>node.name.startsWith(actor.id+'_'))),'room reference geometry is excluded');
  const loader=new GLTFLoader();loader.register(()=>({name:'offline-texture-placeholder',loadTexture:async()=>new THREE.Texture()}));
  const {scene}=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');scene.updateMatrixWorld(true);
  for(const actor of definition.actors){
    const root=scene.getObjectByName(actor.id+'_root'),coat=scene.getObjectByName(actor.id+'_upper_Coat');
    const clothes=[];root.traverse(o=>{if(o.isMesh&&/_(Coat|Waistcoat|Shirt)$/.test(o.name))clothes.push(o);});
    assert.ok(root&&coat&&scene.getObjectByName(actor.id+'_head'));
    for(const y of [.80,.95,1.05])for(const x of [-.1,0,.1]) {
      const origin=new THREE.Vector3(x,y+(actor.pose==='standing'?.25:0),1).applyMatrix4(root.matrixWorld);
      const direction=new THREE.Vector3(0,0,-1).transformDirection(root.matrixWorld);
      assert.ok(new THREE.Raycaster(origin,direction).intersectObjects(clothes,false)[0],`${actor.id} torso hole at ${x}, ${y}`);
    }
  }
  const atlas=await readFile(`public/models/${definition.asset}-lightmap.png`);assert.equal(atlas.readUInt32BE(16),1024);assert.equal(atlas.readUInt32BE(20),1024);
});

// Check exported geometry in actor coordinates, including rotated street residents.
for(const [key,definition] of Object.entries(characterDefinitions))test(`${key} figures have continuous lower bodies and relaxed standing wrists`,async()=>{
  const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
  const bytes=await readFile(`public/models/${definition.asset}.glb`);
  const loader=new GLTFLoader();loader.register(()=>({name:'offline-texture-placeholder',loadTexture:async()=>new THREE.Texture()}));
  const {scene}=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  scene.updateMatrixWorld(true);
  for(const actor of definition.actors) {
    const root=scene.getObjectByName(actor.id+'_root'),lower=scene.getObjectByName(actor.id+'_root_Coat');
    assert.ok(lower,'hips and legs or skirt remain a real lower-body mesh');
    const garments=[];root.traverse(o=>{if(o.isMesh&&/_(Coat|Waistcoat|Shirt)$/.test(o.name))garments.push(o);});
    const cast=(x,y,z,dir,mesh)=>new THREE.Raycaster(new THREE.Vector3(x,y,z).applyMatrix4(root.matrixWorld),new THREE.Vector3(...dir).transformDirection(root.matrixWorld)).intersectObjects(mesh?[mesh]:garments,false)[0];
    if(!actor.dress) {
      const standing=actor.pose==='standing';
      // Waist and crotch must connect across the centerline; two separate capped
      // cones would pass individual leg checks but leave a missing pelvis.
      for(const y of standing?[.91,.94,.97]:[.55,.58,.61,.64])assert.ok(cast(0,y,1,[0,0,-1]),`${actor.id}: pelvis gap at ${y}`);
      for(const side of [-1,1])for(let y=.16;y< (standing?.85:.49);y+=.025)
        assert.ok([.07,.10,.13,.16,.19,.22].some(x=>cast(side*x,y,1,[0,0,-1])),`${actor.id}: leg gap at ${y}`);
    }
    if(actor.dress) {
      for(const y of [.60,.64,.68,.72,.76])for(const x of [-.10,0,.10])
        assert.ok(cast(x,y,1,[0,0,-1]),'dress has continuous outward-facing cloth across the waist');
      const bun=scene.getObjectByName(actor.id+'_head_BunHair');
      assert.ok(bun?.isMesh,'solid bun is exported separately from masked hair cards');
      assert.equal(bun.material.alphaTest,0,'closed bun has no transparent hair-card cutouts');
      assert.equal(bun.material.transparent,false);
    }
    if(actor.pose!=='standing') {
      const skin=scene.getObjectByName(actor.id+'_upper_Skin');
      const sides=actor.id==='edward'?[-1]:actor.id==='john'?[1]:[-1,1];
      const inverse=root.matrixWorld.clone().invert(),forward=actor.pose==='table'?.08:0;
      for(const side of sides)for(const z of [.30,.33,.36]) {
        const x=side*.13,depth=z+forward;
        const palm=cast(x,.45,depth,[0,1,0],skin),cloth=cast(x,1,depth,[0,-1,0]);
        assert.ok(palm&&cloth,`${actor.id}: palm and supporting lap are present`);
        const gap=palm.point.clone().applyMatrix4(inverse).y-cloth.point.clone().applyMatrix4(inverse).y;
        assert.ok(gap>=-.004&&gap<.045,`${actor.id}: palm/lap clearance ${gap.toFixed(3)}m`);
      }
    }
    if(actor.pose==='standing') {
      const skin=scene.getObjectByName(actor.id+'_upper_Skin');
      const matrix=new THREE.Matrix4().multiplyMatrices(root.matrixWorld.clone().invert(),skin.matrixWorld);
      const positions=skin.geometry.getAttribute('position');
      if('heldProp' in actor && actor.heldProp==='ledger') {
        const book=scene.getObjectByName(actor.id+'_upper_Waistcoat');
        const cover=cast(.5,1.22,0,[-1,0,0],book);
        assert.ok(cover,'underarm ledger has a solid outer cover');
        const coverX=root.worldToLocal(cover.point.clone()).x;
        assert.ok(coverX>.22&&coverX<.25,'ledger lies beside the ribs, with its cover facing sideways');
        const hand=cast(.22,.9,.06,[0,1,0],skin);
        assert.ok(hand,'left palm supports the lower edge of the ledger');
      }
      for(const side of [-1,1]) {
        if('heldProp' in actor && actor.heldProp==='ledger' && side===1)continue;
        const hand=[];
        for(let i=0;i<positions.count;i++) {
          const p=new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(matrix);
          if(p.y>.50&&p.y<1.05&&p.x*side>.15)hand.push(p);
        }
        assert.ok(hand.length>50,'complete hand is present');
        const bounds=new THREE.Box3().setFromPoints(hand),size=bounds.getSize(new THREE.Vector3());
        assert.ok(bounds.min.y>.67&&bounds.max.y<1.01,'hand rests beside thigh below wrist');
        assert.ok(size.y>.15&&size.x<.085&&size.z<.15,'hand points down with the palm facing the thigh');
        assert.ok(hand.every(p=>p.x*side>.20),'relaxed hand stays outside the trouser silhouette');
        assert.ok([.07,.10,.13].some(z=>cast(side*.40,.86,z,[-side,0,0],skin)),'wrist-to-palm surface remains connected');
      }
    }
  }
});

for(const [key,Room] of Object.entries(witnessRooms))test(`${key} witness nameplate follows aim and stays hidden during a panel`,()=>{
  const original=globalThis.document;globalThis.document={body:{dataset:{}}};
  try {
    const scene=Object.create(BroadStreetScene.prototype),room=new Room(),game=fieldGame(true);game.travelToLocation(key);
    room.group.visible=true;room.characters.group.userData.characterStatus='ready';
    const camera=new THREE.PerspectiveCamera(60,1,.1,100),target=room.characters.targets[0];
    camera.position.copy(target.position);camera.position.y+=target.geometry.parameters.height/2-.08;camera.position.z+=1.6;camera.updateMatrixWorld(true);
    const label=new THREE.Sprite(),id=characterDefinitions[key].hotspot;
    const office=new SnowOffice();office.group.visible=false;
    Object.assign(scene,{office,[key]:room,gameState:game,camera,hotspotVisuals:new Map([[id,{label}]]),
      renderer:{xr:{isPresenting:false}},raycaster:new THREE.Raycaster(),pointer:new THREE.Vector2(),
      cameraWorldPosition:new THREE.Vector3(),cameraDirection:new THREE.Vector3()});
    Object.defineProperty(scene,'walkable',{get:()=>room});
    scene.updateCharacterHoverLabels();assert.equal(label.visible,true);
    document.body.dataset.overlayOpen='true';scene.updateCharacterHoverLabels();assert.equal(label.visible,false);
    document.body.dataset.overlayOpen='false';camera.rotation.y=Math.PI;camera.updateMatrixWorld(true);
    scene.updateCharacterHoverLabels();assert.equal(label.visible,false);
  } finally {if(original===undefined)delete globalThis.document;else globalThis.document=original;}
});

const { renderSynthesisPanel, renderChapterPanel } = await load('ui/createUi');
function reviewGame() {
  const game=fieldGame(true);
  for (const [location,hotspot,questions] of [
    ['broad-street','broad-street-pump',['pump-caution-question']],
    ['household','broad-street-household',['household-water-question','household-pattern-question']],
    ['workhouse','poland-workhouse',['workhouse-water-question']],
    ['brewery','broad-street-brewery',['brewery-drink-question']],
  ]) {
    game.travelToLocation(location);game.inspectHotspot(hotspot);
    for(const question of questions)game.askQuestion(question);
  }
  game.travelToLocation('snow-desk');
  return game;
}

test('each theory can be prepared and presented without a confidence step; other gates remain',()=>{
  const early=new GameState();early.selectHypothesis('waterborne');
  assert.equal(early.prepareBoardArgument().prepared,false);
  assert.equal(early.presentToBoard().accepted,false);
  for (const theory of early.getHypotheses()) {
    const game=reviewGame();
    assert.equal(game.prepareBoardArgument().prepared,false,'a theory must be selected');
    game.selectHypothesis(theory.id);
    game.travelToLocation('broad-street');
    assert.equal(game.prepareBoardArgument().prepared,false,'prepare at Snow\'s desk');
    game.travelToLocation('snow-desk');
    assert.ok(game.prepareBoardArgument().prepared);
    const next=game.getHypotheses().find(h=>h.id!==theory.id);
    game.selectHypothesis(next.id);
    assert.equal(game.preparedForBoard,false,'changing theory requires preparing again');
    assert.equal(game.presentToBoard().accepted,false);
    game.selectHypothesis(theory.id);assert.ok(game.prepareBoardArgument().prepared);
    assert.ok(game.presentToBoard().accepted);
    assert.equal(game.getBoardFindings().length,2);
    assert.ok(game.getCurrentSceneBody().join(' ').includes(theory.boardAction));
    game.finishBoard();assert.equal(game.getStage(),'complete');
    game.reset();assert.equal(game.selectedHypothesisId,undefined);assert.equal(game.preparedForBoard,false);
  }
});

test('concise theory comparisons never reveal uncollected evidence, for every collection subset',()=>{
  const all=new GameState().getAllEvidence();
  for(let mask=0;mask<2**all.length;mask++) {
    const game=new GameState();
    game.collectedEvidence=new Set(all.filter((_,i)=>mask&(1<<i)).map(card=>card.id));
    for(const theory of game.getHypotheses()) {
      const review=game.getHypothesisReview(theory);
      for(const point of [review.supporting,review.complicating].filter(Boolean)) {
        assert.ok(point.evidenceIds.length>0);
        assert.ok(point.evidenceIds.every(id=>game.hasEvidence(id)),`${theory.id}: uncollected source`);
        assert.ok(point.text.split(/\s+/).length<=25,'each point stays concise');
      }
    }
  }
  const game=reviewGame();
  assert.equal(game.getCollectedEvidence().length,7,'full inquiry fixture');
  const water=game.getHypothesisReview(game.getHypothesis('waterborne'));
  assert.match(water.supporting.text,/68 of 75/);
  assert.match(water.complicating.text,/Six/);
});

test('desktop review shows two points per theory, full-note links and no confidence controls or repeated map list',()=>{
  const game=reviewGame();
  assert.match(renderSynthesisPanel(game),/data-action="prepare-board"\s+disabled/);
  game.selectHypothesis('waterborne');
  const html=renderSynthesisPanel(game);
  assert.equal((html.match(/class="fit-list /g)||[]).length,8);
  assert.equal((html.match(/data-action="select-hypothesis"/g)||[]).length,4);
  assert.match(html,/data-action="notebook"/);assert.match(html,/data-action="map"/);
  assert.doesNotMatch(html,/confidence|synthesis-map-strip/i);
  assert.doesNotMatch(html,/data-action="prepare-board"\s+disabled/);
  assert.ok(game.prepareBoardArgument().prepared);
  assert.match(renderSynthesisPanel(game),/data-action="present"/);
  game.presentToBoard();
  const board=renderChapterPanel(game.getCurrentScene(),'board',game);
  assert.equal((board.match(/<li>/g)||[]).length,2);
  assert.equal((board.match(/Prepared theory/g)||[]).length,0);
  game.finishBoard();
  assert.doesNotMatch(renderChapterPanel(game.getCurrentScene(),'complete',game),/findings-list/);
});

test('VR review uses the same strongest points and offers prepare and present without confidence buttons',()=>{
  const game=reviewGame(),scene=Object.create(BroadStreetScene.prototype);
  let buttons=[],texts=[];
  Object.assign(scene,{gameState:game,addVrText:(text)=>texts.push(text),
    addPaginatedVrText:(_key,text)=>texts.push(text),
    addVrPanelButton:(label,x,y,width,height,action)=>buttons.push({label,action}),
    markVrPanelDirty:()=>{},showVrPanel:()=>{},refreshHotspots:()=>{}});
  scene.buildVrSynthesisPanel();assert.ok(!buttons.some(b=>b.action.type==='prepare-board'));
  for(const theory of game.getHypotheses()) {
    game.selectHypothesis(theory.id);buttons=[];texts=[];
    scene.buildVrSynthesisPanel();
    const review=game.getHypothesisReview(theory);
    assert.ok(texts.includes(review.supporting.text));assert.ok(texts.includes(review.complicating.text));
    assert.equal(buttons.filter(b=>b.action.type==='select-hypothesis').length,4);
    assert.ok(buttons.some(b=>b.action.type==='prepare-board'));
    assert.doesNotMatch(JSON.stringify({buttons,texts}),/confidence|Map evidence:/i);
  }
  scene.handleVrButton({type:'prepare-board'});assert.equal(game.preparedForBoard,true);
  buttons=[];scene.buildVrSynthesisPanel();assert.ok(buttons.some(b=>b.action.type==='present-board'));
  scene.handleVrButton({type:'present-board'});assert.equal(game.getStage(),'board');
});

test('scene guidance names selectable figures and objects, including noninteractive street residents',()=>{
  const game=new GameState();
  const expected={'snow-desk':/John Snow/,registrar:/registrar.*ledger/,household:/survivor/,workhouse:/steward/,brewery:/either brewery owner/,'broad-street':/pump.*background/};
  for(const [id,pattern] of Object.entries(expected)) {
    game.currentLocationId=id;
    assert.match(game.getInteractionHint(),pattern);
    assert.doesNotMatch(game.getInteractionHint(),/gold|marker|marked (table|chair)/i);
  }
});

test('MakeHuman scene figures embed masked textures and match their editable sources',async()=>{
  const {createHash}=await import('node:crypto');
  for(const definition of Object.values(characterDefinitions)) {
    const bytes=await readFile(`public/models/${definition.asset}.glb`);
    const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
    assert.equal(gltf.skins?.length??0,0,'authoring rigs are not shipped');
    for(const image of gltf.images) {
      assert.notEqual(image.bufferView,undefined,'textures are embedded');
      assert.equal(image.uri,undefined,'no authoring machine or external texture paths');
      assert.ok(gltf.bufferViews[image.bufferView].byteLength>1000);
    }
    const report=JSON.parse(await readFile(`assets/${definition.asset}/build-report.json`,'utf8'));
    assert.equal(report.anatomicalBase,'MakeHuman hm08 / MPFB');
    for(const actor of definition.actors) {
      const source=await readFile(`assets/scene-people/${actor.id}.blend`);
      assert.equal(report.sources[actor.id],createHash('sha256').update(source).digest('hex'),'export matches authored anatomy');
      for(const role of ['Skin','Eyes','Brows','Hair']) {
        const node=gltf.nodes.find(n=>n.name===`${actor.id}_head_${role}`);
        assert.ok(node,`${actor.id} has textured ${role}`);
        const material=gltf.materials[gltf.meshes[node.mesh].primitives[0].material];
        assert.ok(material.pbrMetallicRoughness.baseColorTexture,`${actor.id} preserves ${role} detail`);
        if(role!=='Skin')assert.equal(material.alphaMode,'MASK','no sorted transparent hair cards');
        if(role==='Hair')assert.ok(material.pbrMetallicRoughness.baseColorFactor,'individual hair tint survives glTF export');
      }
    }
  }
});

const {ambienceProfiles,clipGroups}=await load('audio/ambience');
const silentClipLoader=async()=>{throw new Error('optional sound unavailable');};
const audioPosition={x:0,y:1.62,z:0},audioForward={x:0,y:0,z:-1},audioUp={x:0,y:1,z:0};
function tickAudio(sound){sound.update(audioPosition,audioForward,audioUp,false);}
function seedClips(sound,c) {
  for(const name of Object.values(clipGroups).flat()) {
    const buffer=c.createBuffer(1,22050*(name==='wagon'?12:1),22050);
    buffer.getChannelData(0).fill(.1);sound.recordings.set(name,buffer);
  }
}

test('reading ducks ambience smoothly without overwriting preferences or effects, then restores it',async()=>{
  const c=fakeAudioContext(),sound=new Soundscape(()=>c,silentClipLoader,()=>.5);
  sound.setReading(true);await sound.unlock();sound.setLevel('ambience',.6);
  assert.equal(sound.getSettings().ambience,.6);assert.equal(sound.ambience.gain.value,.6*.22);
  assert.equal(sound.effects.gain.value,.35);seedClips(sound,c);
  c.currentTime=100;const count=c.sources.length;tickAudio(sound);assert.equal(c.sources.length,count);
  sound.setReading(false);assert.equal(sound.ambience.gain.value,.6);
  tickAudio(sound);assert.equal(c.sources.length,count,'no queued burst when a panel closes');
  c.currentTime=sound.nextEvent+.1;tickAudio(sound);assert.equal(sound.events.size,1);
  sound.dispose();
});

test('spatial events use irregular intervals, alternate kinds and clips, and move street traffic',async()=>{
  const c=fakeAudioContext();let randomValue=.1;
  const sound=new Soundscape(()=>c,silentClipLoader,()=>randomValue);sound.setLocation('broad-street');
  await sound.unlock();seedClips(sound,c);
  c.currentTime=sound.nextEvent;tickAudio(sound);
  const first=[...sound.events][0];assert.ok(first);assert.equal(first.source.loop,false);
  assert.equal(sound.lastEventKind,'wagon');assert.equal(first.panner.positionX.automation.length,2);assert.notEqual(...first.panner.positionX.automation);
  const firstDelay=sound.nextEvent-c.currentTime;first.source.onended();assert.equal(sound.events.size,0);
  randomValue=.8;c.currentTime=sound.nextEvent;tickAudio(sound);
  assert.notEqual(sound.lastEventKind,'wagon');assert.notEqual(sound.nextEvent-c.currentTime,firstDelay);
  assert.notEqual(sound.pickClip('paper'),sound.pickClip('paper'));
  sound.dispose();
});

test('every location has bounded sparse foley, and travel retires old events without accumulating loops',async()=>{
  const c=fakeAudioContext(),sound=new Soundscape(()=>c,silentClipLoader,()=>.2);
  await sound.unlock();seedClips(sound,c);
  for(const location of Object.keys(ambienceProfiles)) {
    sound.setLocation(location);assert.equal(sound.active.length,1);
    assert.ok(sound.allSources.size<=4);
    c.currentTime=sound.nextEvent;tickAudio(sound);
    assert.equal(sound.events.size,1,location);
    const event=[...sound.events][0];sound.setLocation('unknown');assert.equal(sound.active.length,0);
    assert.equal(event.retiring,true);assert.equal(event.source.stopAt,c.currentTime+.4);
    assert.equal(sound.events.size,0);tickAudio(sound);
  }
  sound.dispose();assert.equal(sound.allSources.size,0);
});

test('muting, zero ambience, and XR suspension never create new ambient events or resume in a burst',async()=>{
  const c=fakeAudioContext(),sound=new Soundscape(()=>c,silentClipLoader,()=>.2);
  await sound.unlock();seedClips(sound,c);
  for(const quiet of ['mute','zero','xr']) {
    if(quiet==='mute')sound.toggleMuted();
    if(quiet==='zero')sound.setLevel('ambience',0);
    if(quiet==='xr')sound.setHidden(true,'xr');
    const count=c.sources.length;c.currentTime+=200;tickAudio(sound);assert.equal(c.sources.length,count);
    if(quiet==='mute')sound.toggleMuted();
    if(quiet==='zero')sound.setLevel('ambience',.2);
    if(quiet==='xr'){sound.setHidden(false,'xr');await Promise.resolve();}
    tickAudio(sound);assert.equal(c.sources.length,count);
  }
  sound.dispose();
});

test('recordings load once after a gesture, with two workers; failed clips leave fallback available',async()=>{
  const c=fakeAudioContext();let requests=0,inFlight=0,peak=0;
  c.decodeAudioData=async()=>c.createBuffer(1,22050,22050);
  const sound=new Soundscape(()=>c,async(url)=>{
    requests++;peak=Math.max(peak,++inFlight);await Promise.resolve();inFlight--;
    assert.match(url,/^\/audio\/[\w-]+\.wav$/);
    if(url.includes('wagon'))throw new Error('missing');return new ArrayBuffer(8);
  });
  assert.equal(requests,0);await Promise.all([sound.unlock(),sound.unlock()]);await sound.recordingLoad;
  assert.equal(peak,2);assert.equal(requests,15);assert.equal(sound.recordings.size,14);
  assert.ok(sound.cart);sound.setLocation('registrar');await sound.unlock();assert.equal(requests,15);
  sound.dispose();
});

test('disposing while a recording is loading aborts and cannot repopulate buffers or start sounds',async()=>{
  const c=fakeAudioContext();let finish;const pending=new Promise(resolve=>finish=resolve);let signal;
  c.decodeAudioData=async()=>c.createBuffer(1,22050,22050);
  const sound=new Soundscape(()=>c,async(_,s)=>{signal=s;await pending;return new ArrayBuffer(8);});
  await sound.unlock();const count=c.sources.length;sound.dispose();finish();await sound.recordingLoad;
  assert.equal(signal.aborted,true);assert.equal(sound.recordings.size,0);assert.equal(c.sources.length,count);
});

test('desktop and XR panels duck audio while sound settings remain at the actual selected level',()=>{
  const old=globalThis.document;globalThis.document={body:{dataset:{audioReading:'true'}}};
  try {
    const reading=[],scene=Object.create(BroadStreetScene.prototype);
    Object.assign(scene,{sound:{setLocation(){},setReading(v){reading.push(v);},update(){}},
      gameState:{getCurrentLocation:()=>({id:'snow-desk'})},renderer:{xr:{isPresenting:false}},
      camera:new THREE.PerspectiveCamera(),soundPosition:new THREE.Vector3(),soundForward:new THREE.Vector3(),
      soundUp:new THREE.Vector3(),controllerWorldQuaternion:new THREE.Quaternion(),courtyard:{group:{visible:true}},canUseDesktopMovement:()=>false});
    scene.updateSound();assert.equal(reading.at(-1),true);
    document.body.dataset.audioReading='false';scene.updateSound();assert.equal(reading.at(-1),false);
    scene.renderer.xr.isPresenting=true;scene.vrPanelVisible=true;scene.vrPanelMode='notebook';scene.updateSound();assert.equal(reading.at(-1),true);
    scene.vrPanelMode='sound';scene.updateSound();assert.equal(reading.at(-1),false);
    scene.vrPanelVisible=false;scene.updateSound();assert.equal(reading.at(-1),false);
  } finally {globalThis.document=old;}
});

test('shipped recordings have source credits, verified checksums and a bounded mono PCM budget',async()=>{
  const {createHash}=await import('node:crypto');
  const manifest=JSON.parse(await readFile('public/audio/sources.json','utf8'));
  assert.deepEqual(new Set(manifest.map(x=>x.file)),new Set(Object.values(clipGroups).flat().map(x=>x+'.wav')));
  let bytes=0,seconds=0;
  for(const item of manifest) {
    const data=await readFile('public/audio/'+item.file);bytes+=data.length;seconds+=item.seconds;
    assert.equal(createHash('sha256').update(data).digest('hex'),item.sha256);
    assert.match(item.source,/^https:\/\/(kenney.nl|commons.wikimedia.org)\//);assert.ok(item.author&&item.changes);
    assert.ok(['CC0-1.0','CC-BY-4.0'].includes(item.license));
    assert.equal(data.toString('ascii',0,4),'RIFF');assert.equal(data.toString('ascii',8,12),'WAVE');
    assert.equal(data.readUInt16LE(20),1);assert.equal(data.readUInt16LE(22),1);assert.equal(data.readUInt32LE(24),22050);
    assert.equal(data.readUInt16LE(34),16);
    let peak=0;for(let i=44;i<data.length;i+=2)peak=Math.max(peak,Math.abs(data.readInt16LE(i)));
    assert.ok(peak>0&&peak<32768);
  }
  assert.ok(bytes<1024*1024);assert.ok(seconds<24);
  const credits=await readFile('public/audio/credits.html','utf8');
  assert.match(credits,/Monika Widzicka/);assert.match(credits,/creativecommons.org\/licenses\/by\/4.0/);
});

const {VrShortcutTracker,VrWalking,leftStick,controllerButtons,adjustViewerHeight,setViewerEyeHeight}=await load('walkable/VrInput');
function xrController(hand='left',profile='oculus-touch-v3') {
  return {handedness:hand,profiles:[profile],gamepad:{mapping:'xr-standard',axes:[0,0,0,0],
    buttons:Array.from({length:7},()=>({pressed:false,value:0,touched:false}))}};
}
test('controller face shortcuts follow known profiles and do not assume two extra buttons',()=>{
  const source=xrController();assert.equal(controllerButtons(source).primary.index,4);
  assert.equal(controllerButtons(source).secondary.label,'Y');
  source.gamepad.buttons.length=5;assert.equal(controllerButtons(source).secondary,undefined);
  source.profiles=['unknown'];assert.deepEqual(controllerButtons(source),{});
  source.profiles=['microsoft-mixed-reality'];assert.deepEqual(controllerButtons(source),{});
  source.profiles=['valve-index'];assert.equal(controllerButtons(source).primary.index,4);assert.equal(controllerButtons(source).secondary,undefined);
  source.gamepad.mapping='';assert.deepEqual(controllerButtons(source),{});
  source.gamepad.mapping='xr-standard';source.hand={};assert.deepEqual(controllerButtons(source),{});
});
test('controller shortcuts fire once per press, preserve handedness and ignore held reconnect/resume buttons',()=>{
  const tracker=new VrShortcutTracker(),left=xrController(),right=xrController('right');
  tracker.update(left,true);tracker.update(right,true);
  left.gamepad.buttons[4].pressed=true;assert.deepEqual(tracker.update(left,true),['map']);
  assert.deepEqual(tracker.update(left,true),[]);left.gamepad.buttons[4].pressed=false;tracker.update(left,true);
  left.gamepad.buttons[5].pressed=true;assert.deepEqual(tracker.update(left,true),['notebook']);
  right.gamepad.buttons[4].pressed=true;assert.deepEqual(tracker.update(right,true),['height']);
  right.gamepad.buttons[5].pressed=true;assert.deepEqual(tracker.update(right,true),['settings']);
  tracker.forget(right);assert.deepEqual(tracker.update(right,true),[]);
  tracker.clear();assert.deepEqual(tracker.update(left,false),[]);assert.deepEqual(tracker.update(left,true),[]);
});
test('left-stick walking has a deadzone, rejects nonstandard/nonfinite input and caps diagonal speed',()=>{
  const left=xrController();left.gamepad.axes=[0,0,.1,.1];assert.equal(leftStick(left).length(),0);
  left.gamepad.axes=[0,0,1,-1];assert.ok(Math.abs(leftStick(left).length()-1)<1e-10);
  left.gamepad.axes[2]=NaN;assert.equal(leftStick(left).length(),0);
  left.gamepad.axes=[0,0,0,-1];left.handedness='right';assert.equal(leftStick(left).length(),0);
  left.handedness='left';left.gamepad.mapping='';assert.equal(leftStick(left).length(),0);
});
test('VR walking is head-relative and horizontal, clamps paused frames and waits for center after menus',()=>{
  const walking=new VrWalking(),pos=new THREE.Vector3(0,1.1,0),forward=new THREE.Vector3(1,.5,0);
  const stick=new THREE.Vector2(0,-1),zero=new THREE.Vector2();
  assert.deepEqual(walking.update(pos,forward,stick,1,true,()=>true),pos);
  walking.update(pos,forward,zero,.016,true,()=>true);
  const moved=walking.update(pos,forward,stick,10,true,()=>true);
  assert.ok(Math.abs(moved.x-.0675)<1e-10);assert.equal(moved.y,1.1);assert.equal(moved.z,0);
  assert.deepEqual(walking.update(pos,forward,stick,.016,false,()=>true),pos);
  assert.deepEqual(walking.update(pos,forward,stick,.016,true,()=>true),pos);
  walking.update(pos,forward,zero,.016,true,()=>true);
  assert.ok(walking.update(pos,forward,stick,.016,true,()=>true).x>0);
  assert.deepEqual(walking.update(pos,forward,stick,NaN,true,()=>true),pos);
});
test('VR movement respects swept furniture collision and slides along clear axes',async()=>{
  const {WalkableArea}=await load('walkable/WalkableArea');
  const area=new WalkableArea({minX:-2,maxX:2,minZ:-2,maxZ:2},[{minX:.02,maxX:1,minZ:-.5,maxZ:.5}]);
  const walking=new VrWalking(),pos=new THREE.Vector3(0,1.62,0),forward=new THREE.Vector3(0,0,-1);
  walking.update(pos,forward,new THREE.Vector2(),0,true,area.canWalkBetween);
  const next=walking.update(pos,forward,new THREE.Vector2(1,-1).normalize(),.05,true,area.canWalkBetween);
  assert.equal(next.x,0);assert.ok(next.z<0);assert.equal(next.y,1.62);
});
test('height changes calibrate a seated viewer, preserve tracking and controller alignment, and remain bounded',()=>{
  const rig=new THREE.Group(),camera=new THREE.PerspectiveCamera(),controller=new THREE.Group();
  camera.position.set(.4,1.05,.2);controller.position.set(.6,.7,0);rig.add(camera,controller);
  const separation=camera.getWorldPosition(new THREE.Vector3()).sub(controller.getWorldPosition(new THREE.Vector3()));
  setViewerEyeHeight(rig,camera,1.62);assert.ok(Math.abs(camera.getWorldPosition(new THREE.Vector3()).y-1.62)<1e-10);
  assert.ok(camera.getWorldPosition(new THREE.Vector3()).sub(controller.getWorldPosition(new THREE.Vector3())).distanceTo(separation)<1e-10);
  camera.position.y+=.12;rig.updateMatrixWorld(true);assert.ok(Math.abs(camera.getWorldPosition(new THREE.Vector3()).y-1.74)<1e-10);
  const offset=rig.position.y;teleportViewer(rig,camera,new THREE.Vector3(4,0,5));turnViewer(rig,camera,.6);assert.equal(rig.position.y,offset);
  setViewerEyeHeight(rig,camera,1.15);assert.ok(Math.abs(camera.getWorldPosition(new THREE.Vector3()).y-1.15)<1e-10);
  assert.equal(adjustViewerHeight(rig,100),1.4);assert.equal(adjustViewerHeight(rig,-100),-.8);
  assert.equal(adjustViewerHeight(rig,NaN),-.8);assert.equal(adjustViewerHeight(rig,.8),0);
});
test('left stick cannot snap-turn, right stick turns once until released',()=>{
  const scene=Object.create(BroadStreetScene.prototype),left=xrController(),right=xrController('right');
  const lc=new THREE.Group(),rc=new THREE.Group();let turns=0;
  Object.assign(scene,{vrControllers:[lc,rc],vrInputSources:new Map([[lc,left],[rc,right]]),snapTurnLocked:false,
    courtyard:{group:{visible:true}},turnWalkableView(){turns++;}});
  left.gamepad.axes[2]=1;scene.updateSnapTurn();assert.equal(turns,0);
  right.gamepad.axes[2]=1;scene.updateSnapTurn();scene.updateSnapTurn();assert.equal(turns,1);
  right.gamepad.axes[2]=0;scene.updateSnapTurn();right.gamepad.axes[2]=-1;scene.updateSnapTurn();assert.equal(turns,2);
});
test('face shortcuts open/close utilities without clearing the current conversation answer',()=>{
  const game=fieldGame(true);game.travelToLocation('brewery');game.inspectHotspot('broad-street-brewery');game.askQuestion('brewery-drink-question');
  const answer=game.getActiveDialogueAnswer(),scene=Object.create(BroadStreetScene.prototype);
  Object.assign(scene,{gameState:game,vrPanelVisible:false,vrPanelMode:'home',getDefaultVrStatus:()=>'',
    showVrPanel(){this.vrPanelVisible=true;},hideVrPanel(timer,preserve){assert.equal(preserve,true);this.vrPanelVisible=false;}});
  for(const mode of ['map','notebook','settings']) {
    scene.openVrShortcut(mode);assert.equal(scene.vrPanelMode,mode);assert.equal(scene.vrPanelVisible,true);
    scene.openVrShortcut(mode);assert.equal(scene.vrPanelVisible,false);assert.deepEqual(game.getActiveDialogueAnswer(),answer);
  }
  const source=xrController('right');source.gamepad.buttons[4].pressed=true;
  assert.deepEqual(scene.getVrPaginationButtonState(source),{nextPagePressed:false,previousPagePressed:false});
  source.gamepad.buttons[3].pressed=true;assert.equal(scene.getVrPaginationButtonState(source).nextPagePressed,true);
});
test('compact menus retain fallback actions, have smaller surfaces, and keep all targets inside the panel',()=>{
  const scene=Object.create(BroadStreetScene.prototype),game=new GameState(),commands=[];
  Object.assign(scene,{gameState:game,vrPanelVisible:true,vrPanel:{visible:true},vrPanelDrawCommands:[],vrInputSources:new Map(),
    vrHeightOffset:0,vrStandingView:false,vrStatus:'',vrWalkingEnabled:true,clearVrPanel(){commands.length=0;},addVrPanelSurface(){},
    addVrText(text,x,y,width,height){commands.push({text,x,y,width,height});},
    addVrPanelButton(text,x,y,width,height,action){commands.push({text,x,y,width,height,action});},
    addVrIconButton(text,x,y,size,action){commands.push({text,x,y,width:size,height:size,action});}});
  for(const mode of ['home','settings','height','controls']) {
    scene.vrPanelMode=mode;scene.rebuildVrPanel();assert.ok(scene.vrSurfaceHeight<2.05);
    for(const command of commands)assert.ok(Math.abs(command.y)+command.height/2<=scene.vrSurfaceHeight/2,`${mode}: ${command.text}`);
    if(mode==='home')for(const target of ['map','notebook','settings'])assert.ok(commands.some(c=>c.action?.mode===target));
    if(mode==='settings')assert.ok(commands.some(c=>c.action?.type==='exit-vr'));
    if(mode==='height')for(const action of ['height-adjust','height-toggle','height-reset'])assert.ok(commands.some(c=>c.action?.type===action));
  }
});
test('Exit VR ends only the XR session, suppresses duplicate requests and offers retry after failure',async()=>{
  const game=fieldGame(true),scene=Object.create(BroadStreetScene.prototype);let ends=0,finish;
  const waiting=new Promise(resolve=>finish=resolve),session={end:()=>{ends++;return waiting;}};
  Object.assign(scene,{gameState:game,renderer:{xr:{getSession:()=>session}},vrExitPending:false,markVrPanelDirty(){}});
  const count=game.getCollectedEvidence().length;
  const first=scene.exitVr();await scene.exitVr();assert.equal(ends,1);finish();await first;assert.equal(game.getCollectedEvidence().length,count);
  scene.vrExitPending=false;session.end=async()=>{throw new Error('runtime refused');};await scene.exitVr();
  assert.equal(scene.vrExitPending,false);assert.match(scene.vrStatus,/Could not exit VR/);
});

test('leaving VR restores desktop eye height and clears transient controller state without resetting progress',()=>{
  const old=globalThis.document;globalThis.document={body:{dataset:{}}};
  try {
    const rig=new THREE.Group(),camera=new THREE.PerspectiveCamera();rig.add(camera);rig.position.y=.5;
    const scene=Object.create(BroadStreetScene.prototype);let applied=0;
    Object.assign(scene,{playerRig:rig,camera,vrHeightOffset:.5,vrStandingView:true,vrExitPending:true,
      vrWalking:new VrWalking(),vrShortcuts:new VrShortcutTracker(),vrControllerButtonStates:new Map(),
      destinationLabels:[],hideVrPanel(){},applyCurrentLocation(){applied++;}});
    scene.handleVrSessionEnd();assert.equal(rig.position.y,0);assert.equal(camera.position.y,1.62);
    assert.equal(scene.vrHeightOffset,0);assert.equal(scene.vrStandingView,false);assert.equal(scene.vrExitPending,false);
    assert.equal(document.body.dataset.xrPresenting,'false');assert.equal(applied,1);
  } finally {globalThis.document=old;}
});

const { OutsidePanelDismiss } = await load('ui/OutsidePanelDismiss');
function pointerEvent(type,x=20,y=20,extra={}) {
  const event=new Event(type,{bubbles:true,cancelable:true});
  for(const [key,value] of Object.entries({clientX:x,clientY:y,button:0,isPrimary:true,pointerId:1,detail:type==='click'?1:0,pointerType:'mouse',...extra}))
    Object.defineProperty(event,key,{value});
  return event;
}
function outsidePanelFixture(run) {
  const oldDocument=globalThis.document,oldWindow=globalThis.window;
  const doc=new EventTarget(),win=new EventTarget();globalThis.document=doc;globalThis.window=win;
  const panel={getBoundingClientRect:()=>({left:100,right:300,top:100,bottom:300})};
  const state={panel,enabled:true,closed:0,background:0};
  const root={querySelector:()=>state.panel};
  new OutsidePanelDismiss(root,()=>state.enabled,()=>{state.closed++;state.panel=null;});
  doc.addEventListener('click',()=>{state.background++;});
  const send=(type,x=20,y=20,extra={})=>{const event=pointerEvent(type,x,y,extra);doc.dispatchEvent(event);return event;};
  const click=(x=20,y=20,extra={})=>{send('pointerdown',x,y,extra);send('pointerup',x,y,extra);return send('click',x,y,extra);};
  try {run({state,send,click,doc,win,panel});}
  finally {globalThis.document=oldDocument;globalThis.window=oldWindow;}
}

test('outside primary click dismisses once and consumes the background action',()=>outsidePanelFixture(({state,click,send})=>{
  const event=click();assert.equal(state.closed,1);assert.equal(state.background,0);assert.equal(event.defaultPrevented,true);
  send('click');assert.equal(state.closed,1,'a gesture cannot dismiss twice');
}));

test('panel edges, text and internal controls retain normal clicks',()=>outsidePanelFixture(({state,click})=>{
  for(const point of [[100,100],[300,300],[200,220]])assert.equal(click(...point).defaultPrevented,false);
  assert.equal(state.closed,0);assert.equal(state.background,3,'inside clicks propagate to panel controls');
}));

test('outside drags including out-and-back motion do not close or activate background controls',()=>outsidePanelFixture(({state,send})=>{
  send('pointerdown');send('pointermove',50,20);send('pointermove',20,20);send('pointerup');send('click');
  assert.equal(state.closed,0);assert.equal(state.background,0);
  send('pointerdown');send('pointerup',60,20);send('click',60,20);
  assert.equal(state.closed,0,'release displacement counts even without a move event');
}));

test('small pointer jitter permits a click but crossing the panel boundary does not',()=>outsidePanelFixture(({state,send})=>{
  send('pointerdown',102,200);send('pointerup',99,200);send('click',99,200);
  assert.equal(state.closed,0,'press inside then release outside is not dismissal');
  send('pointerdown',99,200);send('pointerup',102,200);send('click',102,200);
  assert.equal(state.closed,0,'touch capture must still respect release coordinates');
  send('pointerdown',20,20);send('pointermove',22,21);send('pointerup',23,21);send('click',23,21);
  assert.equal(state.closed,1);
}));

test('cancelled, non-primary, secondary and keyboard clicks never dismiss',()=>outsidePanelFixture(({state,send,click,win,doc})=>{
  click(20,20,{button:2});click(20,20,{isPrimary:false});click(20,20,{detail:0});
  send('pointerdown');send('pointercancel');send('pointerup');send('click');
  send('pointerdown');win.dispatchEvent(new Event('blur'));send('pointerup');send('click');
  send('pointerdown');doc.dispatchEvent(new Event('visibilitychange'));send('pointerup');send('click');
  send('pointerdown');send('pointerdown',30,20,{pointerId:2,isPrimary:false});send('pointerup');send('click');
  assert.equal(state.closed,0);
}));

test('opening clicks and stale gestures cannot dismiss a new panel; transition and XR gates are respected',()=>outsidePanelFixture(({state,send,click,panel})=>{
  state.panel=null;send('pointerdown');state.panel=panel;send('pointerup');send('click');
  assert.equal(state.closed,0,'opening pointerdown predates the dialog');
  send('pointerdown');state.panel={...panel};send('pointerup');send('click');assert.equal(state.closed,0);
  state.enabled=false;click();assert.equal(state.closed,0);
  state.enabled=true;send('pointerdown');send('pointerup');send('click',20,20,{pointerId:2});assert.equal(state.closed,0);
}));

test('desktop dragging still turns while a panel is open without selecting scenery',()=>{
  const oldDocument=globalThis.document,oldWindow=globalThis.window;
  const doc=new EventTarget();doc.body={dataset:{overlayOpen:'true'}};globalThis.document=doc;globalThis.window=new EventTarget();
  const canvas=new EventTarget();let captured=false,focused=0,turned=0,selected=0;
  canvas.focus=()=>focused++;canvas.setPointerCapture=()=>{captured=true;};canvas.hasPointerCapture=()=>captured;canvas.releasePointerCapture=()=>{captured=false;};
  const scene=Object.create(BroadStreetScene.prototype);
  Object.assign(scene,{canvas,renderer:{xr:{isPresenting:false,getController:()=>new THREE.Group(),addEventListener:()=>{}}},
    playerRig:new THREE.Group(),vrControllers:[],vrControllerPointers:[],yaw:0,pitch:0,pointerTravel:0,dragging:false,
    applyCameraOrientation:()=>turned++,pickHotspot:()=>({id:'test'}),onHotspotActivate:()=>selected++});
  try {
    scene.addInputHandlers();
    for(const [type,x] of [['pointerdown',20],['pointermove',80],['pointerup',80],['click',80]])canvas.dispatchEvent(pointerEvent(type,x,20));
    assert.equal(turned,1);assert.ok(scene.yaw>0);assert.equal(selected,0);assert.equal(focused,0,'dialog keeps keyboard focus during camera drag');
    doc.body.dataset.overlayOpen='false';
    for(const type of ['pointerdown','pointerup','click'])canvas.dispatchEvent(pointerEvent(type,80,20));
    assert.equal(selected,1,'a subsequent scene click works normally');assert.equal(focused,1);
  } finally {globalThis.document=oldDocument;globalThis.window=oldWindow;}
});

test('VR outside selects dismiss without travel, while panel-to-world drags and large ray motion do not',()=>{
  const scene=Object.create(BroadStreetScene.prototype),controller=new THREE.Group(),game=fieldGame(true);
  game.travelToLocation('household');game.inspectHotspot('broad-street-household');game.askQuestion('household-water-question');
  const count=game.getCollectedEvidence().length;let inside=false,hidden=0,world=0;
  Object.assign(scene,{gameState:game,vrPanelVisible:true,vrSelectionStarts:new Map(),controllerRaycaster:new THREE.Raycaster(),
    pickVrPanel:()=>inside?{}:undefined,pickVrButton:()=>undefined,setRaycasterFromController:()=>{},
    hideVrPanel:()=>{hidden++;scene.vrPanelVisible=false;},pickWorldTravelHit:()=>{world++;}});
  inside=true;scene.beginVrSelection(controller);inside=false;scene.selectFromVrController(controller);
  assert.equal(hidden,0,'dragging off panel leaves it open');
  scene.beginVrSelection(controller);scene.controllerRaycaster.ray.origin.x=.1;scene.selectFromVrController(controller);
  assert.equal(hidden,0,'large hand displacement is not a click');
  scene.beginVrSelection(controller);scene.controllerRaycaster.ray.direction.set(.2,0,-1).normalize();scene.selectFromVrController(controller);
  assert.equal(hidden,0,'large aim change is not a click');
  scene.beginVrSelection(controller);scene.selectFromVrController(controller);
  assert.equal(hidden,1);assert.equal(world,0);assert.equal(game.getActiveDialogue(),undefined);
  assert.equal(game.getCollectedEvidence().length,count,'closing retains collected evidence');
});

const { DesktopKeyboard } = await load('ui/DesktopKeyboard');
test('panel focus stays contained while canvas pointer input remains available; dismissal restores scene focus',()=>{
  const old={document:globalThis.document,window:globalThis.window,HTMLElement:globalThis.HTMLElement};
  class Element {
    dataset={};attributes={};inert=false;
    setAttribute(name,value){this.attributes[name]=value;}
    removeAttribute(name){delete this.attributes[name];}
    getAttribute(name){return this.attributes[name];}
    getClientRects(){return [{}];}
    focus(){globalThis.document.activeElement=this;}
    querySelectorAll(){return [];}
  }
  globalThis.HTMLElement=Element;globalThis.window=new EventTarget();
  const scene=new Element(),button=new Element(),panel=new Element(),rail=new Element();
  button.dataset.action='ask';panel.attributes['aria-label']='Interview';panel.querySelectorAll=()=>[button];
  let open=true;const root={querySelector:selector=>selector==='.hud'?{children:[rail,panel]}:open?panel:null};
  globalThis.document={body:{dataset:{}},activeElement:scene};
  try {
    const keys=new DesktopKeyboard(root,scene,()=>false);keys.afterRender();
    assert.equal(scene.inert,false);assert.equal(scene.attributes['aria-hidden'],'true');
    assert.equal(rail.inert,true);assert.equal(globalThis.document.activeElement,button);
    const tab=new Event('keydown',{cancelable:true});Object.defineProperty(tab,'key',{value:'Tab'});
    globalThis.window.dispatchEvent(tab);assert.equal(tab.defaultPrevented,true);assert.equal(globalThis.document.activeElement,button);
    open=false;keys.afterRender();assert.equal(globalThis.document.activeElement,scene);
    assert.equal(scene.attributes['aria-hidden'],undefined);assert.equal(rail.inert,false);
  } finally {Object.assign(globalThis,old);}
});
