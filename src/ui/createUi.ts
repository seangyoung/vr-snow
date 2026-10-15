import { surveyRoutes, type RouteId } from "../simulation/fieldwork";
import type { SoundControls } from "../audio/Soundscape";
import { DesktopKeyboard } from "./DesktopKeyboard";
import { OutsidePanelDismiss } from "./OutsidePanelDismiss";
import { createIcons, icons } from "lucide";
import { fieldStudyGoal, locationEvidenceIds, noDialogueActionsText } from "../simulation/content";
import type { GameState } from "../simulation/gameState";
import type {
  ChapterScene,
  ChapterStage,
  DialogueNode,
  DialogueQuestion,
  EvidenceCard,
  Hotspot,
  HypothesisDefinition,
  HypothesisId,
  InvestigationLocation,
  LocationId,
} from "../simulation/types";

type OverlayMode = "none" | "notebook" | "map" | "sound";
type MotionLookStatus = "unavailable" | "idle" | "requesting" | "enabled" | "denied";
type ActiveDialogueAnswer = NonNullable<ReturnType<GameState["getActiveDialogueAnswer"]>>;

type MotionLookControls = {
  isAvailable: () => boolean;
  isEnabled: () => boolean;
  getStatus: () => MotionLookStatus;
  setEnabled: (enabled: boolean) => Promise<{ enabled: boolean; status: MotionLookStatus; message: string }>;
};

const broadStreetMapSvgPath = "maps/broad-street.svg";
const broadStreetMapViewBoxSize = 20020;
const broadStreetPumpPoints = [
  { x: 6879.5, y: 18244.7 },
  { x: 13095.5, y: 17251.7 },
  { x: 19502.5, y: 14655.7 },
  { x: 11239.5, y: 9152.7 },
  { x: 3286.5, y: 6782.7 },
  { x: 3045.5, y: 2163.7 },
];

const mapAnnotations: Array<{
  evidenceId: string;
  title: string;
  body: string;
  x: number;
  y: number;
  kind: "cluster" | "record" | "household" | "conflict" | "exception";
}> = [
  {
    evidenceId: "pump-cluster",
    title: "Address cluster",
    body: "Registrar addresses crowd toward the pump once Snow plots them.",
    x: 42,
    y: 30,
    kind: "cluster",
  },
  {
    evidenceId: "household-exposure",
    title: "Household account",
    body: "A death mark gains timing, care, and pump-water testimony.",
    x: 39,
    y: 73,
    kind: "household",
  },
  {
    evidenceId: "household-water-pattern",
    title: "Water preferences",
    body: "A household chooses Broad Street water for its taste and collects it during errands.",
    x: 43,
    y: 67,
    kind: "household",
  },
  {
    evidenceId: "pump-water-inspection",
    title: "Sample inconclusive",
    body: "The water does not visibly prove danger; the map must carry more weight.",
    x: 66,
    y: 31,
    kind: "conflict",
  },
  {
    evidenceId: "attack-timeline",
    title: "Abrupt return",
    body: "Daily returns turn the addresses into a sudden common-source curve.",
    x: 18,
    y: 18,
    kind: "record",
  },
  {
    evidenceId: "workhouse-exception",
    title: "St. James Workhouse exception",
    body: "Over 500 inmates, very few deaths, and a separate water supply.",
    x: 76,
    y: 39,
    kind: "exception",
  },
  {
    evidenceId: "brewery-exception",
    title: "Lion Brewery exception",
    body: "Near Broad Street, but workers did not rely on pump water.",
    x: 70,
    y: 77,
    kind: "exception",
  },
];

export interface PrototypeUi {
  onReset?: () => void;
  openSnowReview: () => void;
  beginTravel: (locationId: LocationId) => void;
  render: () => void;
  setSoundControls: (controls: SoundControls) => void;
  setMotionLookControls: (controls: MotionLookControls) => void;
  setPrompt: (hotspot?: Hotspot) => void;
  setMessage: (message: string) => void;
}

export function createUi(root: HTMLDivElement, gameState: GameState): PrototypeUi {
  let overlayMode: OverlayMode = "none";
  let message = "Speak with Snow at the desk to receive the field assignment.";
  let isTransitioning = false;
  let snowReviewOpen = false;
  let dismissedChapter: ChapterStage | undefined;
  let previousStage = gameState.getStage();
  let soundControls: SoundControls | undefined;
  let motionLookControls: MotionLookControls | undefined;
  const keyboard = new DesktopKeyboard(root, document.getElementById("scene"), () => isTransitioning);
  new OutsidePanelDismiss(root, () => !isTransitioning && document.body.dataset.xrPresenting !== "true", dismissPanels);

  function dismissPanels(): void {
    if(gameState.startupOpen)return;
    if(gameState.dayIntroOpen)gameState.dismissDayIntroduction();
    overlayMode = "none";
    snowReviewOpen = false;
    dismissedChapter = gameState.getStage();
    gameState.closeDialogue();
    render();
  }

  const ui: PrototypeUi = {
    beginTravel,
    openSnowReview() {
      if (canOpenSnowReview()) {
        gameState.closeDialogue();
        overlayMode = "none";
        snowReviewOpen = true;
        message = "Snow reviews the competing theories with us.";
        render();
        return;
      }

      message = "Return to Snow with enough evidence before preparing the Board argument.";
      render();
    },
    setSoundControls(controls: SoundControls) { soundControls=controls;render(); },
    setMotionLookControls(controls: MotionLookControls) {
      motionLookControls = controls;
      render();
    },
    render,
    setPrompt(_hotspot?: Hotspot) {},
    setMessage(nextMessage: string) {
      message = nextMessage;
    },
  };

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const actionTarget = target.closest<HTMLElement>("[data-action]");
    const action = actionTarget?.dataset.action;
    if (!action) {
      return;
    }

    if(gameState.startupOpen && !['continue-inquiry','new-inquiry'].includes(action))return;
    if(gameState.dayIntroOpen && !gameState.startupOpen && !['dismiss-day','new-inquiry'].includes(action))return;
    if(action==='start-route'){gameState.startSurveyRoute(actionTarget.dataset.routeId as RouteId);render();return;}
    if(action==='record-route'){gameState.recordSurveyRoute();render();return;}
    if(action==='conclude-survey'){gameState.concludeSurvey();render();return;}
    if(action==='continue-inquiry'){gameState.continueInquiry();render();return;}
    if(action==='new-inquiry'){ui.onReset?.();render();return;}
    if(action==='dismiss-day'){gameState.dismissDayIntroduction();render();return;}
    if(action==='end-day'){gameState.endDay();render();return;}
    if(action==='board-decision'){gameState.closeDialogue();dismissedChapter=undefined;overlayMode='none';render();return;}
    if(action==='review-theory'){gameState.closeDialogue();ui.openSnowReview();return;}
    const stage = gameState.getStage();
    const toolsAvailable = stage !== "briefing" && stage !== "board";

    if (action === "close-chapter") { dismissPanels(); return; }
    if (action === "chapter") {
      dismissedChapter = undefined;
      overlayMode = "none";
      gameState.closeDialogue();
      render(); return;
    }

    if(action==="sound") {overlayMode=overlayMode==="sound"?"none":"sound";render();return;}
    if(soundControls && ["toggle-sound","ambience-down","ambience-up","effects-down","effects-up"].includes(action)) {
      if(action==="toggle-sound")soundControls.toggleMuted();
      else {
        const channel=action.startsWith("ambience")?"ambience":"effects";
        soundControls.setLevel(channel,soundControls.getSettings()[channel]+(action.endsWith("up")?.1:-.1));
      }
      render();return;
    }
    if (action === "toggle-motion-look") {
      if (!motionLookControls || !motionLookControls.isAvailable()) {
        return;
      }

      const nextEnabled = !motionLookControls.isEnabled();
      const motionResult = motionLookControls.setEnabled(nextEnabled);
      message = nextEnabled ? "Requesting motion look permission..." : "Motion look off. Drag the view to look around.";
      render();
      void motionResult.then((result) => {
        message = result.message;
        render();
      });
      return;
    }

    if (action === "travel") {
      const locationId = actionTarget.dataset.locationId as LocationId | undefined;
      beginTravel(locationId);
      return;
    }

    if (action === "map-primary") {
      if (gameState.preparedForBoard && stage === "synthesis") {
        if (gameState.getCurrentLocation().id === "snow-desk") {
          gameState.clearActiveDialogueAnswer();
          snowReviewOpen = true;
          overlayMode = "none";
          message = "Present findings from Snow's review panel.";
          render();
          return;
        }

        beginTravel("snow-desk");
        return;
      }

      if (gameState.hasEnoughEvidenceForSynthesis() && !gameState.preparedForBoard) {
        if (gameState.getCurrentLocation().id === "snow-desk") {
          gameState.clearActiveDialogueAnswer();
          snowReviewOpen = true;
          overlayMode = "none";
          message = "Compare the strongest evidence, choose a theory, then prepare the Board argument.";
          render();
          return;
        }

        beginTravel("snow-desk");
        return;
      }

      if(gameState.isDayFieldworkComplete() || !gameState.hasCurrentAssignment()) {
        if(gameState.getCurrentLocation().id==='snow-desk'){overlayMode='none';gameState.inspectHotspot('john-snow');render();}
        else beginTravel('snow-desk');
        return;
      }
      message = gameState.getObjective();
      render();
      return;
    }

    if (action === "conversation-choice") {
      gameState.chooseConversation(actionTarget.dataset.beatId ?? "", actionTarget.dataset.choiceId ?? "");
    }
    if (action === "ask") {
      const questionId = actionTarget.dataset.questionId;
      if (!questionId) {
        return;
      }
      const result = gameState.askQuestion(questionId);
      message = result.message;
    }

    if (action === "select-hypothesis") {
      const hypothesisId = actionTarget.dataset.hypothesisId as HypothesisId | undefined;
      if (!hypothesisId) {
        return;
      }
      const result = gameState.selectHypothesis(hypothesisId);
      message = result.message;
    }

    if (action === "prepare-board") {
      const result = gameState.prepareBoardArgument();
      message = result.message;
    }

    if (action === "close-dialogue") {
      gameState.closeDialogue();
    }

    if (action === "close-snow-review") {
      gameState.clearActiveDialogueAnswer();
      snowReviewOpen = false;
      message = "Snow waits at the desk. Click him when we are ready to continue the review.";
    }

    if (action === "begin") {
      overlayMode = "none";
      snowReviewOpen = false;
      message = "Field inquiry opened. Select people to speak with them and the pump to investigate the water.";
      gameState.beginFieldwork();
    }
    if (action === "notebook" && toolsAvailable) {
      gameState.clearActiveDialogueAnswer();
      snowReviewOpen = false;
      overlayMode = overlayMode === "notebook" ? "none" : "notebook";
    }
    if (action === "map" && toolsAvailable) {
      gameState.closeDialogue();
      snowReviewOpen = false;
      overlayMode = overlayMode === "map" ? "none" : "map";
    }
    if (action === "close") {
      gameState.clearActiveDialogueAnswer();
      overlayMode = "none";
    }
    if (action === "reset") {
      dismissedChapter = undefined;
      overlayMode = "none";
      snowReviewOpen = false;
      message = "Speak with Snow at his desk to receive the field assignment.";
      ui.onReset?.();
    }
    if (action === "present") {
      const result = gameState.presentToBoard();
      overlayMode = "none";
      message = result.message;
    }
    if (action === "begin-hearing") gameState.beginHearing();
    if (action === "finish-board") {
      gameState.finishBoard();
      overlayMode = "none";
      message = "Late September records are open. Review the notebook or replay the inquiry.";
    }
    render();
  });

  function render(): void {
    keyboard.beforeRender();
    const collected = gameState.getCollectedEvidence();
    const allEvidence = gameState.getAllEvidence();
    const activeDialogue = gameState.getActiveDialogue();
    const stage = gameState.getStage();
    if (stage !== previousStage) { dismissedChapter = undefined; previousStage = stage; }
    const currentLocation = gameState.getCurrentLocation();
    const hasChapterPanel = stage === "briefing" || stage === "board" || stage === "complete";
    const showChapterPanel = !gameState.startupOpen && !gameState.dayIntroOpen && hasChapterPanel && dismissedChapter !== stage && overlayMode === "none" && !activeDialogue;
    const showSynthesisPanel =
      stage === "synthesis" &&
      currentLocation.id === "snow-desk" &&
      snowReviewOpen &&
      overlayMode === "none" &&
      !activeDialogue &&
      !isTransitioning;
    document.body.dataset.overlayOpen =
      !gameState.startupOpen && !gameState.dayIntroOpen && overlayMode === "none" && !showChapterPanel && !isTransitioning && !activeDialogue && !showSynthesisPanel
        ? "false"
        : "true";
    document.body.dataset.audioReading = document.body.dataset.overlayOpen === "true" && overlayMode !== "sound" ? "true" : "false";
    document.body.dataset.stage = stage;

    root.innerHTML = `
      <div class="hud" data-overlay="${overlayMode}" data-stage="${stage}" data-synthesis-panel="${showSynthesisPanel}">
        <section class="objective-chip" aria-label="Current objective">
          <span class="objective-kicker">Inquiry preview · ${escapeHtml(gameState.getDay().date)}</span>
          <strong>${escapeHtml(gameState.getObjective())}</strong>
          <span class="location-line">${escapeHtml(currentLocation.title)}</span>
          <span class="location-line">${escapeHtml(gameState.getInteractionHint())}</span>
          <span class="location-line">WASD to move · Arrow keys to look<br>Select clear ground to teleport · Marked exits or map to travel</span>
          <span id="desktop-controls" class="keyboard-help">Space / Enter: select · M: map · N: notebook<br>Objects: click / Space to inspect or return · Q / E: rotate<br>Panels: Tab / arrows, Enter to choose<br>Click outside / Esc: close · Page Up / Down: read more</span>
        </section>

        <nav class="tool-rail" aria-label="Investigation tools">
          ${hasChapterPanel ? '<button class="icon-button" data-action="chapter" aria-label="Open chapter instructions" title="Chapter instructions"><i data-lucide="book-open"></i></button>' : ""}
          <button class="icon-button ${overlayMode === "notebook" ? "is-active" : ""}" data-action="notebook" aria-label="Notebook" aria-keyshortcuts="N" title="Notebook (N)">
            <i data-lucide="notebook-tabs"></i>
            <span>${gameState.getProgressText()}</span>
          </button>
          <button class="icon-button ${overlayMode === "map" ? "is-active" : ""}" data-action="map" aria-label="Map" aria-keyshortcuts="M" title="Map (M)">
            <i data-lucide="map"></i>
          </button>
          <button class="icon-button" data-action="reset" aria-label="Reset inquiry">
            <i data-lucide="rotate-ccw"></i>
          </button>
          <button class="icon-button" data-action="sound" aria-label="Sound settings" title="Sound settings"><i data-lucide="volume-2"></i></button>
        </nav>

        ${renderMotionLookToggle(motionLookControls)}

        <div class="reticle" aria-hidden="true"></div>

        ${gameState.startupOpen ? renderStartPanel(gameState) : gameState.dayIntroOpen ? renderDayPanel(gameState) : ""}
        ${showChapterPanel ? renderChapterPanel(gameState.getCurrentScene(), stage, gameState) : ""}
        ${showSynthesisPanel ? renderSynthesisPanel(gameState) : ""}
        ${activeDialogue && overlayMode === "none" ? renderDialoguePanel(activeDialogue, gameState) : ""}
        ${overlayMode === "notebook" ? renderNotebook(collected, allEvidence, gameState) : ""}
        ${overlayMode === "map" ? renderMap(collected, gameState) : ""}
        ${overlayMode === "sound" ? renderSoundPanel(soundControls) : ""}
        ${isTransitioning ? renderTravelFade(message) : ""}
      </div>
    `;

    createIcons({ icons });
    keyboard.afterRender();
  }

  function beginTravel(locationId: LocationId | undefined): void {
    if (isTransitioning) return;
    const location = locationId ? gameState.getLocation(locationId) : undefined;
    if (!location || !locationId) {
      message = "That location is not on the inquiry map.";
      render();
      return;
    }

    if (!gameState.canTravelToLocation(locationId)) {
      message = `${location.title} is not available for field travel yet.`;
      render();
      return;
    }

    isTransitioning = true;
    snowReviewOpen = false;
    gameState.clearActiveDialogueAnswer();
    message = `Traveling to ${location.title}...`;
    render();
    window.setTimeout(() => {
      const result = gameState.travelToLocation(locationId);
      overlayMode = "none";
      message = result.message;
      render();
      window.setTimeout(() => {
        isTransitioning = false;
        render();
      }, 260);
    }, 260);
  }

  function canOpenSnowReview(): boolean {
    return (
      gameState.getStage() === "synthesis" &&
      gameState.getCurrentLocation().id === "snow-desk" &&
      gameState.hasEnoughEvidenceForSynthesis()
    );
  }

  return ui;
}

function renderDialoguePanel(dialogue: DialogueNode, gameState: GameState): string {
  const survey=gameState.getFieldworkView();
  if(survey)return `<aside class="dialogue-panel conversation-panel" aria-label="Pump-access fieldwork"><div class="dialogue-header"><strong>${escapeHtml(survey.title)}</strong><button class="icon-button" data-action="close-dialogue" aria-label="Close survey">×</button></div><p>${escapeHtml(survey.text)}</p><div class="conversation-choices">${survey.routes.map(r=>`<button class="question-button" data-action="start-route" data-route-id="${r.id}" ${survey.observations.some(o=>o.routeId===r.id)?'disabled':''}>${escapeHtml(r.title)}${survey.observations.some(o=>o.routeId===r.id)?' · recorded':''}</button>`).join('')}${survey.canRecord?'<button class="question-button" data-action="record-route">Record this route</button>':''}${survey.canConclude?'<button class="question-button" data-action="conclude-survey">Compare the results</button>':''}<button class="question-button" data-action="close-dialogue">Return to the scene</button></div><small>${survey.observations.length}/4 routes recorded · Estimates use 1.2 m/s, not elapsed playing time.</small></aside>`;
  const view = gameState.getConversationView();
  if (view) return `
    <aside class="dialogue-panel conversation-panel" aria-label="${escapeHtml(view.speaker)} conversation">
      <div class="dialogue-header"><strong>${escapeHtml(view.speaker)}</strong>
        <button class="icon-button" data-action="close-dialogue" aria-label="Close conversation"><i data-lucide="x"></i></button></div>
      <p class="conversation-beat" aria-live="polite">${escapeHtml(view.text)}</p>
      <div class="conversation-choices">${view.choices.map(choice => `<button class="question-button" data-action="conversation-choice" data-beat-id="${escapeHtml(view.beatId)}" data-choice-id="${escapeHtml(choice.id)}">${escapeHtml(choice.label)}</button>`).join("")}
      ${view.terminalAction ? `<button class="question-button" data-action="${view.terminalAction}">${view.terminalAction==='end-day'?'End day':view.terminalAction==='board-decision'?'Read the Board decision':'Review the theories'}</button>` : ''}
      ${view.complete ? '<button class="question-button" data-action="close-dialogue">Return to the scene</button>' : ""}</div>
    </aside>`;

  const activeAnswer = gameState.getActiveDialogueAnswer();
  const availableQuestions = gameState
    .getAvailableDialogueQuestions(dialogue)
    .filter((question) => question.id !== activeAnswer?.question.id);
  const questionRows = availableQuestions
    .map((question) => renderDialogueQuestion(question))
    .join("");

  return `
    <aside class="dialogue-panel" aria-label="${escapeHtml(dialogue.speaker)} interview">
      <div class="dialogue-header">
        <div>
          <span>${escapeHtml(dialogue.role)}</span>
          <strong>${escapeHtml(dialogue.speaker)}</strong>
        </div>
        <button class="icon-button" data-action="close-dialogue" aria-label="Close interview"><i data-lucide="x"></i></button>
      </div>
      ${activeAnswer ? renderDialogueActiveAnswer(activeAnswer) : `<p class="dialogue-intro">${escapeHtml(dialogue.intro)}</p>`}
      <div class="question-list">
        ${questionRows || renderDialogueEmptyState()}
      </div>
    </aside>
  `;
}

function renderDialogueQuestion(question: DialogueQuestion): string {
  return `
    <article class="question-card">
      <button class="question-button" data-action="ask" data-question-id="${escapeHtml(question.id)}">
        <span>${escapeHtml(question.prompt)}</span>
        <i data-lucide="message-circle-question"></i>
      </button>
    </article>
  `;
}

function renderDialogueActiveAnswer(activeAnswer: ActiveDialogueAnswer): string {
  return `
    <article class="dialogue-active-answer">
      <strong>${escapeHtml(activeAnswer.question.prompt)}</strong>
      <p>${escapeHtml(activeAnswer.question.response)}</p>
    </article>
  `;
}

function renderDialogueEmptyState(): string {
  return `<p class="dialogue-empty-state">${escapeHtml(noDialogueActionsText)}</p>`;
}

function renderTravelFade(message: string): string {
  return `
    <div class="travel-fade" aria-label="Travel transition">
      <div>
        <i data-lucide="map-pinned"></i>
        <span>${escapeHtml(message)}</span>
      </div>
    </div>
  `;
}

function renderMotionLookToggle(controls?: MotionLookControls): string {
  if (!controls?.isAvailable()) {
    return "";
  }

  const enabled = controls.isEnabled();
  const status = controls.getStatus();
  const pending = status === "requesting";
  const denied = status === "denied";
  const label = pending ? "Requesting" : enabled ? "Motion on" : denied ? "Motion denied" : "Motion look";
  const ariaLabel = enabled
    ? "Turn off motion look"
    : denied
      ? "Retry motion look permission"
      : "Turn on motion look";

  return `
    <button
      class="icon-button motion-look-toggle ${enabled ? "is-active" : ""} ${pending ? "is-pending" : ""} ${
        denied ? "is-denied" : ""
      }"
      data-action="toggle-motion-look"
      aria-label="${escapeHtml(ariaLabel)}"
      aria-pressed="${enabled}"
      ${pending ? "disabled" : ""}
    >
      <i data-lucide="smartphone"></i>
      <span>${escapeHtml(label)}</span>
    </button>
  `;
}

export function renderChapterPanel(scene: ChapterScene, stage: ChapterStage, gameState: GameState): string {
  const body = gameState.getCurrentSceneBody().map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
  const boardFindings =
    stage === "board" && gameState.boardPresented
      ? `<ol class="findings-list">${gameState
          .getBoardFindings()
          .map((finding) => `<li>${escapeHtml(finding)}</li>`)
          .join("")}</ol>`
      : "";

  const action =
    stage === "briefing"
      ? `<button class="primary-action wide-action" data-action="begin">
          <i data-lucide="footprints"></i>
          Begin field inquiry
        </button>`
      : stage === "board"
        ? `<button class="primary-action wide-action" data-action="${gameState.boardPresented ? "finish-board" : "begin-hearing"}" ${!gameState.preparedForBoard ? "disabled" : ""}>
            <i data-lucide="check-circle-2"></i>
            ${gameState.boardPresented ? "Continue after meeting" : "Begin hearing"}
          </button>`
        : `<button class="primary-action wide-action" data-action="reset">
            <i data-lucide="rotate-ccw"></i>
            Replay chapter
          </button>`;

  return `
    <aside class="chapter-panel" aria-label="${escapeHtml(scene.title)}">
      <div class="chapter-heading">
        <span>${escapeHtml(scene.subtitle)}</span>
        <h2>${escapeHtml(scene.title)}</h2>
      </div>
      <div class="chapter-copy">
        ${body}
        ${boardFindings}
      </div>
      <div class="chapter-actions">
        <button class="secondary-action" data-action="close-chapter">Close</button>
        <button class="secondary-action" data-action="sound">Sound settings</button>
        ${action}
      </div>
    </aside>
  `;
}

function renderNotebook(collected: EvidenceCard[], allEvidence: EvidenceCard[], gameState: GameState): string {
  const readiness = gameState.getObjective();
  const collectedIds = new Set(collected.map((card) => card.id));
  const studyGoalCompleted = gameState.hasFieldAssignment();
  const evidenceRows = allEvidence
    .map((card) => {
      const unlocked = collectedIds.has(card.id);
      return `
        <article class="evidence-row ${unlocked ? "is-unlocked" : ""}">
          <div class="evidence-status">
            <i data-lucide="${unlocked ? "check-circle-2" : "circle-dot"}"></i>
          </div>
          <div>
            <h3>${escapeHtml(unlocked ? card.title : "Unrecorded evidence")}</h3>
            <p>${escapeHtml(unlocked ? card.summary : gameState.getMissingEvidencePrompt(card))}</p>
            ${
              unlocked
                ? `<div class="source-line">
                    <i data-lucide="${sourceIcon(card.sourceType)}"></i>
                    <span>${escapeHtml(card.sourceLabel)}</span>
                  </div>`
                : ""
            }
          </div>
        </article>
      `;
    })
    .join("");

  return `
    <aside class="overlay-panel notebook-panel" aria-label="Field notebook">
      <div class="panel-header">
        <div>
          <span>Field notebook</span>
          <strong>${collected.length}/${allEvidence.length} evidence ${collected.length === 1 ? "card" : "cards"} collected</strong>
          <small class="readiness-line ${gameState.hasEnoughEvidenceForSynthesis() ? "is-ready" : ""}">${escapeHtml(readiness)}</small>
        </div>
        <button class="icon-button" data-action="close" aria-label="Close notebook"><i data-lucide="x"></i></button>
      </div>
      <div class="panel-body evidence-list">
        ${renderAssignments(gameState)}
        ${renderStudyGoal(studyGoalCompleted)}
        ${evidenceRows}
      </div>
    </aside>
  `;
}

function renderStudyGoal(completed: boolean): string {
  return `
    <article class="study-goal ${completed ? "is-complete" : ""}">
      <div class="evidence-status">
        <i data-lucide="${completed ? "check-circle-2" : "circle-dot"}"></i>
      </div>
      <div>
        <span>Study Goal</span>
        <h3>${escapeHtml(fieldStudyGoal.title)}</h3>
        <p>${escapeHtml(
          completed
            ? fieldStudyGoal.summary
            : "Speak with Snow at his desk to receive the field inquiry goal before traveling to other locations.",
        )}</p>
      </div>
    </article>
  `;
}

function sourceIcon(sourceType: EvidenceCard["sourceType"]): string {
  if (sourceType === "document") {
    return "file-text";
  }
  if (sourceType === "interview") {
    return "messages-square";
  }
  if (sourceType === "inference") {
    return "brain";
  }
  return "eye";
}

export function renderSynthesisPanel(gameState: GameState): string {
  const selectedHypothesis = gameState.getSelectedHypothesis();
  const canPrepare = Boolean(selectedHypothesis && gameState.hasEnoughEvidenceForSynthesis() && gameState.getCurrentLocation().id === "snow-desk");
  const boardPrepared = gameState.preparedForBoard && gameState.getStage() === "synthesis";
  const hypothesisRows = gameState
    .getHypotheses()
    .map((hypothesis) => renderHypothesisCard(hypothesis, gameState, selectedHypothesis?.id === hypothesis.id))
    .join("");
  return `
    <aside class="synthesis-panel" aria-label="Snow hypothesis board">
      <div class="synthesis-header">
        <div>
          <span>Snow's Desk</span>
          <strong>Hypothesis board</strong>
        </div>
        <div class="synthesis-header-actions">
          <div class="synthesis-status ${gameState.preparedForBoard ? "is-ready" : ""}">
            <i data-lucide="${gameState.preparedForBoard ? "check-circle-2" : "clipboard-list"}"></i>
            <span>${gameState.preparedForBoard ? "Board ready" : "Snow review"}</span>
          </div>
          <button class="icon-button" data-action="close-snow-review" aria-label="Close Snow review">
            <i data-lucide="x"></i>
          </button>
        </div>
      </div>
      <p class="synthesis-copy">Choose the theory that best fits the evidence. A strong case can justify action without final proof.</p>
      <div class="hypothesis-grid">
        ${hypothesisRows}
      </div>
      ${selectedHypothesis ? `<p class="synthesis-copy synthesis-recommendation"><strong>Proposed action:</strong> ${escapeHtml(selectedHypothesis.boardAction)}</p>` : ""}
      <div class="synthesis-controls">
        <div class="synthesis-reference-actions">
          <button class="secondary-action" data-action="map">Open map</button>
          <button class="secondary-action" data-action="notebook">Full evidence notes</button>
        </div>
        <div class="synthesis-actions">
          <button
            class="primary-action wide-action"
            data-action="${boardPrepared ? "present" : "prepare-board"}"
            ${canPrepare || boardPrepared ? "" : "disabled"}
          >
            <i data-lucide="${boardPrepared ? "send" : "clipboard-check"}"></i>
            ${boardPrepared ? "Attend the meeting" : "Prepare Board argument"}
          </button>
        </div>
      </div>
    </aside>
  `;
}

function renderHypothesisCard(
  hypothesis: HypothesisDefinition,
  gameState: GameState,
  selected: boolean,
): string {
  const { supporting, complicating } = gameState.getHypothesisReview(hypothesis);
  return `
    <article class="hypothesis-card ${selected ? "is-selected" : ""}">
      <button
        class="hypothesis-select"
        data-action="select-hypothesis"
        data-hypothesis-id="${hypothesis.id}"
        aria-pressed="${selected}"
      >
        <span>${escapeHtml(hypothesis.title)}</span>
        <i data-lucide="${selected ? "check-circle-2" : "circle"}"></i>
      </button>
      <p>${escapeHtml(hypothesis.summary)}</p>
      <div class="fit-columns">
        ${renderEvidenceFit("For", supporting?.text, "supports")}
        ${renderEvidenceFit("Against / limits", complicating?.text, "complicates")}
      </div>
    </article>
  `;
}

function renderEvidenceFit(label: string, text: string | undefined, kind: "supports" | "complicates"): string {
  const empty = kind === "supports" ? "No supporting evidence recorded yet." : "No challenge recorded yet.";
  return `
    <div class="fit-list is-${kind}">
      <span>${escapeHtml(label)}</span>
      <p class="${text ? "" : "is-empty"}">${escapeHtml(text ?? empty)}</p>
    </div>
  `;
}

function renderMap(collected: EvidenceCard[], gameState: GameState): string {
  const collectedIds = new Set(collected.map((card) => card.id));
  const deathsVisible = shouldShowDeathLayer(collectedIds);

  const stage = gameState.getStage();
  const evidenceReady = gameState.hasEnoughEvidenceForSynthesis();
  const fieldAssigned = gameState.hasFieldAssignment();
  const boardPrepared = gameState.preparedForBoard && stage === "synthesis";
  const needsSnowReview = evidenceReady && !gameState.preparedForBoard && stage === "synthesis";
  const currentLocation = gameState.getCurrentLocation();
  const dailyReview = gameState.isDayFieldworkComplete() && stage === "field";
  const canUseMapPrimary = fieldAssigned && (boardPrepared || needsSnowReview || dailyReview || !gameState.hasCurrentAssignment());
  let actionText = "Current assignments";
  let primaryLabel = "Complete today’s fieldwork";
  let primaryIcon = "circle-dot";
  let primaryCopy = gameState.getObjective();

  if (!fieldAssigned) {
    actionText = "Assignment needed";
    primaryLabel = "Talk to Snow first";
    primaryIcon = "message-circle";
    primaryCopy = "Snow has not sent us into the streets yet.";
  } else if(dailyReview || !gameState.hasCurrentAssignment()) {
    actionText="Speak with Snow";primaryLabel=currentLocation.id==="snow-desk"?"Speak with Snow":"Return to Snow";primaryIcon="message-circle";primaryCopy=gameState.getObjective();
  } else if (boardPrepared) {
    actionText = "Ready for Board";
    primaryLabel = currentLocation.id === "snow-desk" ? "Open Snow review" : "Return to Snow's Desk";
    primaryIcon = "clipboard-check";
    primaryCopy =
      currentLocation.id === "snow-desk"
        ? "Choose Attend the meeting on Snow's review panel."
        : "Return to Snow's desk to present the prepared findings.";
  } else if (stage === "complete") {
    actionText = "Presented";
    primaryLabel = "Evidence presented";
  } else if (needsSnowReview) {
    actionText = currentLocation.id === "snow-desk" ? "Open Snow review" : "Return to Snow";
    primaryLabel = currentLocation.id === "snow-desk" ? "Open Snow review" : "Return to Snow's Desk";
    primaryIcon = "clipboard-list";
    primaryCopy =
      currentLocation.id === "snow-desk"
        ? "Open Snow's review board before the meeting."
        : "Return to Snow before approaching the Board.";
  } else if (evidenceReady) {
    actionText = "Review needed";
  }
  const locationNodes = gameState
    .getLocations()
    .filter((location) => !location.boardOnly)
    .map((location) => renderLocationNode(location, gameState, currentLocation.id))
    .join("");
  const evidenceDocket = renderMapEvidenceDocket(gameState);
  const mappedFindings = gameState.getMappedEvidenceFindings();
  const mapFindings = mappedFindings.length
    ? mappedFindings.map((finding) => `<li>${escapeHtml(finding)}</li>`).join("")
    : `<li class="is-empty">No mapped evidence yet. Begin with today’s records and household assignments.</li>`;

  return `
    <aside class="overlay-panel map-panel" aria-label="Snow map table">
      <div class="panel-header">
        <div>
          <span>Map table</span>
          <strong>Sources and locations</strong>
        </div>
        <button class="icon-button" data-action="close" aria-label="Close map"><i data-lucide="x"></i></button>
      </div>
      <div class="map-action-bar">
        <div class="map-action-copy">
          <span>${escapeHtml(actionText)}</span>
          <strong>${escapeHtml(primaryCopy)}</strong>
        </div>
        <button class="primary-action" data-action="map-primary" ${canUseMapPrimary ? "" : "disabled"}>
          <i data-lucide="${primaryIcon}"></i>
          ${escapeHtml(primaryLabel)}
        </button>
      </div>
      <div class="map-layout">
        <div class="map-canvas">
          <div class="map-frame">
            <svg class="snow-map snow-map--custom" viewBox="0 0 ${broadStreetMapViewBoxSize} ${broadStreetMapViewBoxSize}" role="img" aria-label="Broad Street evidence map">
              ${renderCustomMapBase(collectedIds,gameState)}
            </svg>
            ${renderMapLegend(deathsVisible,gameState.getRouteObservations().length>0,gameState.hasWalkingBoundary())}
            ${locationNodes}
          </div>
        </div>
        <div class="map-brief">
          <div class="layer-summary">
            <span>Map evidence</span>
            <p>${escapeHtml(gameState.getObjective())}</p>${renderAssignments(gameState)}
          </div>
          <ul class="map-findings">
            ${mapFindings}
          </ul>
          <dl>
            <div><dt>Current place</dt><dd>${escapeHtml(currentLocation.shortTitle)}</dd></div>
            <div><dt>Evidence</dt><dd>${escapeHtml(gameState.getProgressText())}</dd></div>
            <div><dt>Snow review</dt><dd>${gameState.preparedForBoard ? "Prepared" : evidenceReady ? "Needed" : "Locked"}</dd></div>
            <div><dt>Action</dt><dd>${escapeHtml(actionText)}</dd></div>
          </dl>
          ${gameState.day===3?`<div class="layer-summary"><strong>Pump-access exercise</strong><p>Blue: Survey A. Brown: Survey B. Select the marked origin on Broad Street before each route.</p>${gameState.getRouteObservations().map(o=>`<p>${escapeHtml(surveyRoutes.find(r=>r.id===o.routeId)!.title)}: ≈${o.metres} m · ${o.seconds} s</p>`).join('')}<p>Times assume 1.2 m/s. ${gameState.hasWalkingBoundary()?'Green boundary: historical walking access, not calculated from these four routes.':'Historical boundary appears after both paired comparisons.'}</p></div>`:''}
          ${evidenceDocket}
        </div>
      </div>
    </aside>
  `;
}

function renderCustomMapBase(collectedIds: Set<string>, gameState:GameState): string {
  const mapSource = publicAssetPath(broadStreetMapSvgPath);
  const href = (id: string) => escapeHtml(`${mapSource}#${id}`);
  const showDeaths = shouldShowDeathLayer(collectedIds);

  return `
    <rect class="map-paper" x="0" y="0" width="${broadStreetMapViewBoxSize}" height="${broadStreetMapViewBoxSize}" />
    <g class="imported-map-layer imported-map-layer--streets" aria-hidden="true">
      <use href="${href("Streets")}" />
    </g>
    <g class="imported-map-layer imported-map-layer--label" aria-hidden="true">
      <use href="${href("Broad-Street")}" />
    </g>
    ${
      showDeaths
        ? `<g class="imported-map-layer imported-map-layer--deaths" aria-hidden="true">
            <use href="${href("Deaths")}" />
          </g>`
        : ""
    }
    <g class="imported-map-layer imported-map-layer--pumps" aria-hidden="true">
      <use href="${href("Pumps")}" />
    </g>
    ${gameState.hasWalkingBoundary()?`<image href="${import.meta.env?.BASE_URL??'/'}maps/pump-service-area.svg" x="0" y="0" width="20020" height="20020" />`:''}
    ${gameState.getRouteObservations().map(o=>{const r=surveyRoutes.find(r=>r.id===o.routeId)!;return `<polyline points="${r.polyline.map(p=>p.map(v=>v*broadStreetMapViewBoxSize/100).join(',')).join(' ')}" fill="none" stroke="${r.pair==='marlborough'?'#245eaa':'#985627'}" stroke-width="65" stroke-dasharray="100 65"/>`;}).join('')}
    <g class="map-pump-highlights" aria-hidden="true">
      ${renderPumpHighlights()}
    </g>
  `;
}

function shouldShowDeathLayer(collectedIds: Set<string>): boolean {
  return collectedIds.has("attack-timeline") && collectedIds.has("pump-cluster");
}

function renderMapLegend(deathsVisible: boolean, routesVisible=false, accessVisible=false): string {
  return `
    <div class="map-legend" aria-label="Map legend">
      <span class="map-legend-item">
        <span class="map-legend-swatch is-pump"></span>
        Pumps
      </span>
      ${routesVisible?'<span class="map-legend-item" style="color:#245eaa">Blue: Survey A</span><span class="map-legend-item" style="color:#985627">Brown: Survey B</span>':''}
      ${accessVisible?'<span class="map-legend-item" style="color:#47633b">Historical access</span>':''}
      ${
        deathsVisible
          ? `<span class="map-legend-item">
              <span class="map-legend-swatch is-death"></span>
              Death marks
            </span>`
          : ""
      }
    </div>
  `;
}

function renderPumpHighlights(): string {
  return broadStreetPumpPoints.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="150" />`).join("");
}

function publicAssetPath(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

function renderHistoricMapBase(): string {
  return `
    <rect class="map-paper" x="0" y="0" width="100" height="100" />
    <g class="map-blocks" aria-hidden="true">
      <path d="M5 5 L21 5 L24 24 L7 28 Z" />
      <path d="M27 5 L47 5 L48 23 L31 25 Z" />
      <path d="M55 5 L72 5 L71 23 L57 24 Z" />
      <path d="M80 5 L96 8 L95 23 L80 22 Z" />
      <path d="M8 32 L25 29 L27 44 L9 46 Z" />
      <path d="M34 29 L48 27 L48 43 L35 44 Z" />
      <path d="M58 28 L70 27 L70 42 L59 43 Z" />
      <path d="M79 28 L95 29 L94 43 L80 43 Z" />
      <path d="M8 56 L28 54 L29 64 L12 67 Z" />
      <path d="M36 54 L49 53 L49 63 L36 64 Z" />
      <path d="M59 53 L70 52 L71 63 L60 64 Z" />
      <path d="M79 54 L96 55 L96 66 L82 66 Z" />
      <path d="M10 70 L30 67 L32 78 L9 83 Z" />
      <path d="M39 68 L56 66 L57 79 L38 82 Z" />
      <path d="M65 67 L80 65 L85 77 L67 80 Z" />
      <path d="M87 69 L97 70 L98 87 L91 84 Z" />
      <path d="M9 86 L27 82 L24 96 L6 96 Z" />
      <path d="M35 84 L58 81 L62 96 L34 96 Z" />
      <path d="M69 82 L90 79 L96 96 L72 96 Z" />
    </g>
    <g class="map-parcel-lines" aria-hidden="true">
      <path d="M14 6 L17 26 M20 5 L22 23 M35 5 L36 24 M42 5 L42 24 M63 5 L62 23 M87 6 L86 22" />
      <path d="M12 32 L13 45 M17 31 L18 45 M22 30 L23 44 M39 29 L39 43 M44 28 L44 43" />
      <path d="M63 28 L63 42 M67 28 L67 42 M84 28 L83 43 M89 29 L88 43" />
      <path d="M15 69 L16 81 M22 68 L23 79 M45 68 L45 81 M51 67 L52 80 M72 66 L74 79" />
      <path d="M13 87 L12 96 M19 85 L18 96 M43 83 L45 96 M51 82 L54 96 M78 81 L82 96 M87 80 L91 96" />
    </g>
    <g class="map-street-casing" aria-hidden="true">
      <path d="M4 50 C20 49 35 48 51 48 C66 47 82 48 96 50" />
      <path d="M6 76 C23 74 41 72 58 71 C74 70 87 69 97 72" />
      <path d="M10 63 C25 61 39 60 54 60 C66 60 79 61 94 63" />
      <path d="M25 4 C26 18 28 33 30 48 C31 65 28 81 24 97" />
      <path d="M52 4 C52 20 52 34 52 48 C52 65 50 80 46 97" />
      <path d="M59 4 C58 21 58 37 59 51 C59 65 62 82 67 97" />
      <path d="M77 5 C77 23 77 39 78 55 C80 72 85 86 93 97" />
      <path d="M6 26 C23 24 40 23 57 22 C72 21 86 22 97 25" />
      <path d="M38 34 C47 35 56 36 70 37 C80 37 88 37 96 38" />
      <path d="M33 58 C41 55 48 53 57 49 C66 45 74 42 83 40" />
    </g>
    <g class="map-streets" aria-hidden="true">
      <path class="major-street" d="M4 50 C20 49 35 48 51 48 C66 47 82 48 96 50" />
      <path class="major-street" d="M6 76 C23 74 41 72 58 71 C74 70 87 69 97 72" />
      <path d="M10 63 C25 61 39 60 54 60 C66 60 79 61 94 63" />
      <path class="major-street" d="M25 4 C26 18 28 33 30 48 C31 65 28 81 24 97" />
      <path d="M52 4 C52 20 52 34 52 48 C52 65 50 80 46 97" />
      <path class="major-street" d="M59 4 C58 21 58 37 59 51 C59 65 62 82 67 97" />
      <path class="major-street" d="M77 5 C77 23 77 39 78 55 C80 72 85 86 93 97" />
      <path d="M6 26 C23 24 40 23 57 22 C72 21 86 22 97 25" />
      <path d="M38 34 C47 35 56 36 70 37 C80 37 88 37 96 38" />
      <path d="M33 58 C41 55 48 53 57 49 C66 45 74 42 83 40" />
    </g>
    <g class="map-pump-neighborhood" aria-hidden="true">
      <path d="M45 45 L57 44 L57 52 L45 53 Z" />
      <path d="M45 53 L56 52 L55 60 L44 60 Z" />
      <path d="M57 44 L64 44 L64 52 L57 52 Z" />
    </g>
    <g class="street-labels" aria-hidden="true">
      <text x="48" y="46" transform="rotate(-3 48 46)">BROAD STREET</text>
      <text x="60" y="24" transform="rotate(-86 60 24)">CAMBRIDGE ST</text>
      <text x="79" y="29" transform="rotate(-86 79 29)">POLAND ST</text>
      <text x="29" y="31" transform="rotate(82 29 31)">BERWICK ST</text>
      <text x="37" y="62" transform="rotate(-3 37 62)">MARSHALL ST</text>
      <text x="69" y="75" transform="rotate(-8 69 75)">BREWER ST</text>
      <text x="68" y="42" transform="rotate(-21 68 42)">GREAT PULTENEY ST</text>
      <text x="51" y="17" transform="rotate(-3 51 17)">GREAT MARLBOROUGH ST</text>
      <text x="49" y="77" transform="rotate(-82 49 77)">LITTLE WINDMILL ST</text>
    </g>
  `;
}

function renderMapEvidenceDocket(gameState: GameState): string {
  const rows = gameState
    .getAllEvidence()
    .map((card) => {
      const plotted = gameState.hasEvidence(card.id);
      return `
        <li class="${plotted ? "is-plotted" : ""}">
          <i data-lucide="${plotted ? "check-circle-2" : "circle"}"></i>
          <span>${escapeHtml(plotted ? card.title : "Awaiting source")}</span>
        </li>
      `;
    })
    .join("");

  return `
    <section class="map-docket" aria-label="Evidence plotted on map">
      <span>Plotted sources</span>
      <ul>${rows}</ul>
    </section>
  `;
}

function renderLocationNode(
  location: InvestigationLocation,
  gameState: GameState,
  currentLocationId: LocationId,
): string {
  const unlocked = gameState.isLocationUnlocked(location);
  const active = location.id === currentLocationId;
  const canTravel = gameState.canTravelToLocation(location.id) && !active;
  const offMapDirection = getOffMapDirection(location.id);
  const offMap = Boolean(offMapDirection);
  const popover = renderLocationEvidencePopover(location.id, gameState);
  const classes = [
    "map-node",
    location.id === "household" ? "has-label-left" : "",
    active ? "is-current" : "",
    unlocked ? "is-unlocked" : "is-locked",
    offMap ? "is-off-map" : "",
    offMapDirection ? `is-off-map-${offMapDirection}` : "",
    popover ? "has-evidence-popover" : "",
    location.mapPoint.y < 26 ? "has-popover-below" : "",
    location.mapPoint.x < 28 ? "has-popover-right" : "",
    location.mapPoint.x > 72 ? "has-popover-left" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const label = active
    ? `Current location: ${location.title}`
    : canTravel
      ? `Travel to ${location.title}`
      : `${location.title} is locked`;
  const actionAttributes = canTravel ? `data-action="travel" data-location-id="${location.id}"` : "";
  const disabledAttribute = !canTravel && !active ? "disabled" : "";

  return `
    <button
      type="button"
      class="${classes}"
      style="left: ${location.mapPoint.x}%; top: ${location.mapPoint.y}%"
      ${actionAttributes}
      aria-label="${escapeHtml(label)}"
      ${active ? `aria-current="location"` : ""}
      ${disabledAttribute}
    >
      <span class="node-dot"></span>
      <span class="node-label">${escapeHtml(location.shortTitle)}</span>
      ${popover}
    </button>
  `;
}

function getOffMapDirection(locationId: LocationId): "east" | "south" | "southwest" | "southeast" | undefined {
  if (locationId === "snow-desk") {
    return "south";
  }
  if (locationId === "registrar") {
    return "southeast";
  }
  return undefined;
}

function renderLocationEvidencePopover(locationId: LocationId, gameState: GameState): string {
  const notes = (locationEvidenceIds[locationId] ?? [])
    .filter((evidenceId) => gameState.hasEvidence(evidenceId))
    .map((evidenceId) => mapAnnotations.find((annotation) => annotation.evidenceId === evidenceId))
    .filter((annotation): annotation is (typeof mapAnnotations)[number] => Boolean(annotation));

  if (notes.length === 0) {
    return "";
  }

  return `
    <span class="node-popover" role="tooltip">
      ${notes
        .map(
          (note) => `
            <span class="node-popover-entry is-${note.kind}">
              <strong>${escapeHtml(note.title)}</strong>
              <span>${escapeHtml(note.body)}</span>
            </span>
          `,
        )
        .join("")}
    </span>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderSoundPanel(controls?: SoundControls): string {
  const settings=controls?.getSettings()??{muted:true,ambience:0,effects:0};
  return `<aside class="overlay-panel notebook-panel" aria-label="Sound settings">
    <div class="panel-header"><div><span>Preferences</span><strong>Sound</strong></div>
      <button class="icon-button" data-action="close" aria-label="Close sound settings"><i data-lucide="x"></i></button></div>
    <div class="panel-body sound-settings">
      <button class="secondary-action" data-action="toggle-sound" aria-pressed="${settings.muted}">${settings.muted?"Unmute sound":"Mute sound"}</button>
      ${(["ambience","effects"] as const).map(channel=>`<div class="sound-level"><span>${channel==="ambience"?"Ambience":"Effects"}: <strong>${Math.round(settings[channel]*100)}%</strong></span>
        <button class="secondary-action" data-action="${channel}-down" aria-label="Lower ${channel}" ${settings[channel]<=0?"disabled":""}>−</button>
        <button class="secondary-action" data-action="${channel}-up" aria-label="Raise ${channel}" ${settings[channel]>=1?"disabled":""}>+</button></div>`).join("")}
      <p>All clues and actions remain available visually. Ambience softens while you read. Sound starts after you interact with the app.</p>
      <p><a href="${import.meta.env?.BASE_URL??"/"}audio/credits.html" target="_blank" rel="noopener">Audio sources and credits</a></p>
    </div></aside>`;
}

function renderAssignments(game: GameState): string {
 return `<article class="study-goal assignment-summary"><div><h3>${escapeHtml(game.getDay().title)}</h3>${game.getAssignments().map(o=>`<p>${o.complete?'✓':'○'} ${escapeHtml(o.title)}</p>`).join('')}</div></article>`;
}
function renderStartPanel(game:GameState): string {
 return `<aside class="chapter-panel" aria-label="Start inquiry"><div class="chapter-heading"><span>Three-day inquiry · September 5–7, 1854</span><h2>The Broad Street Inquiry</h2></div><div class="chapter-copy"><p>Investigate records, interview witnesses, compare water supplies and present your argument to the Board.</p><p>${escapeHtml(game.saveNotice || 'Progress saves in this browser. The inquiry preview has a separate save from production.')}</p></div><div class="chapter-actions">${game.hasSavedInquiry?'<button class="primary-action" data-action="continue-inquiry">Continue</button>':''}<button class="secondary-action" data-action="new-inquiry">New Inquiry</button></div></aside>`;
}
function renderDayPanel(game:GameState): string {
 return `<aside class="chapter-panel" aria-label="Day ${game.day} introduction"><div class="chapter-heading"><span>Day ${game.day}</span><h2>${escapeHtml(game.getDay().date)}</h2></div><div class="chapter-copy">${game.getDayIntroduction().slice(1).map(text=>`<p>${escapeHtml(text)}</p>`).join('')}</div><div class="chapter-actions"><button class="primary-action" data-action="dismiss-day">Speak with Snow</button></div></aside>`;
}
