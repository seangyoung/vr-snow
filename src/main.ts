import "./styles.css";
import { Soundscape } from "./audio/Soundscape";
import { GameState } from "./simulation/gameState";
import { createUi } from "./ui/createUi";
import { BroadStreetScene } from "./render/BroadStreetScene";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
const app = document.querySelector<HTMLDivElement>("#app");

if (!canvas || !app) {
  throw new Error("Prototype root elements are missing.");
}

const gameState = new GameState();
const ui = createUi(app, gameState);
const scene = new BroadStreetScene(canvas, gameState);
const sound = new Soundscape();
scene.setSoundscape(sound);
ui.setSoundControls(sound);
let evidenceCount=gameState.getCollectedEvidence().length;
const unlockSound=()=>{void sound.unlock();};
document.addEventListener("pointerdown",unlockSound,{capture:true});
document.addEventListener("keydown",unlockSound,{capture:true});
document.addEventListener("visibilitychange",()=>sound.setHidden(document.hidden));
window.addEventListener("pagehide",()=>sound.setHidden(true));
window.addEventListener("pageshow",()=>sound.setHidden(document.hidden));
app.addEventListener("click",(event)=>{
  const button=(event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
  if(button&&!button.disabled)sound.effect(["map","notebook","close"].includes(button.dataset.action??"")?"paper":"select");
},{capture:true});
let lastLocationId = gameState.getCurrentLocation().id;

ui.setMotionLookControls({
  isAvailable: () => scene.isMotionLookAvailable(),
  isEnabled: () => scene.isMotionLookEnabled(),
  getStatus: () => scene.getMotionLookStatus(),
  setEnabled: (enabled) => scene.setMotionLookEnabled(enabled),
});

scene.onFocusChange = (hotspot) => ui.setPrompt(hotspot);
scene.onHotspotActivate = (hotspot) => {
  sound.effect("select");
  if (
    hotspot.id === "john-snow" &&
    gameState.getStage() === "synthesis" &&
    gameState.getCurrentLocation().id === "snow-desk"
  ) {
    ui.openSnowReview();
    return;
  }

  const result = gameState.inspectHotspot(hotspot.id);
  ui.setMessage(result.message);
  ui.render();
  scene.refreshHotspots();
};
scene.onWorldTravel = (locationId) => ui.beginTravel(locationId);
scene.onMotionLookChange = () => ui.render();

gameState.onChange(() => {
  const nextCount=gameState.getCollectedEvidence().length;
  if(nextCount>evidenceCount)sound.effect("evidence");
  evidenceCount=nextCount;
  ui.render();
  const currentLocationId = gameState.getCurrentLocation().id;
  if (currentLocationId !== lastLocationId) {
    lastLocationId = currentLocationId;
    scene.applyCurrentLocation();
  } else {
    scene.refreshHotspots();
  }
});

ui.onReset = () => {
  gameState.reset();
  scene.applyCurrentLocation();
};

ui.render();
scene.start();
