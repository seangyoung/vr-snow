import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { test } from "node:test";
import ts from "typescript";
import * as THREE from "three";

// Compile into the ignored dependency cache; no additional test dependency.
const output = resolve("node_modules/.cache/walkable-tests");
for (const name of ["render/PanelDepthLayers", "render/DayTransition", "walkable/StreetBoundary", "walkable/ControllerVisuals", "walkable/ObjectInspection", "walkable/InteractionIdleHint", "simulation/streetPopulation", "walkable/WorkhousePump", "simulation/campaign", "simulation/campaignConversations", "simulation/fieldwork", "walkable/AdditionalHousehold", "walkable/PumpSurveyStop", "walkable/BoardRoom", "simulation/conversations", "walkable/CharacterIdle", "walkable/InspectableProps", "walkable/PumpAction", "ui/createUi", "ui/DesktopKeyboard", "ui/OutsidePanelDismiss", "render/BroadStreetScene", "walkable/WalkableArea", "walkable/SnowOffice", "walkable/SnowCharacter", "walkable/SceneCharacters", "walkable/StreetNewspaper", "audio/Soundscape", "audio/ambience", "walkable/FurnishedRoom", "walkable/BakedRoomLighting", "walkable/RegistrarRoom", "walkable/HouseholdRoom", "walkable/WorkhouseCourtyard", "walkable/ManufactoryRoom", "walkable/BreweryRoom", "walkable/DesktopMovement", "walkable/locomotion", "walkable/VrInput", "walkable/PumpCourtyard", "walkable/WorldTravelTargets", "walkable/TravelRoutes", "simulation/gameState", "simulation/content", "simulation/types"]) {
  const source = await readFile(`src/${name}.ts`, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    .replace(/from (["'])(\.\.?\/[^"'.]+)\1/g, 'from "$2.js"');
  await mkdir(resolve(output, name, ".."), { recursive: true });
  await writeFile(resolve(output, `${name}.js`), compiled);
}
await copyFile("src/simulation/route-data.json", resolve(output, "simulation/route-data.json"));
for (const name of ["manufactory-layout", "portable-props", "household-routines-layout", "household-away-layout", "board-layout", "controller-buttons", "scene-characters", "office-layout", "registrar-layout", "household-layout", "workhouse-layout", "brewery-layout"]) await copyFile(`src/walkable/${name}.json`, resolve(output, `walkable/${name}.json`));
await writeFile(resolve(output, "package.json"), '{"type":"module"}');
const load = (name) => import(pathToFileURL(resolve(output, `${name}.js`)).href);
const { teleportViewer, turnViewer, standardTurnAxis } = await load("walkable/locomotion");
const { DesktopMovement } = await load("walkable/DesktopMovement");
const { PumpCourtyard, isValidDestination, canWalkBetween, pumpPosition, streetSpawn } = await load("walkable/PumpCourtyard");
const { GameState } = await load("simulation/gameState");
const {surveyRoutes}=await load("simulation/fieldwork");
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

test("pump inspection waits for day two and rewards once across revisits", () => {
 const early=fieldGame();assert.equal(early.inspectHotspot('broad-street-pump').dialogue,undefined);
 const game=gameAtDay(2);game.travelToLocation('broad-street');game.recordPumpedWater('broad-street');game.inspectHotspot('broad-street-pump');
 const count=game.getCollectedEvidence().length;finishConversation(game);assert.ok(game.hasEvidence('pump-water-inspection'));
 talk(game,'snow-desk','john-snow');talk(game,'broad-street','broad-street-pump');
 assert.equal(game.getCollectedEvidence().length,count+1);game.reset();assert.equal(game.hasEvidence('pump-water-inspection'),false);
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
function finishConversation(game, branch=0) {
  for(let i=0;i<40;i++) {const view=game.getConversationView();if(!view || view.complete)return;const c=view.choices[Math.min(branch,view.choices.length-1)];assert.ok(c,'conversation has a path forward');game.chooseConversation(view.beatId,c.id);}
  assert.fail('conversation did not terminate');
}
function talk(game,location,hotspot,branch=0) {if(game.currentLocationId!==location)assert.ok(game.travelToLocation(location).traveled);if(hotspot==='broad-street-pump'||hotspot==='workhouse-pump')game.recordPumpedWater(location);game.inspectHotspot(hotspot);finishConversation(game,branch);game.closeDialogue();}
function beginDay(game) {game.dismissDayIntroduction();talk(game,'snow-desk','john-snow');}
function finishDay(game) {talk(game,'snow-desk','john-snow');assert.ok(game.endDay());beginDay(game);}
function gameAtDay(day, beforeMap=false) {
 const game=new GameState();beginDay(game);
 if(day>=2){talk(game,'registrar','registrar-ledger');talk(game,'household','broad-street-household');finishDay(game);}
 if(day>=3){talk(game,'broad-street','broad-street-pump');talk(game,'household-routines','routines-household');talk(game,'workhouse','poland-workhouse');talk(game,'manufactory','manufactory-worker');finishDay(game);}
 if(day===3 && !beforeMap)completeSurvey(game);
 return game;
}
function fieldGame(unlocked=false) {const game=gameAtDay(unlocked?3:1);game.travelToLocation('broad-street');return game;}

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
  assert.ok(game.travelToLocation('household').traveled);
  for(const id of ['brewery','workhouse','household-routines','household-away','marlborough-pump','rupert-pump']) assert.equal(game.travelToLocation(id).traveled,false);
  const unlocked=fieldGame(true);
  for(const route of streetTravelRoutes) assert.equal(unlocked.canTravelToLocation(route.to),!['household','household-routines','registrar','workhouse','manufactory'].includes(route.to));
  assert.equal(unlocked.canTravelToLocation('board-room'),false);
  assert.ok(returnTravelRoutes.every(r=>r.to==='broad-street'||r.to==='snow-desk'));
  assert.equal(unlocked.getLocation('household').title,'Household 1');
  assert.ok(unlocked.getLocation('household').mapPoint.y<unlocked.getLocation('broad-street').mapPoint.y);
});

test('target picking respects building occlusion, active scene, and marked household door',()=>{
  const game=fieldGame();const street=new PumpCourtyard();street.group.visible=true;
  const targets=new WorldTravelTargets(()=>new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));targets.refresh(game);
  const ray=new THREE.Raycaster(new THREE.Vector3(-11,1.3,-6),new THREE.Vector3(0,0,-1));
  let hit=targets.pick(ray,'broad-street',street.pick(ray));
  assert.equal(targets.routeFor(hit.object).to,'household');
  targets.refresh(fieldGame(true));
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
  const game=new GameState(), office=new SnowOffice(), courtyard=new PumpCourtyard();office.group.visible=true;game.dismissDayIntroduction();
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
  game.inspectHotspot('john-snow');finishConversation(game);scene.updateWorldTravelZones();assert.equal(game.getCurrentLocation().id,'snow-desk','unlock while inside does not travel');
  teleportViewer(rig,camera,officeSpawn);scene.updateWorldTravelZones();
  teleportViewer(rig,camera,new THREE.Vector3(zone.x,0,zone.z));scene.updateWorldTravelZones();
  assert.equal(game.getCurrentLocation().id,'broad-street');
});

test('all walkable rooms restore scene geometry, lighting and arrival',async()=>{
  const {BoardRoom}=await load('walkable/BoardRoom');
  const board=new BoardRoom();board.loadVisuals=async()=>{};board.characters.loadVisuals=async()=>{};
  const game=reviewGame(),scene=Object.create(BroadStreetScene.prototype);
  for (const [location,hotspot,questions] of [
    ['household','broad-street-household',['household-water-question','household-pattern-question']],
    ['workhouse','poland-workhouse',['workhouse-water-question']],
    ['brewery','broad-street-brewery',['brewery-drink-question']],
  ]) {
    game.travelToLocation(location);game.inspectHotspot(hotspot);finishConversation(game);
  }
  game.travelToLocation('snow-desk');game.selectHypothesis('waterborne');
  assert.ok(game.prepareBoardArgument().prepared);
  const rig=new THREE.Group(),camera=new THREE.PerspectiveCamera();camera.position.y=1.62;rig.add(camera);
  const courtyard=new PumpCourtyard(),office=new SnowOffice(),registrar=new RegistrarRoom(),household=new HouseholdRoom(),workhouse=new WorkhouseCourtyard(),brewery=new BreweryRoom();
  for(const room of [courtyard,registrar,household,workhouse,brewery])room.characters.loadVisuals=async()=>{};
  Object.assign(scene,{gameState:game,playerRig:rig,camera,courtyard,office,registrar,household,workhouse,brewery,board,desktopMovement:new DesktopMovement(),
    travelZones:new TravelZoneTracker(),scene:new THREE.Scene(),panoramaLighting:new THREE.Group(),panoramaSky:new THREE.Group(),
    renderer:{xr:{isPresenting:false}},primeMotionLookReference:()=>{},applyPanorama:()=>{},refreshLocationObjects:()=>{},
    refreshHotspots:()=>{},markVrPanelDirty:()=>{}});
  for(const id of ['snow-desk','broad-street','registrar','household','workhouse','brewery','board-room','brewery','workhouse','household','broad-street','snow-desk']) {
    if(id==='board-room') assert.ok(game.presentToBoard().accepted);
    else { game.stage='field'; game.currentLocationId=id; } // Geometry/arrival test; day travel gates are tested separately.
    scene.applyCurrentLocation();
    assert.equal(office.group.visible,id==='snow-desk');assert.equal(courtyard.group.visible,id==='broad-street');assert.equal(registrar.group.visible,id==='registrar');assert.equal(household.group.visible,id==='household');assert.equal(workhouse.group.visible,id==='workhouse');assert.equal(brewery.group.visible,id==='brewery');
    assert.equal(board.group.visible,id==='board-room');assert.equal(scene.panoramaSky.visible,false);assert.equal(scene.panoramaLighting.visible,false);
    const spawn=id==='snow-desk'?officeSpawn:id==='broad-street'?streetSpawn:id==='registrar'?registrarSpawn:id==='household'?householdSpawn:id==='workhouse'?workhouseSpawn:id==='brewery'?brewerySpawn:board.spawn;
    const viewer=camera.getWorldPosition(new THREE.Vector3());assert.ok(Math.hypot(viewer.x-spawn.x,viewer.z-spawn.z)<1e-10);
    assert.equal(scene.worldTravelPending,false);
    scene.renderer.xr.isPresenting=true;scene.vrHeightOffset=.47;
    scene.applyCurrentLocation();assert.equal(rig.position.y,.47,`${id}: retain the seated height correction`);
    scene.renderer.xr.isPresenting=false;scene.applyCurrentLocation();assert.equal(rig.position.y,0);
    if(id==='board-room') { game.beginHearing(); finishConversation(game);game.finishBoard(); }
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
  finishConversation(game);assert.ok(game.hasEvidence('attack-timeline'));
  const zone=returnTravelRoutes.find(r=>r.id==='registrar-return').zone;
  scene.vrPanelVisible=true;teleportViewer(rig,camera,new THREE.Vector3(zone.x,0,zone.z));scene.updateWorldTravelZones();
  assert.equal(game.getCurrentLocation().id,'registrar');scene.vrPanelVisible=false;scene.updateWorldTravelZones();
  assert.equal(game.getCurrentLocation().id,'registrar','closing dialogue cannot trigger surprise return');
  teleportViewer(rig,camera,registrarSpawn);scene.updateWorldTravelZones();
  teleportViewer(rig,camera,new THREE.Vector3(zone.x,0,zone.z));scene.updateWorldTravelZones();
  assert.equal(game.getCurrentLocation().id,'snow-desk');assert.ok(game.hasEvidence('attack-timeline'));
  assert.equal(game.hasEvidence('pump-cluster'),false,'recap requires both day-one assignments');
  talk(game,'household','broad-street-household');talk(game,'snow-desk','john-snow');assert.ok(game.hasEvidence('pump-cluster'));
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
  const room=new HouseholdRoom();room.group.visible=true;const game=gameAtDay(1);game.travelToLocation('household');
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

test('household controller interview retains its evidence and returns through the marked exit',()=>{
  const game=gameAtDay(1);game.travelToLocation('household');
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
  finishConversation(game);assert.ok(game.hasEvidence('household-exposure'));
  assert.equal(game.hasEvidence('household-water-pattern'),false,'the second household is a later assignment');
  const zone=returnTravelRoutes.find(r=>r.id==='household-return').zone;
  scene.vrPanelVisible=true;teleportViewer(rig,camera,new THREE.Vector3(zone.x,0,zone.z));scene.updateWorldTravelZones();
  scene.vrPanelVisible=false;scene.updateWorldTravelZones();assert.equal(game.getCurrentLocation().id,'household','closing interview does not trigger travel');
  teleportViewer(rig,camera,householdSpawn);scene.updateWorldTravelZones();
  teleportViewer(rig,camera,new THREE.Vector3(zone.x,0,zone.z));scene.updateWorldTravelZones();
  assert.equal(game.getCurrentLocation().id,'broad-street');assert.ok(game.hasEvidence('household-exposure'));assert.equal(game.hasEvidence('household-water-pattern'),false);
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
  const game=gameAtDay(2);game.travelToLocation('workhouse');
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
  finishConversation(game);assert.ok(game.hasEvidence('workhouse-exception'));
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
  const room=new WorkhouseCourtyard();room.group.visible=true;const game=gameAtDay(2);game.travelToLocation('workhouse');
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
  const well=room.pick(ray);assert.equal(room.canTeleport(well),false);assert.equal(room.hotspotFor(well.object),'workhouse-pump','well offers a separate sample inspection');
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
  controller.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),breweryOwnersTarget.clone().setY(1.55).sub(controller.position).normalize());
  const targets=new WorldTravelTargets(()=>new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));targets.refresh(game);
  const scene=Object.create(BroadStreetScene.prototype);
  Object.assign(scene,{camera,playerRig:rig,courtyard:new PumpCourtyard(),office:new SnowOffice(),registrar:new RegistrarRoom(),household:new HouseholdRoom(),workhouse:new WorkhouseCourtyard(),brewery:room,worldTravel:targets,gameState:game,
    renderer:{xr:{isPresenting:true}},desktopMovement:new DesktopMovement(),controllerRaycaster:new THREE.Raycaster(),
    controllerWorldPosition:new THREE.Vector3(),controllerWorldQuaternion:new THREE.Quaternion(),controllerWorldDirection:new THREE.Vector3(),
    cameraWorldPosition:new THREE.Vector3(),travelZones:new TravelZoneTracker(),vrPanelVisible:false,vrPanelButtons:[],
    hotspotVisuals:new Map(),worldTravelPending:false,hideVrPanel:()=>{},activateVrHotspot:h=>game.inspectHotspot(h.id)});
  scene.selectFromVrController(controller);assert.ok(game.hasInspected('broad-street-brewery'));
  finishConversation(game);assert.ok(game.hasEvidence('brewery-exception'));
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
  const aisle=[[1.1,4.25],[0,3.2],[0,1.1],[0,-.8],[0,-4.8]].map(([x,z])=>new THREE.Vector3(x,0,z));
  for(let i=1;i<aisle.length;i++) assert.ok(breweryArea.canWalkBetween(aisle[i-1],aisle[i]),'clear central floor and route between copper vessels');
  assert.ok(Math.hypot(brewerySpawn.x-zone.x,brewerySpawn.z-zone.z)>zone.radius+.5);
  for(const f of breweryLayout.furniture) assert.equal(breweryArea.isValidDestination(new THREE.Vector3(f.x,0,f.z)),false,f.id);
  assert.equal(breweryArea.canWalkBetween(new THREE.Vector3(2.35,0,-.7),new THREE.Vector3(2.35,0,-4.5)),false,'no crossing the copper between valid endpoints');
  const keys=new DesktopMovement();keys.press('w');let p=new THREE.Vector3(0,1.62,2.2);
  for(let i=0;i<100;i++) p=keys.update(p,0,.05,breweryArea.canWalkBetween).position;
  assert.ok(p.z< -4.8,'the former central table no longer blocks forward movement');
  const room=new BreweryRoom();room.characters.group.userData.characterStatus='ready';
  const approach=new THREE.Vector3(-2.45,0,3.2);
  assert.ok(room.canWalkBetween(brewerySpawn,approach),'clear approach to the owners');
  assert.ok(room.canWalkBetween(approach,new THREE.Vector3(0,0,3.2)),'return to the central floor');
  for(const actor of characterDefinitions.brewery.actors) {
    const destination=new THREE.Vector3(...actor.position);
    assert.equal(room.canWalkBetween(approach,destination),false,'loaded owners cannot be walked through');
  }
});

test('brewery seated and standing rays select owners, floor and door but not equipment as evidence',()=>{
  const room=new BreweryRoom();room.group.visible=true;const game=fieldGame(true);game.travelToLocation('brewery');
  const targets=new WorldTravelTargets(()=>new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));targets.refresh(game);
  const ray=new THREE.Raycaster();
  for(const eyeHeight of [1.15,1.62]) {
    const from=brewerySpawn.clone().setY(eyeHeight);
    for(const y of [1.4,1.65]) {
      ray.set(from,breweryOwnersTarget.clone().setY(y).sub(from).normalize());
      const hit=room.pick(ray);assert.equal(room.hotspotFor(hit.object),'broad-street-brewery');assert.equal(room.canTeleport(hit),false);
    }
    ray.set(from,new THREE.Vector3(0,-1,0));assert.ok(room.canTeleport(room.pick(ray)));
  }
  ray.set(new THREE.Vector3(1.8,1.3,4.25),new THREE.Vector3(0,0,1));
  const hit=targets.pick(ray,'brewery',room.pick(ray));assert.equal(targets.routeFor(hit.object).to,'broad-street');
  ray.set(new THREE.Vector3(2.35,1.62,-.6),new THREE.Vector3(0,-.2,-1).normalize());
  const copper=room.pick(ray);assert.equal(room.canTeleport(copper),false);assert.equal(room.hotspotFor(copper.object),undefined);
  room.characters.group.userData.characterStatus='ready';
  for(const actor of characterDefinitions.brewery.actors)for(const eyeHeight of [1.15,1.62]) {
    const from=brewerySpawn.clone().setY(eyeHeight);
    ray.set(from,new THREE.Vector3(...actor.position).setY(1.4).sub(from).normalize());
    const person=room.pick(ray);
    assert.equal(person.object.name,actor.id);
    assert.equal(room.hotspotFor(person.object),'broad-street-brewery');
  }
  ray.set(new THREE.Vector3(-3.2,1.2,3.45),new THREE.Vector3(-1,-.35,0).normalize());
  const table=room.pick(ray);assert.equal(room.hotspotFor(table.object),undefined,'side table is scenery, not an extra conversation target');
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
    assert.equal(surface.material.depthTest, true);
    assert.equal(surface.material.depthFunc, THREE.AlwaysDepth, 'Nearer desks and walls must not hide UI');
    assert.equal(surface.material.depthWrite, true, 'People and controllers must compare against the panel depth');
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
  assert.equal(count,5);assert.equal(room.group.userData.lightingStatus,'baked');
  assert.equal(room.group.userData.waterMapStatus,'ready');
  assert.equal(room.props.filter(prop=>prop.name==='South London water-supply map').length,1,'repeated loading must not duplicate the map');
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

for (const [asset, size] of [['registrar-room',2048],['household-room',2048],['brewery-room',2048],['workhouse-courtyard',2048],['broad-street',2048]]) {
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
  assert.equal(street.pump.children.find(o=>o.isMesh).material.envMap,null);
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

test('Snow idle is continuous across mesh pivots and reduced motion restores the authored pose',async()=>{
  const {CharacterIdle}=await load('walkable/CharacterIdle');
  const root=await exportedSnow(),actor=root.getObjectByName('Snow_character');
  const original=actor.children.map(o=>o.matrix.clone());
  const idle=new CharacterIdle(actor,.6,true);
  const shaders=[];
  actor.traverse(o=>{if(o.isMesh){
    const shader={uniforms:{},vertexShader:'#include <beginnormal_vertex>\n#include <begin_vertex>'};
    o.material.onBeforeCompile(shader);shaders.push(shader);
    const local=new THREE.Vector3(.02,1.08,.1).applyMatrix4(shader.uniforms.meshFromActor.value);
    assert.ok(local.applyMatrix4(shader.uniforms.actorFromMesh.value).distanceTo(new THREE.Vector3(.02,1.08,.1))<1e-7);
    assert.match(shader.vertexShader,/idlePosition/);
  }});
  assert.ok(shaders.length>5);
  idle.update(250,false);assert.ok(shaders.every(s=>s.uniforms.idleTime.value===250&&s.uniforms.idleAmount.value===1));
  idle.update(251,true);assert.ok(shaders.every(s=>s.uniforms.idleAmount.value===0));
  actor.children.forEach((o,i)=>assert.deepEqual(o.matrix.elements,original[i].elements,'selection and pose pivots remain fixed'));
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
    createBufferSource(){const source={...node(),playbackRate:param(1),started:false,stopped:false,start(time){this.started=true;this.startAt=time;},stop(time){this.stopped=true;this.stopAt=time;}};this.sources.push(source);return source;},
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

test('pump water is immediate, sustained and never suppressed by a preceding footstep',async()=>{
  const c=fakeAudioContext(),audio=new Soundscape(()=>c);await audio.unlock();
  audio.effect('step');const count=c.sources.length;audio.effect('water');
  assert.equal(c.sources.length,count+1);
  const water=audio.waterSource,filter=water.connections[0],gain=filter.connections[0];
  assert.equal(water.startAt,c.currentTime);assert.equal(water.playbackRate.value,1);
  assert.ok(Math.abs(water.buffer.duration-.95)<1/22050);
  assert.deepEqual(gain.gain.automation,[0,.85,.85,0],'water holds its level instead of fading immediately');
  const samples=water.buffer.getChannelData(0);
  for(const fraction of [0,.4,.8]) {
    const slice=samples.slice(Math.floor(samples.length*fraction),Math.floor(samples.length*(fraction+.1)));
    assert.ok(Math.sqrt(slice.reduce((sum,v)=>sum+v*v,0)/slice.length)>.12,'splash stays audible across the flow');
  }
  audio.effect('water');assert.equal(water.stopAt,undefined,'repeated strokes stop the previous source immediately');
  const replacement=audio.waterSource;water.onended();assert.equal(audio.waterSource,replacement);
  audio.stopWater();assert.equal(replacement.connections.length,0);assert.equal(audio.waterSource,undefined);
  audio.dispose();
});

test('pump audio respects effects and mute, and stops on travel or backgrounding',async()=>{
  const c=fakeAudioContext(),audio=new Soundscape(()=>c);await audio.unlock();
  audio.setLevel('effects',0);let count=c.sources.length;audio.effect('water');assert.equal(c.sources.length,count);
  audio.setLevel('effects',.35);audio.toggleMuted();audio.effect('water');assert.equal(c.sources.length,count);
  audio.toggleMuted();audio.effect('water');const first=audio.waterSource;
  audio.setLocation('workhouse');assert.equal(first.connections.length,0);assert.equal(audio.waterSource,undefined);
  audio.effect('water');const second=audio.waterSource;audio.setHidden(true);
  assert.equal(second.connections.length,0);assert.equal(audio.waterSource,undefined);
  count=c.sources.length;audio.effect('water');assert.equal(c.sources.length,count);audio.dispose();
});

test('VR sound controls adjust preferences without clearing evidence or a dialogue answer',()=>{
  const game=fieldGame(true);game.travelToLocation('brewery');game.inspectHotspot('broad-street-brewery');finishConversation(game);
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

test('street residents block teleport and walking and have individual conversations',()=>{
  const street=new PumpCourtyard();street.group.visible=true;street.characters.group.userData.characterStatus='ready';
  const target=street.characters.targets[0],feet=target.position.clone();feet.y=0;
  assert.equal(isValidDestination(feet),true,'resident is on accessible pavement');
  assert.equal(street.canTeleport({object:street.floor,point:feet}),false);
  assert.equal(street.canWalkBetween(feet.clone().add(new THREE.Vector3(0,0,2)),feet),false);
  assert.equal(street.hotspotFor(target),'resident-west');
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
  const atlas=await readFile(`public/models/${definition.asset}-lightmap.png`);assert.equal(atlas.readUInt32BE(16),key==='street'?2048:1024);assert.equal(atlas.readUInt32BE(20),key==='street'?2048:1024);
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
    if(actor.id==='whitehead') {
      // Adult clothing and fixed standing wrist targets must not be placed on a
      // child-sized macro mesh. Check the exported result, not profile values.
      const boundsFor=name=>{
        const mesh=scene.getObjectByName(name),points=[];
        const matrix=root.matrixWorld.clone().invert().multiply(mesh.matrixWorld);
        const positions=mesh.geometry.getAttribute('position');
        for(let i=0;i<positions.count;i++)points.push(new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(matrix));
        return new THREE.Box3().setFromPoints(points);
      };
      const face=boundsFor('whitehead_head_Skin'),eyes=boundsFor('whitehead_head_Eyes');
      const hair=boundsFor('whitehead_head_Hair'),coat=boundsFor('whitehead_upper_Coat');
      assert.ok(face.max.y>1.68&&face.max.y<1.85,'Whitehead has adult stature');
      assert.ok(eyes.min.y>1.57,'eyes align with an adult head above the collar');
      assert.ok(coat.max.y<eyes.min.y-.05,'coat cannot engulf the face');
      assert.ok(hair.min.y>1.50&&hair.getSize(new THREE.Vector3()).y<.25,'short hair stays on the scalp');
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
        assert.ok(bounds.min.y>.67&&bounds.max.y<(actor.dress?1.05:1.01),`${actor.id}: hand rests beside thigh below wrist (${bounds.min.y}, ${bounds.max.y})`);
        assert.ok(size.y>.15&&size.x<.09&&size.z<.15,`${actor.id}: hand points down with the palm facing the thigh (under 9cm wide)`);
        assert.ok(hand.every(p=>p.x*side>.20),'relaxed hand stays outside the trouser silhouette');
        assert.ok([.07,.10,.13].some(z=>cast(side*.40,actor.dress?.94:.86,z,[-side,0,0],skin)),'wrist-to-palm surface remains connected');
      }
    }
  }
});

for(const [key,Room] of Object.entries(witnessRooms))test(`${key} witness nameplate follows aim and stays hidden during a panel`,()=>{
  const original=globalThis.document;globalThis.document={body:{dataset:{}}};
  try {
    const scene=Object.create(BroadStreetScene.prototype),room=new Room(),game=gameAtDay(key==='workhouse'?2:key==='brewery'?3:1);game.travelToLocation(key);
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
function completeSurvey(game) {
 if(game.hasEvidence('walking-access'))return;
 assert.ok(game.resumePumpComparison());
 for(let i=0;i<10 && game.getFieldworkView();i++) {
  const guide=game.getFieldworkView().guided;assert.ok(game.advancePumpComparison(guide.actions[0].id,guide.key));
 }
 assert.ok(game.hasWalkingBoundary());finishConversation(game);game.closeDialogue();
}

function reviewGame() {
 const game=gameAtDay(3);talk(game,'brewery','broad-street-brewery');talk(game,'household-away','away-household');completeSurvey(game);talk(game,'snow-desk','john-snow');return game;
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
    assert.equal(game.boardPresented,false,'arrival is not presentation');
    game.finishBoard(); assert.equal(game.getStage(),'board','cannot skip hearing');
    game.beginHearing();assert.equal(game.boardPresented,false);finishConversation(game);
    assert.ok(game.getCurrentSceneBody().join(' ').includes(theory.boardAction));
    game.finishBoard();assert.equal(game.getStage(),'complete');
    game.reset();assert.equal(game.selectedHypothesisId,undefined);assert.equal(game.preparedForBoard,false);
  }
});

test('one attend action prepares the selected theory and arrives without completing or restarting the hearing',()=>{
  const early=new GameState();early.selectHypothesis('waterborne');assert.equal(early.attendBoardMeeting().accepted,false);
  for(const theory of early.getHypotheses()) {
    const game=reviewGame();assert.equal(game.attendBoardMeeting().accepted,false,'choose a theory first');
    game.selectHypothesis(theory.id);game.travelToLocation('broad-street');assert.equal(game.attendBoardMeeting().accepted,false,'review at Snow’s desk');
    game.travelToLocation('snow-desk');let changes=0;game.onChange(()=>changes++);
    assert.equal(game.attendBoardMeeting().accepted,true);assert.equal(changes,1,'single saved state change with no intermediate prepare screen');
    assert.equal(game.getCurrentLocation().id,'board-room');assert.equal(game.selectedHypothesisId,theory.id);assert.equal(game.preparedForBoard,true);assert.equal(game.boardPresented,false);
    const restored=new GameState();assert.ok(restored.restoreSave(game.serializeSave()));assert.equal(restored.selectedHypothesisId,theory.id);assert.equal(restored.preparedForBoard,true);
    game.beginHearing();const beat=game.getConversationView();game.chooseConversation(beat.beatId,beat.choices[0].id);const advanced=game.getConversationView();
    assert.equal(game.attendBoardMeeting().accepted,false);assert.deepEqual(game.getConversationView(),advanced,'a repeated click cannot restart the hearing');
  }
  const legacy=reviewGame();legacy.selectHypothesis('waterborne');legacy.prepareBoardArgument();
  const restored=new GameState();assert.ok(restored.restoreSave(legacy.serializeSave()));assert.equal(restored.attendBoardMeeting().accepted,true,'existing prepared saves still attend normally');
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
  assert.equal(game.getCollectedEvidence().length,10,'full inquiry fixture');
  const water=game.getHypothesisReview(game.getHypothesis('waterborne'));
  assert.match(water.supporting.text,/Manufactory workers.*brewery workers/);
  assert.match(water.complicating.text,/some pump users remained well/);
});

test('desktop review shows two points per theory, full-note links and no confidence controls or repeated map list',()=>{
  const game=reviewGame();
  assert.match(renderSynthesisPanel(game),/data-action="present"\s+disabled/);
  game.selectHypothesis('waterborne');
  const html=renderSynthesisPanel(game);
  assert.equal((html.match(/class="fit-list /g)||[]).length,8);
  assert.equal((html.match(/data-action="select-hypothesis"/g)||[]).length,4);
  assert.match(html,/data-action="notebook"/);assert.match(html,/data-action="map"/);
  assert.doesNotMatch(html,/confidence|synthesis-map-strip/i);
  assert.doesNotMatch(html,/data-action="present"\s+disabled/);
  assert.doesNotMatch(html,/prepare-board|Prepare Board argument/);
  assert.match(html,/Attend the meeting/);
  assert.ok(game.attendBoardMeeting().accepted);
  assert.match(renderChapterPanel(game.getCurrentScene(),'board',game),/begin-hearing/);
  game.beginHearing();finishConversation(game);
  const board=renderChapterPanel(game.getCurrentScene(),'board',game);
  assert.equal((board.match(/<li>/g)||[]).length,2);
  assert.equal((board.match(/Prepared theory/g)||[]).length,0);
  game.finishBoard();
  assert.doesNotMatch(renderChapterPanel(game.getCurrentScene(),'complete',game),/findings-list/);
});

test('VR review uses the same strongest points and a single attend action without confidence buttons',()=>{
  const game=reviewGame(),scene=Object.create(BroadStreetScene.prototype);
  let buttons=[],texts=[];
  Object.assign(scene,{gameState:game,addVrText:(text)=>texts.push(text),
    addPaginatedVrText:(_key,text)=>texts.push(text),
    addVrPanelButton:(label,x,y,width,height,action)=>buttons.push({label,action}),
    markVrPanelDirty:()=>{},showVrPanel:()=>{},refreshHotspots:()=>{}});
  scene.buildVrSynthesisPanel();assert.ok(!buttons.some(b=>b.action.type==='present-board'));
  for(const theory of game.getHypotheses()) {
    game.selectHypothesis(theory.id);buttons=[];texts=[];
    scene.buildVrSynthesisPanel();
    const review=game.getHypothesisReview(theory);
    assert.ok(texts.includes(review.supporting.text));assert.ok(texts.includes(review.complicating.text));
    assert.equal(buttons.filter(b=>b.action.type==='select-hypothesis').length,4);
    assert.equal(buttons.filter(b=>b.action.type==='present-board' && b.label==='Attend the meeting').length,1);
    assert.doesNotMatch(JSON.stringify({buttons,texts}),/confidence|Map evidence:/i);
  }
  assert.equal(game.preparedForBoard,false);
  scene.handleVrButton({type:'present-board'});assert.equal(game.getStage(),'board');
  assert.equal(game.preparedForBoard,true);assert.equal(game.boardPresented,false);
});

test('scene guidance names selectable figures and current-day street activities',()=>{
  const game=new GameState();
  const expected={'snow-desk':/John Snow/,registrar:/registrar.*ledger/,household:/survivor/,workhouse:/steward/,brewery:/either brewery owner/,'broad-street':/Whitehead.*residents/};
  for(const [id,pattern] of Object.entries(expected)) {
    game.currentLocationId=id;
    assert.match(game.getInteractionHint(),pattern);
    assert.doesNotMatch(game.getInteractionHint(),/gold|marker|marked (table|chair)/i);
  }
  game.currentLocationId='broad-street';
  assert.doesNotMatch(game.getInteractionHint(),/inspect|survey/);
  game.day=2;assert.match(game.getInteractionHint(),/pump handle.*inspect/);
  game.day=3;assert.match(game.getInteractionHint(),/household and brewery/);
});

test('MakeHuman scene figures embed masked textures and match their editable sources',async()=>{
  const {createHash}=await import('node:crypto');
  const householdHair=new Set();
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
    assert.deepEqual(report.actors,definition.actors,'exported positions match interaction and collision manifest');
    for(const actor of definition.actors) {
      const source=await readFile(`assets/scene-people/${actor.source??actor.id}.blend`);
      assert.equal(report.sources[actor.id],createHash('sha256').update(source).digest('hex'),'export matches authored anatomy');
      for(const role of ['Skin','Eyes','Brows','Hair']) {
        const node=gltf.nodes.find(n=>n.name===`${actor.id}_head_${role}`);
        assert.ok(node,`${actor.id} has textured ${role}`);
        const material=gltf.materials[gltf.meshes[node.mesh].primitives[0].material];
        assert.ok(material.pbrMetallicRoughness.baseColorTexture,`${actor.id} preserves ${role} detail`);
        if(role!=='Skin')assert.equal(material.alphaMode,'MASK','no sorted transparent hair cards');
        if(role==='Hair') {
          if(['survivor','water-householder','away-householder'].includes(actor.id)) {
            // These figures now carry their colour in the strand image itself.
            const texture=gltf.textures[material.pbrMetallicRoughness.baseColorTexture.index];
            const view=gltf.bufferViews[gltf.images[texture.source].bufferView];
            const start=28+bytes.readUInt32LE(12)+(view.byteOffset??0);
            householdHair.add(createHash('sha256').update(bytes.subarray(start,start+view.byteLength)).digest('hex'));
          } else assert.ok(material.pbrMetallicRoughness.baseColorFactor,'individual hair tint survives glTF export');
        }
      }
    }
  }
  assert.equal(householdHair.size,3,'household figures preserve three distinct embedded hair palettes');
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
  assert.equal(peak,2);assert.equal(requests,16);assert.equal(sound.recordings.size,15);
  assert.ok(sound.cart);sound.setLocation('registrar');await sound.unlock();assert.equal(requests,16);
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
    assert.ok(['CC0-1.0','CC-BY-4.0','Public-domain'].includes(item.license));
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
  const game=fieldGame(true);game.travelToLocation('brewery');game.inspectHotspot('broad-street-brewery');finishConversation(game);
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
  const scene=Object.create(BroadStreetScene.prototype),game=fieldGame(),commands=[];
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
  game.travelToLocation('household');game.inspectHotspot('broad-street-household');finishConversation(game);
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
    dataset={};attributes={};inert=false;classList={contains:()=>false};
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

const {extractProps,propSpecs,InspectableProp,PropHold,propFor}=await load('walkable/InspectableProps');
async function exportedRoom(asset) {
  const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
  const bytes=await readFile(`public/models/${asset}`);
  const loader=new GLTFLoader();loader.register(()=>({name:'offline-texture-placeholder',loadTexture:async()=>new THREE.Texture()}));
  return (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
}
function triangles(root) {let n=0;root.traverse(o=>{if(o.isMesh)n+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});return n;}
for(const asset of Object.keys(propSpecs))test(`${asset} inspectable objects preserve geometry and baked UVs without duplicating furniture`,async()=>{
  const model=await exportedRoom(asset),room=new THREE.Group();room.add(model);
  const before=triangles(model),props=extractProps(model,room,asset);
  assert.equal(props.length,propSpecs[asset].length);assert.equal(triangles(model)+props.reduce((n,p)=>n+triangles(p.group),0),before);
  assert.equal(room.children.filter(o=>o.name==='Resting portable objects').length<24,true,'static items stay material-batched');
  for(const [i,prop] of props.entries()) {
    assert.ok(triangles(prop.group)>0,prop.name);assert.ok(triangles(prop.group)<15000,prop.name);
    const size=new THREE.Box3().setFromObject(prop.group).getSize(new THREE.Vector3());
    const spec=propSpecs[asset][i];
    assert.ok(size.x<=spec.max[0]-spec.min[0]+.0001&&size.y<=spec.max[1]-spec.min[1]+.0001&&size.z<=spec.max[2]-spec.min[2]+.0001,`${prop.name} contains only the item`);
    prop.group.traverse(o=>{if(o.isMesh){assert.equal(propFor(o),prop);assert.ok(o.geometry.attributes.uv1);assert.ok(o.geometry.attributes.normal);}});
    const center=new THREE.Vector3().addVectors(new THREE.Vector3(...propSpecs[asset][i].min),new THREE.Vector3(...propSpecs[asset][i].max)).multiplyScalar(.5);
    assert.ok(prop.home.distanceTo(center)<1e-9);
  }
});

test('pickup follows tracked orientation and returns exactly, without momentum or a second simultaneous grab',()=>{
  const room=new THREE.Group(),object=new THREE.Group();object.position.set(2,.9,-1);room.add(object);
  const prop=new InspectableProp(object,'Test object'),hold=new PropHold(),hand=new THREE.Group();hand.position.set(1,1.3,1);
  assert.equal(hold.begin(prop,hand,false),true);assert.equal(hold.begin(prop,hand,false),false);
  for(let i=0;i<60;i++)hold.update(1/60);
  assert.ok(object.position.distanceTo(new THREE.Vector3(1,1.2,.62))<.001);
  assert.equal(prop.held,true);assert.equal(object.layers.mask,1,'held object remains rendered');
  const before=object.quaternion.clone();hand.rotation.y=.6;for(let i=0;i<60;i++)hold.update(1/60);
  assert.ok(object.quaternion.angleTo(before)>.5);
  hold.release();assert.equal(hold.prop,undefined);assert.equal(prop.held,false);
  let distance=object.position.distanceTo(prop.home);
  for(let i=0;i<40;i++){prop.update(1/60,false);const next=object.position.distanceTo(prop.home);assert.ok(next<=distance+1e-9);distance=next;}
  assert.equal(distance,0);assert.ok(object.quaternion.angleTo(prop.homeRotation)<1e-8);assert.equal(prop.returning,false);
  assert.equal(hold.begin(prop,hand,true),true);hold.update(.05);hold.release(true);assert.deepEqual(object.position.toArray(),[2,.9,-1]);
});

test('reduced motion returns an inspected object immediately',()=>{
  const object=new THREE.Group(),prop=new InspectableProp(object,'Test');object.position.set(3,1,2);prop.release();prop.update(.001,true);
  assert.deepEqual(object.position.toArray(),[0,0,0]);assert.equal(prop.returning,false);
});

test('pump strokes are bounded, water stops, handle remains distinct from evidence, and reset disables operation',()=>{
  const street=new PumpCourtyard(),action=street.pumpAction;street.group.visible=true;
  assert.equal(action.stroke(),true);assert.equal(action.stroke(),false);
  let moved=false,flowed=false;
  for(let i=0;i<120;i++) {
    action.update(1/60,false);moved ||= action.handle.rotation.z>.1;flowed ||= action.water.visible;
    assert.ok(action.handle.rotation.z>=0&&action.handle.rotation.z<=.55);
  }
  assert.equal(moved,true);assert.equal(flowed,true);assert.equal(action.water.visible,false);assert.equal(action.handle.rotation.z,0);
  assert.equal(street.hotspotFor(action.handle.children[0]),undefined);
  assert.equal(street.hotspotFor(street.pump.children.find(o=>o.isMesh)),'broad-street-pump');
  action.reset(false);assert.equal(action.stroke(),false);assert.equal(action.owns(action.handle.children[0]),false);
  assert.ok(action.handle.children.every(o=>o.layers.mask===0));action.reset();assert.equal(action.stroke(),true);
});

test('tactile activation does not collect evidence, teleport, or grab through a nearer obstruction',()=>{
  const scene=Object.create(BroadStreetScene.prototype),street=new PumpCourtyard();street.group.visible=true;
  const game=fieldGame(true),ray=new THREE.Raycaster(),hold=new PropHold(),camera=new THREE.PerspectiveCamera();
  Object.assign(scene,{courtyard:street,gameState:game,propHold:hold,camera});
  const object=new THREE.Group(),prop=new InspectableProp(object,'Cup'),part=new THREE.Mesh();object.add(part);part.userData.inspectableProp=prop;
  let hit={object:part,distance:6};street.pick=()=>hit;
  assert.equal(scene.activateTactile(ray),true);assert.equal(hold.prop,undefined,'move closer required');
  hit.distance=4.5;assert.equal(scene.activateTactile(ray),true);assert.equal(hold.prop,prop);
  hit={object:street.floor,distance:1};assert.equal(scene.activateTactile(ray),true);assert.equal(hold.prop,undefined,'release consumes the click over ground');
  assert.equal(scene.activateTactile(ray),false,'nearer furniture/ground is never picked through');
  assert.equal(game.getCollectedEvidence().length,8,'inspection has not awarded additional evidence');
});

test('controller release cannot activate a target behind a held object regardless of selectend order',()=>{
  const scene=Object.create(BroadStreetScene.prototype),hand=new THREE.Group();let clicks=0;
  Object.assign(scene,{tactileVrSelections:new Set([hand]),pickVrButton:()=>{clicks++;throw new Error('click-through');}});
  scene.selectFromVrController(hand);scene.selectFromVrController(hand);assert.equal(clicks,0);
});

test('scene changes and interruption restore all objects and stop pumping',()=>{
  const scene=Object.create(BroadStreetScene.prototype),room=new THREE.Group(),object=new THREE.Group();room.add(object);
  const prop=new InspectableProp(object,'Mug'),hold=new PropHold(),hand=new THREE.Group(),street=new PumpCourtyard();
  Object.assign(scene,{propHold:hold,office:{props:[prop]},courtyard:street,gameState:fieldGame(true)});
  hold.begin(prop,hand,false);hold.update(.1);street.pumpAction.stroke();
  scene.resetTactileInteractions();assert.equal(hold.prop,undefined);assert.equal(prop.returning,false);assert.deepEqual(object.position.toArray(),[0,0,0]);
  assert.equal(street.pumpAction.water.visible,false);assert.equal(street.pumpAction.handle.rotation.z,0);
});

test('grip holds until its own release; trigger never drops it or clicks through',()=>{
  const oldDocument=globalThis.document,oldWindow=globalThis.window;
  globalThis.document=new EventTarget();document.body={dataset:{}};globalThis.window=new EventTarget();
  try {
    for(const order of [['select','selectend'],['selectend','select']]) {
      const scene=Object.create(BroadStreetScene.prototype),hand=new THREE.Group(),other=new THREE.Group();
      const object=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.2)),prop=new InspectableProp(object,'Cup');object.add(mesh);mesh.userData.inspectableProp=prop;
      const street=new PumpCourtyard();street.group.visible=true;street.pick=()=>({object:mesh,distance:1});
      let clicked=0;
      Object.assign(scene,{canvas:new EventTarget(),renderer:{xr:{isPresenting:true,getController:i=>i===0?hand:other,addEventListener:()=>{}}},
        playerRig:new THREE.Group(),camera:new THREE.PerspectiveCamera(),courtyard:street,gameState:fieldGame(true),
        vrControllers:[],vrControllerPointers:[],vrPanelVisible:false,propHold:new PropHold(),tactileVrSelections:new Set(),
        controllerRaycaster:new THREE.Raycaster(),setRaycasterFromController:()=>{},pickVrButton:()=>{clicked++;},pickVrPanel:()=>undefined});
      scene.addInputHandlers();hand.dispatchEvent({type:'selectstart'});assert.equal(scene.propHold.prop,undefined,'trigger alone does not grab');hand.dispatchEvent({type:'squeezestart'});assert.equal(scene.propHold.prop,prop);
      hand.dispatchEvent({type:'selectstart'});
      for(const type of order)hand.dispatchEvent({type});
      assert.equal(scene.propHold.prop,prop,'trigger events preserve grip ownership');
      other.dispatchEvent({type:'squeezeend'});assert.equal(scene.propHold.prop,prop);
      other.dispatchEvent({type:'squeezestart'});assert.equal(scene.propHold.anchor,other,'free hand takes the nearby item');
      assert.equal(prop.held,true);assert.equal(prop.returning,false);
      hand.dispatchEvent({type:'squeezeend'});assert.equal(scene.propHold.prop,prop,'former owner release cannot drop the item');
      other.dispatchEvent({type:'squeezeend'});
      assert.equal(scene.propHold.prop,undefined);assert.equal(prop.returning,true);assert.equal(clicked,0);
    }
  } finally {globalThis.document=oldDocument;globalThis.window=oldWindow;}
});

const { conversations, ConversationProgress } = await load('simulation/conversations');
for (const definition of conversations) test(`${definition.id}: all choices reconverge, resume and conclude exactly once`, () => {
  const paths = [];
  function visit(id, path = [], seen = new Set()) {
    assert.ok(!seen.has(id), 'ordinary conversation must not trap the player in a cycle');
    const beat = definition.beats.find(b => b.id === id); assert.ok(beat, 'choice destination exists');
    assert.ok(beat.choices.length <= 3);
    if (beat.conclusion !== undefined) { assert.equal(beat.choices.length, 0); paths.push(path); }
    else { assert.ok(beat.choices.length); for (const c of beat.choices) visit(c.next, [...path, [id,c.id]], new Set([...seen,id])); }
  }
  visit(definition.start);
  const endings = new Set();
  for (const path of paths) {
    const progress = new ConversationProgress(); progress.open(definition.id);
    let conclusions = 0;
    for (const [beat,choice] of path) {
      const before = progress.view(); progress.close(); assert.equal(progress.view(),undefined);
      progress.open(definition.id); assert.deepEqual(progress.view(),before,'resume preserves current exchange');
      const result = progress.choose(beat,choice); assert.ok(result.advanced);
      conclusions += result.conclusion !== undefined ? 1 : 0;
      assert.equal(progress.choose(beat,choice).advanced,false,'stale click cannot skip another beat');
    }
    assert.equal(conclusions,1); assert.ok(progress.view().complete); endings.add(progress.view().beatId);
    progress.close(); progress.open(definition.id); assert.ok(progress.view().complete);
    assert.equal(progress.choose(progress.view().beatId,'bogus').advanced,false);
    progress.reset(); progress.open(definition.id); assert.equal(progress.view().beatId,definition.start);
  }
  assert.equal(endings.size,1);
});

test('switching witnesses or leaving a location restarts unfinished exchanges without revoking completed findings',()=>{
  const game=gameAtDay(1);game.travelToLocation('broad-street');
  game.inspectHotspot('whitehead');game.chooseConversation('opening','water');
  game.inspectHotspot('resident-west');game.inspectHotspot('whitehead');
  assert.equal(game.getConversationView().beatId,'opening');
  game.travelToLocation('registrar');game.inspectHotspot('registrar-ledger');game.chooseConversation('opening','approach-0');
  game.closeDialogue(); // Opening a map before travelling must not preserve the abandoned cursor.
  game.travelToLocation('broad-street');game.travelToLocation('registrar');game.inspectHotspot('registrar-ledger');
  assert.equal(game.getConversationView().beatId,'opening');
  finishConversation(game);const count=game.getCollectedEvidence().length;
  game.travelToLocation('broad-street');game.travelToLocation('registrar');game.inspectHotspot('registrar-ledger');
  assert.ok(game.getConversationView().complete);assert.equal(game.getCollectedEvidence().length,count);
});

test('walking out of speaking range restarts an unfinished conversation and persists that reset',()=>{
  const game=new GameState();game.dismissDayIntroduction();game.inspectHotspot('john-snow');game.chooseConversation('opening','begin');
  const scene=Object.create(BroadStreetScene.prototype),camera=new THREE.PerspectiveCamera();camera.position.set(0,1.6,0);
  Object.assign(scene,{gameState:game,camera,vrPanelVisible:false});
  scene.updateConversationRange();camera.position.x=.4;scene.updateConversationRange();
  assert.equal(game.getConversationView().beatId,'records','nearby movement retains the exchange');
  camera.position.x=8;scene.updateConversationRange();assert.equal(game.getConversationView(),undefined);
  const restored=new GameState();assert.ok(restored.restoreSave(game.serializeSave()));restored.inspectHotspot('john-snow');
  assert.equal(restored.getConversationView().beatId,'opening');
});

test('VR snap turning during dialogue leaves its world panel in place',()=>{
  const game=new GameState();game.inspectHotspot('john-snow');
  const scene=Object.create(BroadStreetScene.prototype),hand=new THREE.Group(),rig=new THREE.Group(),camera=new THREE.PerspectiveCamera();rig.add(camera);
  const panel=new THREE.Group();panel.position.set(1,1.3,-2);const pose=panel.position.clone();
  Object.assign(scene,{gameState:game,vrPanelMode:'home',vrPanelVisible:true,vrPanel:panel,playerRig:rig,camera,
    vrControllers:[hand],vrInputSources:new Map([[hand,{handedness:'right',gamepad:{mapping:'xr-standard',axes:[0,0,.9,0]}}]]),
    snapTurnLocked:false,placeVrPanelInFront:()=>assert.fail('turning must not move the conversation panel')});
  Object.defineProperty(scene,'walkable',{value:{}});
  scene.updateSnapTurn(.02);assert.notEqual(rig.rotation.y,0);assert.deepEqual(panel.position,pose);
  assert.equal(scene.vrPanelBlocksWorld(),false);scene.vrPanelMode='map';assert.equal(scene.vrPanelBlocksWorld(),true);
});

test('VR left-stick movement, grip pickup and actor selection remain live during conversation',()=>{
  const oldDocument=globalThis.document;globalThis.document={hidden:false,body:{dataset:{}}};
  try {
    const game=gameAtDay(1);game.travelToLocation('broad-street');game.inspectHotspot('whitehead');game.chooseConversation('opening','water');
    const scene=Object.create(BroadStreetScene.prototype),hand=new THREE.Group(),rig=new THREE.Group(),camera=new THREE.PerspectiveCamera();rig.add(camera);
    const source=xrController(),prop=new InspectableProp(new THREE.Group(),'Cup'),mesh=new THREE.Mesh();prop.group.add(mesh);mesh.userData.inspectableProp=prop;
    let hit={object:mesh,distance:1,point:new THREE.Vector3()};
    Object.defineProperty(scene,'walkable',{value:{pick:()=>hit,hotspotFor:()=>undefined,canTeleport:()=>false}});
    Object.assign(scene,{gameState:game,camera,playerRig:rig,vrPanelVisible:true,vrPanelMode:'home',vrWalkingEnabled:true,
      renderer:{xr:{isPresenting:true,getSession:()=>({visibilityState:'visible'})}},vrInputSources:new Map([[hand,source]]),vrControllers:[hand],
      vrWalking:new VrWalking(),vrShortcuts:new VrShortcutTracker(),propHold:new PropHold(),cameraWorldPosition:new THREE.Vector3(),controllerWorldDirection:new THREE.Vector3(),
      controllerRaycaster:new THREE.Raycaster(),vrSelectionStarts:new Map(),setRaycasterFromController:()=>{},pickVrPanel:()=>undefined,pickVrButton:()=>undefined,
      canWalkWithBoundaryCue:()=>true,updateVrPointers:()=>{},updateVrButtonFocus:()=>{},updateVrPaginationButtons:()=>{},updateSnapTurn:()=>{},updateVrIdleHint:()=>{}});
    scene.updateVrControls(1,.05);source.gamepad.axes[2]=1;scene.updateVrControls(1.05,.05);
    assert.ok(rig.position.x>0,'conversation does not block left stick');
    new THREE.Group().add(prop.group);
    scene.beginGripGrab(hand);assert.equal(scene.propHold.prop,prop);assert.equal(game.getConversationView().beatId,'skepticism');
    scene.reducedCharacterMotion={matches:false};scene.updatePumpInteractions=()=>{};
    scene.objectInspection={update:()=>{}};scene.scene=new THREE.Scene();scene.tactileLabelText='Cup';scene.tactileLabel=new THREE.Sprite();
    scene.updateTactileInteractions(.02);assert.equal(scene.propHold.prop,prop,'frame update must not release held props just because dialogue is open');
    scene.propHold.release(true);
    hit={object:new THREE.Object3D(),distance:1,point:new THREE.Vector3()};hit.object.userData.hotspot=game.getHotspot('resident-west');
    scene.pickWorldTravelHit=()=>hit;scene.activateVrHotspot=hotspot=>game.inspectHotspot(hotspot.id);
    scene.selectFromVrController(hand);assert.equal(game.getConversationView().actorId,'resident-west');
    game.inspectHotspot('whitehead');assert.equal(game.getConversationView().beatId,'opening');
  } finally {globalThis.document=oldDocument;}
});

test('every Board hearing turn is anchored to its own figure, including the Board Snow model',async()=>{
  const definitions=JSON.parse(await readFile('src/walkable/scene-characters.json','utf8'));
  const graph=conversations.find(c=>c.id==='board-hearing');
  for(const beat of graph.beats) {
    const actor=definitions.board.actors.find(a=>a.id===(beat.actorId==='john-snow'?'board-snow':beat.actorId));
    assert.ok(actor,beat.id);assert.deepEqual(beat.anchor,[actor.position[0],actor.position[1]+actor.height*.85,actor.position[2]],beat.id);
  }
});

test('Board dialogue relocates for each speaker using the current viewpoint, and stays still during their turn',()=>{
  const game=reviewGame();game.selectHypothesis('waterborne');game.attendBoardMeeting();game.beginHearing();
  const camera=new THREE.PerspectiveCamera();camera.position.set(0,1.1,5.2);
  const scene=Object.create(BroadStreetScene.prototype);
  Object.assign(scene,{gameState:game,camera,vrPanelMode:'home',vrPanelVisible:true,vrPanel:new THREE.Group(),vrPanelDrawCommands:[],
    vrPanelWorldPosition:new THREE.Vector3(),vrPanelWorldDirection:new THREE.Vector3(),vrPanelLookTarget:new THREE.Vector3(),
    clearVrPanel(){},addVrText(){},addVrPanelButton(){},addVrIconButton(){},addVrPanelSurface(){}});
  let previousSpeaker,previousPosition;const speakers=new Set();
  while(true) {
    const view=game.getConversationView();scene.rebuildVrPanel();speakers.add(view.actorId);
    const position=scene.vrPanel.position.clone();
    if(previousSpeaker!==view.actorId) {
      if(previousPosition)assert.ok(position.distanceTo(previousPosition)>.1,'new speaker gets a different panel position');
      const normal=new THREE.Vector3(0,0,1).applyQuaternion(scene.vrPanel.quaternion);
      assert.ok(normal.dot(camera.position.clone().sub(position).normalize())>1-1e-10,'faces the current eye position');
    } else assert.deepEqual(position,previousPosition,'same speaker keeps the stable panel');
    camera.position.x+=.04;scene.rebuildVrPanel();assert.deepEqual(scene.vrPanel.position,position,'head movement does not drag the panel');
    scene.updateConversationRange();assert.equal(game.getConversationView().id,'board-hearing');
    if(view.complete)break;
    previousPosition=position;previousSpeaker=view.actorId;
    game.chooseConversation(view.beatId,view.choices[0].id);
  }
  assert.equal(speakers.size,4);
  for(const point of [[-2.8,1.1,-4.8],[2.8,1.7,4.8]]) {
    camera.position.set(...point);scene.updateConversationRange();assert.ok(game.getConversationView(),'crossing the hearing room is not leaving the area');
  }
});

test('each morning report belongs to Snow’s conversation, not the day-start panel',()=>{
  for(const [index,deaths] of [71,45,37].entries()) {
    const day=index+1,game=new GameState();game.day=day;
    const intro=game.getDayIntroduction().join(' ');
    assert.match(intro,/Speak with/);
    assert.doesNotMatch(intro,/Historical context|deaths|71|45|37/);
    const progress=new ConversationProgress();progress.open(day===1?'snow-introduction':`snow-day-${day}`);
    const view=progress.view();assert.equal(view.speaker,'John Snow');
    assert.match(view.text,new RegExp(`${deaths} cholera deaths yesterday`));
    assert.match(view.text,/registrar.*streets around Broad Street/);
    assert.doesNotMatch(view.text,/Historical context|Table I|retrospective/);
    assert.equal(view.complete,false,'the report does not itself complete the assignment');
    progress.close();progress.open(view.id);assert.deepEqual(progress.view(),view,'interrupted morning reports resume normally');
  }
});

test('Snow graph grants the assignment only at its shared conclusion; Whitehead never grants evidence', () => {
  const game = new GameState(); game.dismissDayIntroduction();
  assert.equal(game.getConversationView(),undefined);game.inspectHotspot('john-snow');
  assert.equal(game.getConversationView().beatId,'opening');
  game.chooseConversation('opening','doubt'); game.closeDialogue(); game.inspectHotspot('john-snow');
  assert.equal(game.getConversationView().beatId,'skepticism'); assert.equal(game.hasFieldAssignment(),false);
  game.chooseConversation('skepticism','compare'); game.chooseConversation('method','proof');
  assert.equal(game.hasFieldAssignment(),false);
  game.chooseConversation('limits','undertake'); assert.ok(game.hasFieldAssignment());
  game.closeDialogue(); assert.ok(game.travelToLocation('broad-street').traveled);
  game.inspectHotspot('whitehead'); assert.equal(game.getActiveDialogue().speaker,'Reverend Henry Whitehead');
  game.chooseConversation('opening','water'); game.closeDialogue(); game.inspectHotspot('whitehead');
  assert.equal(game.getConversationView().beatId,'skepticism'); game.chooseConversation('skepticism','exceptions');
  assert.ok(game.getConversationView().complete); assert.equal(game.getCollectedEvidence().length,0);
  game.travelToLocation('snow-desk'); assert.equal(game.getConversationView(),undefined);
  game.reset(); assert.equal(game.hasFieldAssignment(),false);
});

test('Board room circulation permits the complete aisle and blocks the table and chairs', async () => {
  const { BoardRoom } = await load('walkable/BoardRoom'); const room = new BoardRoom();
  assert.ok(room.canWalkBetween(room.spawn,new THREE.Vector3(-2.8,0,4.55)));
  const loop=[[-2.8,4.55],[-2.8,-4.5],[-2.8,-5.5],[2.8,-5.5],[2.8,4.55],[0,4.55]];
  for(let i=1;i<loop.length;i++) assert.ok(room.canWalkBetween(new THREE.Vector3(loop[i-1][0],0,loop[i-1][1]),new THREE.Vector3(loop[i][0],0,loop[i][1])));
  assert.equal(room.canWalkBetween(room.spawn,new THREE.Vector3(0,0,0)),false);
  assert.equal(room.canWalkBetween(new THREE.Vector3(-2.8,0,.8),new THREE.Vector3(-1.85,0,.8)),false);
});

test('Board inspection and premature finish cannot complete the inquiry', () => {
  const game=new GameState(); game.finishBoard(); assert.equal(game.getStage(),'field');
  game.previewBoardRoom(); assert.equal(game.getCurrentLocation().id,'board-room');
  game.beginHearing(); game.finishBoard(); assert.equal(game.getStage(),'board');
  assert.equal(game.boardPresented,false); assert.equal(game.getCollectedEvidence().length,0);
});

test('VR opens the graph before positioning its panel, and choice changes do not reposition it', () => {
  const game=new GameState(),scene=Object.create(BroadStreetScene.prototype);let placements=0;
  Object.assign(scene,{gameState:game,vrPanelVisible:false,showVrPanel:(place=true)=>{
    assert.ok(game.getConversationView(),'anchor is available before panel placement'); if(place)placements++;
  },refreshHotspots:()=>{},markVrPanelDirty:()=>{}});
  scene.activateVrHotspot(game.getHotspot('john-snow')); assert.equal(placements,1);
  scene.handleVrButton({type:'conversation-choice',beatId:'opening',choiceId:'begin'});
  assert.equal(placements,1); assert.equal(game.getConversationView().beatId,'records');
});

test('conversation VR panel adapts to seated and standing eye heights and sits beside the speaker', () => {
  const game=new GameState();game.inspectHotspot('john-snow');
  for(const height of [.7,1.1,1.65,2.0]) {
    const scene=Object.create(BroadStreetScene.prototype),camera=new THREE.PerspectiveCamera();camera.position.set(0,height,1);
    Object.assign(scene,{gameState:game,camera,vrPanelMode:'home',vrPanel:new THREE.Group(),
      vrPanelWorldPosition:new THREE.Vector3(),vrPanelWorldDirection:new THREE.Vector3(),vrPanelLookTarget:new THREE.Vector3()});
    scene.placeVrPanelInFront(); const position=scene.vrPanel.position.clone();
    const toActor=new THREE.Vector3(...game.getConversationView().anchor).sub(camera.position);toActor.y=0;toActor.normalize();
    const right=new THREE.Vector3(-toActor.z,0,toActor.x);
    assert.ok(scene.vrPanel.position.clone().sub(camera.position).dot(right)>1.1,'smaller panel remains beside the character');
    assert.equal(scene.vrPanel.scale.x,.78);
    const normal=new THREE.Vector3(0,0,1).applyQuaternion(scene.vrPanel.quaternion);
    assert.ok(normal.dot(camera.position.clone().sub(position).normalize())>1-1e-10,'panel is perpendicular to the eye-to-panel line, including seated pitch');
    assert.ok(Math.abs(position.y-height)<.3);
    camera.rotation.y=.6;camera.position.x+=.2;
    assert.deepEqual(scene.vrPanel.position,position,'head motion cannot move a world-positioned panel');
  }
});

const {days:inquiryDays}=await load('simulation/campaign');
function permutations(xs){return xs.length?xs.flatMap((x,i)=>permutations(xs.filter((_,j)=>i!==j)).map(rest=>[x,...rest])):[[]];}
test('all three days complete in every assignment visit order, with choice saves and interrupted recaps',()=>{
 const groups=[['registrar','household'],['broad-street','household-routines','workhouse','manufactory'],['brewery','household-away']];
 const targets={manufactory:'manufactory-worker','registrar':'registrar-ledger',household:'broad-street-household','broad-street':'broad-street-pump','household-routines':'routines-household',workhouse:'poland-workhouse',brewery:'broad-street-brewery','household-away':'away-household'};
 for(const a of permutations(groups[0]))for(const b of permutations(groups[1]))for(const c of permutations(groups[2])) {
  let game=new GameState();
  function exchange(location,hotspot,branch) {
   if(game.currentLocationId!==location)assert.ok(game.travelToLocation(location).traveled);
   if(hotspot==='broad-street-pump')game.recordPumpedWater(location);
   game.inspectHotspot(hotspot);
   for(let n=0;n<40;n++) {
    const view=game.getConversationView();assert.ok(view);if(view.complete)break;
    const ch=view.choices[Math.min(branch,view.choices.length-1)];game.chooseConversation(view.beatId,ch.id);
    const after=game.getConversationView(),saved=game.serializeSave();const restored=new GameState();assert.ok(restored.restoreSave(saved));game=restored;
    if(after.complete)break;
    game.inspectHotspot(hotspot);assert.equal(game.getConversationView().beatId,after.beatId,'resume does not repeat or skip a beat');
   }
   game.closeDialogue();
  }
  for(const [i,order] of [a,b,c].entries()) {
   game.dismissDayIntroduction();exchange('snow-desk','john-snow',i%2);if(i===2)completeSurvey(game);
   assert.equal(game.endDay(),false,'fieldwork and recap required');
   for(const location of order) {
    if(location==='survey')completeSurvey(game);else exchange(location,targets[location],i%3);
    const total=game.getCollectedEvidence().length;
    game.travelToLocation('broad-street');exchange('broad-street','whitehead',i%3);
    exchange('broad-street','resident-west',i%2);exchange('broad-street','resident-east',i%2);
    assert.equal(game.getCollectedEvidence().length,total,'optional street exchanges never grant evidence');
   }
   assert.ok(game.isDayFieldworkComplete());assert.equal(game.endDay(),false,'recap is explicit');
   exchange('snow-desk','john-snow',i%2);
   if(i<2){assert.ok(game.endDay());assert.equal(game.day,i+2);assert.equal(game.hasCurrentAssignment(),false);}
  }
  assert.ok(game.hasEnoughEvidenceForSynthesis());assert.equal(game.getCollectedEvidence().length,10);
 }
});

test('future evidence and Board completion cannot bypass required objectives, recaps or hearing choices',()=>{
 const game=gameAtDay(1);game.travelToLocation('broad-street');
 assert.equal(game.inspectHotspot('broad-street-pump').dialogue,undefined);
 assert.equal(game.askQuestion('pump-caution-question').evidence,undefined);
 game.collectedEvidence=new Set(game.getAllEvidence().map(c=>c.id));assert.equal(game.hasEnoughEvidenceForSynthesis(),false,'counts cannot advance campaign');
 assert.equal(game.endDay(),false);assert.equal(game.prepareBoardArgument().prepared,false);
 const ready=reviewGame();ready.selectHypothesis('waterborne');ready.prepareBoardArgument();ready.presentToBoard();
 ready.beginHearing();assert.equal(ready.boardPresented,false);ready.finishBoard();assert.equal(ready.stage,'board');
 const first=ready.getConversationView();ready.chooseConversation(first.beatId,first.choices[2].id);
 const saved=ready.serializeSave(),resumed=new GameState();assert.ok(resumed.restoreSave(saved));resumed.beginHearing();
 assert.equal(resumed.getConversationView().beatId,'air-clarify');finishConversation(resumed,2);assert.ok(resumed.boardPresented);
 resumed.finishBoard();assert.equal(resumed.stage,'complete');assert.equal(resumed.getConversationView(),undefined);
});

test('paired routes share origins and use calibrated distances independent of travel speed or teleportation',()=>{
 for(const pair of ['marlborough','rupert']) {
  const routes=surveyRoutes.filter(r=>r.pair===pair);assert.equal(routes.length,2);
  assert.deepEqual(routes[0].polyline[0],routes[1].polyline[0]);assert.equal(routes[0].origin,routes[1].origin);
  for(const route of routes){assert.ok(route.metres>20&&route.metres<800);assert.equal(route.seconds,Math.round(route.metres/1.2));}
 }
 const game=gameAtDay(3,true);const r=surveyRoutes[0];game.resumePumpComparison();
 assert.equal(game.advancePumpComparison('finish'),false,'cannot skip the comparison');
 assert.ok(game.advancePumpComparison(r.id));assert.equal(game.advancePumpComparison(r.id),false,'measurement records only once');
 const saved=new GameState();assert.ok(saved.restoreSave(game.serializeSave()));saved.resumePumpComparison();
 assert.deepEqual(saved.getRouteObservations()[0],{routeId:r.id,metres:r.metres,seconds:r.seconds});
 assert.equal(saved.hasWalkingBoundary(),false);completeSurvey(game);assert.ok(game.hasWalkingBoundary());
});

test('versioned saves reject corrupt and impossible progress and isolate preview from production',()=>{
 const valid=reviewGame(),data=valid.serializeSave();const game=new GameState();assert.ok(game.restoreSave(data));
 assert.equal(game.day,3);assert.equal(game.getCollectedEvidence().length,10);assert.equal(game.currentLocationId,'snow-desk');
 for(const mutate of [v=>v.version=99,v=>v.day=9,v=>v.location='missing',v=>v.routes=[],v=>v.conversation.cursors['unknown']='opening',v=>v.conversation.concluded.push('missing'),v=>v.conversation.concluded=[],v=>v.stage='complete']) {
  const broken=JSON.parse(data);mutate(broken);const before=game.serializeSave();assert.equal(game.restoreSave(JSON.stringify(broken)),false);assert.equal(game.serializeSave(),before,'invalid save is atomic');
 }
 assert.equal(game.restoreSave('{'),false);
 const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 const preview=new GameState();preview.configurePersistence(storage,'/vr-snow/preview/inquiry/');preview.reset();beginDay(preview);
 const production=new GameState();production.configurePersistence(storage,'/vr-snow/');assert.equal(production.hasSavedInquiry,false);
 const next=new GameState();next.configurePersistence(storage,'/vr-snow/preview/inquiry/');assert.ok(next.hasSavedInquiry);assert.ok(next.continueInquiry());assert.ok(next.hasCurrentAssignment());
 const brokenStorage={getItem(){throw Error('disabled');},setItem(){throw Error('quota');},removeItem(){}};
 const unavailable=new GameState();assert.doesNotThrow(()=>unavailable.configurePersistence(brokenStorage,'/vr-snow/'));assert.doesNotThrow(()=>{unavailable.reset();beginDay(unavailable);});assert.match(unavailable.saveNotice,/unavailable/);
});

for(const key of ['household-routines','household-away'])test(`${key} has distinct authored layout, safe circulation and matching asset`,async()=>{
 const {AdditionalHousehold}=await load('walkable/AdditionalHousehold');const room=new AdditionalHousehold(key);room.group.visible=true;
 const layout=JSON.parse(await readFile(`src/walkable/${key}-layout.json`,'utf8')),report=JSON.parse(await readFile(`assets/${key}-room/build-report.json`,'utf8'));
 assert.deepEqual(report.layout,layout);assert.ok(report.triangles<35000);assert.ok(report.materialBatches<=16);
 assert.ok(room.canWalkBetween(room.spawn,room.spawn.clone().add(new THREE.Vector3(0,0,-.3))));
 assert.ok(room.canWalkBetween(room.spawn,new THREE.Vector3(1.25,0,2.8)),'exit can be reached');
 const bytes=await readFile(`public/models/${key}-room.glb`);assert.ok(bytes.length<4*1024*1024);
});
test('pump destinations and survey origins are removed from the world and travel map',()=>{
 const game=gameAtDay(3);
 for(const id of ['marlborough-pump','rupert-pump']) {
  assert.equal(game.getLocation(id),undefined);assert.equal(game.canTravelToLocation(id),false);
 }
 assert.ok(!game.getAllHotspots().some(h=>h.id.startsWith('survey-')));
 assert.ok(!streetTravelRoutes.some(r=>r.to==='marlborough-pump'||r.to==='rupert-pump'));
});
test('hearing conclusions expose the explicit decision action and label historical versus alternate outcomes',()=>{
 for(const {id} of new GameState().getHypotheses()) {
  const game=reviewGame();game.selectHypothesis(id);game.prepareBoardArgument();game.presentToBoard();game.beginHearing();finishConversation(game);
  assert.equal(game.getConversationView().terminalAction,'board-decision');assert.match(game.getCurrentSceneBody().join(' '),id==='waterborne'?/Historical course/:/Alternate teaching conclusion/);
  game.finishBoard();assert.match(game.getCurrentSceneBody().join(' '),id==='waterborne'?/already declining/:/fictional teaching outcome/);
 }
});

test('VR day, route and hearing buttons drive the shared campaign and expose each conversation',()=>{
 const game=gameAtDay(1);talk(game,'registrar','registrar-ledger');talk(game,'household','broad-street-household');talk(game,'snow-desk','john-snow');
 const scene=Object.create(BroadStreetScene.prototype);let placements=0;
 Object.assign(scene,{gameState:game,endDay:()=>game.endDay(),vrPanelMode:'home',showVrPanel:()=>{},hideVrPanel:()=>{},refreshHotspots:()=>{},markVrPanelDirty:()=>{},placeVrPanelInFront:()=>{placements++;assert.ok(scene.gameState.getConversationView());}});
 scene.handleVrButton({type:'end-day'});assert.equal(game.day,2);assert.ok(game.dayIntroOpen);
 scene.handleVrButton({type:'dismiss-day'});assert.equal(game.dayIntroOpen,false);
 const survey=gameAtDay(3,true);survey.resumePumpComparison();scene.gameState=survey;
 const route=surveyRoutes[0];const place=scene.placeVrPanelInFront;scene.placeVrPanelInFront=()=>{};scene.handleVrButton({type:'guided-survey',action:route.id});scene.placeVrPanelInFront=place;assert.deepEqual(survey.getRouteObservations()[0],{routeId:route.id,metres:route.metres,seconds:route.seconds});
 const hearing=reviewGame();hearing.selectHypothesis('waterborne');hearing.prepareBoardArgument();hearing.presentToBoard();scene.gameState=hearing;scene.vrPanelMode='synthesis';
 scene.handleVrButton({type:'begin-hearing'});assert.equal(scene.vrPanelMode,'home');assert.equal(placements,1);assert.equal(hearing.boardPresented,false);
 for(let i=0;i<30&&!hearing.getConversationView().complete;i++){const v=hearing.getConversationView();scene.handleVrButton({type:'conversation-choice',beatId:v.beatId,choiceId:v.choices[0].id});}
 assert.ok(hearing.boardPresented);assert.equal(placements,1,'choices keep the panel stable');scene.handleVrButton({type:'board-decision'});assert.equal(scene.vrPanelMode,'synthesis');assert.equal(hearing.getConversationView(),undefined);scene.handleVrButton({type:'finish-board'});assert.equal(hearing.stage,'complete');
});


test('spoken dialogue stays within the inquiry and witnesses retain their own voices',()=>{
  for(const conversation of conversations) {
    for(const beat of conversation.beats) {
      const spoken=[beat.text,...beat.choices.map(c=>c.label)].join(' ');
      assert.doesNotMatch(spoken,/Table\s+(?:I|1)\b|1855|retrospective|composite|teaching (?:walk|route|outcome)|epilogue|historical (?:boundary|conclusion)|Snow described/i,`${conversation.id}/${beat.id}`);
    }
    if(['registrar','survivor','water-householder','away-householder','steward','brewery-owner'].includes(conversation.actorId)) {
      assert.equal(new Set(conversation.beats.map(b=>b.speaker)).size,1,'witness is not replaced by a remote Snow field note');
      assert.doesNotMatch(conversation.beats.map(b=>b.text).join(' '),/controlled experiment|population (?:tally|survey)|recorded (?:with|as)|return to Snow|test(?:s)? (?:the|a) theory/i);
    }
  }
});

test('witnesses discuss water only after an explicit player question on every conversation path',()=>{
  // Inspection narration and the Board's response to the submitted argument are not field interviews.
  const witnesses=conversations.filter(c=>c.actorId!=='john-snow' && c.locationId!=='board-room' && !['pump','workhouse-pump'].includes(c.actorId));
  const topic=/\b(?:water|pump|drink|drinking|drank|beer)\b|own well|separate supply/i;
  for(const graph of witnesses) {
    const walk=(beatId,asked=false)=>{
      const beat=graph.beats.find(b=>b.id===beatId);
      if(!asked)assert.doesNotMatch(beat.text,topic,`${graph.id}/${beat.id}: witness raised water before the player`);
      for(const choice of beat.choices)walk(choice.next,asked||topic.test(choice.label));
    };
    walk(graph.start);
  }
});

test('Whitehead remains skeptical when asked, while his parish conversations can finish without discussing water',()=>{
  for(const id of ['whitehead-local-knowledge','whitehead-day-2','whitehead-day-3']) {
    const graph=conversations.find(c=>c.id===id);
    const response=graph.beats.find(b=>b.id===(id==='whitehead-local-knowledge'?'skepticism':'follow'));
    assert.match(response.text,/unconvincing|will not accept|How does Dr\. Snow explain/i);
    const progress=new ConversationProgress();progress.open(id);
    if(id==='whitehead-local-knowledge') {
      progress.choose('opening','help');progress.choose('care','respect');
    } else progress.choose('opening','listen');
    assert.ok(progress.view().complete);
    assert.doesNotMatch(progress.view().text,/water|pump|explanation/i);
  }
});

test('all interview branches retain their essential shared observations',()=>{
  const required={
    'registrar-records':[/end of August/,/September/,/dates and addresses/],
    'household-first':[/Broad Street water/,/before the illness/,/nursing/],
    'pump-sample':[/inspection/,/no decisive/],
    'household-routines':[/Broad Street/,/errands/,/drinking/],
    'workhouse-supply':[/five hundred/,/few deaths/,/separate supply/],
    'brewery-supply':[/No deaths/,/beer/,/well/],
    'household-away':[/drank at Broad Street/,/working/,/water home/,/ill here/],
  };
  for(const [id,facts] of Object.entries(required)) {
    const graph=conversations.find(c=>c.id===id);
    const walk=(beatId,visited=[])=>{
      const beat=graph.beats.find(b=>b.id===beatId),path=[...visited,beat.text];
      if(beat.conclusion) for(const fact of facts)assert.match(path.join(' '),fact,id);
      else for(const choice of beat.choices)walk(choice.next,path);
    };
    walk(graph.start);
  }
});

test('VR notebook contains assignments and evidence without historical or source essays',()=>{
  const game=reviewGame(),scene=Object.create(BroadStreetScene.prototype),cards=[];
  let page=0,total=0;
  Object.assign(scene,{gameState:game,vrTextPageCounts:new Map(),addVrText:()=>{},addVrPanelButton:()=>{},
    getVrListPage:(_key,count)=>{total=count;return page;},addVrNotebookCard:card=>cards.push(card)});
  do {scene.buildVrNotebookPanel();page++;} while(page*2<total);
  assert.equal(cards.length,game.getAllEvidence().length+1);
  assert.equal(cards.filter(c=>c.studyGoal).length,1);
  assert.doesNotMatch(cards.map(c=>[c.eyebrow,c.title,c.body,c.meta].join(' ')).join(' '),/Historical notes|Chronology and reconstruction|Table I|composite|teaching reconstruction/i);
});


test('water inspection requires flow from the local handle, not a pump click or an interrupted stroke',()=>{
  for(const location of ['broad-street','workhouse']) {
    const game=gameAtDay(2);game.travelToLocation(location);
    const street=new PumpCourtyard(),workhouse=new WorkhouseCourtyard(),scene=Object.create(BroadStreetScene.prototype);
    street.group.visible=location==='broad-street';workhouse.group.visible=location==='workhouse';
    const action=location==='workhouse'?workhouse.pumpAction:street.pumpAction;
    const effects=[];let flowing=false;
    Object.assign(scene,{gameState:game,courtyard:street,workhouse,reducedCharacterMotion:{matches:false},sound:{effect(kind){effects.push(kind);flowing=true;},stopWater(){flowing=false;}}});
    const hotspot=location==='workhouse'?'workhouse-pump':'broad-street-pump';
    assert.match(game.inspectHotspot(hotspot).message,/handle/);assert.equal(game.getConversationView(),undefined);
    action.stroke();for(let i=0;i<5;i++)scene.updatePumpInteractions(.05);
    assert.equal(game.hasPumpedWater(location),false);action.reset();scene.updatePumpInteractions(.05);
    assert.equal(game.hasPumpedWater(location),false,'cancelled stroke cannot supply a sample');
    assert.deepEqual(effects,[],'no sound before water appears');
    action.stroke();for(let i=0;i<12;i++)scene.updatePumpInteractions(.05);
    assert.ok(action.water.visible);assert.equal(game.hasPumpedWater(location),true);
    assert.deepEqual(effects,['water']);assert.equal(flowing,true);
    for(let i=0;i<25;i++)scene.updatePumpInteractions(.05);
    assert.deepEqual(effects,['water'],'one sound per stroke');assert.equal(flowing,false);
    assert.equal(game.hasPumpedWater(location==='workhouse'?'broad-street':'workhouse'),false,'supplies remain separate');
    assert.equal(game.hasEvidence('pump-water-inspection'),false,'drawing water alone never awards evidence');
    assert.ok(game.inspectHotspot(hotspot).dialogue);finishConversation(game);
    assert.equal(location==='workhouse'?game.hasWorkhouseSample():game.hasEvidence('pump-water-inspection'),true);
  }
});

test('both sample orders yield the same inconclusive comparison without extra objectives or cards',()=>{
  for(const order of [['broad-street','workhouse'],['workhouse','broad-street']]) {
    let game=gameAtDay(2);
    for(const location of order) {
      game.travelToLocation(location);game.recordPumpedWater(location);
      const restored=new GameState();assert.ok(restored.restoreSave(game.serializeSave()));game=restored;
      const hotspot=location==='workhouse'?'workhouse-pump':'broad-street-pump';
      game.inspectHotspot(hotspot);const view=game.getConversationView();game.chooseConversation(view.beatId,view.choices[0].id);
      const resumed=new GameState();assert.ok(resumed.restoreSave(game.serializeSave()));game=resumed;game.inspectHotspot(hotspot);finishConversation(game);
    }
    assert.match(game.getConversationView().text,/no notable difference/);
    assert.match(game.getEvidence('pump-water-inspection').summary,/neither|either sample/);
    assert.match(game.getAllEvidence().find(c=>c.id==='pump-water-inspection').sourceLabel,/workhouse/);
    assert.equal(game.getAllEvidence().length,10);assert.equal(game.getCollectedEvidence().length,4);
    assert.equal(game.getAssignments().find(o=>o.id==='workhouse').complete,false,'sample cannot replace steward interview');
    game.reset();assert.equal(game.hasWorkhouseSample(),false);assert.equal(game.hasPumpedWater('workhouse'),false);
  }
});

test('sample save validation preserves old inspections but rejects invalid or prematurely drawn water',()=>{
  const early=gameAtDay(1);early.travelToLocation('broad-street');assert.equal(early.recordPumpedWater('broad-street'),false);
  const game=gameAtDay(2);game.travelToLocation('broad-street');assert.equal(game.recordPumpedWater('workhouse'),false);
  game.recordPumpedWater('broad-street');game.inspectHotspot('broad-street-pump');
  const old=JSON.parse(game.serializeSave());delete old.pumpedWater;
  const restored=new GameState();assert.ok(restored.restoreSave(JSON.stringify(old)));assert.ok(restored.hasPumpedWater('broad-street'));
  for(const water of [[],['workhouse'],['brewery'],['broad-street','broad-street'],null]) {
    const invalid={...old,pumpedWater:water};
    assert.equal(new GameState().restoreSave(JSON.stringify(invalid)),false);
  }
  const invalid=JSON.parse(early.serializeSave());invalid.pumpedWater=['broad-street'];
  assert.equal(new GameState().restoreSave(JSON.stringify(invalid)),false);
});

test('workhouse pump replaces static geometry without moving the well, buckets or collision envelope',async()=>{
  const room=new WorkhouseCourtyard(),model=await exportedRoom('workhouse-courtyard.glb');
  room.group.visible=true;model.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(3,1.5,-3.5),new THREE.Vector3(0,0,-1));
  assert.ok(ray.intersectObject(model,true)[0].distance<3,'authored pump initially present');
  const environment=new THREE.Texture();model.traverse(o=>{if(o.isMesh)o.material.envMap=environment;});
  const before=triangles(model);room.prepareVisuals(model);const after=triangles(model);
  const material=room.pump.group.children.find(o=>o.isMesh).material;
  assert.equal(material.envMap,environment);assert.equal(material.envMapIntensity,1.4);assert.equal(material.lightMap,null);
  assert.ok(before-after>100 && before-after<5000,'only pump triangles removed');
  assert.ok((ray.intersectObject(model,true)[0]?.distance??Infinity)>4,'old pump cannot overlap or flicker');
  room.group.add(model);room.group.updateMatrixWorld(true);
  assert.equal(room.hotspotFor(room.pick(ray).object),'workhouse-pump');
  assert.equal(room.canTeleport({object:room.floor,point:new THREE.Vector3(3,0,-5.8)}),false);
  const origin=new THREE.Vector3(5.1,1.15,-5.8),target=new THREE.Vector3(3.9,.72,-5.8);
  ray.set(origin,target.sub(origin).normalize());const handle=room.pick(ray);
  assert.ok(room.pumpAction.owns(handle.object),'handle reachable from outside the well collision area');
  assert.ok(handle.distance<2.4);assert.equal(room.canTeleport(handle),false);assert.equal(room.hotspotFor(handle.object),undefined);
});

test('both pumps work through the same mouse, keyboard and controller tactile path with reach limits',()=>{
  for(const location of ['broad-street','workhouse'])for(const controller of [undefined,new THREE.Group()]) {
    const game=gameAtDay(2);game.travelToLocation(location);
    const street=new PumpCourtyard(),workhouse=new WorkhouseCourtyard(),scene=Object.create(BroadStreetScene.prototype);
    street.group.visible=location==='broad-street';workhouse.group.visible=location==='workhouse';
    const room=location==='workhouse'?workhouse:street,action=room.pumpAction;
    Object.assign(scene,{gameState:game,courtyard:street,workhouse,camera:new THREE.PerspectiveCamera(),propHold:new PropHold(),reducedCharacterMotion:{matches:true}});
    let distance=3;room.pick=()=>({object:action.handle.children[0],distance});
    const ray=new THREE.Raycaster();assert.equal(scene.activateTactile(ray,controller),true);
    for(let i=0;i<15;i++)scene.updatePumpInteractions(.05);assert.equal(game.hasPumpedWater(location),false);
    distance=1;assert.equal(scene.activateTactile(ray,controller),true);
    for(let i=0;i<15;i++)scene.updatePumpInteractions(.05);assert.equal(game.hasPumpedWater(location),true);
    scene.resetTactileInteractions();assert.equal(action.water.visible,false);assert.equal(action.handle.rotation.z,0);
  }
});


function unbriefedDay(day) {
  const saved=JSON.parse(gameAtDay(day,true).serializeSave());
  const id=day===1?'snow-introduction':`snow-day-${day}`;
  delete saved.conversation.cursors[id];saved.conversation.concluded=saved.conversation.concluded.filter(c=>c!==id);
  saved.location='snow-desk';saved.dayIntro=true;
  const game=new GameState();assert.ok(game.restoreSave(JSON.stringify(saved)));return game;
}

test('each day allows office exploration and voluntary Snow conversations while gating map and travel',()=>{
 for(const day of [1,2,3]) {
  const game=unbriefedDay(day);
  assert.equal(game.canUseMap(),false);assert.equal(game.needsDailyBriefing(),true);
  game.dismissDayIntroduction();assert.equal(game.getConversationView(),undefined);
  game.inspectHotspot('john-snow');assert.equal(game.getConversationView().id,day===1?'snow-introduction':`snow-day-${day}`);
  for(let n=0;n<20;n++) {
    const view=game.getConversationView();if(view.complete)break;
    assert.equal(game.canUseMap(),false);
    for(const location of game.getLocations())assert.equal(game.canTravelToLocation(location.id),false);
    assert.equal(game.travelToLocation('broad-street').traveled,false);
    game.beginFieldwork();assert.equal(game.currentLocationId,'snow-desk');
    game.closeDialogue();assert.equal(game.getConversationView(),undefined,'briefing can be dismissed without unlocking travel');
    assert.equal(game.canUseMap(),false);game.inspectHotspot('john-snow');assert.equal(game.getConversationView().beatId,view.beatId);
    const restored=new GameState();assert.ok(restored.restoreSave(game.serializeSave()));
    assert.equal(restored.currentLocationId,'snow-desk');assert.equal(restored.getConversationView(),undefined);
    restored.inspectHotspot('john-snow');assert.equal(restored.getConversationView().beatId,view.beatId);
    game.chooseConversation(view.beatId,view.choices[0].id);
  }
  if(day===3)completeSurvey(game);
  assert.ok(game.hasCurrentAssignment());assert.ok(game.canUseMap());
  assert.ok(game.canTravelToLocation('broad-street'));assert.equal(game.canTravelToLocation('registrar'),day===1);
  game.closeDialogue();assert.equal(game.getConversationView(),undefined);assert.ok(game.travelToLocation('broad-street').traveled);
 }
});

test('old saves outside the office before a daily assignment resume the unfinished Snow briefing safely',()=>{
 for(const day of [2,3]) {
  const game=unbriefedDay(day);game.dismissDayIntroduction();game.inspectHotspot('john-snow');
  const first=game.getConversationView();game.chooseConversation(first.beatId,'doubt');
  const old=JSON.parse(game.serializeSave());old.location='broad-street';
  const restored=new GameState();assert.ok(restored.restoreSave(JSON.stringify(old)));
  assert.equal(restored.currentLocationId,'snow-desk');assert.equal(restored.getConversationView(),undefined);
  restored.inspectHotspot('john-snow');assert.equal(restored.getConversationView().beatId,'doubt');
  assert.equal(restored.canUseMap(),false);finishConversation(restored);if(day===3)completeSurvey(restored);assert.ok(restored.canUseMap());
 }
});

test('VR day entry hides the panel and locked map shortcuts do not force a conversation',()=>{
 for(const day of [1,2,3]) {
  const game=unbriefedDay(day),scene=Object.create(BroadStreetScene.prototype);
  Object.assign(scene,{gameState:game,renderer:{xr:{isPresenting:true}},vrPanelMode:'home',vrPanelVisible:true,
    vrPanel:new THREE.Group(),vrIdleHint:new THREE.Group(),refreshHotspots:()=>{},markVrPanelDirty:()=>{},placeVrPanelInFront:()=>{}});
  scene.handleVrButton({type:'dismiss-day'});
  assert.equal(game.getConversationView(),undefined);assert.equal(scene.vrPanelVisible,false);
  scene.openVrShortcut('map');assert.equal(scene.vrPanelMode,'home');assert.equal(scene.vrPanelVisible,false);
  scene.handleVrButton({type:'mode',mode:'map'});assert.equal(scene.vrPanelMode,'home');
  scene.hideVrPanel();assert.equal(scene.vrPanelVisible,false);assert.equal(game.getConversationView(),undefined);
  game.inspectHotspot('john-snow');finishConversation(game);if(day===3)completeSurvey(game);scene.openVrShortcut('map');assert.equal(scene.vrPanelMode,'map');
  scene.hideVrPanel();assert.equal(scene.vrPanelVisible,false);
 }
});

test('daily destinations hide future locations and archive earlier field visits without travel',()=>{
 const expected={1:['snow-desk','broad-street','registrar','household'],2:['snow-desk','broad-street','household-routines','workhouse','manufactory'],3:['snow-desk','broad-street','brewery','household-away']};
 for(const day of [1,2,3]) {
  const game=gameAtDay(day);
  assert.deepEqual(game.getLocations().filter(l=>game.canTravelToLocation(l.id)).map(l=>l.id).sort(),expected[day].sort());
  const visible=game.getMapLocations();
  for(const location of visible)assert.ok(game.canTravelToLocation(location.id)||game.isArchivedLocation(location));
  if(day>1) {
    assert.ok(game.isArchivedLocation(game.getLocation('household')));
    assert.equal(game.travelToLocation('household').traveled,false);
    const save=JSON.parse(game.serializeSave());save.location='household';
    const restored=new GameState();assert.ok(restored.restoreSave(JSON.stringify(save)));assert.equal(restored.currentLocationId,'broad-street');
  }
  game.travelToLocation('broad-street');
  const targets=new WorldTravelTargets(()=>new THREE.MeshBasicMaterial());targets.refresh(game);
  for(const route of streetTravelRoutes)assert.equal(targets.group.getObjectByName(route.id).visible,game.canTravelToLocation(route.to));
  if(day!==1) {
    const ray=new THREE.Raycaster(new THREE.Vector3(-11,1.3,-6),new THREE.Vector3(0,0,-1));
    assert.equal(targets.pick(ray,'broad-street'),undefined,'invisible household doorway must not intercept selection');
  }
 }
});

test('daily street placements keep conversation anchors, targets and collision together',async()=>{
 const {streetPlacement,streetExtras}=await load('simulation/streetPopulation');
 const people=new SceneCharacters('street');people.group.userData.characterStatus='ready';
 for(const day of [1,2,3]) {
  const game=gameAtDay(day);game.travelToLocation('broad-street');people.setDay(day);
  for(const id of ['resident-west','resident-east','whitehead']) {
    const placement=streetPlacement(day,id);const [x,y,z]=placement.position;
    assert.ok(isValidDestination(new THREE.Vector3(x,0,z)));
    assert.ok(people.blocks(new THREE.Vector3(x,0,z)));
    const target=people.targets.find(t=>t.name===id);assert.equal(target.position.x,x);assert.equal(target.position.z,z+.08);
    game.inspectHotspot(id);assert.deepEqual(game.getConversationView().anchor,[x,1.45,z]);game.closeDialogue();
    for(const route of streetTravelRoutes)if(route.zone)assert.ok(Math.hypot(x-route.zone.x,z-route.zone.z)>route.zone.radius+.5,`${id} obstructs ${route.id}`);
  }
  for(const extra of streetExtras) {
    const [x,z]=extra.days[day-1];assert.ok(isValidDestination(new THREE.Vector3(x,0,z)));
    for(const route of streetTravelRoutes)if(route.zone)assert.ok(Math.hypot(x-route.zone.x,z-route.zone.z)>route.zone.radius+.5,'extra obstructs exit');
  }
 }
 for(const id of ['resident-west','resident-east','whitehead'])assert.equal(new Set([1,2,3].map(d=>JSON.stringify(streetPlacement(d,id).position))).size,3);
});

test('VR map shares daily visibility and distinguishes earlier visits from available destinations',()=>{
 for(const day of [1,2,3]) {
  const game=gameAtDay(day);const scene=Object.create(BroadStreetScene.prototype);
  Object.assign(scene,{gameState:game,vrPanelDrawCommands:[],vrMapImages:new Map()});
  scene.addVrMap(0,0,1,1);const map=scene.vrPanelDrawCommands[0];
  assert.deepEqual(map.locations.map(l=>l.id),game.getMapLocations().map(l=>l.id));
  for(const marker of map.locations)assert.equal(marker.archived,game.isArchivedLocation(game.getLocation(marker.id)));
  if(day>1)assert.equal(map.locations.find(l=>l.id==='household').archived,true);
  if(day<3)assert.equal(map.locations.some(l=>l.id==='household-away'),false);
 }
});

test('Snow welcomes unfinished visits each day without advancing evidence, recap or assignments',()=>{
 for(const day of [1,2,3]) {
  const game=gameAtDay(day);const evidence=game.getCollectedEvidence().map(c=>c.id);
  const assignments=game.getAssignments();
  assert.ok(game.inspectHotspot('john-snow').dialogue);assert.equal(game.getConversationView().id,'snow-progress');
  game.closeDialogue();game.inspectHotspot('john-snow');finishConversation(game);
  for(const task of assignments.filter(t=>!t.complete))assert.ok(game.getConversationView().text.includes(task.title.toLowerCase()));
  assert.deepEqual(game.getCollectedEvidence().map(c=>c.id),evidence);assert.deepEqual(game.getAssignments(),assignments);
  assert.equal(game.canEndDay(),false);assert.equal(game.prepareBoardArgument().prepared,false);
  const restored=new GameState();assert.ok(restored.restoreSave(game.serializeSave()));
  assert.ok(restored.inspectHotspot('john-snow').dialogue);assert.equal(restored.getConversationView().id,'snow-progress');
 }
 const game=gameAtDay(1);game.inspectHotspot('john-snow');finishConversation(game);game.closeDialogue();
 talk(game,'registrar','registrar-ledger');game.travelToLocation('snow-desk');game.inspectHotspot('john-snow');
 assert.match(game.getConversationView().text,/household 1/);assert.doesNotMatch(game.getConversationView().text,/registrar/);
 game.closeDialogue();talk(game,'household','broad-street-household');game.travelToLocation('snow-desk');game.inspectHotspot('john-snow');
 assert.equal(game.getConversationView().id,'snow-recap-1');assert.equal(game.canEndDay(),false);
 finishConversation(game);assert.equal(game.canEndDay(),true);
});


test('Snow maintains the water case and addresses declining deaths for every recommendation and response path',()=>{
 for(const {id} of new GameState().getHypotheses())for(const branch of [0,1,2]) {
  let game=reviewGame();game.selectHypothesis(id);game.prepareBoardArgument();game.presentToBoard();game.beginHearing();
  const seen=new Set();
  for(let i=0;i<40;i++) {
   const view=game.getConversationView();seen.add(view.beatId);
   if(view.beatId==='declining')assert.match(view.text,/deaths are already declining/);
   if(view.beatId.startsWith('declining-'))assert.match(view.text,/not yet found.*poison.*could do so again.*prevent/s);
   if(view.beatId==='recommendation') {
    assert.match(view.text,/I believe.*water.*remove the handle/);
    assert.match(view.choices[0].label,id==='waterborne'?/Support Snow/:/Recommend instead/);
   }
   if(view.beatId==='snow-response')assert.match(view.text,id==='waterborne'?/precaution/:/cannot agree.*close the pump/);
   if(view.complete) {assert.match(view.text,id==='waterborne'?/follow Dr. Snow.*removed tomorrow/:/Despite Dr. Snow.*leave the pump in use/);break;}
   assert.equal(game.boardPresented,false);game.finishBoard();assert.equal(game.getStage(),'board');
   game.chooseConversation(view.beatId,view.choices[Math.min(branch,view.choices.length-1)].id);
   // Reopening from a real save on each beat must retain the same recommendation and decision.
   const restored=new GameState();assert.ok(restored.restoreSave(game.serializeSave()));restored.beginHearing();game=restored;
  }
  assert.ok(seen.has('declining'));assert.ok(seen.has('snow-response'));assert.ok(game.boardPresented);
  game.finishBoard();assert.equal(game.isPumpClosed(),id==='waterborne');
  assert.equal(game.getCurrentLocation().id,id==='waterborne'?'broad-street':'board-room');
  assert.equal(game.getDisplayDate(),id==='waterborne'?'September 8, 1854':'September 7, 1854');
  const restored=new GameState();assert.ok(restored.restoreSave(game.serializeSave()));assert.equal(restored.getCurrentLocation().id,game.getCurrentLocation().id);assert.equal(restored.isPumpClosed(),game.isPumpClosed());
 }
});

test('legacy completed water saves resume at the closed pump, and a new inquiry restores normal state',()=>{
 const game=reviewGame();game.selectHypothesis('waterborne');game.prepareBoardArgument();game.presentToBoard();game.beginHearing();finishConversation(game);game.finishBoard();
 const legacy=JSON.parse(game.serializeSave());legacy.location='board-room';
 const restored=new GameState();assert.ok(restored.restoreSave(JSON.stringify(legacy)));assert.equal(restored.getCurrentLocation().id,'broad-street');assert.ok(restored.isPumpClosed());
 assert.equal(restored.travelToLocation('brewery').traveled,false);assert.ok(restored.travelToLocation('snow-desk').traveled);const revisited=new GameState();assert.ok(revisited.restoreSave(restored.serializeSave()));assert.equal(revisited.getCurrentLocation().id,'snow-desk');assert.ok(revisited.isPumpClosed());
 restored.reset();assert.equal(restored.isPumpClosed(),false);
});

test('pump closure removes handle interaction and water, shows the hanging notice, and reverses cleanly',()=>{
 const street=new PumpCourtyard();assert.ok(street.pumpAction.stroke());street.setPumpClosed(true);
 assert.equal(street.pumpAction.handle.visible,false);assert.equal(street.pumpAction.water.visible,false);assert.equal(street.pumpAction.stroke(),false);assert.equal(street.closureNotice.visible,true);
 street.pumpAction.handle.traverse(o=>assert.equal(o.layers.mask,0));
 const noticeCount=street.closureNotice.children.length;street.setPumpClosed(true);assert.equal(street.closureNotice.children.length,noticeCount);
 street.setPumpClosed(false);assert.equal(street.closureNotice.visible,false);street.closureNotice.traverse(o=>assert.equal(o.layers.mask,0));assert.equal(street.pumpAction.handle.visible,true);assert.ok(street.pumpAction.stroke());
 for(let i=0;i<6;i++)street.pumpAction.update(.05,false);
 street.setPumpClosed(false);assert.equal(street.pumpAction.stroke(),false,'ordinary UI refresh must not reset an ongoing stroke');
});


test('morning map comparisons gate fieldwork, resume every choice, and reveal the outside household before assignment',()=>{
 for(const answerIndex of [0,1]) {
  let game=gameAtDay(3,true);assert.equal(game.canResumePumpComparison(),true);
  assert.equal(game.hasCurrentAssignment(),false);assert.equal(game.canUseMap(),false);
  assert.equal(game.getConversationView(),undefined);game.inspectHotspot('john-snow');assert.ok(game.getFieldworkView());
  game.resumePumpComparison();const points=new Map();let count=0;
  while(game.getFieldworkView()) {
   const view=game.getFieldworkView().guided;
   assert.equal(game.currentLocationId,'snow-desk');assert.equal(game.hasEvidence('walking-access'),false);
   for(const id of ['broad-street','brewery','household-away'])assert.equal(game.travelToLocation(id).traveled,false);
   const state=JSON.parse(game.serializeSave()).surveyProgress;
   if(state.phase==='origin') {assert.equal(view.results.length,0);points.set(state.routeId,view.mapPoint);assert.match(view.text,/I measured/);}
   if(state.phase==='done') {assert.ok(game.hasWalkingBoundary());assert.equal(view.mapPoint.label,'Household 3');assert.match(view.text,/outside/);}
   const action=view.actions[Math.min(answerIndex,view.actions.length-1)].id;
   assert.ok(game.advancePumpComparison(action,view.key));assert.equal(game.advancePumpComparison(action,view.key),false);
   if(game.getFieldworkView()) {
    const next=game.getFieldworkView().guided,restored=new GameState();assert.ok(restored.restoreSave(game.serializeSave()));game=restored;
    assert.equal(game.getFieldworkView(),undefined);game.inspectHotspot('john-snow');
    assert.deepEqual(game.getFieldworkView().guided,next,'selecting Snow after reload resumes the exact map beat');
   }
   assert.ok(++count<10);
  }
  assert.equal(points.size,2);assert.equal(game.getRouteObservations().length,4);
  assert.equal(game.getConversationView().id,'walking-review');assert.equal(game.canUseMap(),false);
  // The final assignment conversation also resumes without discarding the map result.
  const view=game.getConversationView();game.chooseConversation(view.beatId,view.choices[answerIndex].id);
  const beat=game.getConversationView().beatId,restored=new GameState();assert.ok(restored.restoreSave(game.serializeSave()));game=restored;
  assert.equal(game.getConversationView(),undefined);game.inspectHotspot('john-snow');
  assert.equal(game.getConversationView().beatId,beat);finishConversation(game,answerIndex);
  assert.equal(game.getCollectedEvidence().filter(e=>e.id==='walking-access').length,1);
  assert.match(game.getConversationView().text,/Household 3 outside the boundary/);
  assert.equal(game.canResumePumpComparison(),false);assert.ok(game.canUseMap());assert.ok(game.canTravelToLocation('household-away'));
 }
});

test('table comparison validates cursors and migrates partial visits from retired pump locations',()=>{
 for(const day of [1,2])assert.equal(gameAtDay(day).resumePumpComparison(),false);
 const base=gameAtDay(3,true),old=JSON.parse(base.serializeSave());delete old.mapExercise;
 old.routes=['marlborough-broad'];old.selectedRoute='marlborough-alternative';old.location='marlborough-pump';
 const migrated=new GameState();assert.ok(migrated.restoreSave(JSON.stringify(old)));assert.equal(migrated.currentLocationId,'snow-desk');
 assert.equal(migrated.getRouteObservations().length,0);assert.equal(migrated.getFieldworkView(),undefined);migrated.inspectHotspot('john-snow');assert.ok(migrated.getFieldworkView());assert.equal(migrated.canUseMap(),false);completeSurvey(migrated);
 const completed=new GameState();assert.ok(completed.restoreSave(migrated.serializeSave()));assert.ok(completed.hasEvidence('walking-access'));assert.equal(completed.getFieldworkView(),undefined);
 base.resumePumpComparison();const valid=base.serializeSave();
 for(const mutation of [v=>v.surveyProgress.phase='missing',v=>v.surveyProgress.routeId='missing',v=>v.surveyProgress.phase='arrival',v=>v.surveyProgress.phase='feedback',v=>v.surveyProgress.phase='done',v=>v.selectedRoute='marlborough-broad']) {
  const data=JSON.parse(valid);mutation(data);const before=base.serializeSave();assert.equal(base.restoreSave(JSON.stringify(data)),false);assert.equal(base.serializeSave(),before);
 }
});

test('VR table uses the shared map points and choices without changing rooms',()=>{
 const game=gameAtDay(3,true);game.resumePumpComparison();const scene=Object.create(BroadStreetScene.prototype),buttons=[];
 Object.assign(scene,{gameState:game,vrMapImages:new Map(),vrPanelMode:'home',vrPanelVisible:true,vrPanelDrawCommands:[],clearVrPanel:()=>{},addVrText:()=>{},addVrIconButton:()=>{},addVrPanelSurface:()=>{},addVrPanelButton:(label,x,y,w,h,action)=>buttons.push({label,action}),
  showVrPanel:()=>{},placeVrPanelInFront:()=>{},refreshHotspots:()=>{},markVrPanelDirty:()=>{}});
 while(game.getFieldworkView()) {
  buttons.length=0;scene.rebuildVrPanel();const guide=game.getFieldworkView().guided;
  const map=scene.vrPanelDrawCommands.find(c=>c.kind==='map');assert.deepEqual(map.exercisePoint,guide.mapPoint);assert.equal(map.locations.length,0);
  assert.deepEqual(buttons.map(b=>b.label),guide.actions.map(a=>a.label));scene.handleVrButton(buttons[0].action);
  assert.equal(game.currentLocationId,'snow-desk');
 }
 assert.equal(scene.vrPanelMode,'home');assert.ok(game.hasWalkingBoundary());assert.equal(game.getConversationView().speaker,'John Snow');
});

test('Continue permits exploration before resuming the table or Snow assignment, with travel still gated',()=>{
 const source=gameAtDay(3,true);source.resumePumpComparison();
 const states=[source.serializeSave()];
 while(source.getFieldworkView()){const guide=source.getFieldworkView().guided;source.advancePumpComparison(guide.actions[0].id,guide.key);states.push(source.serializeSave());}
 for(const saved of states){
  const storage={getItem:()=>saved,setItem:()=>{},removeItem:()=>{}},game=new GameState();
  game.configurePersistence(storage,'/vr-snow/preview/inquiry/');assert.ok(game.startupOpen);assert.ok(game.hasSavedInquiry);assert.ok(game.continueInquiry());
  assert.ok(!game.startupOpen);assert.equal(game.currentLocationId,'snow-desk');assert.ok(!game.canUseMap());
  assert.equal(game.getFieldworkView(),undefined);assert.equal(game.getConversationView(),undefined);
  game.inspectHotspot('john-snow');assert.ok(game.getFieldworkView() || game.getConversationView()?.id==='walking-review');
  assert.equal(game.travelToLocation('household-away').traveled,false);
 }
});

test('every street figure has a daily conversation, matching target and clear approach',async()=>{
 const {streetActorIds,streetPlacement}=await load('simulation/streetPopulation');
 assert.deepEqual(new Set(characterDefinitions.street.actors.map(a=>a.id)),new Set(streetActorIds));
 const people=new SceneCharacters('street');people.group.userData.characterStatus='ready';
 for(const day of [1,2,3]) {
  const game=gameAtDay(day);game.travelToLocation('broad-street');people.setDay(day);
  for(const id of streetActorIds) {
   const p=streetPlacement(day,id),target=people.targets.find(t=>t.name===id);
   assert.ok(target,`${id} has its own selectable body`);assert.ok(game.getHotspots().some(h=>h.id===id));
   assert.deepEqual([target.position.x,target.position.z],[p.position[0],p.position[2]+.08]);
   const ray=new THREE.Raycaster(target.position.clone().add(new THREE.Vector3(0,0,1)),new THREE.Vector3(0,0,-1));
   people.group.updateMatrixWorld(true);assert.equal(people.pick(ray)?.object,target);
   game.inspectHotspot(id);assert.equal(game.getConversationView().actorId,id);
   assert.deepEqual(game.getConversationView().anchor,[p.position[0],1.45,p.position[2]]);game.closeDialogue();
  }
 }
 assert.equal(characterDefinitions.street.actors.filter(a=>a.dress).length,2);
});

test('new residents support follow-up choices and interruption without evidence or progression rewards',async()=>{
 const {streetExtras}=await load('simulation/streetPopulation');
 for(const day of [1,2,3])for(const {id} of streetExtras)for(const first of [0,1,2])for(const follow of [-1,0,1,2]) {
  let game=gameAtDay(day);game.travelToLocation('broad-street');
  const evidence=game.getCollectedEvidence().map(c=>c.id),assignments=game.getAssignments();
  game.inspectHotspot(id);let v=game.getConversationView();assert.equal(v.choices.length,3);
  game.chooseConversation(v.beatId,v.choices[first].id);const beat=game.getConversationView().beatId;
  game.closeDialogue();const restored=new GameState();assert.ok(restored.restoreSave(game.serializeSave()));game=restored;
  game.inspectHotspot(id);assert.equal(game.getConversationView().beatId,beat);
  v=game.getConversationView();game.chooseConversation(v.beatId,follow<0?'thanks':'another');
  if(follow>=0){v=game.getConversationView();game.chooseConversation(v.beatId,v.choices[follow].id);}
  finishConversation(game);assert.ok(game.getConversationView().complete);game.closeDialogue();game.inspectHotspot(id);
  assert.ok(game.getConversationView().complete,'a finished conversation does not replay');
  assert.deepEqual(game.getCollectedEvidence().map(c=>c.id),evidence);assert.deepEqual(game.getAssignments(),assignments);
  assert.ok(game.hasCurrentAssignment());assert.equal(game.stage,'field');
 }
});

const {InteractionIdleHint}=await load('walkable/InteractionIdleHint');
test('idle reminder waits thirty quiet seconds, lasts four seconds and does not repeat while idle',()=>{
 const hint=new InteractionIdleHint();
 assert.equal(hint.update(0,false),false);assert.equal(hint.update(29.99,false),false);
 assert.equal(hint.update(30,false),true);assert.equal(hint.update(33.99,false),true);
 assert.equal(hint.update(34,false),false);assert.equal(hint.update(300,false),false);
 assert.equal(hint.update(301,true),false);assert.equal(hint.update(330.99,false),false);
 assert.equal(hint.update(331,false),true);assert.equal(hint.update(332,true),false);
 assert.equal(hint.update(361.99,false),false);assert.equal(hint.update(362,false),true);
 hint.reset();assert.equal(hint.update(10000,false),false);assert.equal(hint.update(10029.99,false),false);assert.equal(hint.update(10030,false),true);
});

test('VR reminder detects walking, aiming, held objects, controller use and panels rather than elapsed panel-close time',()=>{
 const scene=Object.create(BroadStreetScene.prototype),camera=new THREE.PerspectiveCamera(),controller=new THREE.Group();
 const source={gamepad:{axes:[0,0,0,0],buttons:[{pressed:false}]}},game=gameAtDay(1);
 Object.assign(scene,{camera,gameState:game,vrControllers:[controller],vrInputSources:new Map([[controller,source]]),
   vrPanelVisible:false,worldTravelPending:false,propHold:{},interactionIdleHint:new InteractionIdleHint(),idlePoseSamples:new Map(),
   idlePosePosition:new THREE.Vector3(),idlePoseRotation:new THREE.Quaternion(),vrIdleHint:new THREE.Sprite(),
   vrIdleHintPosition:new THREE.Vector3(),vrIdleHintDirection:new THREE.Vector3(),vrIdleHintDown:new THREE.Vector3(),vrIdleHintQuaternion:new THREE.Quaternion()});
 const update=t=>{scene.updateVrIdleHint(t);return scene.vrIdleHint.visible;};
 assert.equal(update(0),false);assert.equal(update(30),true);
 camera.position.x=.05;assert.equal(update(31),false);assert.equal(update(60),false);assert.equal(update(61),true);
 controller.rotation.y=.2;assert.equal(update(62),false);
 source.gamepad.axes[2]=.7;assert.equal(update(100),false);assert.equal(update(150),false);
 source.gamepad.axes[2]=0;assert.equal(update(179),false);assert.equal(update(180),true);
 source.gamepad.buttons[0].pressed=true;assert.equal(update(181),false);source.gamepad.buttons[0].pressed=false;
 scene.propHold.prop={};assert.equal(update(220),false);assert.equal(update(300),false);scene.propHold.prop=undefined;
 scene.vrPanelVisible=true;assert.equal(update(400),false);assert.equal(update(1000),false);
 scene.vrPanelVisible=false;assert.equal(update(1029),false);assert.equal(update(1030),true);assert.equal(update(1034),false);
 scene.worldTravelPending=true;assert.equal(update(1100),false);scene.worldTravelPending=false;
 scene.courtyard={group:{visible:true},pumpAction:{water:{visible:true}}};assert.equal(update(1200),false);
 scene.courtyard.pumpAction.water.visible=false;assert.equal(update(1229),false);assert.equal(update(1230),true);
});

test('right stick spins and tilts the held object without turning the viewer; release requires neutral',()=>{
  const scene=Object.create(BroadStreetScene.prototype),hand=new THREE.Group(),root=new THREE.Group(),item=new THREE.Group();root.add(item);
  const prop=new InspectableProp(item,'Cup'),hold=new PropHold();hold.begin(prop,hand,false);
  const source={handedness:'right',gamepad:{mapping:'xr-standard',axes:[0,0,.8,.7]}};let turns=0;
  Object.assign(scene,{propHold:hold,vrControllers:[hand],vrInputSources:new Map([[hand,source]]),vrPanelVisible:false,
    gameState:fieldGame(true),courtyard:new PumpCourtyard(),turnWalkableView:()=>turns++});
  scene.courtyard.group.visible=true;
  const before=item.quaternion.clone();for(let i=0;i<30;i++){scene.updateSnapTurn(1/60);hold.update(1/60);}
  assert.ok(item.quaternion.angleTo(before)>.2);assert.ok(Math.abs(item.quaternion.x)>.1,'pitch changes');assert.ok(Math.abs(item.quaternion.y)>.1,'yaw changes');assert.equal(turns,0);
  hold.release();scene.updateSnapTurn(1/60);assert.equal(turns,0,'release while deflected must not snap');
  source.gamepad.axes=[0,0,0,.7];scene.updateSnapTurn(1/60);assert.equal(scene.snapTurnLocked,true,'both axes must return to neutral');
  source.gamepad.axes=[0,0,0,0];scene.updateSnapTurn(1/60);source.gamepad.axes=[0,0,.8,0];scene.updateSnapTurn(1/60);assert.equal(turns,1);
});

test('resting props share draw calls, remain ray targets, and restore their batch after return',()=>{
  const model=new THREE.Group(),room=new THREE.Group(),material=new THREE.MeshBasicMaterial();room.add(model);
  for(const x of [-1,1]){const mesh=new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.2),material);mesh.position.set(x,1,0);model.add(mesh);}
  const props=extractProps(model,room,'test',[-1,1].map(x=>({name:'Cup',min:[x-.11,.89,-.11],max:[x+.11,1.11,.11]})));
  assert.equal(props.length,2);const batch=room.children.find(o=>o.name==='Resting portable objects');assert.ok(batch);
  assert.ok(props.every(p=>!p.group.visible));room.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(-1,1,2),new THREE.Vector3(0,0,-1));assert.ok(ray.intersectObject(props[0].group,true).length,'hidden individual mesh remains an exact ray target');
  const original=Array.from(batch.geometry.index.array),hold=new PropHold();hold.begin(props[0],new THREE.Group(),false);
  assert.equal(props[0].group.visible,true);assert.notDeepEqual(Array.from(batch.geometry.index.array),original,'home geometry hidden during grab');
  hold.release();assert.equal(props[0].group.visible,true,'return animation stays visible');props[0].update(1,false);
  assert.equal(props[0].group.visible,false);assert.deepEqual(Array.from(batch.geometry.index.array),original,'exact batch restored');
});

test('grip cannot open a menu, grab through an obstruction, or take a prop during a conversation',()=>{
  const scene=Object.create(BroadStreetScene.prototype),hand=new THREE.Group(),hold=new PropHold(),street=new PumpCourtyard();street.group.visible=true;
  const item=new THREE.Group(),mesh=new THREE.Mesh(),prop=new InspectableProp(item,'Cup');item.add(mesh);mesh.userData.inspectableProp=prop;
  let hit={object:mesh,distance:4.9};street.pick=()=>hit;
  Object.assign(scene,{courtyard:street,gameState:fieldGame(true),propHold:hold,controllerRaycaster:new THREE.Raycaster(),setRaycasterFromController:()=>{},vrPanelVisible:true});
  const previous=globalThis.document;globalThis.document={hidden:false};
  try{
    scene.beginGripGrab(hand);assert.equal(hold.prop,undefined);
    scene.vrPanelVisible=false;hit={object:street.floor,distance:1};scene.beginGripGrab(hand);assert.equal(hold.prop,undefined);
    hit={object:mesh,distance:5.1};scene.beginGripGrab(hand);assert.equal(hold.prop,undefined);
    hit.distance=4.9;scene.beginGripGrab(hand);assert.equal(hold.prop,prop);assert.equal(scene.vrPanelVisible,false);
  }finally{globalThis.document=previous;}
});

const {ControllerVisuals,controllerLabelSpecs,controllerHelpInView,controllerComponentNode}=await load('walkable/ControllerVisuals');
const helpContext={held:false,holdingThis:false,panel:false,paged:false,walking:true,map:true};
function helpSource(handedness='left',profile='meta-quest-touch-plus') {
  return {handedness,targetRayMode:'tracked-pointer',profiles:[profile],gamepad:{mapping:'xr-standard',axes:[0,0,0,0],buttons:Array.from({length:7},()=>({pressed:false,touched:false,value:0}))}};
}
test('controller labels reflect actual shortcuts, grip ownership, menu paging and held-item rotation',()=>{
  const left=helpSource(),right=helpSource('right');
  const texts=(s,c=helpContext)=>controllerLabelSpecs(s,c).map(l=>l.text).join('|');
  assert.match(texts(left),/X · Map/);assert.match(texts(left),/Y · Notebook/);assert.match(texts(right),/A · Stand \/ crouch/);assert.match(texts(right),/B · Settings/);
  assert.match(texts(right,{...helpContext,held:true,holdingThis:true}),/Rotate item/);assert.match(texts(right,{...helpContext,held:true,holdingThis:true}),/Release grip · Return/);
  assert.match(texts(left,{...helpContext,panel:true,paged:true}),/Previous page/);assert.match(texts(right,{...helpContext,panel:true,paged:true}),/Next page/);
  assert.equal(controllerLabelSpecs(left,{...helpContext,map:false}).find(l=>l.button===4).enabled,false);
  assert.ok(controllerLabelSpecs(left,helpContext).every(l=>l.button!==6),'never label the reserved system/thumbrest button as an app shortcut');
  assert.doesNotMatch(texts(helpSource('left','unknown-controller')),/Notebook|Map/);
  assert.deepEqual(controllerLabelSpecs({...left,hand:{}},helpContext),[]);
  assert.deepEqual(controllerLabelSpecs({...left,gamepad:{...left.gamepad,mapping:''}},helpContext),[]);
});
test('controller help is nearby and in the viewing direction, with no dependence on eye tracking',()=>{
  const eye=new THREE.Vector3(0,1.6,0),forward=new THREE.Vector3(0,0,-1);
  assert.equal(controllerHelpInView(eye,forward,new THREE.Vector3(.2,1.4,-.5)),true);
  for(const p of [[0,1.6,.5],[0,1.6,-2],[0,1.6,-.05],[1,1.6,-.1]])assert.equal(controllerHelpInView(eye,forward,new THREE.Vector3(...p)),false);
});
test('controller models live in grip space and late loads cannot resurrect a disconnected model',()=>{
  const grip=new THREE.Group(),scene=new THREE.Scene(),models=[];
  const factory={createControllerModel:()=>{const m=new THREE.Group();models.push(m);return m;}};
  const visual=new ControllerVisuals(grip,scene,factory);
  const source=helpSource();grip.dispatchEvent({type:'connected',data:source});assert.equal(models[0].parent,grip);
  grip.dispatchEvent({type:'disconnected',data:source});models[0].add(new THREE.Mesh());assert.equal(models[0].parent,null);assert.equal(visual.labels.visible,false);
  grip.dispatchEvent({type:'connected',data:helpSource('right')});assert.equal(models[1].parent,grip);assert.equal(models[0].parent,null);
  grip.dispatchEvent({type:'connected',data:{...source,hand:{}}});assert.equal(models.length,2);assert.equal(visual.fallback.visible,false);
});
test('bundled controller assets have local paths, correct component nodes and a retained license',async()=>{
  const root=resolve('public/controllers'),list=JSON.parse(await readFile(`${root}/profilesList.json`));
  const cache=new Map();
  for(const [id,entry] of Object.entries(list)) {
    const profile=JSON.parse(await readFile(resolve(root,entry.path)));
    for(const [hand,layout] of Object.entries(profile.layouts)) {
      const asset=resolve(root,id,layout.assetPath);assert.ok(asset.startsWith(root+'/models/'));
      let model=cache.get(asset);
      if(!model){model=await exportedRoom('../controllers/'+asset.slice(root.length+1));cache.set(asset,model);}
      const source=helpSource(hand,id);source.gamepad.buttons=Array.from({length:10},()=>({pressed:false}));
      for(const label of controllerLabelSpecs(source,helpContext)) {
        const component=Object.values(layout.components).find(c=>c.gamepadIndices.button===label.button);
        if(!component)continue; // Generic profiles only show labels for hardware they model.
        const node=controllerComponentNode(model,component);
        if(id==='valve-index'&&component.type==='squeeze'){assert.equal(node,undefined);continue;}
        assert.ok(node,`${id}/${hand}: ${component.rootNodeName}`);
        const box=new THREE.Box3().setFromObject(node);assert.equal(box.isEmpty(),false);assert.ok(box.getCenter(new THREE.Vector3()).length()<.3);
      }
    }
  }
  assert.match(await readFile(`${root}/LICENSE.txt`,'utf8'),/MIT License/);
});


const {StreetBoundary,streetBoundaryContact}=await load('walkable/StreetBoundary');
test('street boundary distinguishes all four outer edges from props, walls, and teleports',()=>{
  const v=(x,z)=>new THREE.Vector3(x,1.6,z);
  for(const [from,to,edge] of [[v(-12.95,0),v(-13.05,0),'west'],[v(14.95,0),v(15.05,0),'east'],[v(4,-7.8),v(4,-7.9),'north'],[v(4,12.95),v(4,13.05),'south']]) {
    assert.equal(streetBoundaryContact(from,to).edge,edge);
    assert.equal(streetBoundaryContact(to,from),undefined,'returning inward does not trigger');
  }
  for(const [from,to] of [[v(-3.8,.6),v(-3.8,1.3)],[v(0,2.5),v(0,2.7)],[v(0,0),v(16,0)],[v(-13,5),v(-13.1,5)],[v(0,12.95),v(0,13.05)]])assert.equal(streetBoundaryContact(from,to),undefined);
});
test('boundary cue stays anchored, fades after turning away, and resets on panels or scene changes',()=>{
  const cue=new StreetBoundary(),from=new THREE.Vector3(14.95,1.15,0),to=from.clone().add(new THREE.Vector3(.1,0,0)),out=new THREE.Vector3(1,0,0);
  cue.blocked(from,to);for(let i=0;i<6;i++)cue.update(from,out,.05,true);
  assert.ok(cue.group.visible);assert.ok(cue.label.position.distanceTo(from)>=2);
  assert.ok(Math.abs(cue.label.position.y-.75)<1e-8,'seated eye height');const anchored=cue.label.position.clone();
  cue.blocked(from.clone().add(new THREE.Vector3(0,0,.2)),to);assert.deepEqual(cue.label.position,anchored);
  cue.group.updateMatrixWorld(true);const ray=new THREE.Raycaster(from,out);assert.deepEqual(ray.intersectObject(cue.group,true),[]);
  for(let i=0;i<12;i++)cue.update(from,out.clone().negate(),.05,true);assert.equal(cue.group.visible,false);
  cue.blocked(from,to);cue.update(from,out,.05,true,true);assert.equal(cue.group.visible,true);
  cue.update(from,out,.05,false);assert.equal(cue.group.visible,false);assert.equal(cue.previous,undefined);
  cue.update(from,out,.05,true);cue.update(to,out,.05,true);assert.equal(cue.group.visible,true,'room-scale edge crossing also gives feedback');
  for(let i=0;i<70;i++)cue.update(to,out,.05,true);assert.equal(cue.group.visible,false,'a stationary user is not nagged forever');
  cue.reset();cue.blocked(from,to);cue.update(from,new THREE.Vector3(0,0,-1),.05,true);
  assert.equal(cue.group.visible,true,'strafing into an edge still shows the cue');
  assert.ok(cue.label.position.z<from.z,'label initially appears in the current view');
});
test('desktop and left-stick collisions show the same street cue without altering movement',()=>{
  const scene=Object.create(BroadStreetScene.prototype),cue=new StreetBoundary();
  Object.assign(scene,{streetBoundary:cue,courtyard:{group:{visible:true},canWalkBetween}});
  const from=new THREE.Vector3(14.98,1.6,0),check=(a,b)=>scene.canWalkWithBoundaryCue(a,b);
  const desktop=new DesktopMovement();desktop.press('d');const next=desktop.update(from,0,.05,check);
  assert.deepEqual(next.position,from);assert.equal(cue.contact.edge,'east');cue.reset();
  const vr=new VrWalking(),forward=new THREE.Vector3(0,0,-1);vr.update(from,forward,new THREE.Vector2(),.05,true,check);
  assert.deepEqual(vr.update(from,forward,new THREE.Vector2(1,0),.05,true,check),from);assert.equal(cue.contact.edge,'east');
  cue.reset();scene.courtyard.group.visible=false;check(from,from.clone().add(new THREE.Vector3(.1,0,0)));assert.equal(cue.contact,undefined);
});

test('day-one recap starts with an unmarked map then plots deaths, retaining each stage through close and reload',()=>{
 let game=gameAtDay(1);assert.equal(game.hasMappedDeaths(),false);
 talk(game,'registrar','registrar-ledger');assert.equal(game.hasMappedDeaths(),false);
 talk(game,'household','broad-street-household');game.travelToLocation('snow-desk');game.inspectHotspot('john-snow');
 assert.equal(game.getConversationView().map,'base');assert.equal(game.hasMappedDeaths(),false);
 assert.deepEqual(game.getConversationView().choices.map(c=>c.id),['pattern'],'the comparison cannot be skipped');
 game.closeDialogue();
 let restored=new GameState();assert.ok(restored.restoreSave(game.serializeSave()));game=restored;
 assert.equal(game.hasMappedDeaths(),false);game.inspectHotspot('john-snow');assert.equal(game.getConversationView().map,'base');
 game.chooseConversation('opening','pattern');assert.equal(game.getConversationView().map,'deaths');assert.equal(game.hasMappedDeaths(),true);
 assert.equal(game.hasEvidence('pump-cluster'),false);assert.equal(game.canEndDay(),false);
 game.closeDialogue();assert.equal(game.hasMappedDeaths(),true);
 restored=new GameState();assert.ok(restored.restoreSave(game.serializeSave()));game=restored;
 assert.equal(game.hasMappedDeaths(),true);assert.equal(game.hasEvidence('pump-cluster'),false);
 game.inspectHotspot('john-snow');assert.equal(game.getConversationView().beatId,'pattern');assert.equal(game.getConversationView().map,'deaths');
 finishConversation(game);assert.equal(game.hasEvidence('pump-cluster'),true);assert.equal(game.canEndDay(),true);
 game.endDay();assert.equal(game.hasMappedDeaths(),true);
});
test('VR day-one recap changes the map and legend together without travel controls',()=>{
 const game=gameAtDay(1);talk(game,'registrar','registrar-ledger');talk(game,'household','broad-street-household');game.travelToLocation('snow-desk');game.inspectHotspot('john-snow');
 const scene=Object.create(BroadStreetScene.prototype),buttons=[];
 Object.assign(scene,{gameState:game,vrMapImages:new Map([['base','base-image'],['deaths','death-image']]),vrPanelMode:'home',vrPanelVisible:true,vrPanelDrawCommands:[],clearVrPanel:()=>{},addVrIconButton:()=>{},addVrPanelSurface:()=>{},addVrPanelButton:(label,x,y,w,h,action)=>buttons.push({label,action,y,h})});
 for(let i=0;i<10;i++) {
  buttons.length=0;scene.vrPanelDrawCommands=[];scene.rebuildVrPanel();const view=game.getConversationView(),map=scene.vrPanelDrawCommands.find(c=>c.kind==='map');
  const revealed=view.beatId!=='opening';
  assert.equal(map.deathsVisible,revealed);assert.equal(map.mapImage,revealed?'death-image':'base-image');assert.deepEqual(map.locations,[]);
  assert.ok(scene.vrPanelDrawCommands.some(c=>c.kind==='text'&&c.text===(revealed?'Bars: deaths · Teal circles: pumps':'Teal circles: pumps')));
  assert.ok(scene.vrPanelDrawCommands.some(c=>c.kind==='text'&&c.text===view.text));
  assert.ok(buttons.every(b=>Math.abs(b.y)+b.h/2<scene.vrSurfaceHeight/2),'choices stay inside panel');
  if(view.complete){assert.ok(buttons.some(b=>b.action.type==='end-day'));break;}
  game.chooseConversation(view.beatId,view.choices[0].id);
 }
 game.closeDialogue();scene.vrPanelDrawCommands=[];scene.addVrMap(0,0,1,1);assert.equal(scene.vrPanelDrawCommands[0].deathsVisible,true);
});

test('conversation endings keep every VR action and hit target separate and inside the panel',()=>{
 const game=gameAtDay(1),scene=Object.create(BroadStreetScene.prototype),hitboxes=[];
 Object.assign(scene,{gameState:game,vrMapImages:new Map(),vrPanelMode:'home',vrPanelVisible:true,vrPanelDrawCommands:[],placeVrPanelInFront(){},clearVrPanel(){hitboxes.length=0;},addVrPanelSurface(){},addVrPanelHitboxMesh(mesh,x,y){hitboxes.push({x,y,width:mesh.geometry.parameters.width,height:mesh.geometry.parameters.height});}});
 for(const definition of conversations)for(const beat of definition.beats.filter(b=>b.terminalAction&&b.conclusion)) {
  game.getConversationView=()=>({id:definition.id,actorId:definition.actorId,title:definition.title,beatId:beat.id,speaker:beat.speaker,text:beat.text,choices:beat.choices,anchor:definition.anchor,map:definition.map,complete:true,terminalAction:beat.terminalAction});
  scene.rebuildVrPanel();const buttons=scene.vrPanelDrawCommands.filter(c=>c.kind==='button');assert.ok(buttons.length>=3,definition.id);
  for(const b of buttons)assert.ok(Math.abs(b.y)+b.height/2<=scene.vrSurfaceHeight/2-.03,definition.id+' panel bounds');
  for(let i=0;i<hitboxes.length;i++)for(let j=i+1;j<hitboxes.length;j++) {
   const a=hitboxes[i],b=hitboxes[j];const gapX=Math.abs(a.x-b.x)-(a.width+b.width)/2,gapY=Math.abs(a.y-b.y)-(a.height+b.height)/2;
   assert.ok(gapX>=.03||gapY>=.03,definition.id+' has separate button targets');
  }
 }
});

const {DayTransition}=await load('render/DayTransition');
test('day fade changes state only after a fully black frame and finishes exactly once',()=>{
 for(const reduced of [false,true]) {
  const camera=new THREE.PerspectiveCamera(),fade=new DayTransition(camera);let changes=0,finished=0;
  assert.ok(fade.start(()=>{assert.equal(fade.material.opacity,1);changes++;},()=>finished++,reduced));
  assert.equal(fade.start(()=>changes+=100,()=>{}),false);
  assert.equal(changes,0);fade.update(Infinity,true);assert.equal(fade.material.opacity,0);
  let blackSeen=false,frames=0;
  while(fade.active && frames++<120) {
   const wasBlack=fade.material.opacity===1;const before=changes;fade.update(1/60,true);
   if(changes>before)assert.ok(wasBlack,'a black frame preceded the state change');
   blackSeen ||= fade.material.opacity===1;
   assert.ok(fade.material.opacity>=0&&fade.material.opacity<=1);
  }
  assert.ok(blackSeen);assert.equal(changes,1);assert.equal(finished,1);assert.equal(fade.veil.visible,false);
  assert.equal(fade.material.opacity,0);fade.update(2,true);assert.equal(finished,1);
  assert.equal(fade.veil.parent,camera);assert.equal(fade.material.depthTest,false);
 }
});
test('both End day transitions retain the recap until black and prepare VR introduction before fading in',()=>{
 for(const day of [1,2]) {
  const ready=gameAtDay(day);
  if(day===1){talk(ready,'registrar','registrar-ledger');talk(ready,'household','broad-street-household');}
  else {talk(ready,'broad-street','broad-street-pump');talk(ready,'household-routines','routines-household');talk(ready,'workhouse','poland-workhouse');talk(ready,'manufactory','manufactory-worker');}
  talk(ready,'snow-desk','john-snow');assert.ok(ready.canEndDay());
  const camera=new THREE.PerspectiveCamera(),fade=new DayTransition(camera),scene=Object.create(BroadStreetScene.prototype);let rebuilt=0,finished=0;
  Object.assign(scene,{gameState:ready,dayTransition:fade,desktopMovement:new DesktopMovement(),vrWalking:new VrWalking(),vrSelectionStarts:new Map(),vrShortcuts:{clear(){}},vrControllerButtonStates:new Map(),reducedCharacterMotion:{matches:false},resetTactileInteractions(){},renderer:{xr:{isPresenting:true}},showVrPanel(){},rebuildVrPanel(){assert.equal(fade.material.opacity,1);rebuilt++;},onDayTransitionComplete(){finished++;}});
  scene.endDay();scene.endDay();assert.equal(ready.day,day);
  scene.handleVrButton({type:'dismiss-day'});assert.equal(ready.day,day);
  for(let i=0;i<120;i++)fade.update(1/60,true);
  assert.equal(ready.day,day+1);assert.equal(ready.dayIntroOpen,true);assert.equal(rebuilt,1);assert.equal(finished,1);
  assert.equal(ready.needsDailyBriefing(),true);
 }
});


test('epilogue clears street targets and keeps only the return to Snow travel exit',()=>{
 const game=reviewGame();game.selectHypothesis('waterborne');game.attendBoardMeeting();game.beginHearing();finishConversation(game);game.finishBoard();
 const street=new PumpCourtyard(),travel=new WorldTravelTargets(()=>new THREE.MeshBasicMaterial());
 street.characters.group.userData.characterStatus='ready';
 const scene=Object.create(BroadStreetScene.prototype);
 Object.assign(scene,{gameState:game,courtyard:street,worldTravel:travel,hotspotVisuals:new Map(),markVrPanelDirty(){}});
 scene.refreshHotspots();
 assert.equal(street.characters.group.visible,false);
 const person=street.characters.targets[0];
 assert.equal(street.characters.blocks(person.position),false);
 assert.equal(street.characters.blocksPath(person.position.clone().add(new THREE.Vector3(0,0,2)),person.position),false);
 assert.equal(street.characters.pick(new THREE.Raycaster(person.position.clone().add(new THREE.Vector3(0,0,2)),new THREE.Vector3(0,0,-1))),undefined);
 const visible=streetTravelRoutes.filter(route=>travel.group.getObjectByName(route.id).visible);
 assert.deepEqual(visible.map(route=>route.to),['snow-desk']);
 assert.deepEqual(game.getHotspots(),[]);
 for(const route of streetTravelRoutes)if(route.to!=='snow-desk')assert.equal(game.travelToLocation(route.to).traveled,false);
 game.reset();scene.refreshHotspots();assert.equal(street.characters.group.visible,true);
});

test('epilogue VR panel leaves a clear pump sightline at seated and standing heights',()=>{
 const game=reviewGame();game.selectHypothesis('waterborne');game.attendBoardMeeting();game.beginHearing();finishConversation(game);game.finishBoard();
 for(const height of [1,1.65])for(const mode of ['home','synthesis']){
  const scene=Object.create(BroadStreetScene.prototype),camera=new THREE.PerspectiveCamera();camera.position.set(-3.8,height,-1.6);
  Object.assign(scene,{gameState:game,camera,vrPanelMode:mode,vrPanel:new THREE.Group(),vrPanelWorldPosition:new THREE.Vector3(),vrPanelWorldDirection:new THREE.Vector3(),vrPanelLookTarget:new THREE.Vector3()});
  scene.placeVrPanelInFront();scene.vrPanel.updateMatrixWorld(true);
  const surface=new THREE.Mesh(new THREE.PlaneGeometry(2.85,1.9),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));scene.vrPanel.add(surface);scene.vrPanel.updateMatrixWorld(true);
  for(const y of [.3,1,1.8,2.2]){
   const ray=new THREE.Raycaster(camera.position,new THREE.Vector3(-3.8,y,1.3).sub(camera.position).normalize());
   assert.equal(ray.intersectObject(surface).length,0,'the reading panel never covers the pump or its notice');
  }
  assert.equal(scene.vrPanel.scale.x,.68);
 }
});

test('panel depth composition isolates shared materials and restores normal rendering when closed',async()=>{
 const {PanelDepthLayers}=await load('render/PanelDepthLayers');
 const layers=new PanelDepthLayers(),shared=new THREE.MeshBasicMaterial(),root=new THREE.Group();
 const held=new THREE.Mesh(new THREE.BoxGeometry(),shared),furniture=new THREE.Mesh(new THREE.BoxGeometry(),shared);
 const label=new THREE.Sprite(new THREE.SpriteMaterial({depthTest:false,depthWrite:false,opacity:.7}));
 root.add(held,label);held.renderOrder=7;
 layers.update([root],true);
 assert.notEqual(held.material,shared);assert.equal(furniture.material,shared);assert.equal(shared.transparent,false);
 assert.equal(held.material.transparent,true);assert.equal(held.material.depthTest,true);assert.equal(held.material.depthWrite,true);
 assert.equal(held.material.depthFunc,THREE.LessEqualDepth);assert.equal(held.renderOrder,101);
 assert.equal(label.material.depthTest,true);assert.equal(label.material.depthWrite,false);
 const copy=held.material;layers.update([root],true);assert.equal(held.material,copy,'reuse materials while the panel is open');
 let disposed=false;copy.addEventListener('dispose',()=>{disposed=true;});
 layers.update([],false);assert.equal(held.material,shared);assert.equal(held.renderOrder,7);assert.equal(label.material.depthTest,false);assert.ok(disposed);
 const parent=new THREE.Group();parent.add(root);parent.visible=false;layers.update([root],true);assert.equal(held.material,shared,'hidden scenes stay excluded');
});

test('foreground geometry blocks panel rays only when visible and nearer than the panel',async()=>{
 const {foregroundBefore}=await load('render/PanelDepthLayers');
 const root=new THREE.Group(),person=new THREE.Mesh(new THREE.BoxGeometry(.6,1.8,.4),new THREE.MeshBasicMaterial());
 const proxy=new THREE.Mesh(new THREE.BoxGeometry(3,3,3),new THREE.MeshBasicMaterial({visible:false}));root.add(person,proxy);
 person.position.z=-1.5;const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,0,-1));
 assert.equal(foregroundBefore(ray,2,[root]),true);
 person.position.z=-2.5;assert.equal(foregroundBefore(ray,2,[root]),false,'do not block buttons through people behind them');
 person.position.z=-1.5;root.visible=false;assert.equal(foregroundBefore(ray,2,[root]),false);
 root.visible=true;person.visible=false;assert.equal(foregroundBefore(ray,2,[root]),false,'invisible selection proxies cannot block buttons');
});


test('handoff preserves world pose and home pose through repeated transfers under rotated parents',()=>{
 const parent=new THREE.Group(),item=new THREE.Group(),left=new THREE.Group(),right=new THREE.Group();parent.rotation.y=.45;parent.position.set(2,0,1);parent.add(item);
 item.add(new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.2)));item.position.set(.2,1,-1);item.rotation.set(.2,.4,.1);
 left.position.set(-.3,1.1,0);right.position.set(.3,1.3,0);right.rotation.set(.3,-.6,.2);
 const prop=new InspectableProp(item,'Cup'),hold=new PropHold(),home=prop.home.clone(),homeRotation=prop.homeRotation.clone();
 assert.equal(hold.transfer(right),false);hold.begin(prop,left,false);hold.rotate(.4,.2);for(let i=0;i<20;i++)hold.update(.05);
 for(const receiver of [right,left,right]){
  const position=item.getWorldPosition(new THREE.Vector3()),rotation=item.getWorldQuaternion(new THREE.Quaternion());
  assert.equal(hold.transfer(receiver),true);assert.equal(hold.anchor,receiver);assert.equal(prop.held,true);assert.equal(prop.returning,false);
  assert.ok(item.getWorldPosition(new THREE.Vector3()).distanceTo(position)<1e-10);assert.ok(item.getWorldQuaternion(new THREE.Quaternion()).angleTo(rotation)<1e-7);
  assert.equal(hold.transfer(receiver),false);hold.update(.05);assert.ok(item.getWorldQuaternion(new THREE.Quaternion()).angleTo(rotation)<1e-7,'handoff does not reset rotation');
 }
 hold.release(true);assert.ok(item.position.distanceTo(home)<1e-10);assert.ok(item.quaternion.angleTo(homeRotation)<1e-7);
});

test('handoff requires proximity or an unobstructed ray to the held object and respects modal panels',()=>{
 const previous=globalThis.document;globalThis.document={hidden:false};
 try{
  const scene=Object.create(BroadStreetScene.prototype),left=new THREE.Group(),right=new THREE.Group(),root=new THREE.Group(),item=new THREE.Group();root.add(item);
  item.position.set(0,1,-2);item.add(new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.2)));
  const prop=new InspectableProp(item,'Cup'),hold=new PropHold();hold.begin(prop,left,false);right.position.set(0,1,0);
  let obstruction={distance:1},modal=false;
  Object.defineProperty(scene,'walkable',{value:{pick:()=>obstruction}});
  Object.assign(scene,{propHold:hold,controllerRaycaster:new THREE.Raycaster(),vrPanelBlocksWorld:()=>modal,pickVrPanel:()=>undefined,
   setRaycasterFromController:controller=>scene.controllerRaycaster.set(controller.position,new THREE.Vector3(0,0,-1))});
  scene.beginGripGrab(right);assert.equal(hold.anchor,left,'wall blocks aimed handoff');
  obstruction=undefined;right.position.x=1;scene.beginGripGrab(right);assert.equal(hold.anchor,left,'unrelated grip presses do not steal an item');
  right.position.x=0;modal=true;scene.beginGripGrab(right);assert.equal(hold.anchor,left);
  modal=false;scene.beginGripGrab(right);assert.equal(hold.anchor,right,'aiming at held geometry transfers it');
  left.position.set(.2,1,-2);scene.beginGripGrab(left);assert.equal(hold.anchor,left,'close handoff works without aiming down the ray');
  const takeover=controllerLabelSpecs(helpSource(),{...helpContext,held:true,holdingThis:false}).find(l=>l.button===1);
  assert.equal(takeover.text,'Grip · Take item');assert.equal(takeover.enabled,true);
 }finally{globalThis.document=previous;}
});

test('grip and trigger operate both attached pump handles with range, panel and closure guards',()=>{
 const oldDocument=globalThis.document,oldWindow=globalThis.window;
 globalThis.document=new EventTarget();document.body={dataset:{}};globalThis.window=new EventTarget();
 try {
  for(const location of ['broad-street','workhouse']) {
   const scene=Object.create(BroadStreetScene.prototype),hand=new THREE.Group(),other=new THREE.Group();
   const street=new PumpCourtyard(),workhouse=new WorkhouseCourtyard(),game=gameAtDay(2);
   game.travelToLocation(location);street.group.visible=location==='broad-street';workhouse.group.visible=location==='workhouse';
   const room=location==='broad-street'?street:workhouse,action=room.pumpAction,parent=action.handle.parent;
   let distance=3,blocked=false,unlocks=0;room.pick=()=>({object:action.handle.children[0],distance});
   Object.assign(scene,{canvas:new EventTarget(),renderer:{xr:{isPresenting:true,getController:i=>i===0?hand:other,addEventListener:()=>{}}},
    playerRig:new THREE.Group(),camera:new THREE.PerspectiveCamera(),courtyard:street,workhouse,gameState:game,
    vrControllers:[],vrControllerPointers:[],vrPanelVisible:false,propHold:new PropHold(),tactileVrSelections:new Set(),
    controllerRaycaster:new THREE.Raycaster(),setRaycasterFromController:()=>{},pickVrPanel:()=>undefined,
    vrPanelBlocksWorld:()=>blocked,reducedCharacterMotion:{matches:true},sound:{unlock(){unlocks++;},effect(){},stopWater(){}}});
   scene.addInputHandlers();
   const tick=()=>{for(let i=0;i<15;i++)scene.updatePumpInteractions(.05);};
   hand.dispatchEvent({type:'squeezestart'});tick();assert.equal(game.hasPumpedWater(location),false,'out of range');
   distance=1;blocked=true;hand.dispatchEvent({type:'squeezestart'});tick();assert.equal(game.hasPumpedWater(location),false,'modal panel blocks pump');
   blocked=false;
   for(const event of ['squeezestart','selectstart']) {
    action.reset();hand.dispatchEvent({type:event});tick();assert.equal(action.water.visible,true);
    assert.equal(scene.propHold.prop,undefined,'handle never becomes a portable prop');assert.equal(action.handle.parent,parent);
    hand.dispatchEvent({type:'squeezeend'});assert.equal(action.water.visible,true,'release leaves stroke animation intact');
    for(let i=0;i<35;i++)scene.updatePumpInteractions(.05);assert.equal(action.water.visible,false,'holding does not repeat strokes');
   }
   assert.ok(game.hasPumpedWater(location));assert.ok(unlocks>=4,'grip is also an audio gesture');
   action.reset(false);hand.dispatchEvent({type:'squeezestart'});tick();assert.equal(action.water.visible,false,'removed handle cannot pump');
  }
 } finally {globalThis.document=oldDocument;globalThis.window=oldWindow;}
});

test('pump uses the bundled pour once decoded and retains generated fallback on failure',async()=>{
 for(const fails of [false,true]) {
  const c=fakeAudioContext(),clip=c.createBuffer(1,Math.round(.95*22050),22050),urls=[];
  c.decodeAudioData=async()=>clip;
  const sound=new Soundscape(()=>c,async url=>{urls.push(url);if(fails)throw Error('offline');return new ArrayBuffer(8);});
  await sound.unlock();await sound.recordingLoad;
  assert.match(urls[0],/pump-water.wav$/,'water downloads before incidental ambience');
  sound.effect('water');assert.equal(sound.waterSource.buffer,fails?sound.water:clip);
  assert.equal(sound.waterSource.loop,undefined);sound.stopWater();assert.equal(sound.waterSource,undefined);sound.dispose();
 }
});

test('manufactory supplements Household 2, requires its own interview, and archives after Day 2',()=>{
 const game=gameAtDay(2);assert.equal(game.getAssignments().length,4);
 talk(game,'broad-street','broad-street-pump');talk(game,'household-routines','routines-household');talk(game,'workhouse','poland-workhouse');
 assert.equal(game.isDayFieldworkComplete(),false);talk(game,'snow-desk','john-snow');assert.equal(game.canEndDay(),false);
 assert.ok(game.getAssignments().some(o=>o.id==='water-routines'&&o.complete));
 talk(game,'manufactory','manufactory-worker');assert.ok(game.hasEvidence('manufactory-exposure'));
 const count=game.getCollectedEvidence().length;talk(game,'manufactory','manufactory-worker');assert.equal(game.getCollectedEvidence().length,count);
 finishDay(game);completeSurvey(game);assert.equal(game.canTravelToLocation('manufactory'),false);
 assert.ok(game.getMapLocations().some(l=>l.id==='manufactory'&&game.isArchivedLocation(l)));
 const first=gameAtDay(1);assert.equal(first.canTravelToLocation('manufactory'),false);assert.ok(!first.getMapLocations().some(l=>l.id==='manufactory'));
});

test('old saves retain completed days without fabricating manufactory evidence, while unfinished days gain the visit',()=>{
 const saved=JSON.parse(gameAtDay(3).serializeSave());delete saved.campaignRevision;delete saved.legacyManufactoryWaiver;
 delete saved.conversation.cursors['manufactory-supply'];saved.conversation.concluded=saved.conversation.concluded.filter(id=>id!=='manufactory-supply');
 let game=new GameState();assert.ok(game.restoreSave(JSON.stringify(saved)));assert.equal(game.day,3);assert.equal(game.hasEvidence('manufactory-exposure'),false);
 let resumed=new GameState();assert.ok(resumed.restoreSave(game.serializeSave()));assert.equal(resumed.hasEvidence('manufactory-exposure'),false);
 const current={...saved,campaignRevision:2};assert.equal(new GameState().restoreSave(JSON.stringify(current)),false,'new saves cannot bypass the new required interview');
 const unfinished=JSON.parse(gameAtDay(2).serializeSave());delete unfinished.campaignRevision;delete unfinished.legacyManufactoryWaiver;
 assert.ok(game.restoreSave(JSON.stringify(unfinished)));assert.ok(game.getAssignments().some(o=>o.id==='manufactory'&&!o.complete));
 const ended=JSON.parse(gameAtDay(2).serializeSave());
 for(const [key,value] of Object.entries(saved.conversation.cursors))if(key==='snow-recap-2'||['pump-sample','household-routines','workhouse-supply'].includes(key))ended.conversation.cursors[key]=value;
 ended.conversation.concluded.push('pump-sample','household-routines','workhouse-supply','snow-recap-2');ended.pumpedWater=['broad-street'];ended.location='snow-desk';delete ended.campaignRevision;delete ended.legacyManufactoryWaiver;
 assert.ok(game.restoreSave(JSON.stringify(ended)));assert.ok(game.isDayFieldworkComplete());assert.ok(game.canEndDay());assert.equal(game.getAssignments().length,3);
 assert.equal(game.hasEvidence('manufactory-exposure'),false);assert.ok(game.endDay());
 resumed=new GameState();assert.ok(resumed.restoreSave(game.serializeSave()));game.reset();beginDay(game);assert.equal(game.hasEvidence('manufactory-exposure'),false);
});

test('manufactory interview introduces illness through questions before asking about water on every approach',()=>{
 const graph=conversations.find(c=>c.id==='manufactory-supply');assert.match(graph.sourceNote,/authored interim estimate.*not a documented September 6 count/);
 for(const approach of graph.beats[0].choices){const progress=new ConversationProgress();progress.open(graph.id);
  assert.doesNotMatch(progress.view().text,/died|deaths|dozen|sick|water/);
  progress.choose('opening',approach.id);
  if(progress.view().beatId!=='answer-1') {
   const view=progress.view();assert.match(view.choices[0].label,/ill with cholera|How many have you lost/);
   progress.choose(view.beatId,view.choices[0].id);
  }
  let view=progress.view();assert.equal(view.beatId,'answer-1');assert.match(view.text,/about a dozen.*some are sick now/);
  assert.match(view.choices[0].label,/drinking water/);progress.choose(view.beatId,view.choices[0].id);
  view=progress.view();assert.match(view.text,/two tubs.*Broad Street.*two hundred/);assert.doesNotMatch(view.text,/eighteen|\b18\b/);
 }
});

test('manufactory workshop has clear entry, interview and water-tub approaches and bounded baked assets',async()=>{
 const {ManufactoryRoom,manufactoryArea}=await load('walkable/ManufactoryRoom');const room=new ManufactoryRoom();room.group.visible=true;
 const points=[[0,2.35],[0,0],[0,-2.1],[0,3.25]].map(([x,z])=>new THREE.Vector3(x,0,z));
 for(let i=1;i<points.length;i++)assert.ok(room.canWalkBetween(points[i-1],points[i]));
 for(const p of [[2.6,1.2],[-2.6,-1.5],[1.3,-3.1]])assert.equal(manufactoryArea.isValidDestination(new THREE.Vector3(p[0],0,p[1])),false);
 const route=streetTravelRoutes.find(r=>r.to==='manufactory');assert.ok(isValidDestination(new THREE.Vector3(route.zone.x,0,route.zone.z)));
 const model=await exportedRoom('manufactory-room.glb');assert.ok(triangles(model)<25000);
 for(const x of [-1.3,1.3]) {const hit=new THREE.Raycaster(new THREE.Vector3(x,1.2,-3.1),new THREE.Vector3(0,-1,0)).intersectObject(model,true)[0];assert.equal(hit.object.material.name,'Water','each tub has a visible water surface');}
 const props=extractProps(model,room.group,'manufactory-room.glb');assert.equal(props.length,15);
 for(const prop of props)assert.ok(triangles(prop.group)>0);
 const report=JSON.parse(await readFile('assets/manufactory-room/build-report.json'));assert.equal(report.bakedLighting.size,1024);
});


test('resting household member stays inside the bed, has baked surfaces and respects reduced motion',async()=>{
 const patient=await exportedRoom('household-patient.glb');patient.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(patient),bed=householdLayout.furniture.find(f=>f.id==='bed');
 assert.ok(bounds.min.x>=bed.x-bed.width/2-.02 && bounds.max.x<=bed.x+bed.width/2+.02,'body and coverlet stay inside the bed footprint');
 assert.ok(bounds.min.z>=bed.z-bed.depth/2-.02 && bounds.max.z<=bed.z+bed.depth/2+.02);
 assert.ok(bounds.min.y>.4 && bounds.max.y<1.1,'patient rests on the mattress, not the floor or above the bed');
 assert.ok(triangles(patient)<22000);
 patient.traverse(o=>{if(o.isMesh)assert.ok(o.geometry.attributes.uv1,'all patient surfaces support the baked lightmap');});
 const cover=patient.getObjectByName('patient_breathing_coverlet');assert.ok(cover);
 const people=new SceneCharacters('household');people.patientCoverlet=cover;people.patientCoverletY=cover.position.y;
 people.update(1,false);assert.ok(Math.abs(cover.position.y-people.patientCoverletY)<=.0015);
 people.update(1,true);assert.equal(cover.position.y,people.patientCoverletY);
 assert.equal(people.targets.length,1,'the relative remains the sole conversation target');
 assert.ok(!propSpecs['household-room.glb'].some(p=>p.name==='Pillow'),'occupied pillow cannot be taken from under the patient');
});

test('new domestic artifacts are complete pickups with short inspection notes',async()=>{
 const {objectNotes}=await load('walkable/ObjectInspection');
 const expected={'household-room.glb':['Feeding boat','Chamber candlestick'],'household-routines-room.glb':['Flat iron','Sewing scissors'],'household-away-room.glb':['Warming pan','Tea caddy']};
 for(const [asset,names] of Object.entries(expected)){
  const model=await exportedRoom(asset),parent=new THREE.Group();parent.add(model);
  const props=extractProps(model,parent,asset);
  for(const name of names){
   const prop=props.find(p=>p.name===name);assert.ok(prop,name);assert.ok(objectNotes[name]?.text.length<320,'caption fits the nonmodal panel');
   const anchor=new THREE.Object3D(),hold=new PropHold();parent.add(anchor);
   assert.ok(hold.begin(prop,anchor,true));hold.rotate(.3,.1);hold.update(.05);hold.release(true);
   assert.ok(prop.group.position.distanceTo(prop.home)<1e-9);assert.ok(prop.group.quaternion.angleTo(prop.homeRotation)<1e-7);
  }
 }
});
