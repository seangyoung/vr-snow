import { surveyRoutes, observation, type RouteId, type FieldworkView } from "./fieldwork";
import { days, dayDefinition, locationDay, chronologyNote, type InquiryDay, type ObjectiveId } from "./campaign";
import { conversations } from "./conversations";
import { ConversationProgress, type ConversationView } from "./conversations";
import {
  chapterScenes,
  dialogueNodes,
  evidenceCards,
  hotspots,
  hypothesisDefinitions,
  locations,
  locationEvidenceIds,
  locationInteractionHints,
} from "./content";
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
  InvestigationSnapshot,
  LocationId,
} from "./types";

type ChangeHandler = () => void;

export class GameState {
  private readonly conversations = new ConversationProgress();
  getConversationView(): ConversationView | undefined { return this.conversations.view(); }
  private activeSurvey?: string;
  private selectedRoute?: RouteId;
  private recordedRoutes = new Set<RouteId>();
  getRouteObservations() { return [...this.recordedRoutes].map(observation); }
  hasWalkingBoundary(): boolean { return this.recordedRoutes.size===surveyRoutes.length; }
  getFieldworkView(): FieldworkView | undefined {
    if(!this.activeSurvey)return undefined;
    const route=surveyRoutes.find(r=>r.id===this.selectedRoute);
    const choices=surveyRoutes.filter(r=>r.origin===this.activeSurvey);
    const canRecord=!!route && route.stop===this.activeSurvey && route.destination===this.currentLocationId && !this.recordedRoutes.has(route.id);
    return {title:choices.length?'Paired pump-access survey':'Pump survey stop',
      text:choices.length?'Select each route from this same marked origin. Use the map or marked world exits to visit its pump stop, then explicitly record the estimate. Compact scenes stand in for the intervening streets.':
        canRecord?`${route!.title}: about ${route!.metres} metres; ${route!.seconds} seconds at the teaching assumption of 1.2 m/s. Movement mode and elapsed playing time do not affect this estimate.`:
        'Return to the marked origin on Broad Street to select an unrecorded route. Each comparison uses a matched starting point.',
      routes:choices,canRecord,canConclude:this.hasWalkingBoundary() && this.currentLocationId==='broad-street',observations:this.getRouteObservations()};
  }
  startSurveyRoute(id: RouteId): boolean {
    const route=surveyRoutes.find(r=>r.id===id);
    if(this.day!==3 || !this.hasCurrentAssignment() || this.currentLocationId!=='broad-street' || route?.origin!==this.activeSurvey || this.recordedRoutes.has(id))return false;
    this.selectedRoute=id;this.activeSurvey=undefined;this.activeDialogueId=undefined;this.emitChange();return true;
  }
  recordSurveyRoute(): boolean {
    if(!this.getFieldworkView()?.canRecord || !this.selectedRoute)return false;
    this.recordedRoutes.add(this.selectedRoute);this.selectedRoute=undefined;this.emitChange();return true;
  }
  concludeSurvey(): boolean {
    if(!this.getFieldworkView()?.canConclude)return false;
    this.activeSurvey=undefined;this.conversations.open('walking-review');this.activeDialogueId='walking-review';this.emitChange();return true;
  }

  day: InquiryDay = 1;
  private assignedDays = new Set<InquiryDay>();
  private objectives = new Set<ObjectiveId>();
  private recaps = new Set<InquiryDay>();
  dayIntroOpen = true;
  getDay() { return dayDefinition(this.day); }
  getAssignments() { return this.getDay().objectives.map(item=>({...item,complete:this.objectives.has(item.id)})); }
  hasCurrentAssignment(): boolean { return this.assignedDays.has(this.day); }
  isDayFieldworkComplete(): boolean { return this.getDay().objectives.every(o=>this.objectives.has(o.id)); }
  canEndDay(): boolean { return this.day<3 && this.recaps.has(this.day) && this.currentLocationId==='snow-desk'; }
  getDayIntroduction(): string[] { const day=this.getDay(); return [
    `${day.date} · ${day.title}`,
    `Retrospective historical context: ${day.previousDeaths} deaths on ${day.previousDate}, from Snow’s 1855 Table I. These are deaths, not new attacks or instant registrar reports.`,
    ...(this.day===1?[chronologyNote]:[]),
    'Speak with Snow for today’s assignments. Earlier locations remain available after the first briefing.'
  ]; }
  dismissDayIntroduction(): void { this.dayIntroOpen=false; this.emitChange(); }
  endDay(): boolean {
    if(!this.canEndDay())return false;
    this.day=(this.day+1) as InquiryDay; this.dayIntroOpen=true;this.conversations.close();
    this.activeDialogueId=undefined;this.activeDialogueQuestionId=undefined;this.emitChange();return true;
  }
  chooseConversation(beatId: string, choiceId: string): void {
    const result=this.conversations.choose(beatId,choiceId);
    if(!result.advanced)return;
    const end=result.conclusion;
    if(end?.assignment || end?.assignmentDay) {
      this.assignedDays.add(end.assignmentDay??1);this.askedQuestions.add('snow-method-question');
    }
    if(end?.objective && this.hasCurrentAssignment() && this.getDay().objectives.some(o=>o.id===end.objective)) this.objectives.add(end.objective);
    if(end?.recapDay===this.day && this.isDayFieldworkComplete())this.recaps.add(this.day);
    if(end?.evidenceId && (end.objective ? this.objectives.has(end.objective) : end.recapDay ? this.recaps.has(end.recapDay) : false))this.collectedEvidence.add(end.evidenceId);
    if(this.day===3 && this.recaps.has(3) && this.stage==='field')this.stage='synthesis';
    if(end?.hearing && this.stage==='board' && this.preparedForBoard)this.boardPresented=true;
    this.emitChange();
  }

  private inspectedHotspots = new Set<string>();
  private collectedEvidence = new Set<string>();
  private askedQuestions = new Set<string>();
  private changeHandlers = new Set<ChangeHandler>();
  private activeDialogueQuestionId?: string;
  stage: ChapterStage = "field";
  currentLocationId: LocationId = "snow-desk";
  activeDialogueId?: string;
  selectedHypothesisId?: HypothesisId;
  preparedForBoard = false;
  boardPresented = false;

  inspectHotspot(hotspotId: string): { dialogue?: DialogueNode; message: string } {
    const hotspot=this.getHotspot(hotspotId);
    if(!hotspot || hotspot.locationId!==this.currentLocationId || this.stage==='complete')return {message:'That person or object is not here.'};
    this.activeSurvey=undefined;
    if(hotspotId.startsWith('survey-')) {
      if(this.day!==3 || !this.hasCurrentAssignment())return {message:'The pump-access exercise is assigned on September 7.'};
      this.conversations.close();this.activeSurvey=hotspotId;this.activeDialogueId='fieldwork';this.emitChange();return {dialogue:this.getActiveDialogue(),message:'Survey stop opened.'};
    }
    let id: string | undefined;
    if(hotspotId==='john-snow') {
      if(!this.hasCurrentAssignment())id=this.day===1?'snow-introduction':`snow-day-${this.day}`;
      else if(this.isDayFieldworkComplete())id=`snow-recap-${this.day}`;
      else return {message:this.getObjective()};
    } else if(hotspotId==='whitehead')id=this.day===1?'whitehead-local-knowledge':`whitehead-day-${this.day}`;
    else if(hotspotId==='resident-west'||hotspotId==='resident-east')id=`${hotspotId}-day-${this.day}`;
    else if(hotspotId==='board-hearing') { this.beginHearing();return {dialogue:this.getActiveDialogue(),message:'The Board awaits your response.'}; }
    else {
      const source: Record<string,string>={'registrar-ledger':'registrar-records','broad-street-household':'household-first',
        'broad-street-pump':'pump-sample','routines-household':'household-routines','away-household':'household-away',
        'poland-workhouse':'workhouse-supply','broad-street-brewery':'brewery-supply'};
      id=source[hotspotId];
      const graph=conversations.find(c=>c.id===id),objective=graph?.beats.find(b=>b.conclusion?.objective)?.conclusion?.objective;
      const assigned=days.find(d=>d.objectives.some(o=>o.id===objective));
      if(assigned && (assigned.day>this.day || !this.hasCurrentAssignment()))return {message:'This inquiry belongs to a later assignment. Speak with Snow about today’s work.'};
    }
    if(!id)return {message:'No conversation is available here.'};
    this.inspectedHotspots.add(hotspotId);this.conversations.open(id);this.activeDialogueId=id;
    this.activeDialogueQuestionId=undefined;this.emitChange();return {dialogue:this.getActiveDialogue(),message:'Conversation opened.'};
  }

  /** Old single-question rewards are retired; all rewards pass through graph conclusions. */
  askQuestion(_questionId: string): {evidence?: EvidenceCard;response?:string;message:string} {
    return {message:'Speak with the witness and complete the conversation to record the finding.'};
  }

  getObjective(): string {
    if(this.stage==='complete')return 'Read the epilogue or revisit your evidence in the Field Notebook.';
    if(this.stage==='board')return this.boardPresented?'Presentation complete. Read the Board’s decision.':'Explore the room, then begin or resume the hearing.';
    if(this.selectedRoute){const route=surveyRoutes.find(r=>r.id===this.selectedRoute)!;return `${route.title}: visit the marked pump survey stop and record the route. Return to the origin for the paired route.`;}
    if(this.preparedForBoard)return 'Attend the meeting from Snow’s review panel.';
    if(this.hasEnoughEvidenceForSynthesis())return 'Review the theories with Snow and prepare the Board argument.';
    if(!this.hasCurrentAssignment())return `Day ${this.day}: speak with Snow for today’s assignments.`;
    if(this.isDayFieldworkComplete())return this.recaps.has(this.day)?'Today’s review is complete. Return to Snow and choose End day when ready.':'Today’s fieldwork is complete. Return to Snow for the recap; exploration remains available.';
    return `Day ${this.day}: ${this.getAssignments().filter(o=>!o.complete).map(o=>o.title).join(' · ')}.`;
  }

  getCollectedEvidence(): EvidenceCard[] {
    return evidenceCards.filter((card) => this.collectedEvidence.has(card.id));
  }

  getAllEvidence(): EvidenceCard[] {
    return evidenceCards;
  }

  getMissingEvidencePrompt(card: EvidenceCard): string {
    const assignment=days.find(d=>d.objectives.some(o=>o.evidence===card.id));
    if(assignment && assignment.day>this.day)return `Assigned on day ${assignment.day}: ${assignment.title}.`;
    const location = this.getEvidenceLocation(card.id);

    if (!location) {
      return "Find the matching source location to add this note.";
    }

    const prompt = this.getLocationEvidencePrompt(card, location);

    if (location.unlocksWith && !this.hasEvidence(location.unlocksWith)) {
      const prerequisiteLocation = this.getEvidenceLocation(location.unlocksWith);
      const prerequisite = prerequisiteLocation ? ` at ${prerequisiteLocation.title}` : "";
      return `First follow the related lead${prerequisite}; then ${lowercaseFirst(prompt)}`;
    }

    return prompt;
  }

  getCurrentScene(): ChapterScene {
    return chapterScenes.find((scene) => scene.id === this.stage) ?? chapterScenes[0];
  }

  getCurrentSceneBody(): string[] {
    const scene = this.getCurrentScene();
    const hypothesis = this.getSelectedHypothesis();

    if (this.stage === "board" && !this.boardPresented) {
      return ["The Guardians await the presentation. You may look around before beginning.",
        "This room and the three unnamed officials are an interpretation inspired by the original panorama, not a documented reconstruction."];
    }
    if (this.stage === "board" && hypothesis) {
      if (hypothesis.id === "waterborne") {
        return [
          `Historical course: Snow argues for a waterborne explanation. Our prepared theory is ${hypothesis.title}; the case supports precaution without claiming final proof.`,
          `Recommended action: ${hypothesis.boardAction}`,
        ];
      }

      return [
        `Alternate teaching conclusion: we have chosen ${hypothesis.title}. This differs from Snow’s historical recommendation; he tests it against the evidence that remains unexplained.`,
        `Recommended action: ${hypothesis.boardAction}`,
        "The pump handle case is not yet strong under this theory, so Snow urges more inquiry before a pump-specific intervention.",
      ];
    }

    if (this.stage === "complete" && hypothesis) {
      if (hypothesis.id === "waterborne") {
        return [
          "Historical outcome: the pump handle was removed on September 8. The outbreak was already declining, so its decline cannot by itself establish the effect of removing the handle.",
          "Whitehead later helped trace the household at 40 Broad Street, and parish investigators examined defective drainage beside the well. That later work strengthened the water explanation; it was not part of the immediate evidence presented here.",
        ];
      }

      return [
        "Alternate course — a fictional teaching outcome: the Board delays pump-specific action. We cannot know how many additional illnesses that decision would have caused; this is not a historical second outbreak or a prediction.",
        "In the later historical inquiry, Whitehead and parish investigators traced contamination associated with 40 Broad Street and the well. Those findings belong to the epilogue, not to the evidence available during this compressed inquiry.",
      ];
    }

    return scene.body;
  }

  getStage(): ChapterStage {
    return this.stage;
  }

  beginFieldwork(): void {
    this.stage = "field";
    this.currentLocationId = "broad-street";
    this.activeDialogueId = undefined;
    this.activeDialogueQuestionId = undefined;
    this.emitChange();
  }

  presentToBoard(): { accepted: boolean; message: string } {
    if (!this.preparedForBoard) {
      return {
        accepted: false,
        message: this.hasEnoughEvidenceForSynthesis()
          ? "Snow asks us to prepare a theory at his desk before going to the Board."
          : "Complete the three days of assignments and Snow’s reviews first.",
      };
    }

    this.stage = "board";
    this.currentLocationId = "board-room";
    this.activeDialogueId = undefined;
    this.activeDialogueQuestionId = undefined;
    this.boardPresented = false;
    this.conversations.close();
    this.emitChange();
    return {
      accepted: true,
      message: "Arrived at the Board room. Begin the hearing when you are ready.",
    };
  }

  /** Preview-only room inspection, with no evidence or hearing credit. */
  previewBoardRoom(): void {
    this.closeDialogue();
    this.dayIntroOpen=false;this.startupOpen=false;
    this.stage = "board"; this.currentLocationId = "board-room";
    this.boardPresented = false;
    this.emitChange();
  }

  beginHearing(): void {
    if (this.stage !== "board" || !this.preparedForBoard || !this.selectedHypothesisId) return;
    this.conversations.open("board-hearing");this.activeDialogueId="board-hearing";
    this.emitChange();
  }

  finishBoard(): void {
    if (this.stage !== "board" || !this.boardPresented) return;
    this.conversations.close();
    this.stage = "complete";
    this.currentLocationId = "board-room";
    this.activeDialogueId = undefined;
    this.activeDialogueQuestionId = undefined;
    this.emitChange();
  }

  travelToLocation(locationId: LocationId): { traveled: boolean; message: string } {
    const location = this.getLocation(locationId);
    if (!location) {
      return { traveled: false, message: "That location is not on the inquiry map." };
    }

    if (!this.canTravelToLocation(locationId)) {
      return { traveled: false, message: `${location.title} is not available for field travel yet.` };
    }

    this.activeSurvey=undefined;
    this.conversations.close();
    this.currentLocationId = locationId;
    this.activeDialogueId = undefined;
    this.activeDialogueQuestionId = undefined;
    this.emitChange();
    return {
      traveled: true,
      message:
        locationId === "snow-desk" && this.stage === "synthesis" && !this.preparedForBoard
          ? "Returned to Snow's Desk. Test the evidence against the possible theories."
          : `Arrived at ${location.title}.`,
    };
  }

  closeDialogue(): void {
    this.activeSurvey=undefined;
    this.conversations.close();
    this.activeDialogueId = undefined;
    this.activeDialogueQuestionId = undefined;
    this.emitChange();
  }

  clearActiveDialogueAnswer(): void {
    if (!this.activeDialogueQuestionId) {
      return;
    }

    this.activeDialogueQuestionId = undefined;
    this.emitChange();
  }

  selectHypothesis(hypothesisId: HypothesisId): { selected: boolean; message: string } {
    const hypothesis = this.getHypothesis(hypothesisId);
    if (!hypothesis) {
      return { selected: false, message: "That theory is not on Snow's board." };
    }

    this.selectedHypothesisId = hypothesis.id;
    this.preparedForBoard = false;
    this.emitChange();
    return { selected: true, message: `${hypothesis.title} selected for Snow's review.` };
  }

  prepareBoardArgument(): { prepared: boolean; message: string } {
    if (!this.hasEnoughEvidenceForSynthesis()) {
      return { prepared: false, message: "Complete the three days of assignments and recaps before synthesis." };
    }

    if (this.currentLocationId !== "snow-desk") {
      return { prepared: false, message: "Return to Snow's Desk before preparing the Board argument." };
    }

    if (!this.selectedHypothesisId) {
      return { prepared: false, message: "Choose the theory that best fits the evidence." };
    }

    this.preparedForBoard = true;
    this.stage = "synthesis";
    this.emitChange();
    return {
      prepared: true,
      message:
        this.selectedHypothesisId === "waterborne"
          ? "Snow accepts the argument: strong enough for temporary pump closure, not final proof."
          : "Snow records the argument, including the evidence it still struggles to explain.",
    };
  }

  getBoardFindings(): string[] {
    const hypothesis = this.getSelectedHypothesis();
    if (!hypothesis) return [];
    const review = this.getHypothesisReview(hypothesis);
    return [
      `For: ${review.supporting?.text ?? "No supporting evidence recorded yet."}`,
      `Against / limits: ${review.complicating?.text ?? "No challenge recorded yet; this is not proof."}`,
    ];
  }

  getMappedEvidenceFindings(): string[] {
    const findings: string[] = [];

    if (this.hasEvidence("pump-cluster")) {
      findings.push("Deaths cluster around the Broad Street pump.");
    }

    if (this.hasEvidence("household-exposure")) {
      findings.push("A household interview ties one death mark to water use, attack timing, and close care.");
    }

    if (this.hasEvidence("household-water-pattern")) {
      findings.push("A second composite household links water choice to preference and errands; it is not a population tally.");
    }

    if (this.hasEvidence("pump-water-inspection")) {
      findings.push("The pump-water sample gives no decisive visible proof of danger.");
    }

    if (this.hasEvidence("attack-timeline")) {
      findings.push("Registrar death returns add timing: fatal attacks rose and fell suddenly, not as a slow chain alone.");
    }

    if (this.hasEvidence("workhouse-exception")) {
      findings.push("The St. James Workhouse near Broad Street held over 500 inmates, had very few deaths, and had its own water supply.");
    }

    if (this.hasEvidence("brewery-exception")) {
      findings.push("The Lion Brewery on Broad Street had no deaths, and did not rely on the Broad Street pump.");
    }

    if(this.hasEvidence("nonlocal-exposure"))findings.push("A distant residence can be connected to exposure near Broad Street.");
    if(this.hasEvidence("walking-access"))findings.push("Walking access describes convenience, not actual consumption; the revealed boundary is historical.");
    return findings;
  }

  getHotspots(): Hotspot[] {
    if (this.stage !== "field" && this.stage !== "synthesis" && this.stage !== "board") {
      return [];
    }

    return hotspots.filter((hotspot) => hotspot.locationId === this.currentLocationId && (!hotspot.id.startsWith("survey-") || this.day===3 && this.hasCurrentAssignment()));
  }

  getAllHotspots(): Hotspot[] {
    return hotspots;
  }

  getHotspot(id: string): Hotspot | undefined {
    return hotspots.find((hotspot) => hotspot.id === id);
  }

  getDialogueForLocation(locationId: LocationId): DialogueNode | undefined {
    return dialogueNodes.find((dialogue) => dialogue.locationId === locationId);
  }

  private conversationDialogue(): DialogueNode | undefined {
    const view = this.getConversationView();
    return view ? {id: view.id, locationId: this.currentLocationId, speaker: view.speaker,
      role: view.title, intro: view.text, questions: []} : undefined;
  }

  getActiveDialogue(): DialogueNode | undefined {
    const survey=this.getFieldworkView();if(survey)return {id:'fieldwork',locationId:this.currentLocationId,speaker:survey.title,role:'Walking-access fieldwork',intro:survey.text,questions:[]};
    if (this.getConversationView()) return this.conversationDialogue();
    return this.activeDialogueId ? dialogueNodes.find((dialogue) => dialogue.id === this.activeDialogueId) : undefined;
  }

  getActiveDialogueAnswer():
    | { dialogue: DialogueNode; question: DialogueQuestion; evidence?: EvidenceCard }
    | undefined {
    const dialogue = this.getActiveDialogue();
    if (!dialogue || !this.activeDialogueQuestionId) {
      return undefined;
    }

    const question = dialogue.questions.find((candidate) => candidate.id === this.activeDialogueQuestionId);
    if (!question) {
      return undefined;
    }

    return {
      dialogue,
      question,
      evidence: this.getQuestionEvidence(question),
    };
  }

  getAvailableDialogueQuestions(dialogue: DialogueNode): DialogueQuestion[] {
    return dialogue.questions.filter(
      (question) => this.isDialogueQuestionAvailable(question) && !this.askedQuestions.has(question.id),
    );
  }

  hasAskedQuestion(questionId: string): boolean {
    return this.askedQuestions.has(questionId);
  }

  getQuestionEvidence(question: DialogueQuestion): EvidenceCard | undefined {
    return question.unlocksEvidenceId ? this.getEvidence(question.unlocksEvidenceId) : undefined;
  }

  getHypotheses(): HypothesisDefinition[] {
    return hypothesisDefinitions;
  }

  getHypothesis(id: HypothesisId): HypothesisDefinition | undefined {
    return hypothesisDefinitions.find((hypothesis) => hypothesis.id === id);
  }

  getSelectedHypothesis(): HypothesisDefinition | undefined {
    return this.selectedHypothesisId ? this.getHypothesis(this.selectedHypothesisId) : undefined;
  }

  getHypothesisReview(hypothesis: HypothesisDefinition) {
    return {
      supporting: hypothesis.supportingEvidence.find(point => point.evidenceIds.every(id => this.hasEvidence(id))),
      complicating: hypothesis.complicatingEvidence.find(point => point.evidenceIds.every(id => this.hasEvidence(id))),
    };
  }

  getInteractionHint(): string {
    if(this.stage==='complete')return 'The inquiry is complete. Open the chapter panel for the epilogue or the notebook to review your evidence.';
    if (this.currentLocationId === "board-room" && !this.boardPresented) return "Walk around the table. Open the chapter panel when ready to begin.";
    return locationInteractionHints[this.currentLocationId];
  }

  getCurrentLocation(): InvestigationLocation {
    return this.getLocation(this.currentLocationId) ?? locations[0];
  }

  getLocations(): InvestigationLocation[] {
    return locations;
  }

  getLocation(id: LocationId): InvestigationLocation | undefined {
    return locations.find((location) => location.id === id);
  }

  getUnlockedLocations(): InvestigationLocation[] {
    return locations.filter((location) => this.isLocationUnlocked(location));
  }

  canTravelToLocation(id: LocationId): boolean {
    const location = this.getLocation(id);
    if (!location || location.boardOnly || this.stage === "briefing" || this.stage === "board") {
      return false;
    }

    if (!this.hasFieldAssignment()) {
      return location.id === "snow-desk";
    }

    return this.isLocationUnlocked(location);
  }

  isLocationUnlocked(location: InvestigationLocation): boolean {
    if (location.boardOnly) {
      return this.preparedForBoard || this.boardPresented || this.stage === "complete";
    }

    if (this.stage === "briefing") {
      return location.id === "snow-desk";
    }

    if (!this.hasFieldAssignment()) {
      return location.id === "snow-desk";
    }

    if ((locationDay[location.id]??1)>this.day)return false;
    if (location.unlocksWith) {
      return this.hasEvidence(location.unlocksWith);
    }

    return true;
  }

  getEvidence(id: string): EvidenceCard | undefined {
    return evidenceCards.find((card) => card.id === id);
  }

  private getEvidenceLocation(evidenceId: string): InvestigationLocation | undefined {
    const locationEntry = Object.entries(locationEvidenceIds).find(([, evidenceIds]) => evidenceIds?.includes(evidenceId));
    return locationEntry ? this.getLocation(locationEntry[0] as LocationId) : undefined;
  }

  private getLocationEvidencePrompt(card: EvidenceCard, location: InvestigationLocation): string {
    if (card.id === "household-water-pattern") {
      return `Interview the householder at ${location.title} about water preferences and routines.`;
    }

    if (card.sourceType === "interview") {
      return `Interview witnesses at ${location.title} to add this note.`;
    }

    if (card.sourceType === "document") {
      return `Review records at ${location.title} to add this note.`;
    }

    if (card.sourceType === "observation") {
      return `Inspect ${location.title} to add this note.`;
    }

    if (location.id === "snow-desk") {
      return "Speak with Snow at his desk to add this note.";
    }

    return `Go to ${location.title} to add this note.`;
  }

  hasEvidence(id: string): boolean {
    return this.collectedEvidence.has(id);
  }

  hasFieldAssignment(): boolean {
    return this.askedQuestions.has("snow-method-question");
  }

  private isDialogueQuestionAvailable(question: DialogueQuestion): boolean {
    return (question.requiresEvidenceIds ?? []).every((evidenceId) => this.hasEvidence(evidenceId));
  }

  hasEnoughEvidenceForSynthesis(): boolean {
    return this.day===3 && this.recaps.has(3) && days.every(d=>d.objectives.every(o=>this.objectives.has(o.id)));
  }

  hasInspected(hotspotId: string): boolean {
    return this.inspectedHotspots.has(hotspotId);
  }

  getProgressText(): string {
    return `Day ${this.day} · ${this.getAssignments().filter(o=>o.complete).length}/${this.getAssignments().length}`;
  }

  getSnapshot(): InvestigationSnapshot {
    return {
      inspectedHotspots: new Set(this.inspectedHotspots),
      collectedEvidence: new Set(this.collectedEvidence),
      askedQuestions: new Set(this.askedQuestions),
      selectedHypothesisId: this.selectedHypothesisId,
      preparedForBoard: this.preparedForBoard,
      stage: this.stage,
      currentLocationId: this.currentLocationId,
    };
  }

  onChange(handler: ChangeHandler): () => void {
    this.changeHandlers.add(handler);
    return () => this.changeHandlers.delete(handler);
  }

  reset(): void {
    this.startupOpen=false;this.pendingSave=undefined;this.recordedRoutes.clear();this.selectedRoute=undefined;this.activeSurvey=undefined;
    this.conversations.reset();this.day=1;this.assignedDays.clear();this.objectives.clear();this.recaps.clear();this.dayIntroOpen=true;
    this.inspectedHotspots.clear();
    this.collectedEvidence.clear();
    this.askedQuestions.clear();
    this.stage = "field";
    this.currentLocationId = "snow-desk";
    this.activeDialogueId = undefined;
    this.activeDialogueQuestionId = undefined;
    this.selectedHypothesisId = undefined;
    this.preparedForBoard = false;
    this.boardPresented = false;
    this.emitChange();
  }

  startupOpen = false;
  saveNotice = '';
  private storage?: Pick<Storage,'getItem'|'setItem'|'removeItem'>;
  private saveKey = '';
  private pendingSave?: string;
  get hasSavedInquiry(): boolean { return !!this.pendingSave; }
  configurePersistence(storage: Pick<Storage,'getItem'|'setItem'|'removeItem'> | undefined, basePath: string): void {
    this.storage=storage;this.saveKey=`broad-street-inquiry:v1:${basePath}`;this.startupOpen=true;
    try {
      const saved=storage?.getItem(this.saveKey);
      if(saved) {
        const probe=new GameState();
        if(probe.restoreSave(saved))this.pendingSave=saved;
        else this.saveNotice='The saved inquiry could not be read. Start a new inquiry.';
      }
      if(!storage)this.saveNotice='Local saving is unavailable; you can still play this session.';
    } catch { this.storage=undefined;this.saveNotice='Local saving is unavailable; you can still play this session.'; }
  }
  continueInquiry(): boolean {
    if(!this.pendingSave || !this.restoreSave(this.pendingSave))return false;
    this.pendingSave=undefined;this.startupOpen=false;this.emitChange();return true;
  }
  serializeSave(): string {
    return JSON.stringify({version:1,day:this.day,location:this.currentLocationId,stage:this.stage,
      conversation:this.conversations.serialize(),hypothesis:this.selectedHypothesisId,
      prepared:this.preparedForBoard,dayIntro:this.dayIntroOpen,routes:[...this.recordedRoutes],selectedRoute:this.selectedRoute});
  }
  restoreSave(json: string): boolean {
    try {
      const value=JSON.parse(json);
      if(value?.version!==1 || ![1,2,3].includes(value.day) || !this.getLocation(value.location)
        || !['field','synthesis','board','complete'].includes(value.stage) || typeof value.prepared!=='boolean'
        || typeof value.dayIntro!=='boolean' || (value.hypothesis!==undefined && !this.getHypothesis(value.hypothesis)))return false;
      if(!Array.isArray(value.routes) || new Set(value.routes).size!==value.routes.length || !value.routes.every((id:unknown)=>surveyRoutes.some(r=>r.id===id)) || (value.selectedRoute!==undefined && !surveyRoutes.some(r=>r.id===value.selectedRoute)))return false;
      if(value.day!==3 && (value.routes.length || value.selectedRoute))return false;
      const progress=new ConversationProgress();if(!progress.restore(value.conversation))return false;
      const objectives=new Set<ObjectiveId>(),assigned=new Set<InquiryDay>(),recaps=new Set<InquiryDay>(),evidence=new Set<string>();
      let hearing=false;
      for(const graph of conversations)if(progress.hasCompleted(graph.id)) {
        const end=graph.beats.find(b=>b.conclusion!==undefined)!.conclusion!;
        if(end.assignment)assigned.add(1);if(end.assignmentDay)assigned.add(end.assignmentDay);
        if(end.objective)objectives.add(end.objective);if(end.recapDay)recaps.add(end.recapDay);
        if(end.evidenceId)evidence.add(end.evidenceId);if(end.hearing)hearing=true;
      }
      for(const day of days) {
        if(day.day>value.day && (assigned.has(day.day)||recaps.has(day.day)||day.objectives.some(o=>objectives.has(o.id))))return false;
        if(day.day<value.day && !recaps.has(day.day))return false;
        if(recaps.has(day.day) && (!assigned.has(day.day)||!day.objectives.every(o=>objectives.has(o.id))))return false;
        if(day.objectives.some(o=>objectives.has(o.id)) && !assigned.has(day.day))return false;
      }
      if(objectives.has("walking-access") && value.routes.length!==surveyRoutes.length)return false;
      const ready=recaps.has(3);
      if(value.prepared && (!ready||!value.hypothesis))return false;
      if(['board','complete'].includes(value.stage) && (!value.prepared||value.location!=='board-room'))return false;
      if(value.stage==='complete'&&!hearing)return false;
      if(hearing&&!['board','complete'].includes(value.stage))return false;
      if((value.routes.length||value.selectedRoute)&&!assigned.has(3))return false;
      if(value.selectedRoute&&value.routes.includes(value.selectedRoute))return false;
      if(value.stage==='synthesis'&&!ready)return false;
      if((locationDay[value.location as LocationId]??1)>value.day || (!assigned.has(1) && value.location!=='snow-desk'))return false;
      // Commit only after full validation; callers can retain their current session on failure.
      this.conversations.restore(value.conversation);this.day=value.day;this.currentLocationId=value.location;
      this.stage=value.stage;this.objectives=objectives;this.recaps=recaps;this.assignedDays=assigned;this.collectedEvidence=evidence;
      this.askedQuestions=new Set(assigned.has(1)?['snow-method-question']:[]);this.inspectedHotspots.clear();
      this.selectedHypothesisId=value.hypothesis;this.preparedForBoard=value.prepared;this.boardPresented=hearing;
      this.recordedRoutes=new Set(value.routes);this.selectedRoute=value.selectedRoute;this.activeSurvey=undefined;
      this.dayIntroOpen=value.dayIntro;this.activeDialogueId=undefined;this.activeDialogueQuestionId=undefined;
      return true;
    } catch { return false; }
  }

  private emitChange(): void {
    if(this.storage && !this.startupOpen)try { this.storage.setItem(this.saveKey,this.serializeSave()); } catch { this.saveNotice="Progress could not be saved; this session is still playable."; }
    this.changeHandlers.forEach((handler) => handler());
  }
}

function lowercaseFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}
