import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { boardThreshold, fieldStudyGoal } from "../simulation/content";
import type { GameState } from "../simulation/gameState";
import type { Hotspot, HypothesisId, LocationId, SynthesisConfidence } from "../simulation/types";

type HotspotMesh = THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial> & {
  userData: { hotspot: Hotspot };
};

type HotspotVisual = {
  mesh: HotspotMesh;
  label: THREE.Sprite;
};

type VrPanelMode = "home" | "map" | "notebook" | "synthesis";
type VrPanelIcon = "map" | "notebook" | "x";

type VrButtonAction =
  | { type: "mode"; mode: VrPanelMode }
  | { type: "close-panel" }
  | { type: "recenter" }
  | { type: "travel"; locationId: LocationId }
  | { type: "ask"; questionId: string }
  | { type: "close-dialogue" }
  | { type: "page-text"; pageKey: string; direction: -1 | 1 }
  | { type: "page-questions"; pageKey: string; direction: -1 | 1 }
  | { type: "select-hypothesis"; hypothesisId: HypothesisId }
  | { type: "set-confidence"; confidence: SynthesisConfidence }
  | { type: "prepare-board" }
  | { type: "present-board" }
  | { type: "finish-board" }
  | { type: "reset" };

type VrButtonMesh = THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> & {
  userData: {
    vrButton: VrButtonAction;
    baseScale: THREE.Vector3;
  };
};

type VrPanelTextCommand = {
  kind: "text";
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  fontSize: number;
  weight: string;
};

type VrPanelButtonCommand = {
  kind: "button";
  label?: string;
  icon?: VrPanelIcon;
  highlight?: boolean;
  active?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
};

type VrMapLocationCommand = {
  id: LocationId;
  label: string;
  x: number;
  y: number;
  unlocked: boolean;
  current: boolean;
  boardReady: boolean;
  offMapDirection?: "east" | "south" | "southwest" | "southeast";
};

type VrPanelMapCommand = {
  kind: "map";
  x: number;
  y: number;
  width: number;
  height: number;
  locations: VrMapLocationCommand[];
  deathsVisible: boolean;
  mapImage?: HTMLImageElement;
};

type VrPanelNotebookCardCommand = {
  kind: "notebook-card";
  x: number;
  y: number;
  width: number;
  height: number;
  eyebrow: string;
  title: string;
  body: string;
  meta?: string;
  tags?: string[];
  unlocked: boolean;
  studyGoal?: boolean;
};

type VrPanelDrawCommand = VrPanelTextCommand | VrPanelButtonCommand | VrPanelMapCommand | VrPanelNotebookCardCommand;

type VrControllerPointer = {
  group: THREE.Group;
  beam: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  reticle: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
};

type VrControllerButtonState = {
  nextPagePressed: boolean;
  previousPagePressed: boolean;
};

type VrMapVariant = "base" | "deaths";

type VrTextOptions = {
  color?: string;
  background?: string;
  fontSize?: number;
  weight?: string;
};

type CaptureWindow = Window & {
  __vrSnowCapture?: () => string;
};

type DeviceOrientationPermissionState = "granted" | "denied" | "prompt";

type DeviceOrientationEventConstructorWithPermission = {
  requestPermission?: () => Promise<DeviceOrientationPermissionState>;
};

type WindowWithDeviceOrientation = Window & {
  DeviceOrientationEvent?: DeviceOrientationEventConstructorWithPermission;
};

export type MotionLookStatus = "unavailable" | "idle" | "requesting" | "enabled" | "denied";

export type MotionLookResult = {
  enabled: boolean;
  status: MotionLookStatus;
  message: string;
};

type WrappedTextLayout = {
  fontSize: number;
  lineHeight: number;
  lines: string[];
  fits: boolean;
};

const cameraHeight = 1.62;
const xrFramebufferScale = 1.35;
const vrPanelDistance = 2.05;
const vrPanelScale = 1;
const vrPanelWidth = 2.85;
const vrPanelHeight = 2.05;
const vrPanelContentWidth = 2.55;
const vrPanelTextureWidth = 4096;
const vrPanelTextureHeight = Math.round((vrPanelTextureWidth * vrPanelHeight) / vrPanelWidth);
const vrPanelDesignWidth = 1180;
const snapTurnAngle = Math.PI / 4;
const snapTurnActivationThreshold = 0.72;
const snapTurnReleaseThreshold = 0.22;
const vrIdleHintDelaySeconds = 10;
const vrIdleHintDistance = 2;
const vrIdleHintLowerOffset = 0.44;
const motionLookPitchLimit = 1.15;
const motionLookCameraCorrection = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
const motionLookZAxis = new THREE.Vector3(0, 0, 1);

export class BroadStreetScene {
  onFocusChange?: (hotspot?: Hotspot) => void;
  onHotspotActivate?: (hotspot: Hotspot) => void;
  onMotionLookChange?: () => void;

  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(65, 1, 0.05, 100);
  private readonly playerRig = new THREE.Group();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly raycaster = new THREE.Raycaster();
  private readonly controllerRaycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly cameraWorldPosition = new THREE.Vector3();
  private readonly cameraDirection = new THREE.Vector3();
  private readonly hotspotDirection = new THREE.Vector3();
  private readonly hotspotWorldPosition = new THREE.Vector3();
  private readonly controllerWorldPosition = new THREE.Vector3();
  private readonly controllerWorldDirection = new THREE.Vector3();
  private readonly controllerWorldQuaternion = new THREE.Quaternion();
  private readonly vrIdleHintPosition = new THREE.Vector3();
  private readonly vrIdleHintDirection = new THREE.Vector3();
  private readonly vrIdleHintDown = new THREE.Vector3();
  private readonly vrIdleHintQuaternion = new THREE.Quaternion();
  private readonly vrPanelWorldPosition = new THREE.Vector3();
  private readonly vrPanelWorldDirection = new THREE.Vector3();
  private readonly vrPanelLookTarget = new THREE.Vector3();
  private readonly motionLookEuler = new THREE.Euler();
  private readonly motionLookQuaternion = new THREE.Quaternion();
  private readonly motionLookScreenQuaternion = new THREE.Quaternion();
  private readonly motionLookForward = new THREE.Vector3();
  private readonly handleDeviceOrientation = (event: DeviceOrientationEvent) => this.updateMotionLookFromDevice(event);
  private readonly hotspotVisuals = new Map<string, HotspotVisual>();
  private readonly locationObjects = new Map<LocationId, THREE.Object3D[]>();
  private readonly sharedExterior = new THREE.Group();
  private readonly vrControllers: THREE.Group[] = [];
  private readonly vrInputSources = new Map<THREE.Group, XRInputSource>();
  private readonly vrControllerButtonStates = new Map<THREE.Group, VrControllerButtonState>();
  private readonly vrControllerPointers: VrControllerPointer[] = [];
  private readonly vrPanel = new THREE.Group();
  private readonly vrPanelButtons: VrButtonMesh[] = [];
  private readonly vrPanelDrawCommands: VrPanelDrawCommand[] = [];
  private readonly vrTextPageIndexes = new Map<string, number>();
  private readonly vrTextPageCounts = new Map<string, number>();
  private readonly vrTextPageSignatures = new Map<string, string>();
  private readonly vrQuestionPageIndexes = new Map<string, number>();
  private readonly vrQuestionPageCounts = new Map<string, number>();
  private readonly vrIdleHint = createVrIdleHintSprite();
  private vrPanelSurface?: THREE.Mesh;
  private readonly fallbackPanoramaTexture = createPanoramaTexture();
  private readonly skyMaterial = new THREE.MeshBasicMaterial({
    map: this.fallbackPanoramaTexture,
    side: THREE.BackSide,
    fog: false,
    toneMapped: false,
  });
  private readonly panoramaLoader = new THREE.TextureLoader();
  private readonly panoramaTextureCache = new Map<LocationId, THREE.Texture | null>();
  private readonly locationsWithLoadedPanorama = new Set<LocationId>();
  private readonly vrMapImages = new Map<VrMapVariant, HTMLImageElement>();
  private readonly vrMapObjectUrls: string[] = [];
  private readonly motionLookAvailable: boolean;
  private readonly allowCanvasCapture: boolean;
  private activePanoramaLocationId?: LocationId;
  private focusedHotspot?: Hotspot;
  private captureFrameCounter = 0;
  private yaw = 0;
  private pitch = 0;
  private vrPanelMode: VrPanelMode = "home";
  private vrPanelDirty = true;
  private vrPanelVisible = false;
  private vrStatus = "Aim the controller beam at a marker or panel. Trigger selects. Squeeze toggles the panel.";
  private vrFocusedButton?: VrButtonMesh;
  private vrMapNeedsAttention = false;
  private vrActivePageKey?: string;
  private vrPanelHiddenSince?: number;
  private snapTurnLocked = false;
  private dragging = false;
  private previousPointer = { x: 0, y: 0 };
  private motionLookEnabled = false;
  private motionLookStatus: MotionLookStatus = "unavailable";
  private motionReferenceYaw?: number;
  private motionReferencePitch?: number;
  private motionYawOffset = 0;
  private motionPitchOffset = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly gameState: GameState,
  ) {
    this.allowCanvasCapture = new URLSearchParams(window.location.search).has("capture");
    this.motionLookAvailable = this.detectMotionLookAvailability();
    this.motionLookStatus = this.motionLookAvailable ? "idle" : "unavailable";
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: this.allowCanvasCapture,
    });
    this.renderer.xr.enabled = true;
    this.renderer.xr.setFramebufferScaleFactor(xrFramebufferScale);
    this.renderer.xr.setFoveation(0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor("#080b0d");
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.camera.position.set(0, cameraHeight, 0);
    this.playerRig.add(this.camera);
    this.scene.add(this.playerRig);
    this.scene.add(this.vrPanel);
    this.scene.add(this.vrIdleHint);
    this.vrPanel.scale.setScalar(vrPanelScale);
    this.vrPanel.visible = false;
    this.vrIdleHint.visible = false;

    if (this.allowCanvasCapture) {
      (window as CaptureWindow).__vrSnowCapture = () => createCaptureDataUrl(this.renderer.domElement);
    }

    this.buildScene();
    this.buildHotspots();
    this.loadVrMapImages();
    this.addInputHandlers();
    this.addVrEntryButton();
    this.resize();
    this.applyCurrentLocation();
  }

  start(): void {
    this.renderer.setAnimationLoop((time: number) => {
      const timeSeconds = time * 0.001;
      this.updateHotspots(timeSeconds);
      this.updateVrControls(timeSeconds);
      this.updateFocusFromCenter();
      this.renderer.render(this.scene, this.camera);
      if (this.allowCanvasCapture && this.captureFrameCounter % 12 === 0) {
        this.canvas.dataset.captureFrame = createCaptureDataUrl(this.renderer.domElement);
      }
      this.captureFrameCounter += 1;
    });
  }

  resetView(): void {
    this.yaw = 0;
    this.pitch = 0;
    this.primeMotionLookReference();
    this.applyCameraOrientation();
  }

  applyCurrentLocation(): void {
    const location = this.gameState.getCurrentLocation();
    const target = locationLookTargets[location.id] ?? [0, 0, -4];
    this.applyPanorama(location.id);
    this.yaw = Math.atan2(-target[0], -target[2]);
    this.pitch = THREE.MathUtils.clamp((target[1] - cameraHeight) * 0.12, -0.18, 0.18);
    this.primeMotionLookReference();
    this.applyCameraOrientation();
    this.focusedHotspot = undefined;
    this.onFocusChange?.(undefined);
    this.refreshLocationObjects();
    this.refreshHotspots();
    if (this.renderer.xr.isPresenting && this.vrPanelVisible) {
      this.placeVrPanelInFront();
    }
    this.markVrPanelDirty();
  }

  refreshHotspots(): void {
    const activeHotspotIds = new Set(this.gameState.getHotspots().map((hotspot) => hotspot.id));
    this.hotspotVisuals.forEach(({ mesh, label }) => {
      const active = activeHotspotIds.has(mesh.userData.hotspot.id);
      const inspected = this.gameState.hasInspected(mesh.userData.hotspot.id);
      mesh.visible = active;
      label.visible = active;
      mesh.material.color.set(inspected ? "#89d6ba" : "#f3d37a");
      mesh.material.emissive.set(inspected ? "#1b7e62" : "#8b621a");
    });

    if (this.focusedHotspot && !activeHotspotIds.has(this.focusedHotspot.id)) {
      this.focusedHotspot = undefined;
      this.onFocusChange?.(undefined);
    }

    this.markVrPanelDirty();
  }

  isMotionLookAvailable(): boolean {
    return this.motionLookAvailable;
  }

  isMotionLookEnabled(): boolean {
    return this.motionLookEnabled;
  }

  getMotionLookStatus(): MotionLookStatus {
    return this.motionLookStatus;
  }

  async setMotionLookEnabled(enabled: boolean): Promise<MotionLookResult> {
    if (!this.motionLookAvailable) {
      return {
        enabled: false,
        status: "unavailable",
        message: "Motion look is not available on this device or browser.",
      };
    }

    if (!enabled) {
      this.disableMotionLook("idle");
      return {
        enabled: false,
        status: this.motionLookStatus,
        message: "Motion look off. Drag the view to look around.",
      };
    }

    if (this.motionLookEnabled) {
      return {
        enabled: true,
        status: this.motionLookStatus,
        message: "Motion look is already on. Drag the view to fine-tune it.",
      };
    }

    this.motionLookStatus = "requesting";
    this.onMotionLookChange?.();

    try {
      const orientationEventConstructor = (window as WindowWithDeviceOrientation).DeviceOrientationEvent;
      if (typeof orientationEventConstructor?.requestPermission === "function") {
        const permission = await orientationEventConstructor.requestPermission();
        if (permission !== "granted") {
          this.disableMotionLook("denied");
          return {
            enabled: false,
            status: this.motionLookStatus,
            message: "Motion look permission was not granted.",
          };
        }
      }
    } catch {
      this.disableMotionLook("denied");
      return {
        enabled: false,
        status: this.motionLookStatus,
        message: "Motion look could not start. This browser may require HTTPS or sensor permission.",
      };
    }

    this.motionLookEnabled = true;
    this.motionLookStatus = "enabled";
    this.primeMotionLookReference();
    window.addEventListener("deviceorientation", this.handleDeviceOrientation, true);
    this.onMotionLookChange?.();

    return {
      enabled: true,
      status: this.motionLookStatus,
      message: "Motion look on. Drag the view to fine-tune it.",
    };
  }

  private detectMotionLookAvailability(): boolean {
    const orientationEventConstructor = (window as WindowWithDeviceOrientation).DeviceOrientationEvent;
    if (!orientationEventConstructor) {
      return false;
    }

    const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    const hasTouch = navigator.maxTouchPoints > 0;
    const mobileUserAgent = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const iPadDesktopUserAgent = /Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
    return (coarsePointer && hasTouch) || mobileUserAgent || iPadDesktopUserAgent;
  }

  private disableMotionLook(status: MotionLookStatus): void {
    if (!this.motionLookAvailable) {
      this.motionLookStatus = "unavailable";
      return;
    }

    window.removeEventListener("deviceorientation", this.handleDeviceOrientation, true);
    this.motionLookEnabled = false;
    this.motionLookStatus = status;
    this.motionReferenceYaw = undefined;
    this.motionReferencePitch = undefined;
    this.motionYawOffset = this.yaw;
    this.motionPitchOffset = this.pitch;
    this.onMotionLookChange?.();
  }

  private primeMotionLookReference(): void {
    if (!this.motionLookEnabled) {
      return;
    }

    this.motionReferenceYaw = undefined;
    this.motionReferencePitch = undefined;
    this.motionYawOffset = this.yaw;
    this.motionPitchOffset = this.pitch;
  }

  private updateMotionLookFromDevice(event: DeviceOrientationEvent): void {
    if (!this.motionLookEnabled || this.renderer.xr.isPresenting) {
      return;
    }

    const lookAngles = this.getDeviceLookAngles(event);
    if (!lookAngles) {
      return;
    }

    if (this.motionReferenceYaw === undefined || this.motionReferencePitch === undefined) {
      this.motionReferenceYaw = lookAngles.yaw;
      this.motionReferencePitch = lookAngles.pitch;
    }

    const yawDelta = shortestAngleDelta(lookAngles.yaw, this.motionReferenceYaw);
    const pitchDelta = lookAngles.pitch - this.motionReferencePitch;
    this.yaw = this.motionYawOffset + yawDelta;
    this.pitch = THREE.MathUtils.clamp(
      this.motionPitchOffset + pitchDelta,
      -motionLookPitchLimit,
      motionLookPitchLimit,
    );
    this.applyCameraOrientation();
  }

  private getDeviceLookAngles(event: DeviceOrientationEvent): { yaw: number; pitch: number } | undefined {
    const { alpha, beta, gamma } = event;
    if (alpha === null || beta === null || gamma === null) {
      return undefined;
    }

    const screenOrientation = THREE.MathUtils.degToRad(screen.orientation?.angle ?? 0);
    this.motionLookEuler.set(
      THREE.MathUtils.degToRad(beta),
      THREE.MathUtils.degToRad(alpha),
      THREE.MathUtils.degToRad(-gamma),
      "YXZ",
    );
    this.motionLookQuaternion.setFromEuler(this.motionLookEuler);
    this.motionLookQuaternion.multiply(motionLookCameraCorrection);
    this.motionLookQuaternion.multiply(
      this.motionLookScreenQuaternion.setFromAxisAngle(motionLookZAxis, -screenOrientation),
    );

    this.motionLookForward.set(0, 0, -1).applyQuaternion(this.motionLookQuaternion);
    return {
      yaw: Math.atan2(-this.motionLookForward.x, -this.motionLookForward.z),
      pitch: Math.asin(THREE.MathUtils.clamp(this.motionLookForward.y, -1, 1)),
    };
  }

  private buildScene(): void {
    this.scene.fog = new THREE.FogExp2("#111619", 0.043);
    this.scene.background = new THREE.Color("#111619");

    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(42, 64, 32),
      this.skyMaterial,
    );
    this.scene.add(sky);

    this.scene.add(new THREE.HemisphereLight("#d7eef4", "#332c23", 1.45));
    const lantern = new THREE.PointLight("#f4b468", 55, 14, 1.6);
    lantern.position.set(-2.2, 3.6, -3.2);
    this.scene.add(lantern);

    const fill = new THREE.DirectionalLight("#aac5d6", 1.5);
    fill.position.set(4, 7, 5);
    fill.castShadow = true;
    fill.shadow.camera.near = 0.5;
    fill.shadow.camera.far = 24;
    fill.shadow.camera.left = -8;
    fill.shadow.camera.right = 8;
    fill.shadow.camera.top = 8;
    fill.shadow.camera.bottom = -8;
    this.scene.add(fill);
  }

  private buildHotspots(): void {
    this.gameState.getAllHotspots().forEach((hotspot) => {
      const mesh = createHotspotMesh(hotspot);
      this.scene.add(mesh);

      const label = createSpriteLabel(hotspot.shortLabel, "#f4d891");
      label.position.set(hotspot.position[0], hotspot.position[1] + 0.33, hotspot.position[2]);
      this.scene.add(label);
      this.hotspotVisuals.set(hotspot.id, { mesh, label });
    });
    this.refreshHotspots();
  }

  private addLocationObject(locationId: LocationId, object: THREE.Object3D): void {
    this.scene.add(object);
    const objects = this.locationObjects.get(locationId) ?? [];
    objects.push(object);
    this.locationObjects.set(locationId, objects);
  }

  private loadVrMapImages(): void {
    fetch(resolvePublicAssetPath(broadStreetMapSvgPath))
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not load ${broadStreetMapSvgPath}`);
        }
        return response.text();
      })
      .then((svgText) => {
        this.createVrMapImage("base", svgText, false);
        this.createVrMapImage("deaths", svgText, true);
      })
      .catch(() => {
        this.markVrPanelDirty();
      });
  }

  private createVrMapImage(variant: VrMapVariant, svgText: string, deathsVisible: boolean): void {
    const image = new Image();
    const svg = createVrMapSvgVariant(svgText, deathsVisible);
    const objectUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    this.vrMapObjectUrls.push(objectUrl);

    image.onload = () => {
      this.vrMapImages.set(variant, image);
      this.markVrPanelDirty();
    };
    image.onerror = () => {
      this.markVrPanelDirty();
    };
    image.src = objectUrl;
  }

  private applyPanorama(locationId: LocationId): void {
    this.activePanoramaLocationId = locationId;
    this.setSkyTexture(this.fallbackPanoramaTexture);

    const cachedTexture = this.panoramaTextureCache.get(locationId);
    if (cachedTexture) {
      this.locationsWithLoadedPanorama.add(locationId);
      this.setSkyTexture(cachedTexture);
      return;
    }

    if (cachedTexture === null) {
      this.locationsWithLoadedPanorama.delete(locationId);
      return;
    }

    this.locationsWithLoadedPanorama.delete(locationId);
    this.panoramaLoader.load(
      resolvePublicAssetPath(panoramaAssetPaths[locationId]),
      (loadedTexture) => {
        const texture = createDisplayPanoramaTexture(loadedTexture);
        this.panoramaTextureCache.set(locationId, texture);
        this.locationsWithLoadedPanorama.add(locationId);
        if (this.activePanoramaLocationId === locationId) {
          this.setSkyTexture(texture);
          this.refreshLocationObjects();
        }
      },
      undefined,
      () => {
        this.panoramaTextureCache.set(locationId, null);
        this.locationsWithLoadedPanorama.delete(locationId);
        if (this.activePanoramaLocationId === locationId) {
          this.setSkyTexture(this.fallbackPanoramaTexture);
          this.refreshLocationObjects();
        }
      },
    );
  }

  private setSkyTexture(texture: THREE.Texture): void {
    if (this.skyMaterial.map === texture) {
      return;
    }

    this.skyMaterial.map = texture;
    this.skyMaterial.needsUpdate = true;
  }

  private addInputHandlers(): void {
    window.addEventListener("resize", () => this.resize());
    this.canvas.addEventListener("pointerdown", (event) => {
      if (this.renderer.xr.isPresenting) {
        return;
      }
      this.dragging = true;
      this.previousPointer = { x: event.clientX, y: event.clientY };
      this.canvas.setPointerCapture(event.pointerId);
    });
    this.canvas.addEventListener("pointermove", (event) => {
      if (!this.dragging) {
        return;
      }
      const deltaX = event.clientX - this.previousPointer.x;
      const deltaY = event.clientY - this.previousPointer.y;
      this.previousPointer = { x: event.clientX, y: event.clientY };
      const deltaYaw = deltaX * 0.004;
      const deltaPitch = deltaY * 0.003;
      this.yaw += deltaYaw;
      this.pitch = THREE.MathUtils.clamp(this.pitch + deltaPitch, -motionLookPitchLimit, motionLookPitchLimit);
      if (this.motionLookEnabled) {
        this.motionYawOffset += deltaYaw;
        this.motionPitchOffset = THREE.MathUtils.clamp(
          this.motionPitchOffset + deltaPitch,
          -motionLookPitchLimit,
          motionLookPitchLimit,
        );
      }
      this.applyCameraOrientation();
    });
    this.canvas.addEventListener("pointerup", (event) => {
      this.dragging = false;
      if (this.canvas.hasPointerCapture(event.pointerId)) {
        this.canvas.releasePointerCapture(event.pointerId);
      }
    });
    this.canvas.addEventListener("click", (event) => {
      if (this.renderer.xr.isPresenting) {
        return;
      }
      const hotspot = this.pickHotspot(event.clientX, event.clientY);
      if (hotspot) {
        this.onHotspotActivate?.(hotspot);
      }
    });
    window.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        if (this.focusedHotspot) {
          this.onHotspotActivate?.(this.focusedHotspot);
        }
      }
    });

    for (let index = 0; index < 2; index += 1) {
      const controller = this.renderer.xr.getController(index);
      const pointer = createControllerPointer();
      controller.add(pointer.group);
      controller.addEventListener("connected", (event) => {
        this.vrInputSources.set(controller, event.data);
        this.snapTurnLocked = false;
      });
      controller.addEventListener("disconnected", () => {
        this.vrInputSources.delete(controller);
        this.vrControllerButtonStates.delete(controller);
        this.snapTurnLocked = false;
      });
      controller.addEventListener("select", () => this.selectFromVrController(controller));
      controller.addEventListener("squeeze", () => this.toggleVrPanel());
      this.playerRig.add(controller);
      this.vrControllers.push(controller);
      this.vrControllerPointers.push(pointer);
    }

    this.renderer.xr.addEventListener("sessionstart", () => this.handleVrSessionStart());
    this.renderer.xr.addEventListener("sessionend", () => this.handleVrSessionEnd());
  }

  private handleVrSessionStart(): void {
    this.disableMotionLook("idle");
    this.vrPanelMode = "home";
    this.vrStatus = this.getDefaultVrStatus();
    this.snapTurnLocked = false;
    this.applyCameraOrientation();
    this.showVrPanel();
  }

  private handleVrSessionEnd(): void {
    this.hideVrPanel(false);
    this.snapTurnLocked = false;
    this.playerRig.rotation.set(0, 0, 0);
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
  }

  private toggleVrPanel(): void {
    if (!this.renderer.xr.isPresenting) {
      return;
    }

    if (this.vrPanelVisible) {
      this.hideVrPanel();
    } else {
      this.showVrPanel();
    }
  }

  private updateVrControls(timeSeconds: number): void {
    if (!this.renderer.xr.isPresenting) {
      this.vrIdleHint.visible = false;
      return;
    }

    if (this.vrPanelDirty) {
      this.rebuildVrPanel();
    }

    this.updateVrPointers();
    this.updateVrButtonFocus();
    this.updateVrPaginationButtons();
    this.updateSnapTurn();
    this.updateVrIdleHint(timeSeconds);
  }

  private selectFromVrController(controller: THREE.Group): void {
    const button = this.pickVrButton(controller);
    if (button) {
      this.handleVrButton(button.userData.vrButton);
      return;
    }

    if (this.pickVrPanel(controller)) {
      return;
    }

    const hotspot = this.pickVrHotspot(controller);
    if (hotspot) {
      this.activateVrHotspot(hotspot);
      return;
    }

    if (this.focusedHotspot) {
      this.activateVrHotspot(this.focusedHotspot);
    }
  }

  private activateVrHotspot(hotspot: Hotspot): void {
    const wasPanelVisible = this.vrPanelVisible;
    this.showVrPanel(!wasPanelVisible);
    this.vrPanelMode = "home";

    if (
      hotspot.id === "john-snow" &&
      this.gameState.getStage() === "synthesis" &&
      this.gameState.getCurrentLocation().id === "snow-desk"
    ) {
      this.vrPanelMode = "synthesis";
      this.vrStatus = "Snow turns to the map table. Test the evidence against the competing theories.";
      this.markVrPanelDirty();
      return;
    }

    const result = this.gameState.inspectHotspot(hotspot.id);
    this.vrStatus = result.dialogue?.intro ?? result.message;
    this.refreshHotspots();
    this.markVrPanelDirty();
  }

  private handleVrButton(action: VrButtonAction): void {
    switch (action.type) {
      case "mode":
        this.vrPanelMode = this.vrPanelMode === action.mode ? "home" : action.mode;
        if (action.mode === "map") {
          this.vrMapNeedsAttention = false;
        }
        this.vrStatus = this.getDefaultVrStatus();
        break;
      case "close-panel":
        if (this.vrPanelMode !== "home") {
          this.vrPanelMode = "home";
          this.vrStatus = this.getDefaultVrStatus();
        } else if (this.gameState.getActiveDialogue()) {
          this.gameState.closeDialogue();
          this.vrPanelMode = "home";
          this.vrStatus = "Conversation closed.";
        } else {
          this.hideVrPanel();
          return;
        }
        break;
      case "recenter":
        this.recenterToCurrentLocation();
        this.placeVrPanelInFront();
        this.vrStatus = "View recentered on the current investigation point.";
        break;
      case "travel": {
        const result = this.gameState.travelToLocation(action.locationId);
        this.vrPanelMode = "home";
        this.vrMapNeedsAttention = false;
        this.vrStatus = result.message;
        if (result.traveled) {
          this.refreshHotspots();
          this.hideVrPanel();
          return;
        }
        break;
      }
      case "ask": {
        const result = this.gameState.askQuestion(action.questionId);
        this.vrPanelMode = "home";
        if (result.evidence || action.questionId === "snow-method-question") {
          this.vrMapNeedsAttention = true;
        }
        this.vrStatus = this.formatVrQuestionResponse(result);
        break;
      }
      case "close-dialogue":
        this.gameState.closeDialogue();
        this.vrStatus = "Conversation closed.";
        break;
      case "page-text":
        this.turnVrTextPage(action.pageKey, action.direction);
        break;
      case "page-questions":
        this.turnVrQuestionPage(action.pageKey, action.direction);
        break;
      case "select-hypothesis": {
        const result = this.gameState.selectHypothesis(action.hypothesisId);
        this.vrPanelMode = "synthesis";
        this.vrStatus = result.message;
        break;
      }
      case "set-confidence": {
        const result = this.gameState.setSynthesisConfidence(action.confidence);
        this.vrPanelMode = "synthesis";
        this.vrStatus = result.message;
        break;
      }
      case "prepare-board": {
        const result = this.gameState.prepareBoardArgument();
        this.vrPanelMode = "synthesis";
        this.vrStatus = result.message;
        break;
      }
      case "present-board": {
        const result = this.gameState.presentToBoard();
        this.vrPanelMode = "synthesis";
        this.vrStatus = result.message;
        break;
      }
      case "finish-board":
        this.gameState.finishBoard();
        this.vrPanelMode = "synthesis";
        this.vrStatus = "The meeting is over. The parish waits to see what follows.";
        break;
      case "reset":
        this.gameState.reset();
        this.vrPanelMode = "home";
        this.vrStatus = "Investigation reset.";
        break;
    }

    this.showVrPanel(false);
    this.refreshHotspots();
    this.markVrPanelDirty();
  }

  private formatVrQuestionResponse(result: { response?: string; message: string }): string {
    return result.response ?? result.message;
  }

  private showVrPanel(placeInFront = true): void {
    this.vrPanelVisible = true;
    this.vrPanel.visible = true;
    this.vrPanelHiddenSince = undefined;
    this.vrIdleHint.visible = false;
    if (placeInFront) {
      this.placeVrPanelInFront();
    }
    this.markVrPanelDirty();
  }

  private hideVrPanel(startIdleHintTimer = true): void {
    this.vrPanelVisible = false;
    this.vrPanel.visible = false;
    this.vrIdleHint.visible = false;
    this.vrPanelHiddenSince = startIdleHintTimer ? performance.now() * 0.001 : undefined;
    this.markVrPanelDirty();
  }

  private getDefaultVrStatus(): string {
    if (this.vrPanelMode === "map") {
      return "Choose a location to travel by map.";
    }

    if (this.vrPanelMode === "notebook") {
      return "Collected evidence appears here as the inquiry develops.";
    }

    if (this.vrPanelMode === "synthesis") {
      return "Choose a theory, state our confidence, and decide what we should tell the Board.";
    }

    return "Aim with the controller beam. Trigger selects. Squeeze toggles the panel. Thumbstick turns.";
  }

  private rebuildVrPanel(): void {
    this.vrPanelDirty = false;
    this.clearVrPanel();
    this.vrPanelDrawCommands.length = 0;
    this.vrActivePageKey = undefined;

    if (!this.vrPanelVisible) {
      this.vrPanel.visible = false;
      return;
    }

    const currentLocation = this.gameState.getCurrentLocation();
    this.addVrHeaderControls();
    this.addVrText(currentLocation.title, 0.05, 0.81, 1.5, 0.16, {
      color: "#f6deb0",
      fontSize: 48,
      weight: "700",
    });
    if (this.vrPanelMode !== "map" && this.vrPanelMode !== "notebook") {
      this.addVrText(this.gameState.getObjective(), 0, 0.55, vrPanelContentWidth, 0.25, {
        color: "#d9e5e1",
        fontSize: 34,
      });
    }

    if (this.vrPanelMode === "map") {
      this.buildVrMapPanel();
    } else if (this.vrPanelMode === "notebook") {
      this.buildVrNotebookPanel();
    } else if (this.vrPanelMode === "synthesis") {
      this.buildVrSynthesisPanel();
    } else {
      this.buildVrHomePanel();
    }

    if (
      this.vrPanelMode === "home" &&
      !this.gameState.getActiveDialogue() &&
      this.gameState.getStage() !== "complete"
    ) {
      this.addVrText(this.vrStatus, 0, -0.76, vrPanelContentWidth, 0.2, {
        color: "#b9c9c4",
        fontSize: 30,
      });
    }

    this.addVrPanelSurface();
  }

  private addVrHeaderControls(): void {
    this.addVrIconButton("map", -1.17, 0.82, 0.2, {
      type: "mode",
      mode: "map",
    }, {
      active: this.vrPanelMode === "map",
      highlight: this.vrMapNeedsAttention && this.vrPanelMode !== "map",
    });
    this.addVrIconButton("notebook", -0.9, 0.82, 0.2, {
      type: "mode",
      mode: "notebook",
    }, {
      active: this.vrPanelMode === "notebook",
    });
    this.addVrIconButton("x", 1.22, 0.82, 0.2, { type: "close-panel" });
  }

  private buildVrHomePanel(): void {
    const activeDialogue = this.gameState.getActiveDialogue();
    if (activeDialogue) {
      this.addVrText(`${activeDialogue.speaker}: ${activeDialogue.role}`, 0, 0.34, vrPanelContentWidth, 0.14, {
        color: "#f1d79c",
        fontSize: 34,
        weight: "700",
      });
      const dialogueBody = this.vrStatus === this.getDefaultVrStatus() ? activeDialogue.intro : this.vrStatus;
      this.addPaginatedVrText(`dialogue:${activeDialogue.id}`, dialogueBody, 0, 0.02, vrPanelContentWidth, 0.48, {
        color: "#e7ece8",
        fontSize: 28,
      }, -0.25);

      const availableQuestions = this.gameState.getAvailableDialogueQuestions(activeDialogue);
      const questionPageKey = `dialogue-questions:${activeDialogue.id}`;
      const questionsPerPage = availableQuestions.length > 3 ? 2 : 3;
      const questionPageIndex = this.getVrQuestionPage(questionPageKey, availableQuestions.length, questionsPerPage);
      const questionPageCount = this.vrQuestionPageCounts.get(questionPageKey) ?? 1;
      const questionStartIndex = questionPageIndex * questionsPerPage;
      const visibleQuestions = availableQuestions.slice(questionStartIndex, questionStartIndex + questionsPerPage);

      visibleQuestions.forEach((question, index) => {
        const recorded = this.gameState.hasAskedQuestion(question.id) ? "Recorded: " : "";
        this.addVrPanelButton(`${recorded}${question.prompt}`, 0, -0.43 - index * 0.16, 2.34, 0.14, {
          type: "ask",
          questionId: question.id,
        });
      });

      if (questionPageCount > 1) {
        this.addVrText(`${questionPageIndex + 1}/${questionPageCount}`, 0, -0.75, 0.42, 0.1, {
          color: "#b9c9c4",
          fontSize: 22,
          weight: "700",
        });
        if (questionPageIndex > 0) {
          this.addVrPanelButton("<", -0.46, -0.75, 0.18, 0.12, {
            type: "page-questions",
            pageKey: questionPageKey,
            direction: -1,
          });
        }
        if (questionPageIndex < questionPageCount - 1) {
          this.addVrPanelButton(">", 0.46, -0.75, 0.18, 0.12, {
            type: "page-questions",
            pageKey: questionPageKey,
            direction: 1,
          });
        }
      }

      if (activeDialogue.id === "snow-briefing" && this.gameState.hasFieldAssignment() && availableQuestions.length === 1) {
        this.addVrText("Use the MAP in the top left corner to travel to other locations.", 0, -0.76, vrPanelContentWidth, 0.12, {
          color: "#b9c9c4",
          fontSize: 24,
          weight: "700",
        });
      }
      return;
    }

    if (this.gameState.getStage() === "synthesis" && this.gameState.getCurrentLocation().id === "snow-desk") {
      this.addVrText("Snow is ready to test the evidence against the possible causes.", 0, 0.14, vrPanelContentWidth, 0.34, {
        color: "#e7ece8",
        fontSize: 36,
      });
      this.addVrPanelButton("Snow Review", 0, -0.18, 1.1, 0.22, { type: "mode", mode: "synthesis" });
      return;
    }

    if (this.gameState.getStage() === "board") {
      this.addVrText("The Board has heard the argument. Record what follows.", 0, 0.14, vrPanelContentWidth, 0.34, {
        color: "#e7ece8",
        fontSize: 36,
      });
      this.addVrPanelButton("After the Meeting", 0, -0.18, 1.16, 0.22, { type: "finish-board" });
      return;
    }

    if (this.gameState.getStage() === "complete") {
      this.addPaginatedVrText("home:complete", this.gameState.getCurrentSceneBody().join(" "), 0, 0.06, vrPanelContentWidth, 0.7, {
        color: "#e7ece8",
        fontSize: 30,
      }, -0.42);
      this.addVrPanelButton("Reset", 0, -0.66, 0.68, 0.22, { type: "reset" });
      return;
    }

    this.addVrText("Point at a gold marker in the scene and pull the trigger to inspect it.", 0, 0.12, vrPanelContentWidth, 0.36, {
      color: "#e7ece8",
      fontSize: 36,
    });
  }

  private buildVrMapPanel(): void {
    this.addVrMap(0, -0.06, 1.48, 1.26);

    const currentLocationId = this.gameState.getCurrentLocation().id;
    const locations = this.gameState.getLocations().filter((location) => {
      return !location.boardOnly && this.gameState.canTravelToLocation(location.id) && location.id !== currentLocationId;
    });

    if (locations.length === 0) {
      this.addVrText("No other field locations are available yet.", 0, -0.72, vrPanelContentWidth, 0.12, {
        color: "#e7ece8",
        fontSize: 26,
      });
    }

    locations.slice(0, 7).forEach((location, index) => {
      const x = -1.04 + index * 0.35;
      this.addVrPanelButton(
        location.shortTitle,
        x,
        -0.76,
        0.31,
        0.14,
        {
          type: "travel",
          locationId: location.id,
        },
      );
    });
  }

  private buildVrNotebookPanel(): void {
    const collectedEvidence = this.gameState.getCollectedEvidence();
    const allEvidence = this.gameState.getAllEvidence();
    const collectedIds = new Set(collectedEvidence.map((card) => card.id));
    const studyGoalCompleted = this.gameState.hasFieldAssignment();
    const progressText =
      collectedEvidence.length >= boardThreshold
        ? `${collectedEvidence.length}/${allEvidence.length} evidence cards. Snow review ready.`
        : `${collectedEvidence.length}/${allEvidence.length} evidence cards. ${boardThreshold - collectedEvidence.length} more for Snow review.`;
    const notebookCards: VrPanelNotebookCardCommand[] = [
      {
        kind: "notebook-card",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        eyebrow: "Study Goal",
        title: fieldStudyGoal.title,
        body: studyGoalCompleted
          ? fieldStudyGoal.summary
          : "Speak with Snow at his desk to receive the field inquiry goal before traveling to other locations.",
        unlocked: studyGoalCompleted,
        studyGoal: true,
      },
      ...allEvidence.map((card) => {
        const unlocked = collectedIds.has(card.id);
        return {
          kind: "notebook-card" as const,
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          eyebrow: unlocked ? "Recorded Evidence" : "Evidence Card",
          title: unlocked ? card.title : "Unrecorded evidence",
          body: unlocked ? card.summary : this.gameState.getMissingEvidencePrompt(card),
          meta: unlocked ? card.sourceLabel : undefined,
          tags: unlocked ? card.supports.slice(0, 2) : undefined,
          unlocked,
        };
      }),
    ];

    this.addVrText("Field Notebook", 0, 0.52, vrPanelContentWidth, 0.11, {
      color: "#f1d79c",
      fontSize: 32,
      weight: "700",
    });
    this.addVrText(progressText, 0, 0.4, vrPanelContentWidth, 0.1, {
      color: "#d9e5e1",
      fontSize: 24,
      weight: "700",
    });

    const pageKey = "notebook:cards";
    const cardsPerPage = 2;
    const pageIndex = this.getVrListPage(pageKey, notebookCards.length, cardsPerPage);
    const pageCount = this.vrTextPageCounts.get(pageKey) ?? 1;
    const visibleCards = notebookCards.slice(pageIndex * cardsPerPage, pageIndex * cardsPerPage + cardsPerPage);
    visibleCards.forEach((card, index) => {
      this.addVrNotebookCard({
        ...card,
        x: 0,
        y: 0.15 - index * 0.47,
        width: vrPanelContentWidth,
        height: 0.41,
      });
    });

    if (pageCount > 1) {
      this.addVrText(`${pageIndex + 1}/${pageCount}`, 0, -0.75, 0.42, 0.1, {
        color: "#b9c9c4",
        fontSize: 24,
        weight: "700",
      });
      if (pageIndex > 0) {
        this.addVrPanelButton("<", -0.46, -0.75, 0.18, 0.12, {
          type: "page-text",
          pageKey,
          direction: -1,
        });
      }
      if (pageIndex < pageCount - 1) {
        this.addVrPanelButton(">", 0.46, -0.75, 0.18, 0.12, {
          type: "page-text",
          pageKey,
          direction: 1,
        });
      }
    }
  }

  private buildVrSynthesisPanel(): void {
    const stage = this.gameState.getStage();
    if (stage === "board" || stage === "complete") {
      this.addPaginatedVrText(`synthesis:${stage}`, this.gameState.getCurrentSceneBody().join(" "), 0, 0.1, vrPanelContentWidth, 0.7, {
        color: "#e7ece8",
        fontSize: 30,
      }, -0.42);
      this.addVrPanelButton(stage === "board" ? "After the Meeting" : "Reset", 0, -0.68, 1.16, 0.22, {
        type: stage === "board" ? "finish-board" : "reset",
      });
      return;
    }

    const selected = this.gameState.getSelectedHypothesis();
    const confidence = this.gameState.synthesisConfidence;
    const boardPrepared = this.gameState.preparedForBoard && this.gameState.getStage() === "synthesis";
    const mappedFindings = this.gameState.getMappedEvidenceFindings();
    const findingsText = mappedFindings.length
      ? mappedFindings.join(" ")
      : "Map evidence appears as you collect addresses, returns, and exceptions.";
    const selectedEvidence = selected ? this.gameState.getHypothesisEvidence(selected) : undefined;
    const supportsText = selectedEvidence?.supporting.length
      ? selectedEvidence.supporting.map((card) => card.title).join("; ")
      : "No recorded evidence selected yet.";
    const complicatesText = selectedEvidence?.complicating.length
      ? selectedEvidence.complicating.map((card) => card.title).join("; ")
      : "No major conflict recorded.";
    const reviewText = selected
      ? `${this.gameState.getSnowSynthesisFeedback()} Map evidence: ${findingsText} Evidence fit for ${selected.title}. Supports: ${supportsText} Complicates: ${complicatesText}`
      : `${this.gameState.getSnowSynthesisFeedback()} Map evidence: ${findingsText} Select a theory to compare supporting and complicating evidence.`;

    this.addVrText("Evidence Review", -0.54, 0.34, 1.22, 0.1, {
      color: "#f1d79c",
      fontSize: 28,
      weight: "700",
    });
    this.addPaginatedVrText("synthesis:review", reviewText, -0.54, 0.02, 1.24, 0.58, {
      color: "#e7ece8",
      fontSize: 24,
    }, -0.32);

    this.addVrText("Theory", 0.76, 0.34, 0.96, 0.1, { color: "#f1d79c", fontSize: 28, weight: "700" });

    this.gameState.getHypotheses().forEach((hypothesis, index) => {
      const label = selected?.id === hypothesis.id ? `Selected: ${hypothesis.shortTitle}` : hypothesis.shortTitle;
      this.addVrPanelButton(label, 0.76, 0.2 - index * 0.13, 0.94, 0.11, {
        type: "select-hypothesis",
        hypothesisId: hypothesis.id,
      });
    });

    const confidenceOptions: Array<{ id: SynthesisConfidence; label: string }> = [
      { id: "tentative", label: "Tentative" },
      { id: "proportionate", label: "Temporary action" },
      { id: "overstated", label: "Final proof" },
    ];
    confidenceOptions.forEach((option, index) => {
      const label = confidence === option.id ? `Set: ${option.label}` : option.label;
      this.addVrPanelButton(label, -0.64 + index * 0.64, -0.53, 0.58, 0.13, {
        type: "set-confidence",
        confidence: option.id,
      });
    });

    this.addVrPanelButton(
      boardPrepared ? "Present Findings" : "Prepare Board Argument",
      0,
      -0.72,
      1.42,
      0.2,
      { type: boardPrepared ? "present-board" : "prepare-board" },
    );
  }

  private addVrText(text: string, x: number, y: number, width: number, height: number, options: VrTextOptions = {}): void {
    this.vrPanelDrawCommands.push({
      kind: "text",
      text,
      x,
      y,
      width,
      height,
      color: options.color ?? "#ffffff",
      fontSize: options.fontSize ?? 36,
      weight: options.weight ?? "500",
    });
  }

  private addVrMap(x: number, y: number, width: number, height: number): void {
    const currentLocationId = this.gameState.getCurrentLocation().id;
    const deathsVisible = this.gameState.hasEvidence("attack-timeline") && this.gameState.hasEvidence("pump-cluster");
    this.vrPanelDrawCommands.push({
      kind: "map",
      x,
      y,
      width,
      height,
      deathsVisible,
      mapImage: this.vrMapImages.get(deathsVisible ? "deaths" : "base"),
      locations: this.gameState
        .getLocations()
        .filter((location) => !location.boardOnly)
        .map((location) => ({
          id: location.id,
          label: location.shortTitle,
          x: location.mapPoint.x,
          y: location.mapPoint.y,
          unlocked: this.gameState.isLocationUnlocked(location),
          current: location.id === currentLocationId,
          boardReady: false,
          offMapDirection: getVrMapOffMapDirection(location.id),
        })),
    });
  }

  private addVrNotebookCard(command: VrPanelNotebookCardCommand): void {
    this.vrPanelDrawCommands.push(command);
  }

  private addPaginatedVrText(
    pageKey: string,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    options: VrTextOptions = {},
    controlsY = y - height / 2 - 0.08,
  ): void {
    const fontSize = options.fontSize ?? 36;
    const weight = options.weight ?? "500";
    const signature = `${text}|${width}|${height}|${fontSize}|${weight}`;
    if (this.vrTextPageSignatures.get(pageKey) !== signature) {
      this.vrTextPageSignatures.set(pageKey, signature);
      this.vrTextPageIndexes.set(pageKey, 0);
    }

    const pages = createVrTextPages(text, x, y, width, height, {
      fontSize,
      weight,
    });
    const pageIndex = THREE.MathUtils.clamp(this.vrTextPageIndexes.get(pageKey) ?? 0, 0, pages.length - 1);
    this.vrTextPageIndexes.set(pageKey, pageIndex);
    this.vrTextPageCounts.set(pageKey, pages.length);
    this.addVrText(pages[pageIndex] ?? "", x, y, width, height, options);

    if (pages.length <= 1) {
      return;
    }

    this.vrActivePageKey = pageKey;
    this.addVrText(`${pageIndex + 1}/${pages.length}`, x, controlsY, 0.42, 0.1, {
      color: "#b9c9c4",
      fontSize: 24,
      weight: "700",
    });

    if (pageIndex > 0) {
      this.addVrPanelButton("<", x - width / 2 + 0.18, controlsY, 0.18, 0.12, {
        type: "page-text",
        pageKey,
        direction: -1,
      });
    }

    if (pageIndex < pages.length - 1) {
      this.addVrPanelButton(">", x + width / 2 - 0.18, controlsY, 0.18, 0.12, {
        type: "page-text",
        pageKey,
        direction: 1,
      });
    }
  }

  private addVrPanelButton(label: string, x: number, y: number, width: number, height: number, action: VrButtonAction): void {
    this.vrPanelDrawCommands.push({
      kind: "button",
      label,
      x,
      y,
      width,
      height,
    });

    const button = createVrButtonHitbox(width, height, action);
    button.position.set(x, y, 0.04);
    button.userData.baseScale = button.scale.clone();
    this.vrPanelButtons.push(button);
    this.vrPanel.add(button);
  }

  private addVrIconButton(
    icon: VrPanelIcon,
    x: number,
    y: number,
    size: number,
    action: VrButtonAction,
    options: { active?: boolean; highlight?: boolean } = {},
  ): void {
    this.vrPanelDrawCommands.push({
      kind: "button",
      icon,
      x,
      y,
      width: size,
      height: size,
      active: options.active,
      highlight: options.highlight,
    });

    const button = createVrButtonHitbox(size, size, action);
    button.position.set(x, y, 0.04);
    button.userData.baseScale = button.scale.clone();
    this.vrPanelButtons.push(button);
    this.vrPanel.add(button);
  }

  private addVrPanelSurface(): void {
    const panelSurface = createVrPanelSurface(this.vrPanelDrawCommands);
    panelSurface.position.set(0, 0, 0);
    this.vrPanelSurface = panelSurface;
    this.vrPanel.add(panelSurface);
  }

  private clearVrPanel(): void {
    [...this.vrPanel.children].forEach((child) => {
      this.vrPanel.remove(child);
      disposeObjectTree(child);
    });
    this.vrPanelButtons.length = 0;
    this.vrFocusedButton = undefined;
    this.vrPanelSurface = undefined;
  }

  private markVrPanelDirty(): void {
    this.vrPanelDirty = true;
  }

  private applyCameraOrientation(): void {
    if (this.renderer.xr.isPresenting) {
      this.playerRig.rotation.y = this.yaw;
      this.camera.rotation.set(0, 0, 0);
      return;
    }

    this.playerRig.rotation.set(0, 0, 0);
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
  }

  private recenterToCurrentLocation(): void {
    const location = this.gameState.getCurrentLocation();
    const target = locationLookTargets[location.id] ?? [0, 0, -4];
    this.yaw = Math.atan2(-target[0], -target[2]);
    this.pitch = THREE.MathUtils.clamp((target[1] - cameraHeight) * 0.12, -0.18, 0.18);
    this.primeMotionLookReference();
    this.applyCameraOrientation();
  }

  private placeVrPanelInFront(): void {
    this.camera.getWorldPosition(this.vrPanelWorldPosition);
    this.camera.getWorldDirection(this.vrPanelWorldDirection);
    this.vrPanelWorldDirection.y = 0;
    if (this.vrPanelWorldDirection.lengthSq() < 0.0001) {
      this.vrPanelWorldDirection.set(0, 0, -1);
    }
    this.vrPanelWorldDirection.normalize();

    this.vrPanel.position
      .copy(this.vrPanelWorldPosition)
      .addScaledVector(this.vrPanelWorldDirection, vrPanelDistance);
    this.vrPanel.position.y = Math.max(1.05, this.vrPanelWorldPosition.y - 0.18);

    this.vrPanelLookTarget.set(this.vrPanelWorldPosition.x, this.vrPanel.position.y, this.vrPanelWorldPosition.z);
    const yawToCamera = Math.atan2(
      this.vrPanelLookTarget.x - this.vrPanel.position.x,
      this.vrPanelLookTarget.z - this.vrPanel.position.z,
    );
    this.vrPanel.rotation.set(0, yawToCamera, 0);
  }

  private updateVrIdleHint(timeSeconds: number): void {
    if (this.vrPanelVisible || this.vrPanelHiddenSince === undefined) {
      this.vrIdleHint.visible = false;
      return;
    }

    if (timeSeconds - this.vrPanelHiddenSince < vrIdleHintDelaySeconds) {
      this.vrIdleHint.visible = false;
      return;
    }

    this.camera.getWorldPosition(this.vrIdleHintPosition);
    this.camera.getWorldDirection(this.vrIdleHintDirection);
    this.camera.getWorldQuaternion(this.vrIdleHintQuaternion);
    this.vrIdleHintDown.set(0, -1, 0).applyQuaternion(this.vrIdleHintQuaternion).normalize();
    this.vrIdleHint.position
      .copy(this.vrIdleHintPosition)
      .addScaledVector(this.vrIdleHintDirection, vrIdleHintDistance)
      .addScaledVector(this.vrIdleHintDown, vrIdleHintLowerOffset);
    this.vrIdleHint.visible = true;
  }

  private updateVrButtonFocus(): void {
    let nextButton: VrButtonMesh | undefined;
    for (const controller of this.vrControllers) {
      nextButton = this.pickVrButton(controller);
      if (nextButton) {
        break;
      }
    }

    if (nextButton === this.vrFocusedButton) {
      return;
    }

    this.vrFocusedButton = nextButton;
  }

  private updateVrPaginationButtons(): void {
    for (const controller of this.vrControllers) {
      const inputSource = this.vrInputSources.get(controller);
      const nextState = this.getVrPaginationButtonState(inputSource);
      const previousState = this.vrControllerButtonStates.get(controller) ?? {
        nextPagePressed: false,
        previousPagePressed: false,
      };

      if (this.vrActivePageKey && this.vrPanelVisible) {
        if (nextState.nextPagePressed && !previousState.nextPagePressed) {
          this.turnVrTextPage(this.vrActivePageKey, 1);
        } else if (nextState.previousPagePressed && !previousState.previousPagePressed) {
          this.turnVrTextPage(this.vrActivePageKey, -1);
        }
      }

      this.vrControllerButtonStates.set(controller, nextState);
    }
  }

  private getVrPaginationButtonState(inputSource?: XRInputSource): VrControllerButtonState {
    const buttons = inputSource?.gamepad?.buttons ?? [];
    return {
      nextPagePressed: Boolean(buttons[4]?.pressed),
      previousPagePressed: Boolean(buttons[5]?.pressed),
    };
  }

  private turnVrTextPage(pageKey: string, direction: -1 | 1): void {
    const pageCount = this.vrTextPageCounts.get(pageKey) ?? 1;
    const currentPage = this.vrTextPageIndexes.get(pageKey) ?? 0;
    const nextPage = THREE.MathUtils.clamp(currentPage + direction, 0, pageCount - 1);
    if (nextPage === currentPage) {
      return;
    }

    this.vrTextPageIndexes.set(pageKey, nextPage);
    this.markVrPanelDirty();
  }

  private getVrListPage(pageKey: string, itemCount: number, pageSize: number): number {
    const pageCount = Math.max(1, Math.ceil(itemCount / pageSize));
    const pageIndex = THREE.MathUtils.clamp(this.vrTextPageIndexes.get(pageKey) ?? 0, 0, pageCount - 1);
    this.vrTextPageIndexes.set(pageKey, pageIndex);
    this.vrTextPageCounts.set(pageKey, pageCount);
    if (pageCount > 1) {
      this.vrActivePageKey = pageKey;
    }
    return pageIndex;
  }

  private getVrQuestionPage(pageKey: string, questionCount: number, pageSize: number): number {
    const pageCount = Math.max(1, Math.ceil(questionCount / pageSize));
    const pageIndex = THREE.MathUtils.clamp(this.vrQuestionPageIndexes.get(pageKey) ?? 0, 0, pageCount - 1);
    this.vrQuestionPageIndexes.set(pageKey, pageIndex);
    this.vrQuestionPageCounts.set(pageKey, pageCount);
    return pageIndex;
  }

  private turnVrQuestionPage(pageKey: string, direction: -1 | 1): void {
    const pageCount = this.vrQuestionPageCounts.get(pageKey) ?? 1;
    const currentPage = this.vrQuestionPageIndexes.get(pageKey) ?? 0;
    const nextPage = THREE.MathUtils.clamp(currentPage + direction, 0, pageCount - 1);
    if (nextPage === currentPage) {
      return;
    }

    this.vrQuestionPageIndexes.set(pageKey, nextPage);
    this.markVrPanelDirty();
  }

  private updateSnapTurn(): void {
    let turnAxis = 0;
    for (const controller of this.vrControllers) {
      const inputSource = this.vrInputSources.get(controller);
      const candidate = this.getSnapTurnAxis(inputSource);
      if (Math.abs(candidate) > Math.abs(turnAxis)) {
        turnAxis = candidate;
      }
    }

    if (Math.abs(turnAxis) < snapTurnReleaseThreshold) {
      this.snapTurnLocked = false;
      return;
    }

    if (this.snapTurnLocked || Math.abs(turnAxis) < snapTurnActivationThreshold) {
      return;
    }

    this.yaw -= Math.sign(turnAxis) * snapTurnAngle;
    this.applyCameraOrientation();
    this.snapTurnLocked = true;
  }

  private getSnapTurnAxis(inputSource?: XRInputSource): number {
    const axes = inputSource?.gamepad?.axes ?? [];
    let strongestAxis = 0;

    for (let axisIndex = 0; axisIndex < axes.length; axisIndex += 2) {
      const axis = axes[axisIndex] ?? 0;
      if (Number.isFinite(axis) && Math.abs(axis) > Math.abs(strongestAxis)) {
        strongestAxis = axis;
      }
    }

    return strongestAxis;
  }

  private updateVrPointers(): void {
    this.vrControllers.forEach((controller, index) => {
      const pointer = this.vrControllerPointers[index];
      if (!pointer) {
        return;
      }

      const hit = this.pickVrPointerHit(controller);
      const distance = THREE.MathUtils.clamp(hit?.distance ?? 4.5, 0.18, 4.5);
      pointer.group.visible = true;
      pointer.beam.position.z = -distance / 2;
      pointer.beam.scale.set(1, 1, distance);
      pointer.reticle.position.z = -distance;

      const isButton = hit ? this.vrPanelButtons.includes(hit.object as VrButtonMesh) : false;
      const color = isButton ? "#8fd3ff" : hit ? "#f4d891" : "#d7e7ff";
      pointer.beam.material.color.set(color);
      pointer.reticle.material.color.set(color);
      pointer.beam.material.opacity = hit ? 0.9 : 0.52;
      pointer.reticle.material.opacity = hit ? 0.95 : 0.42;
      pointer.reticle.scale.setScalar(hit ? 1 : 0.74);
    });
  }

  private pickVrButton(controller: THREE.Group): VrButtonMesh | undefined {
    if (!this.vrPanelVisible || this.vrPanelButtons.length === 0) {
      return undefined;
    }

    this.setRaycasterFromController(controller);
    const hit = this.controllerRaycaster.intersectObjects(this.vrPanelButtons, false)[0];
    return hit ? (hit.object as VrButtonMesh) : undefined;
  }

  private pickVrPointerHit(controller: THREE.Group): THREE.Intersection<THREE.Object3D> | undefined {
    this.setRaycasterFromController(controller);
    const buttonHit = this.vrPanelVisible
      ? this.controllerRaycaster.intersectObjects(this.vrPanelButtons, false)[0]
      : undefined;
    if (buttonHit) {
      return buttonHit;
    }

    const panelHit = this.pickVrPanel(controller);
    if (panelHit) {
      return panelHit;
    }

    const visibleHotspots = [...this.hotspotVisuals.values()].map((visual) => visual.mesh).filter((mesh) => mesh.visible);
    return this.controllerRaycaster.intersectObjects(visibleHotspots, false)[0];
  }

  private pickVrPanel(controller: THREE.Group): THREE.Intersection<THREE.Object3D> | undefined {
    if (!this.vrPanelVisible || !this.vrPanelSurface) {
      return undefined;
    }

    this.setRaycasterFromController(controller);
    return this.controllerRaycaster.intersectObject(this.vrPanelSurface, false)[0];
  }

  private pickVrHotspot(controller: THREE.Group): Hotspot | undefined {
    this.setRaycasterFromController(controller);
    const visibleHotspots = [...this.hotspotVisuals.values()].map((visual) => visual.mesh).filter((mesh) => mesh.visible);
    const hit = this.controllerRaycaster.intersectObjects(visibleHotspots, false)[0];
    return hit ? (hit.object as HotspotMesh).userData.hotspot : undefined;
  }

  private setRaycasterFromController(controller: THREE.Group): void {
    controller.getWorldPosition(this.controllerWorldPosition);
    controller.getWorldQuaternion(this.controllerWorldQuaternion);
    this.controllerWorldDirection.set(0, 0, -1).applyQuaternion(this.controllerWorldQuaternion).normalize();
    this.controllerRaycaster.set(this.controllerWorldPosition, this.controllerWorldDirection);
    this.controllerRaycaster.near = 0;
    this.controllerRaycaster.far = 12;
  }

  private addVrEntryButton(): void {
    const button = VRButton.createButton(this.renderer);
    button.classList.add("vr-entry-button");
    document.body.appendChild(button);
  }

  private resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private updateHotspots(time: number): void {
    this.hotspotVisuals.forEach(({ mesh }, id) => {
      if (!mesh.visible) {
        return;
      }
      const inspected = this.gameState.hasInspected(id);
      const pulse = Math.sin(time * 2.7 + mesh.position.x) * 0.07;
      const baseScale = inspected ? 0.78 : 1;
      mesh.scale.setScalar(baseScale + pulse);
    });
  }

  private updateFocusFromCenter(): void {
    this.camera.getWorldPosition(this.cameraWorldPosition);
    this.camera.getWorldDirection(this.cameraDirection);

    let nextHotspot: Hotspot | undefined;
    let closestAngle = this.renderer.xr.isPresenting ? 0.28 : 0.18;
    this.hotspotVisuals.forEach(({ mesh }) => {
      if (!mesh.visible) {
        return;
      }
      mesh.getWorldPosition(this.hotspotWorldPosition);
      this.hotspotDirection.subVectors(this.hotspotWorldPosition, this.cameraWorldPosition).normalize();
      const angle = this.cameraDirection.angleTo(this.hotspotDirection);
      if (angle < closestAngle) {
        closestAngle = angle;
        nextHotspot = mesh.userData.hotspot;
      }
    });

    if (nextHotspot?.id !== this.focusedHotspot?.id) {
      this.focusedHotspot = nextHotspot;
      this.onFocusChange?.(nextHotspot);
    }
  }

  private pickHotspot(clientX: number, clientY: number): Hotspot | undefined {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -(((clientY - rect.top) / rect.height) * 2 - 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(
      [...this.hotspotVisuals.values()].map((visual) => visual.mesh).filter((mesh) => mesh.visible),
      false,
    )[0];
    return hit ? (hit.object as HotspotMesh).userData.hotspot : undefined;
  }

  private refreshLocationObjects(): void {
    const currentLocationId = this.gameState.getCurrentLocation().id;
    const currentLocationHasPanorama = this.locationsWithLoadedPanorama.has(currentLocationId);
    this.sharedExterior.visible = !currentLocationHasPanorama;
    this.locationObjects.forEach((objects, locationId) => {
      const visible = locationId === currentLocationId;
      objects.forEach((object) => {
        object.visible = visible;
        setEnvironmentShellVisibility(object, !(visible && currentLocationHasPanorama));
      });
    });
  }
}

function createControllerPointer(): VrControllerPointer {
  const group = new THREE.Group();
  const beamGeometry = new THREE.CylinderGeometry(0.008, 0.012, 1, 12, 1, true);
  beamGeometry.rotateX(Math.PI / 2);
  const beamMaterial = new THREE.MeshBasicMaterial({
    color: "#f4d891",
    transparent: true,
    opacity: 0.72,
    depthTest: false,
    fog: false,
    toneMapped: false,
  });
  const beam = new THREE.Mesh(beamGeometry, beamMaterial);
  beam.position.z = -2.25;
  beam.scale.set(1, 1, 4.5);
  beam.renderOrder = 90;
  group.add(beam);

  const reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.035, 0.054, 28),
    new THREE.MeshBasicMaterial({
      color: "#f4d891",
      transparent: true,
      opacity: 0.75,
      depthTest: false,
      side: THREE.DoubleSide,
      fog: false,
      toneMapped: false,
    }),
  );
  reticle.position.z = -4.5;
  reticle.renderOrder = 92;
  group.add(reticle);

  return { group, beam, reticle };
}

function createVrPanelSurface(commands: VrPanelDrawCommand[]): THREE.Mesh {
  const canvas = document.createElement("canvas");
  canvas.width = vrPanelTextureWidth;
  canvas.height = vrPanelTextureHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create VR panel surface.");
  }

  drawVrPanelBackground(ctx, canvas.width, canvas.height);
  commands.forEach((command) => {
    if (command.kind === "button") {
      drawVrPanelButton(ctx, command);
      return;
    }

    if (command.kind === "map") {
      drawVrPanelMap(ctx, command);
      return;
    }

    if (command.kind === "notebook-card") {
      drawVrNotebookCard(ctx, command);
      return;
    }

    drawVrPanelText(ctx, command);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
  texture.needsUpdate = true;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    fog: false,
    transparent: false,
    depthTest: true,
    depthWrite: true,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(vrPanelWidth, vrPanelHeight), material);
  mesh.renderOrder = 35;
  return mesh;
}

function createVrButtonHitbox(width: number, height: number, action: VrButtonAction): VrButtonMesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    }),
  ) as VrButtonMesh;
  mesh.userData = {
    vrButton: action,
    baseScale: new THREE.Vector3(1, 1, 1),
  };
  return mesh;
}

function drawVrPanelBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#102327");
  gradient.addColorStop(0.5, "#0b171a");
  gradient.addColorStop(1, "#060d0f");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#183036";
  ctx.fillRect(0, 0, width, Math.round(height * 0.18));

  ctx.strokeStyle = "#d9c489";
  ctx.lineWidth = 10;
  ctx.strokeRect(16, 16, width - 32, height - 32);
}

function drawVrPanelButton(ctx: CanvasRenderingContext2D, command: VrPanelButtonCommand): void {
  const rect = getPanelCanvasRect(command.x, command.y, command.width, command.height);
  const isIconButton = Boolean(command.icon);
  const radius = isIconButton ? rect.height * 0.5 : Math.min(rect.height * 0.18, 26);
  drawRoundRect(ctx, rect.x, rect.y, rect.width, rect.height, radius);
  ctx.fillStyle = command.active ? "#315f67" : command.highlight ? "#334e45" : "#274953";
  ctx.fill();
  ctx.lineWidth = command.highlight ? Math.max(8, rect.height * 0.055) : Math.max(5, rect.height * 0.035);
  ctx.strokeStyle = command.highlight ? "#f6d36f" : command.active ? "#cde8df" : "#9fc6c0";
  ctx.stroke();

  if (command.icon) {
    drawVrPanelIcon(ctx, command.icon, rect);
    return;
  }

  const fontSize = command.height < 0.14 ? 30 : command.height < 0.18 ? 34 : 40;
  drawTextIntoRect(ctx, command.label ?? "", rect, {
    color: "#fff4d8",
    fontSize,
    weight: "800",
    maxLines: command.height < 0.11 ? 1 : 2,
  });
}

function drawVrPanelIcon(
  ctx: CanvasRenderingContext2D,
  icon: VrPanelIcon,
  rect: { x: number; y: number; width: number; height: number },
): void {
  ctx.save();
  ctx.strokeStyle = "#fff4d8";
  ctx.lineWidth = Math.max(7, rect.width * 0.08);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const left = rect.x + rect.width * 0.25;
  const right = rect.x + rect.width * 0.75;
  const top = rect.y + rect.height * 0.25;
  const bottom = rect.y + rect.height * 0.75;
  const midX = rect.x + rect.width * 0.5;
  const midY = rect.y + rect.height * 0.5;

  if (icon === "x") {
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(right, bottom);
    ctx.moveTo(right, top);
    ctx.lineTo(left, bottom);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (icon === "map") {
    ctx.beginPath();
    ctx.moveTo(left, top + rect.height * 0.06);
    ctx.lineTo(rect.x + rect.width * 0.4, top - rect.height * 0.03);
    ctx.lineTo(rect.x + rect.width * 0.6, top + rect.height * 0.05);
    ctx.lineTo(right, top - rect.height * 0.02);
    ctx.lineTo(right, bottom - rect.height * 0.06);
    ctx.lineTo(rect.x + rect.width * 0.6, bottom + rect.height * 0.03);
    ctx.lineTo(rect.x + rect.width * 0.4, bottom - rect.height * 0.05);
    ctx.lineTo(left, bottom + rect.height * 0.02);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(rect.x + rect.width * 0.4, top - rect.height * 0.02);
    ctx.lineTo(rect.x + rect.width * 0.4, bottom - rect.height * 0.05);
    ctx.moveTo(rect.x + rect.width * 0.6, top + rect.height * 0.05);
    ctx.lineTo(rect.x + rect.width * 0.6, bottom + rect.height * 0.03);
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.roundRect(left, top, rect.width * 0.42, rect.height * 0.5, rect.width * 0.05);
  ctx.moveTo(rect.x + rect.width * 0.34, top);
  ctx.lineTo(rect.x + rect.width * 0.34, bottom);
  ctx.moveTo(rect.x + rect.width * 0.66, rect.y + rect.height * 0.34);
  ctx.lineTo(rect.x + rect.width * 0.77, rect.y + rect.height * 0.34);
  ctx.moveTo(rect.x + rect.width * 0.66, rect.y + rect.height * 0.49);
  ctx.lineTo(rect.x + rect.width * 0.77, rect.y + rect.height * 0.49);
  ctx.moveTo(rect.x + rect.width * 0.66, rect.y + rect.height * 0.64);
  ctx.lineTo(rect.x + rect.width * 0.77, rect.y + rect.height * 0.64);
  ctx.stroke();
  ctx.restore();
}

function drawVrPanelMap(ctx: CanvasRenderingContext2D, command: VrPanelMapCommand): void {
  const rect = getPanelCanvasRect(command.x, command.y, command.width, command.height);
  const mapRect = getCenteredVrMapRect(rect);
  const radius = Math.min(rect.width, rect.height) * 0.035;

  drawRoundRect(ctx, rect.x, rect.y, rect.width, rect.height, radius);
  ctx.fillStyle = "#efe0bc";
  ctx.fill();
  ctx.lineWidth = Math.max(6, rect.width * 0.006);
  ctx.strokeStyle = "#8b7650";
  ctx.stroke();

  ctx.save();
  drawRoundRect(ctx, mapRect.x, mapRect.y, mapRect.width, mapRect.height, radius);
  ctx.clip();
  ctx.fillStyle = "#ead9b0";
  ctx.fillRect(mapRect.x, mapRect.y, mapRect.width, mapRect.height);
  if (command.mapImage?.complete && command.mapImage.naturalWidth > 0) {
    ctx.drawImage(command.mapImage, mapRect.x, mapRect.y, mapRect.width, mapRect.height);
    drawVrMapPumps(ctx, mapRect);
  } else {
    drawVrMapBlocks(ctx, mapRect);
    drawVrMapStreets(ctx, mapRect);
    drawVrMapLabels(ctx, mapRect);
    if (command.deathsVisible) {
      drawVrMapDeaths(ctx, mapRect);
    }
    drawVrMapPumps(ctx, mapRect);
  }
  command.locations.forEach((location) => drawVrMapLocation(ctx, mapRect, location));
  drawVrMapLegend(ctx, mapRect, command.deathsVisible);
  ctx.restore();
}

function getCenteredVrMapRect(rect: { x: number; y: number; width: number; height: number }): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const size = Math.min(rect.width, rect.height) * 0.96;
  return {
    x: rect.x + (rect.width - size) / 2,
    y: rect.y + (rect.height - size) / 2,
    width: size,
    height: size,
  };
}

function drawVrMapBlocks(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
): void {
  const blocks = [
    [
      [5, 5],
      [21, 5],
      [24, 24],
      [7, 28],
    ],
    [
      [27, 5],
      [47, 5],
      [48, 23],
      [31, 25],
    ],
    [
      [55, 5],
      [72, 5],
      [71, 23],
      [57, 24],
    ],
    [
      [80, 5],
      [96, 8],
      [95, 23],
      [80, 22],
    ],
    [
      [8, 32],
      [25, 29],
      [27, 44],
      [9, 46],
    ],
    [
      [34, 29],
      [48, 27],
      [48, 43],
      [35, 44],
    ],
    [
      [58, 28],
      [70, 27],
      [70, 42],
      [59, 43],
    ],
    [
      [79, 28],
      [95, 29],
      [94, 43],
      [80, 43],
    ],
    [
      [8, 56],
      [28, 54],
      [29, 64],
      [12, 67],
    ],
    [
      [36, 54],
      [49, 53],
      [49, 63],
      [36, 64],
    ],
    [
      [59, 53],
      [70, 52],
      [71, 63],
      [60, 64],
    ],
    [
      [79, 54],
      [96, 55],
      [96, 66],
      [82, 66],
    ],
    [
      [10, 70],
      [30, 67],
      [32, 78],
      [9, 83],
    ],
    [
      [39, 68],
      [56, 66],
      [57, 79],
      [38, 82],
    ],
    [
      [65, 67],
      [80, 65],
      [85, 77],
      [67, 80],
    ],
    [
      [35, 84],
      [58, 81],
      [62, 96],
      [34, 96],
    ],
    [
      [69, 82],
      [90, 79],
      [96, 96],
      [72, 96],
    ],
  ];

  ctx.fillStyle = "#d4c6a3";
  ctx.strokeStyle = "rgba(102, 84, 52, 0.32)";
  ctx.lineWidth = Math.max(2, rect.width * 0.0025);
  blocks.forEach((block) => {
    ctx.beginPath();
    block.forEach(([x, y], index) => {
      const point = getVrMapCanvasPoint(rect, x, y);
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });
}

function drawVrMapStreets(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
): void {
  const streets: Array<{
    start: [number, number];
    cp1: [number, number];
    cp2: [number, number];
    end: [number, number];
    major?: boolean;
  }> = [
    { start: [4, 50], cp1: [20, 49], cp2: [66, 47], end: [96, 50], major: true },
    { start: [6, 76], cp1: [23, 74], cp2: [74, 70], end: [97, 72], major: true },
    { start: [10, 63], cp1: [25, 61], cp2: [66, 60], end: [94, 63] },
    { start: [25, 4], cp1: [26, 18], cp2: [31, 65], end: [24, 97], major: true },
    { start: [52, 4], cp1: [52, 20], cp2: [50, 80], end: [46, 97] },
    { start: [59, 4], cp1: [58, 21], cp2: [62, 82], end: [67, 97], major: true },
    { start: [77, 5], cp1: [77, 23], cp2: [80, 72], end: [93, 97], major: true },
    { start: [6, 26], cp1: [23, 24], cp2: [72, 21], end: [97, 25] },
    { start: [38, 34], cp1: [47, 35], cp2: [80, 37], end: [96, 38] },
    { start: [33, 58], cp1: [41, 55], cp2: [74, 42], end: [83, 40] },
  ];

  streets.forEach((street) => {
    drawVrMapStreet(ctx, rect, street, true);
  });
  streets.forEach((street) => {
    drawVrMapStreet(ctx, rect, street, false);
  });
}

function drawVrMapStreet(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
  street: {
    start: [number, number];
    cp1: [number, number];
    cp2: [number, number];
    end: [number, number];
    major?: boolean;
  },
  casing: boolean,
): void {
  const start = getVrMapCanvasPoint(rect, street.start[0], street.start[1]);
  const cp1 = getVrMapCanvasPoint(rect, street.cp1[0], street.cp1[1]);
  const cp2 = getVrMapCanvasPoint(rect, street.cp2[0], street.cp2[1]);
  const end = getVrMapCanvasPoint(rect, street.end[0], street.end[1]);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = rect.width * (casing ? (street.major ? 0.036 : 0.027) : street.major ? 0.022 : 0.015);
  ctx.strokeStyle = casing ? "rgba(86, 70, 46, 0.45)" : "#f4ebcf";
  ctx.stroke();
}

function drawVrMapLabels(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
): void {
  const labels: Array<{ text: string; x: number; y: number; rotation: number }> = [
    { text: "BROAD STREET", x: 55, y: 47, rotation: -0.04 },
    { text: "POLAND ST", x: 79, y: 31, rotation: -1.35 },
    { text: "BREWER ST", x: 69, y: 75, rotation: -0.12 },
  ];
  ctx.save();
  ctx.fillStyle = "rgba(67, 56, 39, 0.72)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${Math.max(18, rect.width * 0.027)}px Georgia, "Times New Roman", serif`;
  labels.forEach((label) => {
    const point = getVrMapCanvasPoint(rect, label.x, label.y);
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(label.rotation);
    ctx.fillText(label.text, 0, 0);
    ctx.restore();
  });
  ctx.restore();
}

function drawVrMapDeaths(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
): void {
  const deathMarks = [
    [54, 42],
    [56, 43],
    [58, 41],
    [59, 45],
    [61, 43],
    [63, 46],
    [57, 49],
    [60, 50],
    [64, 51],
    [52, 47],
    [49, 45],
    [67, 47],
    [55, 55],
    [62, 57],
    [45, 52],
    [70, 39],
    [50, 59],
    [72, 53],
  ];
  const width = rect.width * 0.013;
  const height = rect.height * 0.034;
  ctx.fillStyle = "rgba(125, 45, 48, 0.72)";
  ctx.strokeStyle = "rgba(80, 27, 31, 0.58)";
  ctx.lineWidth = Math.max(1.5, rect.width * 0.0018);
  deathMarks.forEach(([x, y]) => {
    const point = getVrMapCanvasPoint(rect, x, y);
    drawRoundRect(ctx, point.x - width / 2, point.y - height / 2, width, height, width * 0.22);
    ctx.fill();
    ctx.stroke();
  });
}

function drawVrMapPumps(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
): void {
  const pumpPoints = [
    [34.4, 91.1],
    [65.4, 86.2],
    [97.4, 73.2],
    [56.1, 45.7],
    [16.4, 33.9],
    [15.2, 10.8],
  ];
  const radius = rect.width * 0.012;
  pumpPoints.forEach(([x, y]) => {
    const point = getVrMapCanvasPoint(rect, x, y);
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#0b766d";
    ctx.fill();
    ctx.lineWidth = Math.max(3, rect.width * 0.0035);
    ctx.strokeStyle = "rgba(255, 246, 218, 0.95)";
    ctx.stroke();
  });
}

function drawVrMapLocation(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
  location: VrMapLocationCommand,
): void {
  const x = clampValue(location.x, 3, 97);
  const y = clampValue(location.y, 5, 95);
  const point = getVrMapCanvasPoint(rect, x, y);
  const radius = rect.width * 0.018;
  const activeColor = location.boardReady ? "#e9b653" : location.current ? "#2f6f69" : location.unlocked ? "#a6463e" : "#777065";
  const labelColor = location.current || location.boardReady ? "#fff4d8" : "#24190d";

  if (location.offMapDirection) {
    drawVrMapOffMapArrow(ctx, point, radius, location.offMapDirection, activeColor);
  }

  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = activeColor;
  ctx.globalAlpha = location.unlocked || location.current || location.boardReady ? 1 : 0.45;
  ctx.fill();
  ctx.lineWidth = Math.max(3, rect.width * 0.0035);
  ctx.strokeStyle = location.boardReady ? "#fff1bd" : "#24190d";
  if (location.offMapDirection) {
    ctx.setLineDash([8, 7]);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  const fontSize = Math.max(22, rect.width * 0.026);
  ctx.font = `800 ${fontSize}px Arial, Helvetica, sans-serif`;
  const paddingX = fontSize * 0.45;
  const labelWidth = ctx.measureText(location.label).width + paddingX * 2;
  const labelHeight = fontSize * 1.35;
  const preferredX = point.x + radius * 1.35;
  const labelX = clampValue(preferredX, rect.x + 8, rect.x + rect.width - labelWidth - 8);
  const labelY = clampValue(point.y - labelHeight / 2, rect.y + 8, rect.y + rect.height - labelHeight - 8);
  drawRoundRect(ctx, labelX, labelY, labelWidth, labelHeight, labelHeight * 0.48);
  ctx.fillStyle = location.current ? "#2f6f69" : location.boardReady ? "#5c4320" : "rgba(247, 235, 202, 0.94)";
  ctx.fill();
  ctx.lineWidth = Math.max(2, rect.width * 0.0025);
  ctx.strokeStyle = "rgba(37, 26, 12, 0.45)";
  ctx.stroke();
  ctx.fillStyle = labelColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(location.label, labelX + labelWidth / 2, labelY + labelHeight / 2);
  ctx.globalAlpha = 1;
}

function drawVrMapOffMapArrow(
  ctx: CanvasRenderingContext2D,
  point: { x: number; y: number },
  radius: number,
  direction: "east" | "south" | "southwest" | "southeast",
  color: string,
): void {
  const length = radius * 2.4;
  const angle =
    direction === "east"
      ? 0
      : direction === "south"
        ? Math.PI / 2
      : direction === "southwest"
        ? (Math.PI * 3) / 4
        : Math.PI / 4;
  const startX = point.x + Math.cos(angle) * radius * 1.2;
  const startY = point.y + Math.sin(angle) * radius * 1.2;
  const endX = point.x + Math.cos(angle) * length;
  const endY = point.y + Math.sin(angle) * length;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(4, radius * 0.35);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.translate(endX, endY);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(radius * 0.68, 0);
  ctx.lineTo(-radius * 0.35, -radius * 0.45);
  ctx.lineTo(-radius * 0.35, radius * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawVrMapLegend(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
  deathsVisible: boolean,
): void {
  const width = rect.width * 0.25;
  const height = rect.height * (deathsVisible ? 0.16 : 0.1);
  const x = rect.x + rect.width - width - rect.width * 0.018;
  const y = rect.y + rect.height * 0.025;
  drawRoundRect(ctx, x, y, width, height, height * 0.12);
  ctx.fillStyle = "rgba(255, 245, 219, 0.94)";
  ctx.fill();
  ctx.strokeStyle = "rgba(75, 61, 38, 0.34)";
  ctx.lineWidth = Math.max(2, rect.width * 0.0025);
  ctx.stroke();

  const fontSize = Math.max(20, rect.width * 0.025);
  ctx.font = `800 ${fontSize}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#271d10";
  const swatchX = x + width * 0.12;
  const textX = x + width * 0.26;
  const pumpY = y + height * (deathsVisible ? 0.32 : 0.5);
  ctx.beginPath();
  ctx.arc(swatchX, pumpY, fontSize * 0.34, 0, Math.PI * 2);
  ctx.fillStyle = "#0b766d";
  ctx.fill();
  ctx.fillStyle = "#271d10";
  ctx.fillText("Pumps", textX, pumpY);

  if (!deathsVisible) {
    return;
  }

  const deathY = y + height * 0.72;
  drawRoundRect(ctx, swatchX - fontSize * 0.35, deathY - fontSize * 0.22, fontSize * 0.7, fontSize * 0.44, fontSize * 0.1);
  ctx.fillStyle = "rgba(125, 45, 48, 0.74)";
  ctx.fill();
  ctx.fillStyle = "#271d10";
  ctx.fillText("Deaths", textX, deathY);
}

function drawVrNotebookCard(ctx: CanvasRenderingContext2D, command: VrPanelNotebookCardCommand): void {
  const rect = getPanelCanvasRect(command.x, command.y, command.width, command.height);
  const scale = vrPanelTextureWidth / vrPanelDesignWidth;
  const radius = Math.min(rect.height * 0.1, 28 * scale);
  const isComplete = command.unlocked;

  drawRoundRect(ctx, rect.x, rect.y, rect.width, rect.height, radius);
  ctx.fillStyle = command.studyGoal
    ? isComplete
      ? "#243f39"
      : "#1b3032"
    : isComplete
      ? "#21383d"
      : "#17262a";
  ctx.fill();
  ctx.lineWidth = Math.max(4 * scale, rect.height * 0.018);
  ctx.strokeStyle = isComplete ? "#d9c489" : "rgba(159, 198, 192, 0.45)";
  ctx.stroke();

  const padding = 22 * scale;
  const statusRadius = 18 * scale;
  const statusX = rect.x + padding + statusRadius;
  const statusY = rect.y + padding + statusRadius * 0.95;
  ctx.beginPath();
  ctx.arc(statusX, statusY, statusRadius, 0, Math.PI * 2);
  ctx.fillStyle = isComplete ? "#f1d79c" : "rgba(185, 201, 196, 0.2)";
  ctx.fill();
  ctx.lineWidth = Math.max(3 * scale, statusRadius * 0.16);
  ctx.strokeStyle = isComplete ? "#fff4d8" : "rgba(185, 201, 196, 0.64)";
  ctx.stroke();

  if (isComplete) {
    ctx.beginPath();
    ctx.strokeStyle = "#173336";
    ctx.lineWidth = Math.max(4 * scale, statusRadius * 0.18);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.moveTo(statusX - statusRadius * 0.45, statusY - statusRadius * 0.02);
    ctx.lineTo(statusX - statusRadius * 0.12, statusY + statusRadius * 0.34);
    ctx.lineTo(statusX + statusRadius * 0.5, statusY - statusRadius * 0.4);
    ctx.stroke();
  }

  const contentX = rect.x + padding * 2 + statusRadius * 2;
  const contentWidth = rect.x + rect.width - padding - contentX;
  let cursorY = rect.y + padding * 0.88;

  cursorY = drawVrNotebookLeftText(ctx, command.eyebrow, contentX, cursorY, contentWidth, 18, "800", "#f1d79c", 1, 0.95);
  cursorY = drawVrNotebookLeftText(ctx, command.title, contentX, cursorY + 4 * scale, contentWidth, 27, "800", "#fff4d8", 1);
  cursorY = drawVrNotebookLeftText(
    ctx,
    command.body,
    contentX,
    cursorY + 7 * scale,
    contentWidth,
    22,
    "600",
    isComplete ? "#e7ece8" : "#b9c9c4",
    command.meta ? 2 : 3,
    1.12,
  );

  if (command.meta) {
    cursorY = drawVrNotebookLeftText(ctx, command.meta, contentX, cursorY + 5 * scale, contentWidth, 18, "700", "#b9c9c4", 1);
  }

  if (command.tags?.length) {
    let tagX = contentX;
    const tagY = Math.min(cursorY + 7 * scale, rect.y + rect.height - 34 * scale);
    command.tags.forEach((tag) => {
      tagX = drawVrNotebookTag(ctx, tag, tagX, tagY, rect.x + rect.width - padding);
    });
  }
}

function drawVrNotebookLeftText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  weight: string,
  color: string,
  maxLines: number,
  lineHeightMultiplier = 1.14,
): number {
  const scale = vrPanelTextureWidth / vrPanelDesignWidth;
  const scaledFontSize = fontSize * scale;
  const lineHeight = scaledFontSize * lineHeightMultiplier;
  ctx.font = `${weight} ${scaledFontSize}px Arial, Helvetica, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  const lines = wrapCanvasText(ctx, text, maxWidth, maxLines);
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });

  return y + lines.length * lineHeight;
}

function drawVrNotebookTag(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  maxRight: number,
): number {
  const scale = vrPanelTextureWidth / vrPanelDesignWidth;
  const fontSize = 16 * scale;
  const paddingX = 10 * scale;
  const height = 26 * scale;
  ctx.font = `800 ${fontSize}px Arial, Helvetica, sans-serif`;
  const width = Math.min(ctx.measureText(label).width + paddingX * 2, Math.max(0, maxRight - x));
  if (width < 45 * scale) {
    return x;
  }

  drawRoundRect(ctx, x, y, width, height, height * 0.45);
  ctx.fillStyle = "rgba(241, 215, 156, 0.14)";
  ctx.fill();
  ctx.strokeStyle = "rgba(241, 215, 156, 0.36)";
  ctx.lineWidth = Math.max(1.5 * scale, 2);
  ctx.stroke();
  ctx.fillStyle = "#f1d79c";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(ellipsizeCanvasText(ctx, label, Math.max(fontSize, width - paddingX * 2)), x + width / 2, y + height / 2);
  return x + width + 8 * scale;
}

function getVrMapCanvasPoint(
  rect: { x: number; y: number; width: number; height: number },
  xPercent: number,
  yPercent: number,
): { x: number; y: number } {
  return {
    x: rect.x + (xPercent / 100) * rect.width,
    y: rect.y + (yPercent / 100) * rect.height,
  };
}

function getVrMapOffMapDirection(locationId: LocationId): "east" | "south" | "southwest" | "southeast" | undefined {
  if (locationId === "snow-desk") {
    return "south";
  }
  if (locationId === "registrar") {
    return "southeast";
  }
  return undefined;
}

function drawVrPanelText(ctx: CanvasRenderingContext2D, command: VrPanelTextCommand): void {
  const rect = getPanelCanvasRect(command.x, command.y, command.width, command.height);
  drawTextIntoRect(ctx, command.text, rect, {
    color: command.color,
    fontSize: command.fontSize,
    weight: command.weight,
  });
}

function createVrTextPages(
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options: { fontSize: number; weight: string },
): string[] {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return [text];
  }

  const scale = vrPanelTextureWidth / vrPanelDesignWidth;
  const rect = getPanelCanvasRect(x, y, width, height);
  const fontSize = options.fontSize * scale;
  const padding = getTextPadding(rect, fontSize);
  const maxWidth = Math.max(fontSize, rect.width - padding * 2);
  const linesPerPage = getMaxLinesForRect(rect, fontSize);
  ctx.font = `${options.weight} ${fontSize}px Arial, Helvetica, sans-serif`;

  const wrappedLines = wrapCanvasText(ctx, text, maxWidth);
  const pages: string[] = [];
  for (let lineIndex = 0; lineIndex < wrappedLines.length; lineIndex += linesPerPage) {
    pages.push(wrappedLines.slice(lineIndex, lineIndex + linesPerPage).join(" "));
  }

  return pages.length > 0 ? pages : [""];
}

function drawTextIntoRect(
  ctx: CanvasRenderingContext2D,
  text: string,
  rect: { x: number; y: number; width: number; height: number },
  options: { color: string; fontSize: number; weight: string; maxLines?: number },
): void {
  const scale = vrPanelTextureWidth / vrPanelDesignWidth;
  const baseFontSize = options.fontSize * scale;
  const minimumFontSize = Math.max(20 * scale, baseFontSize * 0.58);
  const fontStep = 2 * scale;
  let layout = measureWrappedText(ctx, text, rect, options.weight, baseFontSize, options.maxLines);

  while (!layout.fits && layout.fontSize - fontStep >= minimumFontSize) {
    layout = measureWrappedText(ctx, text, rect, options.weight, layout.fontSize - fontStep, options.maxLines);
  }

  if (!layout.fits) {
    const maxLines = getMaxLinesForRect(rect, layout.fontSize);
    layout = measureWrappedText(ctx, text, rect, options.weight, layout.fontSize, maxLines);
  }

  ctx.font = `${options.weight} ${layout.fontSize}px Arial, Helvetica, sans-serif`;
  ctx.fillStyle = options.color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(4 * scale, layout.fontSize * 0.08);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.86)";

  const startY = rect.y + rect.height / 2 - ((layout.lines.length - 1) * layout.lineHeight) / 2;
  layout.lines.forEach((line, index) => {
    const y = startY + index * layout.lineHeight;
    ctx.strokeText(line, rect.x + rect.width / 2, y);
    ctx.fillText(line, rect.x + rect.width / 2, y);
  });
}

function measureWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  rect: { width: number; height: number },
  weight: string,
  fontSize: number,
  maxLines?: number,
): WrappedTextLayout {
  const padding = getTextPadding(rect, fontSize);
  const lineHeight = fontSize * 1.16;
  const maxWidth = Math.max(fontSize, rect.width - padding * 2);
  const availableHeight = Math.max(lineHeight, rect.height - padding * 2);
  const maxLinesByHeight = Math.max(1, Math.floor(availableHeight / lineHeight));

  ctx.font = `${weight} ${fontSize}px Arial, Helvetica, sans-serif`;
  const lines = wrapCanvasText(ctx, text, maxWidth, maxLines);
  return {
    fontSize,
    lineHeight,
    lines,
    fits: lines.length <= maxLinesByHeight,
  };
}

function getTextPadding(rect: { height: number }, fontSize: number): number {
  const scale = vrPanelTextureWidth / vrPanelDesignWidth;
  return Math.max(12 * scale, Math.min(rect.height * 0.08, fontSize * 0.55));
}

function getMaxLinesForRect(rect: { height: number }, fontSize: number): number {
  const padding = getTextPadding(rect, fontSize);
  const lineHeight = fontSize * 1.16;
  return Math.max(1, Math.floor(Math.max(lineHeight, rect.height - padding * 2) / lineHeight));
}

function getPanelCanvasRect(
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } {
  const pixelsPerPanelX = vrPanelTextureWidth / vrPanelWidth;
  const pixelsPerPanelY = vrPanelTextureHeight / vrPanelHeight;
  return {
    x: (x - width / 2 + vrPanelWidth / 2) * pixelsPerPanelX,
    y: (vrPanelHeight / 2 - y - height / 2) * pixelsPerPanelY,
    width: width * pixelsPerPanelX,
    height: height * pixelsPerPanelY,
  };
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines?: number,
): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || currentLine.length === 0) {
      currentLine = candidate;
      return;
    }

    lines.push(currentLine);
    currentLine = word;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  if (maxLines !== undefined && lines.length > maxLines) {
    const trimmed = lines.slice(0, maxLines);
    const finalLine = trimmed[trimmed.length - 1] ?? "";
    trimmed[trimmed.length - 1] = ellipsizeCanvasText(ctx, finalLine, maxWidth);
    return trimmed;
  }

  return lines.length > 0 ? lines : [""];
}

function ellipsizeCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  const ellipsis = "...";
  const withEllipsis = `${text}${ellipsis}`;
  if (ctx.measureText(withEllipsis).width <= maxWidth) {
    return withEllipsis;
  }

  let trimmed = text.trimEnd();
  while (trimmed.length > 0 && ctx.measureText(`${trimmed}${ellipsis}`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1).trimEnd();
  }

  return trimmed ? `${trimmed}${ellipsis}` : ellipsis;
}

function clampValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function disposeObjectTree(object: THREE.Object3D): void {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }

    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    materials.forEach((material) => {
      const mappedMaterial = material as THREE.Material & { map?: THREE.Texture };
      if (mappedMaterial.map) {
        mappedMaterial.map.dispose();
      }
      material.dispose();
    });
  });
}

const locationLookTargets: Record<LocationId, [number, number, number]> = {
  "snow-desk": [-2.8, 1.35, 2.4],
  "broad-street": [0.8, 1.1, -5.4],
  household: [-2.25, 1.18, -0.95],
  registrar: [3.2, 1.1, 2.2],
  workhouse: [3.6, 1.2, -1.7],
  brewery: [3.4, 1.25, 1.8],
  "board-room": [0, 1.2, 2.8],
};

const broadStreetMapSvgPath = "maps/broad-street.svg";
const vrMapRasterSize = 2048;
const svgNamespace = "http://www.w3.org/2000/svg";

const panoramaAssetPaths: Record<LocationId, string> = {
  "snow-desk": "panoramas/snow-desk.jpg",
  "broad-street": "panoramas/broad-street.jpg",
  household: "panoramas/household.jpg",
  registrar: "panoramas/registrar.jpg",
  workhouse: "panoramas/workhouse.jpg",
  brewery: "panoramas/brewery.jpg",
  "board-room": "panoramas/board-room.jpg",
};

function resolvePublicAssetPath(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}${path}`;
}

function createVrMapSvgVariant(svgText: string, deathsVisible: boolean): string {
  const document = new DOMParser().parseFromString(svgText, "image/svg+xml");
  if (document.querySelector("parsererror")) {
    throw new Error("Could not parse Broad Street SVG.");
  }

  const svg = document.documentElement;
  svg.setAttribute("width", `${vrMapRasterSize}`);
  svg.setAttribute("height", `${vrMapRasterSize}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  const paper = document.createElementNS(svgNamespace, "rect");
  paper.setAttribute("x", "0");
  paper.setAttribute("y", "0");
  paper.setAttribute("width", "20020");
  paper.setAttribute("height", "20020");
  paper.setAttribute("fill", "#efe0bc");
  svg.insertBefore(paper, svg.firstChild);

  removeSvgLayer(document, "PumpServiceArea");
  if (!deathsVisible) {
    removeSvgLayer(document, "Deaths");
  }

  styleSvgLayer(document, "Streets", {
    fill: "none",
    stroke: "#4e412b",
    "stroke-width": "18",
    opacity: "0.7",
  });
  styleSvgLayer(document, "Broad-Street", {
    opacity: "0.78",
  });
  styleSvgLayer(document, "Pumps", {
    fill: "none",
    stroke: "#0b766d",
    "stroke-width": "42",
    opacity: "0.72",
  });
  if (deathsVisible) {
    styleSvgLayer(document, "Deaths", {
      fill: "#7d2d30",
      stroke: "#5f2026",
      "stroke-width": "18",
      opacity: "0.6",
    });
  }

  return new XMLSerializer().serializeToString(svg);
}

function removeSvgLayer(document: Document, id: string): void {
  document.getElementById(id)?.remove();
}

function styleSvgLayer(document: Document, id: string, attributes: Record<string, string>): void {
  const layer = document.getElementById(id);
  if (!layer) {
    return;
  }

  Object.entries(attributes).forEach(([attribute, value]) => {
    layer.setAttribute(attribute, value);
  });
}

function preparePanoramaTexture(texture: THREE.Texture): void {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.x = -1;
  texture.offset.x = 1;
  texture.needsUpdate = true;
}

function createDisplayPanoramaTexture(sourceTexture: THREE.Texture): THREE.CanvasTexture {
  const image = sourceTexture.image as HTMLImageElement;
  const width = image.naturalWidth || image.width || 2048;
  const height = image.naturalHeight || image.height || 1024;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not prepare panorama texture.");
  }

  ctx.filter = "contrast(1.1) saturate(1.18) brightness(1.04)";
  ctx.drawImage(image, 0, 0, width, height);
  sourceTexture.dispose();

  const texture = new THREE.CanvasTexture(canvas);
  preparePanoramaTexture(texture);
  return texture;
}

function markEnvironmentShell<T extends THREE.Object3D>(object: T): T {
  object.userData.isEnvironmentShell = true;
  return object;
}

function setEnvironmentShellVisibility(object: THREE.Object3D, visible: boolean): void {
  object.traverse((child) => {
    if (child.userData.isEnvironmentShell === true) {
      child.visible = visible;
    }
  });
}

function createHotspotMesh(hotspot: Hotspot): HotspotMesh {
  const material = new THREE.MeshStandardMaterial({
    color: "#f3d37a",
    emissive: "#8b621a",
    emissiveIntensity: 0.85,
    roughness: 0.45,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), material) as HotspotMesh;
  mesh.position.set(...hotspot.position);
  mesh.userData = { hotspot };
  return mesh;
}

type Vec3 = [number, number, number];

function createPanoramaTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create panorama texture.");
  }

  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#1c2932");
  sky.addColorStop(0.36, "#4d5960");
  sky.addColorStop(0.52, "#34302b");
  sky.addColorStop(1, "#131313");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255, 220, 150, 0.1)";
  for (let i = 0; i < 80; i += 1) {
    const x = (i * 311) % canvas.width;
    const y = 80 + ((i * 97) % 260);
    ctx.beginPath();
    ctx.arc(x, y, 1 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 26; i += 1) {
    const width = 110 + (i % 5) * 30;
    const height = 230 + (i % 6) * 36;
    const x = i * 82 - 80;
    const y = 590 - height * 0.34;
    ctx.fillStyle = i % 2 === 0 ? "#1b1d1d" : "#24231f";
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = "rgba(238, 186, 95, 0.18)";
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        ctx.fillRect(x + 18 + col * 30, y + 28 + row * 42, 10, 16);
      }
    }
  }

  ctx.fillStyle = "rgba(55, 50, 45, 0.62)";
  ctx.fillRect(0, 610, canvas.width, 80);
  ctx.fillStyle = "rgba(18, 17, 16, 0.66)";
  ctx.fillRect(0, 690, canvas.width, 334);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

function createGround(): THREE.Mesh {
  const texture = createCobbleTexture();
  texture.repeat.set(4, 4);
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(18, 128),
    new THREE.MeshStandardMaterial({
      color: "#37342e",
      map: texture,
      roughness: 0.96,
      metalness: 0.01,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.025;
  ground.receiveShadow = true;
  return ground;
}

function createDistantStreetSilhouette(): THREE.Group {
  const group = new THREE.Group();
  const darkBrick = createMaterial("#20211f", { roughness: 0.93 });
  const roof = createMaterial("#151719", { roughness: 0.82 });
  for (let index = 0; index < 14; index += 1) {
    const angle = (index / 14) * Math.PI * 2;
    const radius = 12.5 + (index % 2) * 0.7;
    const height = 1.4 + (index % 5) * 0.22;
    const width = 1.7 + (index % 4) * 0.22;
    const building = createBox(
      [width, height, 0.16],
      darkBrick,
      [Math.sin(angle) * radius, height / 2 - 0.02, Math.cos(angle) * radius],
      [0, angle, 0],
    );
    building.castShadow = false;
    group.add(building);

    const cap = createBox(
      [width * 1.08, 0.12, 0.2],
      roof,
      [Math.sin(angle) * radius, height + 0.04, Math.cos(angle) * radius],
      [0, angle, 0],
    );
    cap.castShadow = false;
    group.add(cap);
  }
  return group;
}

function createBroadStreetSet(): THREE.Group {
  // The Broad Street panorama now contains the single visible pump. Keep the
  // separate hotspot for interaction, but do not render duplicate 3D scenery.
  return new THREE.Group();
}

function createRegistrarSet(): THREE.Group {
  const group = new THREE.Group();
  group.position.set(-3.2, 0, -2.2);
  group.rotation.y = Math.atan2(group.position.x, group.position.z);

  const wood = createMaterial("#4a3325", { roughness: 0.84 });
  const darkWood = createMaterial("#2c211b", { roughness: 0.82 });
  const paper = createMaterial("#d8c69c", { roughness: 0.72 });
  const greenGlass = createMaterial("#3c6c56", { emissive: "#1d553e", emissiveIntensity: 0.25, roughness: 0.38 });

  group.add(createRoomShell(4.6, 3.1, "#3b312a", "#242522", "#7f5a38"));

  const desk = createBox([1.65, 0.14, 0.92], wood, [0, 0.76, 0]);
  group.add(desk);
  group.add(createBox([1.72, 0.08, 0.12], darkWood, [0, 0.62, 0.48]));
  group.add(createBox([0.12, 0.72, 0.12], darkWood, [-0.68, 0.36, -0.32]));
  group.add(createBox([0.12, 0.72, 0.12], darkWood, [0.68, 0.36, -0.32]));
  group.add(createLedgerBook([0, 0.875, -0.02]));
  group.add(createPaperStack([-0.55, 0.9, 0.18], 4, 0.78));
  group.add(createInkBottle([0.58, 0.9, -0.22]));
  group.add(createDeskLamp([0.5, 0.92, 0.2], greenGlass));

  group.add(createShelf([-1.75, 1.04, 0.95], darkWood, paper, 5));
  group.add(createShelf([1.75, 1.04, 0.95], darkWood, paper, 4));
  group.add(createPointLight("#d6b176", 42, 5, [0.1, 2.2, 0.2]));
  return group;
}

function createHouseholdSet(): THREE.Group {
  const group = new THREE.Group();
  group.position.set(-2.25, 0, -0.95);
  group.rotation.y = Math.atan2(group.position.x, group.position.z);

  const wood = createMaterial("#4a3124", { roughness: 0.86 });
  const darkWood = createMaterial("#251b16", { roughness: 0.86 });
  const linen = createMaterial("#d3c2a0", { roughness: 0.84 });
  const blanket = createMaterial("#5f2e2e", { roughness: 0.9 });
  const blackCloth = createMaterial("#10100f", { roughness: 0.78 });
  const basin = createMaterial("#c9b889", { roughness: 0.58 });
  const blueGlass = createMaterial("#2f5d61", { transparent: true, opacity: 0.64, roughness: 0.42 });

  group.add(createRoomShell(4.5, 3.1, "#302822", "#24221d", "#75513a"));

  group.add(createBox([1.45, 0.18, 0.72], wood, [-1.05, 0.34, -0.42]));
  group.add(createBox([1.48, 0.08, 0.76], linen, [-1.05, 0.51, -0.42]));
  group.add(createBox([1.18, 0.06, 0.62], blanket, [-1.0, 0.57, -0.4]));
  group.add(createBox([0.36, 0.08, 0.46], linen, [-1.62, 0.6, -0.42]));
  group.add(createBox([0.12, 0.54, 0.12], wood, [-1.68, 0.18, -0.72]));
  group.add(createBox([0.12, 0.54, 0.12], wood, [-0.42, 0.18, -0.72]));
  group.add(createBox([0.12, 0.54, 0.12], wood, [-1.68, 0.18, -0.1]));
  group.add(createBox([0.12, 0.54, 0.12], wood, [-0.42, 0.18, -0.1]));

  const table = createBox([1.12, 0.12, 0.58], wood, [0.65, 0.66, -0.42]);
  group.add(table);
  group.add(createBox([0.1, 0.58, 0.1], darkWood, [0.22, 0.34, -0.62]));
  group.add(createBox([0.1, 0.58, 0.1], darkWood, [1.08, 0.34, -0.62]));
  group.add(createBox([0.1, 0.58, 0.1], darkWood, [0.22, 0.34, -0.22]));
  group.add(createBox([0.1, 0.58, 0.1], darkWood, [1.08, 0.34, -0.22]));
  group.add(createCylinder(0.2, 0.17, 0.09, basin, [0.42, 0.76, -0.44], [0, 0, 0], 28));
  group.add(createCylinder(0.16, 0.16, 0.018, blueGlass, [0.42, 0.815, -0.44], [0, 0, 0], 28));
  group.add(createBucket([0.95, 0.03, -0.04]));
  group.add(createPaperStack([0.84, 0.75, -0.48], 3, 0.82));

  group.add(createChair([1.35, 0.02, 0.36], -0.55));

  group.add(createBox([0.92, 0.08, 0.08], blackCloth, [-1.78, 1.54, 1.56]));
  group.add(createBox([0.08, 0.62, 0.06], blackCloth, [-1.78, 1.24, 1.55]));

  group.add(createPointLight("#e5b36f", 38, 5.2, [0.45, 1.95, -0.05]));
  group.add(createPointLight("#a7c5cc", 11, 4.5, [-1.45, 1.65, -0.2]));
  return group;
}

function createWorkhouseSet(): THREE.Group {
  const group = new THREE.Group();
  group.position.set(3.6, 0, -1.7);
  group.rotation.y = Math.atan2(group.position.x, group.position.z);

  const brick = createMaterial("#65443b", { roughness: 0.96 });
  const soot = createMaterial("#2e2f2e", { roughness: 0.9 });
  const stone = createMaterial("#8b8171", { roughness: 0.94 });
  const wood = createMaterial("#382820", { roughness: 0.87 });
  const water = createMaterial("#315657", { transparent: true, opacity: 0.68, roughness: 0.4 });

  const shell = markEnvironmentShell(new THREE.Group());
  shell.add(createBox([4.8, 0.04, 3.2], createMaterial("#383731", { roughness: 0.98 }), [0, 0, -0.12]));
  shell.add(createFacade([0, 1.18, 1.35], [4.6, 2.35, 0.2], brick, createMaterial("#c79557", { roughness: 0.55 }), 4, 2, 0));
  shell.add(createBox([1.1, 1.22, 0.12], wood, [0, 0.62, 1.23]));
  shell.add(createBox([4.9, 0.22, 0.24], soot, [0, 2.4, 1.34]));
  shell.add(createBox([0.16, 1.0, 2.6], brick, [-2.36, 0.5, -0.2]));
  shell.add(createBox([0.16, 1.0, 2.6], brick, [2.36, 0.5, -0.2]));
  shell.add(createBox([3.25, 0.18, 0.12], stone, [0, 0.16, -1.36]));
  shell.add(createBox([0.12, 1.05, 0.1], wood, [-0.95, 0.55, -1.24]));
  shell.add(createBox([0.12, 1.05, 0.1], wood, [0.95, 0.55, -1.24]));
  shell.add(createBox([1.95, 0.09, 0.08], wood, [0, 1.08, -1.24]));
  group.add(shell);

  const ownSupply = createBox([0.9, 0.64, 0.72], stone, [1.25, 0.34, -0.35]);
  group.add(ownSupply);
  group.add(createBox([0.78, 0.025, 0.6], water, [1.25, 0.68, -0.35]));
  group.add(createBucket([0.45, 0.03, -0.78]));
  group.add(createBucket([1.85, 0.03, -0.68]));
  group.add(createBench([-1.28, 0.22, -0.72]));

  group.add(createPointLight("#cbd9d3", 22, 6, [-0.4, 2.1, -0.15]));
  return group;
}

function createBrewerySet(): THREE.Group {
  const group = new THREE.Group();
  group.position.set(3.4, 0, 1.8);
  group.rotation.y = Math.atan2(group.position.x, group.position.z);

  const brick = createMaterial("#5a362f", { roughness: 0.94 });
  const copper = createMaterial("#b46f39", { roughness: 0.42, metalness: 0.32 });
  const wood = createMaterial("#65442a", { roughness: 0.78 });
  const stone = createMaterial("#413b33", { roughness: 0.98 });

  group.add(createRoomShell(4.8, 3.2, "#3a2925", "#2a2924", "#7a4c2a"));
  group.add(markEnvironmentShell(createBox([4.2, 0.04, 2.75], stone, [0, 0.012, -0.1])));
  group.add(createVat([-1.15, 0.02, 0.3], copper));
  group.add(createVat([1.18, 0.02, 0.26], copper));
  group.add(createBarrel([-0.1, 0.38, -0.72], 1.15));
  group.add(createBarrel([0.72, 0.36, -0.75], 0.95));
  group.add(createBarrel([-0.84, 0.36, -0.72], 0.95));
  group.add(createCrate([1.75, 0.26, -0.72]));
  group.add(createCrate([-1.75, 0.26, -0.64]));
  group.add(createMug([0.1, 0.82, 0.72]));

  const tastingTable = createBox([1.5, 0.12, 0.58], wood, [0.15, 0.7, 0.7]);
  group.add(tastingTable);
  group.add(createBox([0.12, 0.65, 0.1], wood, [-0.45, 0.35, 0.5]));
  group.add(createBox([0.12, 0.65, 0.1], wood, [0.75, 0.35, 0.5]));

  group.add(createPointLight("#f0a24b", 62, 6, [0.1, 2.1, 0.15]));
  return group;
}

function createSnowDeskSet(): THREE.Group {
  const group = new THREE.Group();
  group.position.set(0, 0, 2.8);

  const wood = createMaterial("#5b3823", { roughness: 0.82 });
  const darkWood = createMaterial("#2a1f19", { roughness: 0.82 });
  const paper = createMaterial("#d7c79d", { roughness: 0.76 });
  const redPin = createMaterial("#8d2f26", { emissive: "#5c1712", emissiveIntensity: 0.18, roughness: 0.55 });
  const generatedDeskProps = markEnvironmentShell(new THREE.Group());

  group.add(createRoomShell(6.0, 3.6, "#322820", "#24241f", "#805638"));
  group.add(createSnowFigure());
  generatedDeskProps.add(createMapTable());
  generatedDeskProps.add(createBookStack([0.95, 0.88, -0.34]));
  generatedDeskProps.add(createPaperStack([-0.7, 0.875, 0.22], 5, 1));
  generatedDeskProps.add(createInkBottle([-0.92, 0.9, -0.25]));
  generatedDeskProps.add(createDeskLamp([0.58, 0.91, 0.28]));

  const wallMap = createBox([1.65, 1.04, 0.04], paper, [1.65, 1.46, 1.7]);
  generatedDeskProps.add(wallMap);
  generatedDeskProps.add(createBox([1.78, 1.17, 0.07], darkWood, [1.65, 1.46, 1.73]));
  for (let index = 0; index < 13; index += 1) {
    const pin = createCylinder(0.025, 0.025, 0.016, redPin, [
      1.05 + ((index * 53) % 120) / 100,
      1.14 + ((index * 31) % 68) / 100,
      1.675,
    ], [Math.PI / 2, 0, 0], 12);
    generatedDeskProps.add(pin);
  }
  generatedDeskProps.add(createShelf([-2.2, 1.12, 1.3], darkWood, paper, 4));
  generatedDeskProps.add(createBox([0.92, 0.08, 0.92], wood, [-1.65, 0.42, -0.48]));
  generatedDeskProps.add(createBox([0.14, 0.52, 0.14], wood, [-1.65, 0.2, -0.48]));
  group.add(generatedDeskProps);
  group.add(createPointLight("#efbd74", 62, 6, [0.5, 2.0, 0.05]));
  return group;
}

function createMapTable(): THREE.Group {
  const group = new THREE.Group();
  const wood = createMaterial("#5b3823", { roughness: 0.82 });
  const paper = createMaterial("#cfc094", { roughness: 0.76 });
  const ink = createMaterial("#35302a", { roughness: 0.9 });
  group.add(createBox([2.05, 0.16, 1.22], wood, [0, 0.74, 0]));
  group.add(createBox([0.13, 0.72, 0.13], wood, [-0.82, 0.38, -0.46]));
  group.add(createBox([0.13, 0.72, 0.13], wood, [0.82, 0.38, -0.46]));
  group.add(createBox([0.13, 0.72, 0.13], wood, [-0.82, 0.38, 0.46]));
  group.add(createBox([0.13, 0.72, 0.13], wood, [0.82, 0.38, 0.46]));
  const map = createPlane([1.62, 0.96], paper, [0, 0.835, 0], [-Math.PI / 2, 0, 0]);
  group.add(map);
  for (let index = 0; index < 18; index += 1) {
    group.add(
      createBox(
        [0.012, 0.006, 0.18 + (index % 3) * 0.06],
        ink,
        [-0.64 + (index % 6) * 0.25, 0.842, -0.34 + Math.floor(index / 6) * 0.24],
        [0, 0.25 + index * 0.19, 0],
      ),
    );
  }
  return group;
}

function createBoardRoomSet(): THREE.Group {
  const group = new THREE.Group();
  group.position.set(0, 0, 2.8);

  const wood = createMaterial("#4e321f", { roughness: 0.83 });
  const darkWood = createMaterial("#251c17", { roughness: 0.82 });
  const paper = createMaterial("#d8c79d", { roughness: 0.72 });
  const cloth = createMaterial("#243b35", { roughness: 0.86 });

  group.add(createRoomShell(6.2, 3.9, "#342820", "#22231f", "#815937"));
  group.add(createBox([3.15, 0.16, 1.08], wood, [0, 0.75, 0.08]));
  group.add(createBox([2.86, 0.04, 0.86], cloth, [0, 0.855, 0.08]));
  for (let index = 0; index < 5; index += 1) {
    group.add(createPaperStack([-1.18 + index * 0.58, 0.89, -0.05 + (index % 2) * 0.22], 2, 0.68));
  }
  for (const side of [-1, 1]) {
    for (let index = 0; index < 4; index += 1) {
      group.add(createChair([-1.2 + index * 0.8, 0.32, side * 0.88], side < 0 ? 0 : Math.PI));
    }
  }
  group.add(createBox([2.5, 1.12, 0.05], paper, [0, 1.5, 1.78]));
  group.add(createBox([2.68, 1.28, 0.08], darkWood, [0, 1.5, 1.82]));
  group.add(createPointLight("#e7b36f", 68, 6.5, [0, 2.1, 0.15]));
  group.add(createPointLight("#a9c7d7", 14, 5, [-1.9, 1.8, 0.75]));
  return group;
}

function createPump(): THREE.Group {
  const group = new THREE.Group();
  const iron = createMaterial("#232a29", { roughness: 0.56, metalness: 0.58 });
  const brass = createMaterial("#a77b3a", { roughness: 0.42, metalness: 0.42 });
  const stone = createMaterial("#7c7467", { roughness: 0.92 });
  const water = createMaterial("#2d5f62", { transparent: true, opacity: 0.72, roughness: 0.42 });

  group.add(createCylinder(0.34, 0.42, 0.18, iron, [0, 0.09, 0], [0, 0, 0], 32));
  group.add(createCylinder(0.15, 0.19, 1.34, iron, [0, 0.78, 0], [0, 0, 0], 32));
  group.add(createCylinder(0.19, 0.15, 0.18, brass, [0, 1.48, 0], [0, 0, 0], 32));
  group.add(createCylinder(0.034, 0.034, 0.58, iron, [0.34, 1.12, 0], [0, 0, Math.PI / 2], 16));
  group.add(createBox([0.08, 0.58, 0.055], brass, [-0.24, 1.16, 0], [0, 0, -0.36]));
  group.add(createBox([0.18, 0.06, 0.09], brass, [-0.29, 1.43, 0]));
  group.add(createBox([0.82, 0.18, 0.52], stone, [0.3, 0.11, 0.58]));
  group.add(createBox([0.64, 0.026, 0.38], water, [0.3, 0.215, 0.58]));
  return group;
}

function createSnowFigure(): THREE.Group {
  const group = new THREE.Group();
  const coat = createMaterial("#171717", { roughness: 0.74 });
  const skin = createMaterial("#b89170", { roughness: 0.8 });
  const waistcoat = createMaterial("#393028", { roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.76, 8, 16), coat);
  const vest = createBox([0.28, 0.42, 0.045], waistcoat, [0, 0.82, -0.2]);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 16), skin);
  const hat = createCylinder(0.2, 0.18, 0.17, coat, [0, 1.58, 0], [0, 0, 0], 24);
  const brim = createCylinder(0.27, 0.27, 0.035, coat, [0, 1.5, 0], [0, 0, 0], 24);
  body.position.y = 0.82;
  head.position.y = 1.4;
  group.add(body, vest, head, hat, brim);
  group.position.set(-2.8, 0, -0.4);
  group.rotation.y = 2.52;
  enableShadows(group);
  return group;
}

function createHouseholdWitness(position: Vec3, rotationY: number): THREE.Group {
  const group = new THREE.Group();
  const dress = createMaterial("#3f3430", { roughness: 0.86 });
  const shawl = createMaterial("#614333", { roughness: 0.9 });
  const skin = createMaterial("#b89170", { roughness: 0.8 });
  const cap = createMaterial("#d9c8a8", { roughness: 0.84 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.58, 8, 16), dress);
  body.position.set(0, 0.84, 0);
  const shoulders = createBox([0.5, 0.08, 0.13], shawl, [0, 1.05, -0.02], [0.08, 0, 0]);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 16), skin);
  head.position.set(0, 1.28, 0);
  const bonnet = createCylinder(0.17, 0.13, 0.08, cap, [0, 1.39, 0], [0, 0, 0], 24);
  const apron = createBox([0.25, 0.34, 0.035], cap, [0, 0.78, -0.18]);

  group.add(body, shoulders, head, bonnet, apron);
  group.position.set(...position);
  group.rotation.y = rotationY;
  enableShadows(group);
  return group;
}

function createRoomShell(
  width: number,
  depth: number,
  wallColor: string,
  floorColor: string,
  trimColor: string,
): THREE.Group {
  const group = new THREE.Group();
  const wall = createMaterial(wallColor, { roughness: 0.93 });
  const floor = createMaterial(floorColor, { roughness: 0.98, map: createFloorboardTexture() });
  const trim = createMaterial(trimColor, { roughness: 0.84 });
  group.add(createBox([width, 0.04, depth], floor, [0, 0, 0.25]));
  group.add(createBox([width, 2.6, 0.12], wall, [0, 1.3, depth / 2 + 0.25]));
  group.add(createBox([0.12, 2.35, depth], wall, [-width / 2, 1.18, 0.25]));
  group.add(createBox([0.12, 2.35, depth], wall, [width / 2, 1.18, 0.25]));
  group.add(createBox([width, 0.08, 0.14], trim, [0, 0.62, depth / 2 + 0.18]));
  group.add(createBox([0.16, 0.08, depth], trim, [-width / 2 + 0.04, 0.62, 0.25]));
  group.add(createBox([0.16, 0.08, depth], trim, [width / 2 - 0.04, 0.62, 0.25]));
  return markEnvironmentShell(group);
}

function createFacade(
  position: Vec3,
  size: Vec3,
  facadeMaterial: THREE.MeshStandardMaterial,
  windowMaterial: THREE.MeshStandardMaterial,
  columns: number,
  rows: number,
  rotationY: number,
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(...position);
  group.rotation.y = rotationY;
  group.add(createBox(size, facadeMaterial, [0, 0, 0]));
  const horizontalAxis = size[0] > size[2] ? "x" : "z";
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const offset = -0.5 + (column + 0.5) / columns;
      const y = -size[1] * 0.16 + row * 0.56;
      const window = createBox(
        horizontalAxis === "x" ? [0.24, 0.34, 0.035] : [0.035, 0.34, 0.24],
        windowMaterial,
        horizontalAxis === "x" ? [offset * size[0] * 0.78, y, -size[2] * 0.54] : [-size[0] * 0.54, y, offset * size[2] * 0.78],
      );
      group.add(window);
    }
  }
  return group;
}

function createLedgerBook(position: Vec3): THREE.Group {
  const group = new THREE.Group();
  group.position.set(...position);
  const cover = createMaterial("#6c342c", { roughness: 0.72 });
  const page = createMaterial("#e0cfa4", { roughness: 0.74 });
  const ink = createMaterial("#2b2923", { roughness: 0.9 });
  group.add(createBox([0.88, 0.04, 0.54], cover, [0, 0, 0]));
  group.add(createBox([0.4, 0.025, 0.49], page, [-0.22, 0.035, 0]));
  group.add(createBox([0.4, 0.025, 0.49], page, [0.22, 0.035, 0]));
  for (let line = 0; line < 5; line += 1) {
    group.add(createBox([0.25, 0.006, 0.012], ink, [-0.22, 0.055, -0.17 + line * 0.08]));
    group.add(createBox([0.25, 0.006, 0.012], ink, [0.22, 0.055, -0.17 + line * 0.08]));
  }
  return group;
}

function createPaperStack(position: Vec3, count: number, scale = 1): THREE.Group {
  const group = new THREE.Group();
  group.position.set(...position);
  const paper = createMaterial("#d8c79d", { roughness: 0.76 });
  for (let index = 0; index < count; index += 1) {
    group.add(
      createBox(
        [0.44 * scale, 0.012, 0.32 * scale],
        paper,
        [0.006 * (index % 2), index * 0.014, 0.006 * (index % 3)],
        [0, index * 0.05, 0],
      ),
    );
  }
  return group;
}

function createBookStack(position: Vec3): THREE.Group {
  const group = new THREE.Group();
  group.position.set(...position);
  const colors = ["#6c342c", "#284654", "#5c4b2c"];
  for (let index = 0; index < 3; index += 1) {
    group.add(createBox([0.46, 0.07, 0.3], createMaterial(colors[index], { roughness: 0.76 }), [0, index * 0.075, 0]));
  }
  return group;
}

function createInkBottle(position: Vec3): THREE.Group {
  const group = new THREE.Group();
  group.position.set(...position);
  const glass = createMaterial("#152126", { roughness: 0.28, metalness: 0.05 });
  const cap = createMaterial("#2d2923", { roughness: 0.5, metalness: 0.16 });
  group.add(createCylinder(0.06, 0.075, 0.08, glass, [0, 0.04, 0], [0, 0, 0], 18));
  group.add(createCylinder(0.045, 0.04, 0.035, cap, [0, 0.095, 0], [0, 0, 0], 18));
  return group;
}

function createDeskLamp(position: Vec3, shadeMaterial = createMaterial("#b58b50", { emissive: "#7b4d20", emissiveIntensity: 0.32 })): THREE.Group {
  const group = new THREE.Group();
  group.position.set(...position);
  const brass = createMaterial("#a57a3b", { roughness: 0.42, metalness: 0.42 });
  group.add(createCylinder(0.05, 0.07, 0.42, brass, [0, 0.2, 0], [0, 0, 0], 16));
  group.add(createCylinder(0.2, 0.28, 0.18, shadeMaterial, [0, 0.46, 0], [0, 0, 0], 24));
  group.add(createPointLight("#f0bd73", 24, 3.2, [0, 0.46, 0]));
  return group;
}

function createShelf(position: Vec3, shelfMaterial: THREE.MeshStandardMaterial, paperMaterial: THREE.MeshStandardMaterial, books: number): THREE.Group {
  const group = new THREE.Group();
  group.position.set(...position);
  for (let shelfIndex = 0; shelfIndex < 3; shelfIndex += 1) {
    group.add(createBox([1.0, 0.08, 0.18], shelfMaterial, [0, shelfIndex * 0.34, 0]));
    for (let bookIndex = 0; bookIndex < books; bookIndex += 1) {
      group.add(
        createBox(
          [0.1, 0.26 + (bookIndex % 2) * 0.05, 0.13],
          bookIndex % 3 === 0 ? paperMaterial : createMaterial(bookIndex % 2 === 0 ? "#5a352b" : "#2f4b52", { roughness: 0.78 }),
          [-0.38 + bookIndex * 0.16, 0.16 + shelfIndex * 0.34, 0.02],
          [0, 0, (bookIndex % 2) * 0.05],
        ),
      );
    }
  }
  return group;
}

function createBucket(position: Vec3): THREE.Group {
  const group = new THREE.Group();
  group.position.set(...position);
  const wood = createMaterial("#5f442e", { roughness: 0.82 });
  const metal = createMaterial("#3f4140", { roughness: 0.52, metalness: 0.24 });
  group.add(createCylinder(0.17, 0.14, 0.26, wood, [0, 0.13, 0], [0, 0, 0], 20));
  group.add(createCylinder(0.175, 0.175, 0.018, metal, [0, 0.27, 0], [0, 0, 0], 20));
  return group;
}

function createBench(position: Vec3): THREE.Group {
  const group = new THREE.Group();
  group.position.set(...position);
  const wood = createMaterial("#4a3325", { roughness: 0.88 });
  group.add(createBox([1.15, 0.08, 0.32], wood, [0, 0.35, 0]));
  group.add(createBox([0.1, 0.36, 0.1], wood, [-0.44, 0.18, 0]));
  group.add(createBox([0.1, 0.36, 0.1], wood, [0.44, 0.18, 0]));
  return group;
}

function createVat(position: Vec3, material: THREE.MeshStandardMaterial): THREE.Group {
  const group = new THREE.Group();
  group.position.set(...position);
  group.add(createCylinder(0.46, 0.58, 1.04, material, [0, 0.55, 0], [0, 0, 0], 36));
  group.add(createCylinder(0.5, 0.5, 0.08, createMaterial("#2b2926", { roughness: 0.52, metalness: 0.18 }), [0, 1.1, 0], [0, 0, 0], 36));
  group.add(createBox([0.08, 1.14, 0.08], createMaterial("#282522", { roughness: 0.65, metalness: 0.12 }), [-0.56, 0.56, 0]));
  return group;
}

function createBarrel(position: Vec3, scale = 1): THREE.Group {
  const group = new THREE.Group();
  group.position.set(...position);
  group.scale.setScalar(scale);
  const barrelMat = createMaterial("#68452b", { roughness: 0.72 });
  const bandMat = createMaterial("#262626", { roughness: 0.5, metalness: 0.25 });
  const barrel = createCylinder(0.28, 0.28, 0.72, barrelMat, [0, 0, 0], [0, 0, Math.PI / 2], 28);
  group.add(barrel);
  for (const offset of [-0.24, 0.24]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.285, 0.014, 8, 28), bandMat);
    band.position.set(offset, 0, 0);
    band.rotation.y = Math.PI / 2;
    group.add(band);
  }
  enableShadows(group);
  return group;
}

function createCrate(position: Vec3): THREE.Group {
  const group = new THREE.Group();
  group.position.set(...position);
  const wood = createMaterial("#5d4029", { roughness: 0.86 });
  group.add(createBox([0.62, 0.46, 0.52], wood, [0, 0, 0]));
  group.add(createBox([0.66, 0.05, 0.56], createMaterial("#37271f", { roughness: 0.85 }), [0, 0.18, 0]));
  return group;
}

function createMug(position: Vec3): THREE.Group {
  const group = new THREE.Group();
  group.position.set(...position);
  const ceramic = createMaterial("#d2c2a0", { roughness: 0.58 });
  group.add(createCylinder(0.065, 0.065, 0.12, ceramic, [0, 0.06, 0], [0, 0, 0], 18));
  group.add(createCylinder(0.042, 0.042, 0.012, createMaterial("#6b4a2f", { roughness: 0.5 }), [0, 0.126, 0], [0, 0, 0], 18));
  return group;
}

function createSampleVial(position: Vec3): THREE.Group {
  const group = new THREE.Group();
  group.position.set(...position);
  const glass = createMaterial("#d6f3ef", { transparent: true, opacity: 0.38, roughness: 0.18, metalness: 0.02 });
  const cork = createMaterial("#7b5736", { roughness: 0.82 });
  const water = createMaterial("#6bbfba", { transparent: true, opacity: 0.58, roughness: 0.32 });
  group.add(createCylinder(0.045, 0.055, 0.26, glass, [0, 0.15, 0], [0.12, 0.2, 0.08], 18));
  group.add(createCylinder(0.035, 0.038, 0.045, cork, [0, 0.3, 0], [0.12, 0.2, 0.08], 16));
  group.add(createCylinder(0.04, 0.048, 0.12, water, [0, 0.1, 0], [0.12, 0.2, 0.08], 18));
  enableShadows(group);
  return group;
}

function createChair(position: Vec3, rotationY: number): THREE.Group {
  const group = new THREE.Group();
  group.position.set(...position);
  group.rotation.y = rotationY;
  const wood = createMaterial("#3d2b22", { roughness: 0.86 });
  group.add(createBox([0.42, 0.08, 0.42], wood, [0, 0.42, 0]));
  group.add(createBox([0.42, 0.58, 0.08], wood, [0, 0.72, 0.18]));
  for (const x of [-0.16, 0.16]) {
    for (const z of [-0.16, 0.16]) {
      group.add(createBox([0.055, 0.42, 0.055], wood, [x, 0.2, z]));
    }
  }
  return group;
}

function createPointLight(color: string, intensity: number, distance: number, position: Vec3): THREE.PointLight {
  const light = new THREE.PointLight(color, intensity, distance, 1.65);
  light.position.set(...position);
  light.castShadow = false;
  return light;
}

function createBox(
  size: Vec3,
  material: THREE.Material,
  position: Vec3,
  rotation: Vec3 = [0, 0, 0],
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createCylinder(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  material: THREE.Material,
  position: Vec3,
  rotation: Vec3 = [0, 0, 0],
  segments = 24,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createPlane(
  size: [number, number],
  material: THREE.Material,
  position: Vec3,
  rotation: Vec3 = [0, 0, 0],
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

function createMaterial(
  color: string,
  options: Partial<THREE.MeshStandardMaterialParameters> = {},
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.84,
    metalness: 0.03,
    ...options,
  });
}

function enableShadows(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

function createCobbleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create cobble texture.");
  }
  ctx.fillStyle = "#3b3934";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < 9; y += 1) {
    for (let x = 0; x < 9; x += 1) {
      const jitterX = ((x * 41 + y * 19) % 13) - 6;
      const jitterY = ((x * 17 + y * 37) % 11) - 5;
      ctx.fillStyle = (x + y) % 2 === 0 ? "#46423a" : "#302f2b";
      roundRect(ctx, x * 58 + jitterX, y * 58 + jitterY, 52, 45, 9);
      ctx.fill();
      ctx.strokeStyle = "rgba(16, 15, 14, 0.32)";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function createFloorboardTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create floor texture.");
  }
  ctx.fillStyle = "#2c2923";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < 8; y += 1) {
    ctx.fillStyle = y % 2 === 0 ? "#312d26" : "#25241f";
    ctx.fillRect(0, y * 64, canvas.width, 60);
    ctx.strokeStyle = "rgba(12, 11, 10, 0.45)";
    ctx.beginPath();
    ctx.moveTo(0, y * 64);
    ctx.lineTo(canvas.width, y * 64);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.5, 2.5);
  return texture;
}

function createSpriteLabel(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create label texture.");
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(18, 17, 14, 0.72)";
  roundRect(ctx, 30, 28, 324, 68, 24);
  ctx.fill();
  ctx.strokeStyle = "rgba(239, 214, 151, 0.32)";
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = "600 34px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    }),
  );
  sprite.scale.set(1.25, 0.42, 1);
  return sprite;
}

function createVrIdleHintSprite(): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create VR hint texture.");
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(5, 9, 10, 0.72)";
  roundRect(ctx, 34, 28, canvas.width - 68, 104, 30);
  ctx.fill();
  ctx.strokeStyle = "rgba(246, 211, 111, 0.28)";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = "#e8f1eb";
  ctx.font = "700 44px Arial, Helvetica, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Squeeze for the panel, or select a gold sphere.", canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      opacity: 0.92,
      toneMapped: false,
    }),
  );
  sprite.renderOrder = 95;
  sprite.frustumCulled = false;
  sprite.scale.set(1.28, 0.2, 1);
  return sprite;
}

function createCaptureDataUrl(source: HTMLCanvasElement): string {
  const maxWidth = 760;
  const scale = Math.min(1, maxWidth / source.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return "";
  }
  ctx.fillStyle = "#111619";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.86);
}

function shortestAngleDelta(angle: number, reference: number): number {
  return Math.atan2(Math.sin(angle - reference), Math.cos(angle - reference));
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}
