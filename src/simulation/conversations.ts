import type { LocationId } from "./types";

export type ActorId = "john-snow" | "whitehead";
export type ConversationId = "snow-introduction" | "whitehead-local-knowledge";
export interface ConversationChoice { id: string; label: string; next: string }
export interface ConversationBeat {
  id: string;
  speaker: string;
  text: string;
  choices: readonly ConversationChoice[];
  conclusion?: { assignment?: boolean; evidenceId?: string };
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
  anchor: readonly [number, number, number]; complete: boolean;
}
const next = (id: string, label: string, to: string): ConversationChoice => ({ id, label, next: to });
export const conversations: readonly ConversationDefinition[] = [
  {
    id: "snow-introduction", actorId: "john-snow", locationId: "snow-desk", title: "Starting the inquiry",
    anchor: [-.65, 1.35, -2.15], start: "opening",
    sourceNote: "Reconstructed teaching dialogue, informed by Snow, On the Mode of Communication of Cholera (1855). This preview retains the existing field assignments pending the three-day campaign.",
    beats: [
      { id: "opening", speaker: "John Snow", text: "People are dying near Broad Street, and I suspect something they have swallowed. Will you help me test that suspicion against what we can find?", choices: [next("begin", "Where should we begin?", "records"), next("doubt", "What if the water is innocent?", "skepticism")] },
      { id: "records", speaker: "John Snow", text: "Begin with the death returns: when did people fall ill, and where did they live? Addresses can guide our questions, but a mark on a map cannot tell us what someone drank.", choices: [next("people", "Then we need to speak with the households.", "method")] },
      { id: "skepticism", speaker: "John Snow", text: "Then we must be willing to change our explanation. Look for people who escaped illness as carefully as those who suffered it.", choices: [next("compare", "How can we make a fair comparison?", "method")] },
      { id: "method", speaker: "John Snow", text: "Ask about water, daily routines, and the timing of illness; compare those accounts with the records. Keep observations separate from reports and our own inferences.", choices: [next("accept", "I will collect the accounts and bring them back.", "assignment"), next("proof", "Will that prove what caused the outbreak?", "limits")] },
      { id: "limits", speaker: "John Snow", text: "No single account will prove it. Together, a pattern and its exceptions may tell us whether action is justified while uncertainty remains.", choices: [next("undertake", "Let us begin the inquiry.", "assignment")] },
      { id: "assignment", speaker: "John Snow", text: "Take the notebook and map. Visit the registrar, examine Broad Street, and return to me to plot the addresses; Reverend Whitehead also knows the neighborhood well.", choices: [], conclusion: { assignment: true } },
    ],
  },
  {
    id: "whitehead-local-knowledge", actorId: "whitehead", locationId: "broad-street", title: "Local knowledge",
    anchor: [-6.5, 1.5, -5.6], start: "opening",
    sourceNote: "Reconstructed conversation with Reverend Henry Whitehead. Local familiarity and skepticism are informed by the accounts reproduced in UCLA's John Snow archive, Stream 2e; his later contamination investigation is not revealed here.",
    beats: [
      { id: "opening", speaker: "Reverend Henry Whitehead", text: "I visit families here and know many of their ordinary habits. Before we settle on an explanation, we should hear what has happened behind these doors.", choices: [next("neighbors", "What can local knowledge add?", "routines"), next("water", "Dr. Snow suspects the pump water.", "skepticism"), next("help", "How should I approach the families?", "care")] },
      { id: "routines", speaker: "Reverend Henry Whitehead", text: "A person's address is only a beginning: work and errands take people elsewhere, and water can be carried home. Ask about their routines before assuming where exposure happened.", choices: [next("listen", "I will ask about what they actually did.", "conclusion")] },
      { id: "skepticism", speaker: "Reverend Henry Whitehead", text: "It is a claim worth questioning carefully. We need to account for those who drank and remained well, as well as those who fell ill.", choices: [next("exceptions", "The exceptions should test the idea too.", "conclusion")] },
      { id: "care", speaker: "Reverend Henry Whitehead", text: "Listen before pressing your own explanation. A family can tell you what they remember, but grief and uncertainty do not always leave a complete account.", choices: [next("respect", "I will distinguish what they recall from what we infer.", "conclusion")] },
      { id: "conclusion", speaker: "Reverend Henry Whitehead", text: "Compare the accounts, including the exceptions, and record what people actually drank. My local knowledge may help you ask better questions; it does not settle the cause.", choices: [], conclusion: {} },
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
  reset(): void { this.cursors.clear(); this.concluded.clear(); this.close(); }
  view(): ConversationView | undefined {
    const definition = conversations.find(item => item.id === this.activeId);
    const beat = definition?.beats.find(item => item.id === this.cursors.get(definition.id));
    return definition && beat ? { id: definition.id, actorId: definition.actorId, title: definition.title,
      beatId: beat.id, speaker: beat.speaker, text: beat.text, choices: beat.choices,
      anchor: definition.anchor, complete: beat.conclusion !== undefined } : undefined;
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
