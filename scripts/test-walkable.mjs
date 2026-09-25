import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { test } from "node:test";
import ts from "typescript";
import * as THREE from "three";

// Compile into the ignored dependency cache; no additional test dependency.
const output = resolve("node_modules/.cache/walkable-tests");
for (const name of ["render/BroadStreetScene", "walkable/WalkableArea", "walkable/SnowOffice", "walkable/FurnishedRoom", "walkable/RegistrarRoom", "walkable/HouseholdRoom", "walkable/WorkhouseCourtyard", "walkable/DesktopMovement", "walkable/locomotion", "walkable/PumpCourtyard", "walkable/WorldTravelTargets", "walkable/TravelRoutes", "simulation/gameState", "simulation/content", "simulation/types"]) {
  const source = await readFile(`src/${name}.ts`, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    .replace(/from "(\.\.?\/[^".]+)"/g, 'from "$1.js"');
  await mkdir(resolve(output, name, ".."), { recursive: true });
  await writeFile(resolve(output, `${name}.js`), compiled);
}
for (const name of ["office-layout", "registrar-layout", "household-layout", "workhouse-layout"]) await copyFile(`src/walkable/${name}.json`, resolve(output, `walkable/${name}.json`));
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

test("arrow translation matches WASD, arrow turns rotate without translating", () => {
  const controls = new DesktopMovement();
  const start = new THREE.Vector3();
  controls.press("ArrowUp");
  assert.ok(controls.update(start, 0, 0.05).position.z < 0);
  controls.press("KeyW");
  assert.ok(Math.abs(controls.update(start, 0, 0.05).position.z + 0.1) < 1e-10);
  controls.clear();
  controls.press("ArrowDown");
  assert.ok(controls.update(start, 0, 0.05).position.z > 0);
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
  assert.ok(gltf.materials.some(m => m.name === 'Painted shopfront' && m.pbrMetallicRoughness.baseColorFactor[0] < .1));
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
  const rig=new THREE.Group(),camera=new THREE.PerspectiveCamera();camera.position.y=1.62;rig.add(camera);
  const courtyard=new PumpCourtyard(),office=new SnowOffice(),registrar=new RegistrarRoom(),household=new HouseholdRoom(),workhouse=new WorkhouseCourtyard();
  Object.assign(scene,{gameState:game,playerRig:rig,camera,courtyard,office,registrar,household,workhouse,desktopMovement:new DesktopMovement(),
    travelZones:new TravelZoneTracker(),scene:new THREE.Scene(),panoramaLighting:new THREE.Group(),panoramaSky:new THREE.Group(),
    renderer:{xr:{isPresenting:false}},primeMotionLookReference:()=>{},applyPanorama:()=>{},refreshLocationObjects:()=>{},
    refreshHotspots:()=>{},markVrPanelDirty:()=>{}});
  for(const id of ['snow-desk','broad-street','registrar','household','workhouse','brewery','workhouse','household','broad-street','snow-desk']) {
    game.travelToLocation(id);scene.applyCurrentLocation();
    assert.equal(office.group.visible,id==='snow-desk');assert.equal(courtyard.group.visible,id==='broad-street');assert.equal(registrar.group.visible,id==='registrar');assert.equal(household.group.visible,id==='household');assert.equal(workhouse.group.visible,id==='workhouse');
    assert.equal(scene.panoramaSky.visible,id==='brewery');assert.equal(scene.panoramaLighting.visible,id==='brewery');
    const spawn=id==='snow-desk'?officeSpawn:id==='broad-street'?streetSpawn:id==='registrar'?registrarSpawn:id==='household'?householdSpawn:id==='workhouse'?workhouseSpawn:new THREE.Vector3();
    const viewer=camera.getWorldPosition(new THREE.Vector3());assert.ok(Math.hypot(viewer.x-spawn.x,viewer.z-spawn.z)<1e-10);
    assert.equal(scene.worldTravelPending,false);
  }
});

test('authored office fits a small mesh budget and matches the runtime furniture layout',async()=>{
  const report=JSON.parse(await readFile('assets/snow-office/build-report.json','utf8'));
  assert.deepEqual(report.layout,officeLayout);assert.ok(report.triangles<30000);assert.ok(report.materialBatches<=16);
  const glb=await readFile('public/models/snow-office.glb');assert.equal(glb.readUInt32LE(0),0x46546c67);
  const json=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
  assert.ok(json.meshes.length>0);assert.ok(json.images.every(image=>image.bufferView!==undefined),'textures embedded');
});

const registrarLayout=JSON.parse(await readFile('src/walkable/registrar-layout.json','utf8'));
test('registrar approach and return door are reachable while furniture blocks walking',()=>{
  const zone=returnTravelRoutes.find(r=>r.id==='registrar-return').zone;
  assert.ok(registrarArea.canWalkBetween(registrarSpawn,new THREE.Vector3(0,0,.8)));
  assert.ok(registrarArea.canWalkBetween(registrarSpawn,new THREE.Vector3(zone.x,0,zone.z)));
  assert.ok(Math.hypot(registrarSpawn.x-zone.x,registrarSpawn.z-zone.z)>zone.radius+.5);
  for(const f of registrarLayout.furniture) assert.equal(registrarArea.isValidDestination(new THREE.Vector3(f.x,0,f.z)),false,f.id);
  assert.equal(registrarArea.canWalkBetween(new THREE.Vector3(-1.7,0,-.4),new THREE.Vector3(1.7,0,-.4)),false,'no cutting through table');
  assert.equal(registrarArea.canWalkBetween(new THREE.Vector3(-2.8,0,-2.05),new THREE.Vector3(2.8,0,-2.05)),false,'no cutting through counter');
  const keys=new DesktopMovement();keys.press('w');let p=new THREE.Vector3(0,1.62,1);
  for(let i=0;i<80;i++) p=keys.update(p,0,.05,registrarArea.canWalkBetween).position;
  assert.ok(p.z>=.45 && p.z<.6,'stop at ledger table');
});

test('registrar ledger, label, floor and return door have unobstructed intended ray targets',()=>{
  const room=new RegistrarRoom();room.group.visible=true;const game=fieldGame();game.travelToLocation('registrar');
  const targets=new WorldTravelTargets(()=>new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));targets.refresh(game);
  const from=registrarSpawn.clone().setY(1.62);const ray=new THREE.Raycaster();
  for(const y of [.82,1.35]) {
    ray.set(from,new THREE.Vector3(0,y,-.4).sub(from).normalize());
    const hit=room.pick(ray);assert.equal(room.hotspotFor(hit.object),'registrar-ledger');assert.equal(room.canTeleport(hit),false);
  }
  ray.set(new THREE.Vector3(2.1,1.3,2.5),new THREE.Vector3(0,0,1));
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
