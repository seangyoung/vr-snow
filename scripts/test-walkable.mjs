import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { test } from "node:test";
import ts from "typescript";
import * as THREE from "three";

// Compile into the ignored dependency cache; no additional test dependency.
const output = resolve("node_modules/.cache/walkable-tests");
for (const name of ["render/BroadStreetScene", "walkable/DesktopMovement", "walkable/locomotion", "walkable/PumpCourtyard", "simulation/gameState", "simulation/content", "simulation/types"]) {
  const source = await readFile(`src/${name}.ts`, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    .replace(/from "(\.\.?\/[^".]+)"/g, 'from "$1.js"');
  await mkdir(resolve(output, name, ".."), { recursive: true });
  await writeFile(resolve(output, `${name}.js`), compiled);
}
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
