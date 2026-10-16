import { campaignConversations } from "./campaignConversations";
import type { InquiryDay, ObjectiveId } from "./campaign";
import type { LocationId } from "./types";

export type ActorId = "seamstress" | "laundress" | "porter" | "messenger" | "john-snow" | "whitehead" | "resident-west" | "resident-east" | "registrar" | "survivor" | "water-householder" | "away-householder" | "steward" | "brewery-owner" | "pump" | "workhouse-pump" | "board-chair" | "board-tradesman" | "board-guardian" | "survey";
export type ConversationId = string;
export interface ConversationChoice { id: string; label: string; next: string }
export interface ConversationBeat {
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
    sourceNote: "Reconstructed teaching dialogue, informed by Snow, On the Mode of Communication of Cholera (1855). The inquiry compresses several historical activities into September 5–7.",
    beats: [
      { id: "opening", speaker: "John Snow", text: "People are dying near Broad Street, and I suspect something they have swallowed. Will you help me test that suspicion against what we can find?", choices: [next("begin", "Where should we begin?", "records"), next("doubt", "What if the water is innocent?", "skepticism")] },
      { id: "records", speaker: "John Snow", text: "Begin with the death returns: when did people fall ill, and where did they live? Addresses can guide our questions, but a mark on a map cannot tell us what someone drank.", choices: [next("people", "Then we need to speak with the households.", "method")] },
      { id: "skepticism", speaker: "John Snow", text: "Then we must be willing to change our explanation. Look for people who escaped illness as carefully as those who suffered it.", choices: [next("compare", "How can we make a fair comparison?", "method")] },
      { id: "method", speaker: "John Snow", text: "Ask about water, daily routines, and the timing of illness; compare those accounts with the records. Bring your notes back and we will go through them together.", choices: [next("accept", "I will collect the accounts and bring them back.", "assignment"), next("proof", "Will that prove what caused the outbreak?", "limits")] },
      { id: "limits", speaker: "John Snow", text: "We shall see whether the accounts fit together. I am especially interested in people close to the pump who have escaped illness.", choices: [next("undertake", "Let us begin the inquiry.", "assignment")] },
      { id: "assignment", speaker: "John Snow", text: "Take the map and notebook: copy the registrar’s records and visit Household 1 and hear their account. Then return here to plot the addresses; Whitehead knows the neighborhood but opposes my explanation.", choices: [], conclusion: { assignment: true } },
    ],
  },
  {
    id: "whitehead-local-knowledge", actorId: "whitehead", locationId: "broad-street", title: "Local knowledge",
    anchor: [-6.5, 1.5, -5.6], start: "opening",
    sourceNote: "Reconstructed conversation with Reverend Henry Whitehead. Whitehead initially opposed Snow's water theory and expected investigation to refute it, as described in UCLA's John Snow archive, Stream 2e. These are authored lines, not quotations; his later change of mind and contamination investigation are reserved for the later inquiry.",
    beats: [
      { id: "opening", speaker: "Reverend Henry Whitehead", text: "I know these families, and I do not believe Dr. Snow is right to blame the Broad Street water. I expect a careful inquiry here will show that his explanation is mistaken.", choices: [next("neighbors", "Do you know these families well?", "routines"), next("water", "Dr. Snow suspects the pump water.", "skepticism"), next("help", "How should I approach the families?", "care")] },
      { id: "routines", speaker: "Reverend Henry Whitehead", text: "I visit these homes in my parish work. I know people who drank this water and have remained well; that is one reason I doubt Dr. Snow’s claim.", choices: [next("listen", "I will ask about what they actually did.", "conclusion")] },
      { id: "skepticism", speaker: "Reverend Henry Whitehead", text: "I find that explanation unconvincing. If the water is to blame, Dr. Snow must explain why some who drank it escaped illness; pointing to deaths near the pump will not answer that objection.", choices: [next("exceptions", "The exceptions should test the idea too.", "conclusion")] },
      { id: "care", speaker: "Reverend Henry Whitehead", text: "Be gentle with them. Some have scarcely slept, and others have lost more than one person; they need time to speak.", choices: [next("respect", "I will give them time.", "conclusion")] },
      { id: "conclusion", speaker: "Reverend Henry Whitehead", text: "I remain opposed to this explanation. I cannot accept that the pump is responsible simply because Dr. Snow is convinced of it.", choices: [], conclusion: {} },
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
    if (!this.cursors.has(id)) this.cursors.set(id, definition.start);
    this.activeId = id;
  }
  close(): void { this.activeId = undefined; }
  hasCompleted(id: string): boolean { return this.concluded.has(id); }
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
      beatId: beat.id, speaker: beat.speaker, text: beat.text, choices: beat.choices,
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
