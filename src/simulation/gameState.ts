import { streetPlacement, streetExtras } from './streetPopulation';
import { surveyRoutes, observation, pumpJourneys, routePoint, nearestRouteFraction, walkingTime, type SurveyProgress, type GuidedSurveyView, type RouteId, type FieldworkView } from "./fieldwork";
import { days, dayDefinition, locationDay, chronologyNote, type InquiryDay, type ObjectiveId } from "./campaign";
import { waterSamples, sampleConversation } from './waterSamples';
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
  getConversationView(): ConversationView | undefined {
    let view=this.conversations.view();
    if(view?.id==='snow-progress' && view.beatId==='reminder') {
      const remaining=this.getAssignments().filter(item=>!item.complete).map(item=>item.title.toLowerCase());
      const tasks=remaining.length>1?`${remaining.slice(0,-1).join(', ')}, and ${remaining.at(-1)}`:remaining[0];
      view={...view,text:`Please ${tasks}. Bring your notes back this evening, and we’ll discuss what you found.`};
    }
    if(view?.id==='board-hearing' && this.selectedHypothesisId!=='waterborne') {
      const hypothesis=this.getSelectedHypothesis();
      if(hypothesis && view.beatId==='recommendation')view={...view,choices:view.choices.map(choice=>({...choice,label:`Recommend instead: ${hypothesis.boardAction}`}))};
      if(view.beatId==='snow-response')view={...view,text:'I cannot agree. These accounts still point to the Broad Street water. I ask the Guardians to close the pump, whatever other measures they undertake.'};
      if(hypothesis && view.beatId==='conclusion')view={...view,text:`We are persuaded by your recommendation to ${hypothesis.boardAction.charAt(0).toLowerCase()+hypothesis.boardAction.slice(1)} Despite Dr. Snow’s objection, we shall leave the pump in use.`};
    }
    const placement=view && streetPlacement(this.day,view.actorId);
    if(view && placement)view={...view,anchor:[placement.position[0],1.45,placement.position[2]]};
    if(view?.complete && ((view.id==='workhouse-sample' && this.hasEvidence('pump-water-inspection')) || (view.id==='pump-sample' && this.hasWorkhouseSample())))
      return {...view,text:this.getWaterSampleObservations().length>1
        ? 'The workhouse sample looks clear; Broad Street has shown small changes in visible material. Neither inspection gives a decisive explanation for the difference in illness. You record both observations.'
        : 'The workhouse sample looks clear. Neither it nor the Broad Street sample gives a decisive explanation for the difference in illness. You record both observations.'};
    return view;
  }
  private legacyManufactoryWaiver=false;
  private activeSurvey?: string;
  private surveyProgress?: SurveyProgress;
  fieldworkTravelRevision = 0;
  canResumePumpComparison(): boolean { return this.day===3 && this.assignedDays.has(3) && !this.dayIntroOpen && !this.startupOpen && this.stage==='field' && !this.objectives.has('walking-access'); }
  getPumpComparisonLabel(): string { return this.surveyProgress ? 'Resume Snow’s map comparison' : 'Join Snow at the map table'; }
  // Retained for older movement consumers; the comparison now stays in the office.
  getSurveyOrigin(): string | undefined { return undefined; }
  getFieldworkSpawn(): [number,number,number] | undefined { return undefined; }
  private openGuidedSurvey(): void {
    this.conversations.close();this.activeSurvey='guided';this.activeDialogueId='fieldwork';
  }
  resumePumpComparison(): boolean {
    if(!this.canResumePumpComparison())return false;
    if(!this.surveyProgress) {
      const pair=surveyRoutes.slice(0,2).every(r=>this.recordedRoutes.has(r.id))?'rupert':'marlborough';
      this.surveyProgress={routeId:`${pair}-broad`,phase:this.recordedRoutes.size===4?'done':'origin'};
    }
    this.selectedRoute=undefined;
    if(this.currentLocationId!=='snow-desk'){this.currentLocationId='snow-desk';this.fieldworkTravelRevision++;}
    this.openGuidedSurvey();this.emitChange();return true;
  }
  private guidedSurveyView(): GuidedSurveyView | undefined {
    const progress=this.surveyProgress;if(!progress)return undefined;
    const route=surveyRoutes.find(r=>r.id===progress.routeId)!,journey=pumpJourneys.find(j=>j.id===route.pair)!;
    const alternative=journey.pumpLabel;
    const fraction=(progress.marker??1)/4,point=routePoint(route.pair,progress.phase==='origin'?0:fraction);
    const base: GuidedSurveyView={key:`${progress.routeId}:${progress.phase}:${progress.marker??0}`,title:'Find an equal-distance point',progress:`Snow’s map table · Journey ${route.pair==='marlborough'?1:2} of 2`,
      mapPumps:[{x:journey.polyline[0][0],y:journey.polyline[0][1],label:'Broad St pump'},{x:journey.polyline.at(-1)![0],y:journey.polyline.at(-1)![1],label:alternative+' pump'}],
      mapPoint:{x:point[0],y:point[1],label:progress.phase==='origin'?'Start here':progress.phase==='feedback'?'Halfway':'Your marker'},
      results:[],text:'',actions:[]};
    if(progress.phase==='done')return {...base,title:'Beyond the pump service area',progress:'Snow’s map table · A new question',
      mapPumps:[],mapPoint:{...this.getLocation('household-away')!.mapPoint,label:'Household 3'},
      text:'These are two examples. I checked the surrounding pumps and the nearest streets to each point; the green line brings those comparisons together. Household 3 lies outside it, yet someone there has fallen ill. Could they have used Broad Street water?',actions:[{id:'discuss',label:'Ask Snow about Household 3'}]};
    if(progress.phase==='origin')return {...base,title:`Broad Street to ${alternative}`,
      text:`I measured to all the nearby public pumps. For this example, start at Broad Street and follow the streets to ${alternative}.`,
      actions:[{id:'trace',label:'Trace the street route'}]};
    base.mapPolyline=journey.polyline;
    base.results=[{label:'Back to Broad Street',time:`${Math.round(journey.metres*fraction)} m · ${walkingTime(Math.round(journey.seconds*fraction))}`},
      {label:`On to ${alternative}`,time:`${Math.round(journey.metres*(1-fraction))} m · ${walkingTime(Math.round(journey.seconds*(1-fraction)))}`}];
    if(progress.phase==='compare')return {...base,markerFraction:fraction,
      text:`The whole journey is ${journey.metres} metres (${walkingTime(journey.seconds)}). Grab the red marker and slide it along the route until the two walks balance.`,
      actions:progress.marker===2?[{id:'mark',label:'Mark this equal-distance point'}]:[]};
    return {...base,text:'Here the distance is equal in either direction along this route. To draw a boundary, I must also check the nearest streets and the other pumps—not merely join two marks.',
      actions:[{id:route.pair==='marlborough'?'next':'finish',label:route.pair==='marlborough'?'Explore the Bridle Lane journey':'Show Snow’s full pump service area'}]};
  }
  movePumpMarker(fraction:number): boolean {
    const progress=this.surveyProgress;
    if(!Number.isFinite(fraction) || !this.canResumePumpComparison() || this.activeSurvey!=='guided' || progress?.phase!=='compare')return false;
    // A small magnetic capture makes equality attainable with a controller ray.
    const clamped=Math.max(0,Math.min(1,fraction));
    const marker=Math.abs(clamped-.5)<=.015?2:Math.round(clamped*4000)/1000;
    if(progress.marker===marker)return false;
    progress.marker=marker;this.emitChange();return true;
  }
  dragPumpMarker(x:number,y:number): boolean {
    if(!Number.isFinite(x)||!Number.isFinite(y)||!this.surveyProgress)return false;
    const route=surveyRoutes.find(r=>r.id===this.surveyProgress!.routeId)!;
    return this.movePumpMarker(nearestRouteFraction(route.pair,x,y));
  }
  advancePumpComparison(action: string, expectedStep?: string): boolean {
    if(!this.canResumePumpComparison() || !this.activeSurvey || !this.surveyProgress)return false;
    const progress=this.surveyProgress,route=surveyRoutes.find(r=>r.id===progress.routeId)!;
    if(expectedStep!==undefined && expectedStep!==this.guidedSurveyView()?.key)return false;
    if(!this.guidedSurveyView()?.actions.some(a=>a.id===action))return false;
    if(action==='trace'){progress.phase='compare';progress.marker=1;}
    else if(action==='mark') {
      progress.phase='feedback';surveyRoutes.filter(r=>r.pair===route.pair).forEach(r=>this.recordedRoutes.add(r.id));
    } else if(action==='next')this.surveyProgress={routeId:'rupert-broad',phase:'origin'};
    else if(action==='finish')progress.phase='done';
    else if(action==='discuss') {this.activeSurvey=undefined;this.conversations.open('walking-review');this.activeDialogueId='walking-review';}
    this.emitChange();return true;
  }
  private selectedRoute?: RouteId;
  private recordedRoutes = new Set<RouteId>();
  getRouteObservations() { return [...this.recordedRoutes].map(observation); }
  hasWalkingBoundary(): boolean { return this.recordedRoutes.size===surveyRoutes.length && (!this.surveyProgress || this.surveyProgress.phase==='done'); }
  getFieldworkView(): FieldworkView | undefined {
    if(!this.activeSurvey || !this.surveyProgress)return undefined;
    const guided=this.guidedSurveyView()!;
    return {guided,title:guided.title,text:guided.text};
  }

  day: InquiryDay = 1;
  private assignedDays = new Set<InquiryDay>();
  private objectives = new Set<ObjectiveId>();
  private recaps = new Set<InquiryDay>();
  dayIntroOpen = true;
  isPumpClosed(): boolean { return this.stage==='complete' && this.boardPresented && this.selectedHypothesisId==='waterborne'; }
  getDisplayDate(): string { return this.isPumpClosed()?'September 8, 1854':this.getDay().date; }
  getDay() { return dayDefinition(this.day); }
  getAssignments() { return this.getDay().objectives.filter(item=>!this.objectiveWaived(item.id,this.day)).map(item=>({...item,complete:this.objectives.has(item.id)})); }
  hasCurrentAssignment(): boolean { return this.assignedDays.has(this.day) && (this.day!==3 || this.objectives.has('walking-access')); }
  needsDailyBriefing(): boolean { return this.stage==='field' && !this.hasCurrentAssignment(); }
  canUseMap(): boolean { return !this.startupOpen && !this.dayIntroOpen && this.hasCurrentAssignment() && !['briefing','board'].includes(this.stage); }
  private openDailyBriefing(): void {
    if(!this.needsDailyBriefing())return;
    this.currentLocationId='snow-desk';
    if(this.canResumePumpComparison()) {
      if(this.surveyProgress?.phase==='done' && this.conversations.serialize().cursors['walking-review']) {this.conversations.open('walking-review');this.activeDialogueId='walking-review';}
      else this.resumePumpComparison();
      return;
    }
    const id=this.day===1?'snow-introduction':`snow-day-${this.day}`;
    this.conversations.open(id);this.activeDialogueId=id;this.activeDialogueQuestionId=undefined;
  }
  isDayFieldworkComplete(): boolean { return this.getDay().objectives.every(o=>this.objectives.has(o.id) || this.objectiveWaived(o.id,this.day)); }
  canEndDay(): boolean { return this.day<3 && this.recaps.has(this.day) && this.currentLocationId==='snow-desk'; }
  /** Reveal deaths after the recap’s unmarked map; the finding still requires finishing it. */
  hasMappedDeaths(): boolean {
    return this.hasEvidence('attack-timeline') && (this.hasEvidence('pump-cluster') || this.conversations.mapFor('snow-recap-1')==='deaths');
  }
  getDayIntroduction(): string[] { const day=this.getDay(); return [
    `${day.date} · ${day.title}`,
    this.day===1 ? 'You are in Dr. Snow’s office. Speak with him to begin your inquiry.' : 'Speak with Snow for today’s assignments.'
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
    if(end?.objective && this.assignedDays.has(this.day) && (end.objective!=='walking-access' || this.hasWalkingBoundary()) && this.getDay().objectives.some(o=>o.id===end.objective)) this.objectives.add(end.objective);
    if(end?.recapDay===this.day && this.isDayFieldworkComplete())this.recaps.add(this.day);
    if(end?.evidenceId && (end.objective ? this.objectives.has(end.objective) : end.recapDay ? this.recaps.has(end.recapDay) : false))this.collectedEvidence.add(end.evidenceId);
    if(this.day===3 && this.recaps.has(3) && this.stage==='field')this.stage='synthesis';
    if(end?.hearing && this.stage==='board' && this.preparedForBoard)this.boardPresented=true;
    this.emitChange();
  }

  private dailyPumpedWater = new Set<InquiryDay>();
  private legacySampleWaivers = new Set<InquiryDay>();
  private pumpedWater = new Set<'broad-street'|'workhouse'>();
  hasPumpedWater(location: 'broad-street'|'workhouse'): boolean { return location==='broad-street'?this.dailyPumpedWater.has(this.day):this.pumpedWater.has(location); }
  /** Called by the physical pump only when its stroke actually produces water. */
  recordPumpedWater(location: 'broad-street'|'workhouse'): boolean {
    if(this.currentLocationId!==location || !this.hasCurrentAssignment() || (location==='workhouse' && this.day!==2) || !['field','synthesis'].includes(this.stage))return false;
    if(this.hasPumpedWater(location))return false;
    if(location==='broad-street')this.dailyPumpedWater.add(this.day);
    this.pumpedWater.add(location);this.emitChange();return true;
  }
  hasWorkhouseSample(): boolean { return this.conversations.hasCompleted('workhouse-sample'); }
  getWaterSampleObservations() {
    return ([1,2,3] as const).filter(day=>this.conversations.hasCompleted(sampleConversation(day))).map(day=>({day,date:dayDefinition(day).date,text:waterSamples[day].observation}));
  }
  private sampleCard(card: EvidenceCard): EvidenceCard {
    if(card.id!=='pump-water-inspection')return card;
    const samples=this.getWaterSampleObservations();if(!samples.length)return card;
    return {...card,title:samples.length>1?'Pump water varies between samples':'First Broad Street water sample',
      summary:samples.map(s=>`Sept ${s.day+4}: ${s.text}`).join(' ')+' No inspection identifies the cause of illness.'+(this.hasWorkhouseSample()?' The workhouse water looks clear; neither supply gives decisive visible proof.':''),
      sourceLabel:'Dated Broad Street pump inspections'+(this.hasWorkhouseSample()?' · workhouse comparison':'')};
  }
  private objectiveWaived(id:ObjectiveId,day:InquiryDay):boolean {
    return (id==='manufactory' && this.legacyManufactoryWaiver) || (id===waterSamples[day].objective && this.legacySampleWaivers.has(day));
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
      this.resumePumpComparison();
      return {dialogue:this.getActiveDialogue(),message:'Pump comparison opened.'};
    }
    let id: string | undefined;
    if(hotspotId==='john-snow') {
      if(this.canResumePumpComparison()){this.openDailyBriefing();this.emitChange();return {dialogue:this.getActiveDialogue(),message:'Snow turns to the map table.'};}
      if(!this.hasCurrentAssignment())id=this.day===1?'snow-introduction':`snow-day-${this.day}`;
      else if(this.surveyProgress?.phase==='done' && !this.objectives.has('walking-access'))id='walking-review';
      else if(this.isDayFieldworkComplete())id=`snow-recap-${this.day}`;
      else id='snow-progress';
    } else if(hotspotId==='whitehead')id=this.day===1?'whitehead-local-knowledge':`whitehead-day-${this.day}`;
    else if(hotspotId==='resident-west'||hotspotId==='resident-east'||streetExtras.some(p=>p.id===hotspotId))id=`${hotspotId}-day-${this.day}`;
    else if(hotspotId==='board-hearing') { this.beginHearing();return {dialogue:this.getActiveDialogue(),message:'The Board awaits your response.'}; }
    else {
      const source: Record<string,string>={'registrar-ledger':'registrar-records','broad-street-household':'household-first',
        'broad-street-pump':sampleConversation(this.day),'workhouse-pump':'workhouse-sample','routines-household':'household-routines','away-household':'household-away',
        'manufactory-worker':'manufactory-supply','poland-workhouse':'workhouse-supply','broad-street-brewery':'brewery-supply'};
      id=source[hotspotId];
      const graph=conversations.find(c=>c.id===id),objective=graph?.beats.find(b=>b.conclusion?.objective)?.conclusion?.objective;
      const assigned=days.find(d=>d.objectives.some(o=>o.id===objective));
      if(assigned && (assigned.day>this.day || !this.hasCurrentAssignment()))return {message:'This inquiry belongs to a later assignment. Speak with Snow about today’s work.'};
    }
    if(hotspotId==='broad-street-pump' || hotspotId==='workhouse-pump') {
      if(!this.hasCurrentAssignment())return {message:'Speak with Snow about today’s water sample first.'};
      const pump=hotspotId==='workhouse-pump'?'workhouse':'broad-street';
      if(!this.hasPumpedWater(pump))return {message:'Use the pump handle to draw some water first, then select the pump to inspect the sample.'};
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
    if(this.surveyProgress?.phase==='done' && this.canResumePumpComparison())return 'The pump service area is on the map. Discuss the comparison with Snow.';
    if(this.surveyProgress && this.canResumePumpComparison())return 'Trace the pump-to-pump journeys and mark equal walking distances at Snow’s map table.';
    if(this.selectedRoute)return 'Resume the pump comparison to continue your earlier route notes.';
    if(this.preparedForBoard)return 'Attend the meeting from Snow’s review panel.';
    if(this.hasEnoughEvidenceForSynthesis())return 'Choose a theory with Snow, then attend the meeting.';
    if(!this.hasCurrentAssignment())return `Day ${this.day}: speak with Snow for today’s assignments.`;
    if(this.isDayFieldworkComplete())return this.recaps.has(this.day)?'Today’s review is complete. Return to Snow and choose End day when ready.':'Today’s fieldwork is complete. Return to Snow for the recap; exploration remains available.';
    return `Day ${this.day}: ${this.getAssignments().filter(o=>!o.complete).map(o=>o.title).join(' · ')}.`;
  }

  getCollectedEvidence(): EvidenceCard[] {
    return evidenceCards.filter((card) => this.collectedEvidence.has(card.id)).map(card=>this.sampleCard(card));
  }

  getAllEvidence(): EvidenceCard[] {
    return evidenceCards.map(card=>this.sampleCard(card));
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
      return ["The Guardians await the presentation. You may look around before beginning."];
    }
    if (this.stage === "board" && hypothesis) {
      if (hypothesis.id === "waterborne") {
        return [
          "Historical course: you support Snow’s argument. The Guardians order the pump handle removed tomorrow morning.",
          `Recommended action: ${hypothesis.boardAction}`,
        ];
      }

      return [
        `Alternate teaching conclusion: you persuade the Guardians to favor ${hypothesis.title.toLowerCase()} and leave the pump open, against Snow’s advice.`,
        `Recommended action: ${hypothesis.boardAction}`,
        "Snow continues to argue that the water carries the poison and urges the Board to close the pump.",
      ];
    }

    if (this.stage === "complete" && hypothesis) {
      if (hypothesis.id === "waterborne") {
        return [
          "Historical outcome — September 8: the handle is gone. A notice on the pump records the Guardians’ order. The outbreak was already declining, so its decline cannot by itself establish the effect of removing the handle.",
          "Whitehead later changed his mind. His inquiries at 40 Broad Street, together with parish investigations of defective drainage beside the well, helped explain how the water became contaminated.",
          chronologyNote,
        ];
      }

      return [
        "Alternate course — a fictional teaching outcome: your argument persuades the Board to leave the pump open despite Snow’s continuing objection. Historically, the handle was removed on September 8, when the outbreak was already declining.",
        "Whitehead later changed his mind. His inquiries at 40 Broad Street and the parish investigation of drainage beside the well strengthened the water explanation.",
        chronologyNote,
      ];
    }

    return scene.body;
  }

  getStage(): ChapterStage {
    return this.stage;
  }

  beginFieldwork(): void {
    if(!this.hasCurrentAssignment() || this.dayIntroOpen || this.startupOpen)return;
    this.stage = "field";
    this.currentLocationId = "broad-street";
    this.activeDialogueId = undefined;
    this.activeDialogueQuestionId = undefined;
    this.emitChange();
  }

  attendBoardMeeting(): { accepted: boolean; message: string } {
    if(this.stage==='board' || this.stage==='complete')
      return {accepted:false,message:'You have already arrived at the meeting.'};
    if(!this.preparedForBoard) {
      const preparation=this.prepareBoardArgument(false);
      if(!preparation.prepared)return {accepted:false,message:preparation.message};
    }
    return this.presentToBoard();
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
    this.currentLocationId = this.isPumpClosed() ? "broad-street" : "board-room";
    this.activeDialogueId = undefined;
    this.activeDialogueQuestionId = undefined;
    this.emitChange();
  }

  travelToLocation(locationId: LocationId): { traveled: boolean; message: string } {
    const location = this.getLocation(locationId);
    if (!location) {
      return { traveled: false, message: "That location is not on the inquiry map." };
    }

    if(this.needsDailyBriefing())return {traveled:false,message:"Receive today’s assignments from Snow before leaving his office."};

    if (!this.canTravelToLocation(locationId)) {
      return { traveled: false, message: `${location.title} is not available for field travel yet.` };
    }

    this.activeSurvey=undefined;
    this.conversations.restartUnfinishedAt(this.currentLocationId);
    this.conversations.interrupt();
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

  interruptConversation(): void {
    this.conversations.interrupt();
    this.closeDialogue();
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

  prepareBoardArgument(notify = true): { prepared: boolean; message: string } {
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
    if(notify)this.emitChange();
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
      `Against / limits: ${review.complicating?.text ?? "No challenge recorded yet."}`,
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
      findings.push("The second household prefers Broad Street water and collects it during errands.");
    }

    if (this.hasEvidence("pump-water-inspection")) {
      findings.push(this.hasWorkhouseSample()?"Broad Street water varies; the workhouse comparison is also inconclusive.":"The pump-water sample gives no decisive visible proof of danger.");
    }

    if (this.hasEvidence("attack-timeline")) {
      findings.push("Death returns show a sudden surge around the end of August and early September.");
    }

    if (this.hasEvidence("workhouse-exception")) {
      findings.push("The St. James Workhouse near Broad Street held over 500 inmates, had very few deaths, and had its own water supply.");
    }

    if (this.hasEvidence("brewery-exception")) {
      findings.push("The Lion Brewery on Broad Street had no deaths, and did not rely on the Broad Street pump.");
    }

    if(this.hasEvidence("manufactory-exposure"))findings.push("At 37 Broad Street, workers who died at different homes shared a workplace supplied with Broad Street pump water.");
    if(this.hasEvidence("nonlocal-exposure"))findings.push("A distant residence can be connected to exposure near Broad Street.");
    if(this.hasEvidence("walking-access"))findings.push("The street-route halfway points help explain Snow’s wider pump service-area comparison.");
    return findings;
  }

  getHotspots(): Hotspot[] {
    if (this.stage !== "field" && this.stage !== "synthesis" && this.stage !== "board") {
      return [];
    }

    return hotspots.filter((hotspot) => hotspot.locationId === this.currentLocationId && (!hotspot.id.startsWith("survey-") || hotspot.id===this.getSurveyOrigin()));
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
    const survey=this.getFieldworkView();if(survey)return {id:'fieldwork',locationId:this.currentLocationId,speaker:survey.title,role:'Snow’s map table',intro:survey.text,questions:[]};
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
    if(this.currentLocationId==='broad-street')return (this.getAssignments().some(o=>o.id===waterSamples[this.day].objective && !o.complete)
      ? 'Use the pump handle to draw today’s water, then select the pump to inspect it. ' : '')+
      (this.day===3?'Speak with Whitehead and the street residents. Follow today’s household and brewery inquiries.':'Speak with Whitehead and the street residents. Follow the marked exits or map to today’s interviews.');
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

  isArchivedLocation(location: InvestigationLocation): boolean {
    return !this.isLocationUnlocked(location) && (locationEvidenceIds[location.id] ?? []).some(id=>this.hasEvidence(id));
  }

  getMapLocations(): InvestigationLocation[] {
    return locations.filter(location=>!location.boardOnly && (this.isLocationUnlocked(location) || this.isArchivedLocation(location)));
  }

  getUnlockedLocations(): InvestigationLocation[] {
    return locations.filter((location) => this.isLocationUnlocked(location));
  }

  canTravelToLocation(id: LocationId): boolean {
    const location = this.getLocation(id);
    if (!location || location.boardOnly || this.stage === "briefing" || this.stage === "board") {
      return false;
    }

    if (!this.hasCurrentAssignment() || this.dayIntroOpen || this.startupOpen)return false;

    if(this.stage==='complete')return id==='snow-desk' || (this.isPumpClosed() && id==='broad-street');
    return this.isLocationUnlocked(location);
  }

  isLocationUnlocked(location: InvestigationLocation): boolean {
    if (location.boardOnly) {
      return this.preparedForBoard || this.boardPresented || this.stage === "complete";
    }

    if (this.stage === "briefing") {
      return location.id === "snow-desk";
    }

    if (!this.hasCurrentAssignment()) {
      return location.id === "snow-desk";
    }

    if ((locationDay[location.id]??1)>this.day)return false;
    const assignedDay=days.find(day=>day.objectives.some(o=>o.location===location.id));
    if(assignedDay && !["broad-street","snow-desk"].includes(location.id) && assignedDay.day!==this.day)return false;
    if (location.unlocksWith) {
      return this.hasEvidence(location.unlocksWith);
    }

    return true;
  }

  getEvidence(id: string): EvidenceCard | undefined {
    return this.getAllEvidence().find((card) => card.id === id);
  }

  private getEvidenceLocation(evidenceId: string): InvestigationLocation | undefined {
    const locationEntry = Object.entries(locationEvidenceIds).find(([, evidenceIds]) => evidenceIds?.includes(evidenceId));
    return locationEntry ? this.getLocation(locationEntry[0] as LocationId) : undefined;
  }

  private getLocationEvidencePrompt(card: EvidenceCard, location: InvestigationLocation): string {
    if(card.id==='pump-water-inspection')return 'Use the Broad Street pump handle to draw water, then select the pump to inspect the sample.';
    if (card.id === "household-water-pattern") {
      return `Interview the householder at ${location.title}.`;
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
    return this.day===3 && this.recaps.has(3) && days.every(d=>d.objectives.every(o=>this.objectives.has(o.id) || this.objectiveWaived(o.id,d.day)));
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
    this.startupOpen=false;this.pendingSave=undefined;this.recordedRoutes.clear();this.surveyProgress=undefined;this.pumpedWater.clear();this.dailyPumpedWater.clear();this.legacySampleWaivers.clear();this.selectedRoute=undefined;this.activeSurvey=undefined;
    this.legacyManufactoryWaiver=false;this.conversations.reset();this.day=1;this.assignedDays.clear();this.objectives.clear();this.recaps.clear();this.dayIntroOpen=true;
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
    return JSON.stringify({version:1,campaignRevision:2,legacyManufactoryWaiver:this.legacyManufactoryWaiver,mapExercise:4,sampleRevision:1,dailyPumpedWater:[...this.dailyPumpedWater],legacySampleWaivers:[...this.legacySampleWaivers],day:this.day,location:this.currentLocationId,stage:this.stage,
      conversation:this.conversations.serialize(),hypothesis:this.selectedHypothesisId,
      pumpedWater:[...this.pumpedWater],prepared:this.preparedForBoard,dayIntro:this.dayIntroOpen,routes:[...this.recordedRoutes],selectedRoute:this.selectedRoute,surveyProgress:this.surveyProgress});
  }
  restoreSave(json: string): boolean {
    try {
      const value=JSON.parse(json);
      if(value && ['marlborough-pump','rupert-pump'].includes(value.location))value.location='snow-desk';
      if((value?.campaignRevision!==undefined && value.campaignRevision!==2) || (value?.legacyManufactoryWaiver!==undefined && typeof value.legacyManufactoryWaiver!=='boolean'))return false;
      if(value?.version!==1 || (value.mapExercise!==undefined && ![2,3,4].includes(value.mapExercise)) || ![1,2,3].includes(value.day) || !this.getLocation(value.location)
        || !['field','synthesis','board','complete'].includes(value.stage) || typeof value.prepared!=='boolean'
        || typeof value.dayIntro!=='boolean' || (value.hypothesis!==undefined && !this.getHypothesis(value.hypothesis)))return false;
      if(!Array.isArray(value.routes) || new Set(value.routes).size!==value.routes.length || !value.routes.every((id:unknown)=>surveyRoutes.some(r=>r.id===id)) || (value.selectedRoute!==undefined && !surveyRoutes.some(r=>r.id===value.selectedRoute)))return false;
      if(value.day!==3 && (value.routes.length || value.selectedRoute))return false;
      let guided=value.surveyProgress;
      if(value.mapExercise===3 || value.mapExercise===4) {
        if(value.selectedRoute!==undefined)return false;
        if(guided!==undefined) {
          const route=surveyRoutes.find(r=>r.id===guided?.routeId);
          if(!route || !guided.routeId.endsWith('-broad') || value.day!==3 || !['origin','compare','feedback','done'].includes(guided.phase) || guided.answer!==undefined)return false;
          if(guided.phase==='origin' ? guided.marker!==undefined : (value.mapExercise===3 ? ![1,2,3].includes(guided.marker) : !Number.isFinite(guided.marker) || guided.marker<0 || guided.marker>4))return false;
          if(['feedback','done'].includes(guided.phase) && guided.marker!==2)return false;
          if(guided.phase==='done' && route.pair!=='rupert')return false;
          const expected=surveyRoutes.filter(r=>(route.pair==='rupert' && r.pair==='marlborough') || (['feedback','done'].includes(guided.phase) && r.pair===route.pair)).map(r=>r.id);
          if(value.routes.length!==expected.length || !expected.every(id=>value.routes.includes(id)))return false;
        }
      } else if(guided!==undefined) {
        const route=surveyRoutes.find(r=>r.id===guided?.routeId);
        if(value.mapExercise===2 && ['arrival','compare'].includes(guided.phase))return false;
        if(!route || value.day!==3 || !['origin','arrival','compare','feedback','done'].includes(guided.phase))return false;
        const pair=surveyRoutes.filter(r=>r.pair===route.pair);
        if(guided.phase==='origin' && value.routes.includes(route.id) && value.mapExercise===2)return false;
        if(guided.phase!=='origin' && !value.routes.includes(route.id))return false;
        if(['compare','feedback','done'].includes(guided.phase) && !pair.every(r=>value.routes.includes(r.id)))return false;
        if(guided.phase==='done' && (value.routes.length!==4 || route.pair!=='rupert'))return false;
        if(guided.answer!==undefined && !pair.some(r=>r.id===guided.answer))return false;
        if(guided.phase==='feedback' && guided.answer===undefined)return false;
        if(value.selectedRoute!==undefined)return false;
      }
      const progress=new ConversationProgress();if(!progress.restore(value.conversation))return false;
      // Older saves predate physical sample collection; preserve already-started inspections.
      const sampleLocations = ['broad-street','workhouse'] as const;
      const water=value.pumpedWater===undefined ? sampleLocations.filter(location=>value.conversation.cursors[location==='workhouse'?'workhouse-sample':'pump-sample']) : value.pumpedWater;
      if(!Array.isArray(water) || new Set(water).size!==water.length || !water.every(v=>sampleLocations.includes(v)))return false;
      for(const location of sampleLocations)if(value.conversation.cursors[location==='workhouse'?'workhouse-sample':'pump-sample'] && !water.includes(location))return false;
      const objectives=new Set<ObjectiveId>(),assigned=new Set<InquiryDay>(),recaps=new Set<InquiryDay>(),evidence=new Set<string>();
      let hearing=false;
      for(const graph of conversations)if(progress.hasCompleted(graph.id)) {
        const end=graph.beats.find(b=>b.conclusion!==undefined)!.conclusion!;
        if(end.assignment)assigned.add(1);if(end.assignmentDay)assigned.add(end.assignmentDay);
        if(end.objective)objectives.add(end.objective);if(end.recapDay)recaps.add(end.recapDay);
        if(end.evidenceId)evidence.add(end.evidenceId);if(end.hearing)hearing=true;
      }
      const waived=(value.campaignRevision===undefined || value.legacyManufactoryWaiver===true) && recaps.has(2);
      if(value.legacyManufactoryWaiver===true && !recaps.has(2))return false;
      if(value.sampleRevision!==undefined && value.sampleRevision!==1)return false;
      const daily=value.sampleRevision===1?value.dailyPumpedWater:(water.includes('broad-street')?[2]:[]);
      const sampleWaivers=value.sampleRevision===1?value.legacySampleWaivers:[1,3].filter(d=>recaps.has(d as InquiryDay));
      if(!Array.isArray(daily) || new Set(daily).size!==daily.length || !daily.every(d=>[1,2,3].includes(d) && d<=value.day && assigned.has(d)))return false;
      if(!Array.isArray(sampleWaivers) || new Set(sampleWaivers).size!==sampleWaivers.length || !sampleWaivers.every(d=>[1,3].includes(d) && recaps.has(d) && !objectives.has(waterSamples[d as InquiryDay].objective)))return false;
      if(water.includes('broad-street')!==(daily.length>0))return false;
      if(water.includes('workhouse') && (value.day<2 || !assigned.has(2)))return false;
      for(const day of [1,2,3] as const)if(value.conversation.cursors[sampleConversation(day)] && !daily.includes(day))return false;
      for(const day of days) {
        if(day.day>value.day && (assigned.has(day.day)||recaps.has(day.day)||day.objectives.some(o=>objectives.has(o.id))))return false;
        if(day.day<value.day && !recaps.has(day.day))return false;
        if(recaps.has(day.day) && (!assigned.has(day.day)||!day.objectives.every(o=>objectives.has(o.id) || (o.id==='manufactory' && waived) || (o.id===waterSamples[day.day].objective && sampleWaivers.includes(day.day)))))return false;
        if(day.objectives.some(o=>objectives.has(o.id)) && !assigned.has(day.day))return false;
      }
      if([2,3,4].includes(value.mapExercise) && value.routes.length && !guided && !objectives.has('walking-access'))return false;
      if(objectives.has("walking-access") && (value.routes.length!==surveyRoutes.length || (guided && guided.phase!=="done")))return false;
      const ready=recaps.has(3);
      if(value.prepared && (!ready||!value.hypothesis))return false;
      if(['board','complete'].includes(value.stage) && !value.prepared)return false;
      if(value.stage==='board' && value.location!=='board-room')return false;
      if(value.stage==='complete'&&!hearing)return false;
      if(hearing&&!['board','complete'].includes(value.stage))return false;
      if((value.routes.length||value.selectedRoute||guided)&&!assigned.has(3))return false;
      if(value.selectedRoute&&value.routes.includes(value.selectedRoute))return false;
      if(value.stage==='synthesis'&&!ready)return false;
      if((locationDay[value.location as LocationId]??1)>value.day || (!assigned.has(1) && value.location!=='snow-desk'))return false;
      // Commit only after full validation; callers can retain their current session on failure.
      this.legacyManufactoryWaiver=waived;this.conversations.restore(value.conversation);this.day=value.day;this.currentLocationId=value.location;
      this.stage=value.stage;this.objectives=objectives;this.recaps=recaps;this.assignedDays=assigned;this.collectedEvidence=evidence;
      this.askedQuestions=new Set(assigned.has(1)?['snow-method-question']:[]);this.inspectedHotspots.clear();
      this.selectedHypothesisId=value.hypothesis;this.preparedForBoard=value.prepared;this.boardPresented=hearing;
      // Move legacy water-outcome saves from the meeting room to the closed pump.
      if(this.isPumpClosed() && this.currentLocationId==="board-room")this.currentLocationId="broad-street";
      this.pumpedWater=new Set(water);this.dailyPumpedWater=new Set(daily);this.legacySampleWaivers=new Set(sampleWaivers);this.recordedRoutes=new Set(value.routes);this.selectedRoute=value.selectedRoute;this.surveyProgress=guided;this.activeSurvey=undefined;
      if(![3,4].includes(value.mapExercise) && !objectives.has('walking-access')) {
        // Partial visits become an uncompleted table comparison. Finished findings survive.
        this.recordedRoutes.clear();this.selectedRoute=undefined;this.surveyProgress=undefined;
      }
      if(![3,4].includes(value.mapExercise) && objectives.has('walking-access'))this.surveyProgress={routeId:'rupert-broad',phase:'done',marker:2};
      this.dayIntroOpen=value.dayIntro;this.activeDialogueId=undefined;this.activeDialogueQuestionId=undefined;
      // Older previews allowed an unbriefed player to leave on days two and three.
      // Return to Snow's office; selecting him resumes the preserved cursor.
      if(this.needsDailyBriefing()) {
        this.currentLocationId='snow-desk';
      }
      if(!this.needsDailyBriefing() && !['board','complete'].includes(this.stage) && !this.isLocationUnlocked(this.getCurrentLocation()))this.currentLocationId='broad-street';
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
