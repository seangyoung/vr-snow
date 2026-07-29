import { createIcons, icons } from "lucide";
import { boardThreshold } from "../simulation/content";
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
  SynthesisConfidence,
} from "../simulation/types";

type OverlayMode = "none" | "notebook" | "map";
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
  kind: "cluster" | "record" | "household" | "conflict" | "exception" | "method";
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
    title: "Workhouse exception",
    body: "Near the outbreak, but protected by a separate supply.",
    x: 76,
    y: 39,
    kind: "exception",
  },
  {
    evidenceId: "brewery-exception",
    title: "Brewery exception",
    body: "Near Broad Street, but workers did not rely on pump water.",
    x: 70,
    y: 77,
    kind: "exception",
  },
  {
    evidenceId: "snow-method",
    title: "Outliers checked",
    body: "Snow keeps exceptions and distant addresses in the argument.",
    x: 23,
    y: 35,
    kind: "method",
  },
];

const locationEvidenceIds: Partial<Record<LocationId, string[]>> = {
  "snow-desk": ["snow-method", "pump-cluster"],
  "broad-street": ["pump-water-inspection"],
  household: ["household-exposure"],
  registrar: ["attack-timeline"],
  workhouse: ["workhouse-exception"],
  brewery: ["brewery-exception"],
};

export interface PrototypeUi {
  onReset?: () => void;
  openSnowReview: () => void;
  render: () => void;
  setPrompt: (hotspot?: Hotspot) => void;
  setMessage: (message: string) => void;
}

export function createUi(root: HTMLDivElement, gameState: GameState): PrototypeUi {
  let overlayMode: OverlayMode = "none";
  let focusedHotspot: Hotspot | undefined;
  let message = "Speak with Snow at the desk to receive your field assignment.";
  let isTransitioning = false;
  let snowReviewOpen = false;

  const ui: PrototypeUi = {
    openSnowReview() {
      if (canOpenSnowReview()) {
        gameState.closeDialogue();
        overlayMode = "none";
        snowReviewOpen = true;
        message = "Snow reviews the competing theories with you.";
        render();
        return;
      }

      message = "Return to Snow with enough evidence before preparing the Board argument.";
      render();
    },
    render,
    setPrompt(hotspot?: Hotspot) {
      focusedHotspot = hotspot;
      render();
    },
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

    const stage = gameState.getStage();
    const toolsAvailable = stage !== "briefing" && stage !== "board";

    if (action === "travel") {
      const locationId = actionTarget.dataset.locationId as LocationId | undefined;
      beginTravel(locationId);
      return;
    }

    if (action === "map-primary") {
      if (gameState.preparedForBoard && stage === "synthesis") {
        const result = gameState.presentToBoard();
        overlayMode = "none";
        message = result.message;
        render();
        return;
      }

      if (gameState.hasEnoughEvidenceForSynthesis() && !gameState.preparedForBoard) {
        if (gameState.getCurrentLocation().id === "snow-desk") {
          snowReviewOpen = true;
          overlayMode = "none";
          message = "Review the theories with Snow, choose a confidence level, then prepare the Board argument.";
          render();
          return;
        }

        beginTravel("snow-desk");
        return;
      }

      message = `Gather ${boardThreshold} evidence cards before preparing a Board argument.`;
      render();
      return;
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

    if (action === "set-confidence") {
      const confidence = actionTarget.dataset.confidence as SynthesisConfidence | undefined;
      if (!confidence) {
        return;
      }
      const result = gameState.setSynthesisConfidence(confidence);
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
      snowReviewOpen = false;
      message = "Snow waits at the desk. Click him when you want to continue the review.";
    }

    if (action === "begin") {
      overlayMode = "none";
      snowReviewOpen = false;
      message = "Broad Street field inquiry opened. Inspect evidence markers around the street.";
      gameState.beginFieldwork();
    }
    if (action === "notebook" && toolsAvailable) {
      snowReviewOpen = false;
      overlayMode = overlayMode === "notebook" ? "none" : "notebook";
    }
    if (action === "map" && toolsAvailable) {
      gameState.closeDialogue();
      snowReviewOpen = false;
      overlayMode = overlayMode === "map" ? "none" : "map";
    }
    if (action === "close") {
      overlayMode = "none";
    }
    if (action === "reset") {
      overlayMode = "none";
      snowReviewOpen = false;
      message = "Speak with Snow at the desk to receive your field assignment.";
      ui.onReset?.();
    }
    if (action === "present") {
      const result = gameState.presentToBoard();
      overlayMode = "none";
      message = result.message;
    }
    if (action === "finish-board") {
      gameState.finishBoard();
      overlayMode = "none";
      message = "Late September records are open. Review the notebook or replay the inquiry.";
    }
    render();
  });

  function render(): void {
    const collected = gameState.getCollectedEvidence();
    const allEvidence = gameState.getAllEvidence();
    const activeDialogue = gameState.getActiveDialogue();
    const stage = gameState.getStage();
    const currentLocation = gameState.getCurrentLocation();
    const showChapterPanel = stage === "briefing" || stage === "board" || stage === "complete";
    const showSynthesisPanel =
      stage === "synthesis" &&
      currentLocation.id === "snow-desk" &&
      snowReviewOpen &&
      overlayMode === "none" &&
      !activeDialogue &&
      !isTransitioning;
    document.body.dataset.overlayOpen =
      overlayMode === "none" && !showChapterPanel && !isTransitioning && !activeDialogue && !showSynthesisPanel
        ? "false"
        : "true";
    document.body.dataset.stage = stage;

    root.innerHTML = `
      <div class="hud" data-overlay="${overlayMode}" data-stage="${stage}" data-synthesis-panel="${showSynthesisPanel}">
        <section class="objective-chip" aria-label="Current objective">
          <span class="objective-kicker">Broad Street Inquiry</span>
          <strong>${escapeHtml(gameState.getObjective())}</strong>
          <span class="location-line">${escapeHtml(currentLocation.title)}</span>
        </section>

        <nav class="tool-rail" aria-label="Investigation tools">
          <button class="icon-button ${overlayMode === "notebook" ? "is-active" : ""}" data-action="notebook" aria-label="Notebook">
            <i data-lucide="notebook-tabs"></i>
            <span>${gameState.getProgressText()}</span>
          </button>
          <button class="icon-button ${overlayMode === "map" ? "is-active" : ""}" data-action="map" aria-label="Map">
            <i data-lucide="map"></i>
          </button>
          <button class="icon-button" data-action="reset" aria-label="Reset inquiry">
            <i data-lucide="rotate-ccw"></i>
          </button>
        </nav>

        <div class="reticle" aria-hidden="true"></div>
        <div class="prompt-strip">${renderPrompt()}</div>
        <div class="toast-line">${escapeHtml(message)}</div>

        ${showChapterPanel ? renderChapterPanel(gameState.getCurrentScene(), stage, gameState) : ""}
        ${showSynthesisPanel ? renderSynthesisPanel(gameState) : ""}
        ${activeDialogue && overlayMode === "none" ? renderDialoguePanel(activeDialogue, gameState) : ""}
        ${overlayMode === "notebook" ? renderNotebook(collected, allEvidence) : ""}
        ${overlayMode === "map" ? renderMap(collected, gameState) : ""}
        ${isTransitioning ? renderTravelFade(message) : ""}
      </div>
    `;

    createIcons({ icons });
  }

  function beginTravel(locationId: LocationId | undefined): void {
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

  function renderPrompt(): string {
    if (gameState.getStage() === "briefing") {
      return `<span class="prompt-muted">Read Snow's desk briefing, then begin fieldwork.</span>`;
    }

    if (gameState.getStage() === "board") {
      return `<span class="prompt-muted">The Board is considering temporary pump closure.</span>`;
    }

    if (gameState.getStage() === "complete") {
      return `<span class="prompt-muted">Late September records are open. Review evidence or reset the inquiry.</span>`;
    }

    if (!focusedHotspot) {
      if (
        gameState.getStage() === "field" &&
        gameState.getCurrentLocation().id === "snow-desk" &&
        !gameState.hasEvidence("snow-method")
      ) {
        return `<span class="prompt-muted">Look toward John Snow, then press Enter or select him.</span>`;
      }

      return `<span class="prompt-muted">Look toward an interview or evidence marker.</span>`;
    }

    if (
      focusedHotspot.id === "john-snow" &&
      gameState.getStage() === "synthesis" &&
      gameState.getCurrentLocation().id === "snow-desk"
    ) {
      return `
        <span class="prompt-title">John Snow</span>
        <span class="prompt-copy">Review the evidence against each possible theory.</span>
        <span class="prompt-state">Press Enter or select</span>
      `;
    }

    const inspected = gameState.hasInspected(focusedHotspot.id);
    const evidence = gameState.getEvidence(focusedHotspot.evidenceId);
    const recorded = evidence ? gameState.hasEvidence(evidence.id) : false;
    return `
      <span class="prompt-title">${escapeHtml(focusedHotspot.label)}</span>
      <span class="prompt-copy">${escapeHtml(focusedHotspot.description)}</span>
      <span class="prompt-state">${recorded ? "Recorded" : inspected ? "Interview open" : "Press Enter or select"}</span>
    `;
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
  const questionRows = gameState
    .getAvailableDialogueQuestions(dialogue)
    .map((question) => renderDialogueQuestion(question, gameState))
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
      <p class="dialogue-intro">${escapeHtml(dialogue.intro)}</p>
      <div class="question-list">
        ${questionRows}
      </div>
    </aside>
  `;
}

function renderDialogueQuestion(question: DialogueQuestion, gameState: GameState): string {
  const asked = gameState.hasAskedQuestion(question.id);
  const evidence = gameState.getQuestionEvidence(question);
  const collected = evidence ? gameState.hasEvidence(evidence.id) : false;
  return `
    <article class="question-card ${asked ? "is-asked" : ""}">
      <button class="question-button" data-action="ask" data-question-id="${escapeHtml(question.id)}">
        <span>${escapeHtml(question.prompt)}</span>
        <i data-lucide="${asked ? "rotate-ccw" : "message-circle-question"}"></i>
      </button>
      ${
        asked
          ? `<p>${escapeHtml(question.response)}</p>
             ${
               evidence
                 ? `<div class="question-evidence ${collected ? "is-collected" : ""}">
                    <i data-lucide="${collected ? "check-circle-2" : "circle"}"></i>
                    <span>${escapeHtml(collected ? `Recorded: ${evidence.title}` : evidence.title)}</span>
                  </div>`
                 : ""
             }`
          : ""
      }
    </article>
  `;
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

function renderChapterPanel(scene: ChapterScene, stage: ChapterStage, gameState: GameState): string {
  const body = gameState.getCurrentSceneBody().map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
  const boardFindings =
    stage === "board" || stage === "complete"
      ? `<ol class="findings-list">${gameState
          .getBoardFindings()
          .map((finding) => `<li>${escapeHtml(finding)}</li>`)
          .join("")}</ol>`
      : "";
  const preparedArgument = stage === "board" || stage === "complete" ? renderPreparedArgument(gameState) : "";

  const action =
    stage === "briefing"
      ? `<button class="primary-action wide-action" data-action="begin">
          <i data-lucide="footprints"></i>
          Begin field inquiry
        </button>`
      : stage === "board"
        ? `<button class="primary-action wide-action" data-action="finish-board">
            <i data-lucide="check-circle-2"></i>
            Continue after meeting
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
        ${preparedArgument}
        ${boardFindings}
      </div>
      <div class="chapter-actions">
        ${action}
      </div>
    </aside>
  `;
}

function renderPreparedArgument(gameState: GameState): string {
  const hypothesis = gameState.getSelectedHypothesis();
  if (!hypothesis) {
    return "";
  }

  return `
    <section class="argument-summary" aria-label="Prepared argument">
      <span>Prepared theory</span>
      <strong>${escapeHtml(hypothesis.title)}</strong>
      <p>${escapeHtml(gameState.synthesisConfidence ? gameState.getConfidenceLabel(gameState.synthesisConfidence) : "Confidence not stated")}</p>
      <p>${escapeHtml(gameState.getPreparedMapSummary())}</p>
    </section>
  `;
}

function renderNotebook(collected: EvidenceCard[], allEvidence: EvidenceCard[]): string {
  const readiness = evidenceReadinessText(collected.length);
  const evidenceRows = allEvidence
    .map((card) => {
      const unlocked = collected.some((collectedCard) => collectedCard.id === card.id);
      return `
        <article class="evidence-row ${unlocked ? "is-unlocked" : ""}">
          <div class="evidence-status">
            <i data-lucide="${unlocked ? "check-circle-2" : "circle-dot"}"></i>
          </div>
          <div>
            <h3>${escapeHtml(unlocked ? card.title : "Unrecorded evidence")}</h3>
            <p>${escapeHtml(unlocked ? card.summary : "Inspect the street scene to add this note.")}</p>
            ${
              unlocked
                ? `<div class="source-line">
                    <i data-lucide="${sourceIcon(card.sourceType)}"></i>
                    <span>${escapeHtml(card.sourceLabel)}</span>
                  </div>
                  <div class="tag-row">${card.supports
                    .map((tag) => `<span>${escapeHtml(tag)}</span>`)
                    .join("")}</div>`
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
          <small class="readiness-line ${collected.length >= boardThreshold ? "is-ready" : ""}">${escapeHtml(readiness)}</small>
        </div>
        <button class="icon-button" data-action="close" aria-label="Close notebook"><i data-lucide="x"></i></button>
      </div>
      <div class="panel-body evidence-list">
        ${evidenceRows}
      </div>
    </aside>
  `;
}

function evidenceReadinessText(collectedCount: number): string {
  const remaining = Math.max(boardThreshold - collectedCount, 0);
  if (remaining === 0) {
    return "Ready for Snow review";
  }

  return `${remaining} more ${remaining === 1 ? "card" : "cards"} needed for Snow review`;
}

function mapEvidenceReadinessText(collectedCount: number): string {
  if (collectedCount >= boardThreshold) {
    return `${collectedCount} collected; ready`;
  }

  return `${collectedCount}/${boardThreshold} for review`;
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

function renderSynthesisPanel(gameState: GameState): string {
  const selectedHypothesis = gameState.getSelectedHypothesis();
  const confidenceOptions: SynthesisConfidence[] = ["tentative", "proportionate", "overstated"];
  const canPrepare = Boolean(selectedHypothesis && gameState.synthesisConfidence);
  const hypothesisRows = gameState
    .getHypotheses()
    .map((hypothesis) => renderHypothesisCard(hypothesis, gameState, selectedHypothesis?.id === hypothesis.id))
    .join("");
  const confidenceRows = confidenceOptions
    .map((confidence) => {
      const active = gameState.synthesisConfidence === confidence;
      return `
        <button
          class="confidence-button ${active ? "is-selected" : ""}"
          data-action="set-confidence"
          data-confidence="${confidence}"
          aria-pressed="${active}"
        >
          ${escapeHtml(gameState.getConfidenceLabel(confidence))}
        </button>
      `;
    })
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
      <p class="synthesis-copy">${escapeHtml(gameState.getSnowSynthesisFeedback())}</p>
      ${renderSynthesisMapStrip(gameState)}
      <div class="synthesis-controls">
        <div class="confidence-row" aria-label="Confidence">
          ${confidenceRows}
        </div>
        <div class="synthesis-actions">
          <button class="primary-action wide-action" data-action="prepare-board" ${canPrepare ? "" : "disabled"}>
            <i data-lucide="clipboard-check"></i>
            Prepare Board argument
          </button>
        </div>
      </div>
      <div class="hypothesis-grid">
        ${hypothesisRows}
      </div>
    </aside>
  `;
}

function renderSynthesisMapStrip(gameState: GameState): string {
  const mappedFindings = gameState.getMappedEvidenceFindings();
  const findings = mappedFindings.length
    ? mappedFindings.map((finding) => `<li>${escapeHtml(finding)}</li>`).join("")
    : `<li class="is-empty">Map evidence appears as you collect addresses, returns, and exceptions.</li>`;

  return `
    <section class="synthesis-map-strip" aria-label="Map evidence summary">
      <div class="map-strip-heading">
        <i data-lucide="map-pinned"></i>
        <div>
          <span>Map evidence</span>
          <strong>Broad Street</strong>
        </div>
      </div>
      <ul>${findings}</ul>
      <button class="secondary-action" data-action="map">
        <i data-lucide="map"></i>
        Open map table
      </button>
    </section>
  `;
}

function renderHypothesisCard(
  hypothesis: HypothesisDefinition,
  gameState: GameState,
  selected: boolean,
): string {
  const { supporting, complicating } = gameState.getHypothesisEvidence(hypothesis);
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
        ${renderEvidenceFit("Supports", supporting, "supports")}
        ${renderEvidenceFit("Complicates", complicating, "complicates")}
      </div>
    </article>
  `;
}

function renderEvidenceFit(label: string, evidenceCards: EvidenceCard[], kind: "supports" | "complicates"): string {
  const items = evidenceCards.length
    ? evidenceCards.map((card) => `<li>${escapeHtml(card.title)}</li>`).join("")
    : `<li class="is-empty">${kind === "supports" ? "No recorded evidence yet" : "No major conflict recorded"}</li>`;

  return `
    <div class="fit-list is-${kind}">
      <span>${escapeHtml(label)}</span>
      <ul>${items}</ul>
    </div>
  `;
}

function renderMap(collected: EvidenceCard[], gameState: GameState): string {
  const collectedIds = new Set(collected.map((card) => card.id));
  const deathsVisible = shouldShowDeathLayer(collectedIds);

  const stage = gameState.getStage();
  const evidenceReady = gameState.hasEnoughEvidenceForSynthesis();
  const fieldAssigned = gameState.hasEvidence("snow-method");
  const canPresent = gameState.preparedForBoard && stage === "synthesis";
  const needsSnowReview = evidenceReady && !gameState.preparedForBoard && stage === "synthesis";
  const currentLocation = gameState.getCurrentLocation();
  const canUseMapPrimary = fieldAssigned && (canPresent || needsSnowReview);
  let actionText = "Need more support";
  let primaryLabel = "Gather more evidence";
  let primaryIcon = "circle-dot";
  let primaryCopy = "Collect more evidence before preparing a Board argument.";

  if (!fieldAssigned) {
    actionText = "Assignment needed";
    primaryLabel = "Talk to Snow first";
    primaryIcon = "message-circle";
    primaryCopy = "Snow has not sent you into the streets yet.";
  } else if (canPresent) {
    actionText = "Ready for Board";
    primaryLabel = "Present prepared argument";
    primaryIcon = "map-pin";
    primaryCopy = "Snow's theory is prepared for the Board.";
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
    .map((location) => renderLocationNode(location, gameState, currentLocation.id))
    .join("");
  const evidenceDocket = renderMapEvidenceDocket(gameState);
  const mappedFindings = gameState.getMappedEvidenceFindings();
  const mapFindings = mappedFindings.length
    ? mappedFindings.map((finding) => `<li>${escapeHtml(finding)}</li>`).join("")
    : `<li class="is-empty">No mapped evidence yet. Start with the pump observation.</li>`;

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
              ${renderCustomMapBase(collectedIds)}
            </svg>
            ${renderMapLegend(deathsVisible)}
            ${locationNodes}
          </div>
        </div>
        <div class="map-brief">
          <div class="layer-summary">
            <span>Map evidence</span>
            <p>Use the Broad Street map to travel between sources.</p>
          </div>
          <ul class="map-findings">
            ${mapFindings}
          </ul>
          <dl>
            <div><dt>Current place</dt><dd>${escapeHtml(currentLocation.shortTitle)}</dd></div>
            <div><dt>Evidence</dt><dd>${escapeHtml(mapEvidenceReadinessText(collected.length))}</dd></div>
            <div><dt>Snow review</dt><dd>${gameState.preparedForBoard ? "Prepared" : evidenceReady ? "Needed" : "Locked"}</dd></div>
            <div><dt>Action</dt><dd>${escapeHtml(actionText)}</dd></div>
          </dl>
          ${evidenceDocket}
        </div>
      </div>
    </aside>
  `;
}

function renderCustomMapBase(collectedIds: Set<string>): string {
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
    <g class="map-pump-highlights" aria-hidden="true">
      ${renderPumpHighlights()}
    </g>
  `;
}

function shouldShowDeathLayer(collectedIds: Set<string>): boolean {
  return collectedIds.has("attack-timeline") && collectedIds.has("pump-cluster");
}

function renderMapLegend(deathsVisible: boolean): string {
  return `
    <div class="map-legend" aria-label="Map legend">
      <span class="map-legend-item">
        <span class="map-legend-swatch is-pump"></span>
        Pumps
      </span>
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
  const boardReady = location.boardOnly && unlocked;
  const label = active
    ? `Current location: ${location.title}`
    : boardReady
      ? `${location.title} is ready; use Present prepared argument`
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

function getOffMapDirection(locationId: LocationId): "east" | "southwest" | "southeast" | undefined {
  if (locationId === "snow-desk") {
    return "east";
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
