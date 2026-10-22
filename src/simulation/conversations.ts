import { campaignConversations } from "./campaignConversations";
import type { InquiryDay, ObjectiveId } from "./campaign";
import { snowMorningReport } from "./campaign";
import type { LocationId } from "./types";

export type ActorId = "factory-worker" | "seamstress" | "laundress" | "porter" | "messenger" | "john-snow" | "whitehead" | "resident-west" | "resident-east" | "registrar" | "survivor" | "water-householder" | "away-householder" | "steward" | "brewery-owner" | "pump" | "workhouse-pump" | "board-chair" | "board-tradesman" | "board-guardian" | "survey";
export type ConversationId = string;
export interface ConversationChoice { id: string; label: string; next: string }
export interface ConversationBeat {
  map?: "base" | "deaths";
  id: string;
  speaker: string;
  text: string;
  choices: readonly ConversationChoice[];
  conclusion?: { assignment?: boolean; assignmentDay?: InquiryDay; evidenceId?: string; objective?: ObjectiveId; recapDay?: InquiryDay; hearing?: boolean };
  terminalAction?: "end-day" | "review-theory" | "board-decision" | "resume-survey";
  anchor?: readonly [number, number, number];
  actorId?: ActorId;
}
export interface ConversationDefinition {
  map?: "base" | "deaths";
  id: ConversationId;
  actorId: ActorId;
  locationId: LocationId;
  title: string;
  anchor: readonly [number, number, number];
  start: string;
  beats: readonly ConversationBeat[];
  sourceNote: string;
}
export interface ConversationView {
  map?: "base" | "deaths";
  id: ConversationId; actorId: ActorId; title: string; beatId: string;
  speaker: string; text: string; choices: readonly ConversationChoice[];
  anchor: readonly [number, number, number]; complete: boolean; terminalAction?: ConversationBeat["terminalAction"];
}
const next = (id: string, label: string, to: string): ConversationChoice => ({ id, label, next: to });
export const conversations: readonly ConversationDefinition[] = [
  ...campaignConversations,
  {
    id: "snow-introduction", actorId: "john-snow", locationId: "snow-desk", title: "Starting the inquiry",
    anchor: [-.65, 1.35, -2.15], start: "opening",
    sourceNote: "Reconstructed teaching dialogue, informed by Snow, On the Mode of Communication of Cholera (1855). The inquiry compresses several historical activities into September 5–7. The optional royal anaesthesia exchange is authored dialogue based on Snow’s April 7, 1853 case record for Prince Leopold’s birth, reproduced by UCLA (https://epi-snow.ph.ucla.edu/Stream4_Snowlife_d.html); it is not a quotation or a claim that the displayed inhaler was used for the Queen.",
    beats: [
      { id: "opening", speaker: "John Snow", text: `${snowMorningReport(1)} I suspect something they have swallowed—will you help me find its source?`, choices: [next("begin", "Where should we begin?", "records"), next("doubt", "What if the water is innocent?", "skepticism"), next("royal-practice", "Did you give chloroform to Queen Victoria?", "royal-practice")] },
      { id: "royal-practice", speaker: "John Snow", text: "Yes, at Prince Leopold’s birth last year. Much of my practice concerns the relief of pain; I study how to administer ether and chloroform safely.", choices: [next("begin", "Where should we begin our inquiries?", "records")] },
      { id: "records", speaker: "John Snow", text: "Begin with the death returns: when did people fall ill, and where did they live? Addresses can guide our questions, but a mark on a map cannot tell us what someone drank.", choices: [next("people", "Then we need to speak with the households.", "method")] },
      { id: "skepticism", speaker: "John Snow", text: "Then we must be willing to change our explanation. Look for people who escaped illness as carefully as those who suffered it.", choices: [next("compare", "How can we make a fair comparison?", "method")] },
      { id: "method", speaker: "John Snow", text: "Ask about water, daily routines, and the timing of illness; compare those accounts with the records. Bring your notes back and we will go through them together.", choices: [next("accept", "I will collect the accounts and bring them back.", "assignment"), next("proof", "Will that prove what caused the outbreak?", "limits")] },
      { id: "limits", speaker: "John Snow", text: "We shall see whether the accounts fit together. I am especially interested in people close to the pump who have escaped illness.", choices: [next("undertake", "Let us begin the inquiry.", "assignment")] },
      { id: "assignment", speaker: "John Snow", text: "Copy the registrar’s records, hear Household 1’s account, and draw a water sample from Broad Street. We shall inspect fresh water each day; return here with your notes to plot the addresses. Speak with other local people too, including Reverend Whitehead—he knows the neighborhood well.", choices: [], conclusion: { assignment: true } },
    ],
  },
  {
    id: "whitehead-local-knowledge", actorId: "whitehead", locationId: "broad-street", title: "Local knowledge",
    anchor: [-6.5, 1.5, -5.6], start: "opening",
    sourceNote: "Reconstructed conversation with Reverend Henry Whitehead. Whitehead initially opposed Snow's water theory and expected investigation to refute it, as described in UCLA's John Snow archive, Stream 2e. These are authored lines, not quotations; his later change of mind and contamination investigation are reserved for the later inquiry.",
    beats: [
      { id: "opening", speaker: "Reverend Henry Whitehead", text: "I know many of these families through my parish work. I have been visiting the sick and finding what help their neighbors can give.", choices: [next("neighbors", "Do you know these families well?", "routines"), next("water", "Dr. Snow suspects the pump water.", "skepticism"), next("help", "How should I approach the families?", "care")] },
      { id: "routines", speaker: "Reverend Henry Whitehead", text: "Yes. I have called on them in happier times as well as these. Some have lost several members of their family, and others are nursing their neighbors.", choices: [next("listen", "I will ask about what they actually did.", "conclusion")] },
      { id: "skepticism", speaker: "Reverend Henry Whitehead", text: "I find that explanation unconvincing. If the water is to blame, Dr. Snow must explain why some who drank it escaped illness; pointing to deaths near the pump will not answer that objection.", choices: [next("exceptions", "The exceptions should test the idea too.", "conclusion")] },
      { id: "care", speaker: "Reverend Henry Whitehead", text: "Be gentle with them. Some have scarcely slept, and others have lost more than one person; they need time to speak.", choices: [next("respect", "I will give them time.", "conclusion")] },
      { id: "conclusion", speaker: "Reverend Henry Whitehead", text: "I must continue my visits. Listen patiently to the families; they have had a dreadful time.", choices: [], conclusion: {} },
    ],
  },
];

/** Graph cursor and once-only conclusions live in GameState, never in either UI. */
export class ConversationProgress {
  private cursors = new Map<ConversationId, string>();
  private concluded = new Set<ConversationId>();
  activeId?: ConversationId;
  open(id: ConversationId): void {
    const definition = conversations.find(item => item.id === id);
    if (!definition) return;
    if (this.activeId && this.activeId !== id) this.interrupt();
    this.restartUnfinishedAt(definition.locationId, id);
    if (!this.cursors.has(id)) this.cursors.set(id, definition.start);
    this.activeId = id;
  }
  close(): void { this.activeId = undefined; }
  /** Leaving a witness restarts unfinished dialogue without revoking earned findings. */
  interrupt(): void {
    const id = this.activeId;
    const definition = conversations.find(item => item.id === id);
    if (id && definition && !this.concluded.has(id)) this.cursors.set(id, definition.start);
    this.close();
  }
  restartUnfinishedAt(location: LocationId, exceptId?: string): void {
    for(const definition of conversations) {
      if(definition.locationId===location && definition.id!==exceptId
        && this.cursors.has(definition.id) && !this.concluded.has(definition.id))
        this.cursors.set(definition.id,definition.start);
    }
  }
  hasCompleted(id: string): boolean { return this.concluded.has(id); }
  hasStarted(id: string): boolean { return this.cursors.has(id); }
  mapFor(id: string): ConversationView["map"] {
    const definition = conversations.find(item => item.id === id);
    const beat = definition?.beats.find(item => item.id === this.cursors.get(id));
    return beat ? beat.map ?? definition?.map : undefined;
  }
  serialize() { return { cursors: Object.fromEntries(this.cursors), concluded: [...this.concluded] }; }
  restore(data: unknown): boolean {
    if (!data || typeof data !== "object") return false;
    const value = data as { cursors?: Record<string, unknown>; concluded?: unknown };
    if (!value.cursors || typeof value.cursors !== "object" || Array.isArray(value.cursors) || !Array.isArray(value.concluded)) return false;
    const cursors = new Map<string,string>();
    for (const [id,beat] of Object.entries(value.cursors)) {
      if (typeof beat !== "string" || !conversations.find(c=>c.id===id)?.beats.some(b=>b.id===beat)) return false;
      cursors.set(id,beat);
    }
    if (!value.concluded.every(id=>typeof id==='string' && conversations.find(c=>c.id===id)?.beats.some(b=>b.id===cursors.get(id) && b.conclusion!==undefined))) return false;
    if(new Set(value.concluded).size!==value.concluded.length)return false;
    for(const [id,beat] of cursors) {
      const terminal=conversations.find(c=>c.id===id)!.beats.find(b=>b.id===beat)!.conclusion!==undefined;
      if(terminal!==value.concluded.includes(id))return false;
    }
    this.cursors=cursors; this.concluded=new Set(value.concluded); this.close(); return true;
  }
  reset(): void { this.cursors.clear(); this.concluded.clear(); this.close(); }
  view(): ConversationView | undefined {
    const definition = conversations.find(item => item.id === this.activeId);
    const beat = definition?.beats.find(item => item.id === this.cursors.get(definition.id));
    return definition && beat ? { id: definition.id, actorId: beat.actorId ?? definition.actorId, title: definition.title,
      beatId: beat.id, speaker: beat.speaker, text: beat.text, choices: beat.choices, map: beat.map ?? definition.map,
      anchor: beat.anchor ?? definition.anchor, complete: beat.conclusion !== undefined, terminalAction: beat.terminalAction } : undefined;
  }
  choose(beatId: string, choiceId: string): { advanced: boolean; conclusion?: ConversationBeat["conclusion"] } {
    const view = this.view();
    // Reject stale/double clicks even if a later beat reuses a choice identifier.
    if (!view || view.beatId !== beatId) return { advanced: false };
    const choice = view.choices.find(item => item.id === choiceId);
    const definition = conversations.find(item => item.id === view.id)!;
    const target = choice && definition.beats.find(item => item.id === choice.next);
    if (!target) return { advanced: false };
    this.cursors.set(view.id, target.id);
    if (target.conclusion !== undefined && !this.concluded.has(view.id)) {
      this.concluded.add(view.id);
      return { advanced: true, conclusion: target.conclusion };
    }
    return { advanced: true };
  }
}
