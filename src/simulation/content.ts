import type {
  ChapterScene,
  DialogueNode,
  EvidenceCard,
  Hotspot,
  HypothesisDefinition,
  InvestigationLocation,
  LocationId,
  StudyGoal,
} from "./types";

export const noDialogueActionsText = "No further actions here. Check the map or Field Notebook for the next lead.";

export const chapterScenes: ChapterScene[] = [
  {
    id: "briefing",
    title: "Snow's Desk",
    subtitle: "September 1854",
    body: [
      "John Snow already suspects contaminated water can carry cholera, but the Broad Street outbreak must be investigated from field evidence.",
      "Our work is to collect addresses, listen for exposure histories, notice exceptions, and help turn scattered records into evidence the parish Board of Guardians can act on.",
    ],
  },
  {
    id: "board",
    title: "Board of Guardians",
    subtitle: "September 7, 1854",
    body: [
      "Snow presents the case for removing the Broad Street pump handle. The evidence is circumstantial, but it is specific, mapped, and action-oriented.",
      "The board is actively skeptical, but decides to follow Snow's advice and close the Broad Street pump by removing the handle. The decision was framed as temporary public health action while investigation continues.",
    ],
  },
  {
    id: "complete",
    title: "After the Meeting",
    subtitle: "The Board’s decision",
    body: [
      "The pump handle was removed on September 8. By late September the Broad Street outbreak has spent itself, leaving the parish to count its dead and argue over what the pattern means.",
      "Snow keeps the notebook open. The addresses, exceptions, and parish returns still need to be checked against new testimony from the streets around Broad Street.",
    ],
  },
];

// Concise arguments are conditional on the source notes the player has collected.
// Limits are not necessarily counterevidence: a clear sample cannot establish safety.
export const hypothesisDefinitions: HypothesisDefinition[] = [
  {
    id: "waterborne",
    title: "Broad Street pump water",
    shortTitle: "Water",
    summary: "A shared drinking-water source spreads cholera.",
    boardAction: "Close the pump temporarily while inquiry continues.",
    supportingEvidence: [
      { evidenceIds: ["household-water-pattern", "workhouse-exception"], text: "Households describe drinking pump water; the nearby workhouse had few deaths and a separate supply." },
      { evidenceIds: ["household-water-pattern"], text: "The households describe drinking Broad Street water and collecting it during daily errands." },
      { evidenceIds: ["workhouse-exception"], text: "The nearby workhouse had few deaths and used a separate water supply." },
      { evidenceIds: ["brewery-exception"], text: "No brewery workers died; they did not regularly drink from the street pump." },
      { evidenceIds: ["household-exposure"], text: "The bereaved household reports using Broad Street pump water." },
      { evidenceIds: ["pump-cluster"], text: "Deaths cluster around the pump, consistent with a shared local water source." },
    ],
    complicatingEvidence: [
      { evidenceIds: ["household-water-pattern", "pump-water-inspection"], text: "The water looked clear, and the interviews do not explain why some pump users remained well." },
      { evidenceIds: ["household-water-pattern"], text: "The interviews do not explain why some pump users remained well." },
      { evidenceIds: ["pump-water-inspection"], text: "The pump sample showed no obvious contamination." },
    ],
  },
  {
    id: "miasma",
    title: "Miasma or bad air",
    shortTitle: "Miasma",
    summary: "An unhealthy local atmosphere spreads cholera.",
    boardAction: "Prioritize street cleansing, drains and odor control.",
    supportingEvidence: [
      { evidenceIds: ["pump-cluster"], text: "Deaths cluster in one neighborhood, suggesting a local cause." },
    ],
    complicatingEvidence: [
      { evidenceIds: ["workhouse-exception", "brewery-exception"], text: "Workhouse residents and brewery workers shared the neighborhood air but largely escaped deaths, using other drinks or water." },
      { evidenceIds: ["workhouse-exception"], text: "The workhouse shared the neighborhood air, yet had few deaths and a separate water supply." },
      { evidenceIds: ["brewery-exception"], text: "Brewery workers shared the neighborhood air, yet none died and they avoided regular pump use." },
      { evidenceIds: ["household-water-pattern"], text: "Household interviews point to pump-water use, a more specific exposure than neighborhood air." },
    ],
  },
  {
    id: "person-to-person",
    title: "Household transmission",
    shortTitle: "Household",
    summary: "Close contact with sick people drives the outbreak.",
    boardAction: "Prioritize household precautions and further interviews.",
    supportingEvidence: [
      { evidenceIds: ["household-exposure"], text: "The survivor describes close nursing contact, making household spread a possibility to investigate." },
    ],
    complicatingEvidence: [
      { evidenceIds: ["attack-timeline"], text: "The abrupt surge in fatal attacks fits a shared exposure better than a slow chain of household spread." },
      { evidenceIds: ["household-water-pattern"], text: "Both household interviews describe use of the same pump." },
      { evidenceIds: ["pump-cluster"], text: "Deaths center on the pump rather than establishing a chain of nursing contacts." },
    ],
  },
  {
    id: "crowding",
    title: "Crowding or occupation",
    shortTitle: "Crowding",
    summary: "Living or working conditions drive the pattern.",
    boardAction: "Target relief and inspections at crowded homes and workplaces.",
    supportingEvidence: [
      { evidenceIds: ["pump-cluster"], text: "Deaths are concentrated in the same densely inhabited streets." },
    ],
    complicatingEvidence: [
      { evidenceIds: ["workhouse-exception"], text: "Over 500 people lived in the nearby workhouse, yet very few died; their water supply was separate." },
      { evidenceIds: ["brewery-exception"], text: "No brewery workers died despite working near the outbreak; they did not regularly use the street pump." },
      { evidenceIds: ["household-water-pattern"], text: "The interviews describe a shared drinking-water source across different daily routines." },
    ],
  },
];

export const locationInteractionHints: Record<LocationId, string> = {
  "snow-desk": "Select John Snow at his desk to speak with him.",
  "broad-street": "Use the pump handle to draw water, then select the pump to inspect it. Speak with Whitehead and both street residents. On day 3, a marked starting point begins the guided pump comparison.",
  household: "Select the seated household survivor to interview her.",
  registrar: "Select the registrar or the open ledger to review the death returns.",
  workhouse: "Select the steward to ask about the water supply. You can also work the pump handle and inspect its water.",
  brewery: "Select either brewery owner to ask about the workers' drinking water.",
  "household-routines": "Select the householder to begin the interview.",
  "household-away": "Select the householder to begin the interview.",
  "marlborough-pump": "Your visit is recorded automatically during the guided comparison. Resume the pump comparison to continue.",
  "rupert-pump": "Your visit is recorded automatically during the guided comparison. Resume the pump comparison to continue.",
  "board-room": "Select the table or a Board member to begin or resume the hearing.",
};

export const evidenceCards: EvidenceCard[] = [
  {
    id: "pump-cluster",
    title: "Deaths cluster around the Broad Street pump",
    summary:
      "Plotted addresses from the registrar's returns form a dense cluster around Broad Street, strongest near the public pump.",
    confidence: "observed",
    sourceType: "document",
    sourceLabel: "Registrar addresses plotted at Snow's desk",
    supports: ["Waterborne exposure", "Mapping deaths by address"],
    complicates: ["Miasma alone"],
  },
  {
    id: "attack-timeline",
    title: "A sudden surge of illness",
    summary:
      "The death returns show a sudden concentration of deaths around Broad Street at the end of August and in early September. Recorded durations of illness are often short.",
    confidence: "reported",
    sourceType: "document",
    sourceLabel: "Registrar’s death returns",
    supports: ["Common-source exposure", "Urgent public health action"],
    complicates: ["Slow person-to-person spread"],
  },
  {
    id: "household-exposure",
    title: "A bereaved household gives an exposure history",
    summary:
      "The household drank Broad Street water before the illness began in early September. Family members shared the room and nursed the sick person until their death.",
    confidence: "reported",
    sourceType: "interview",
    sourceLabel: "Household 1 interview",
    supports: ["Exposure history", "Household field inquiry", "Common-source testing"],
    complicates: ["Place-only explanations"],
  },
  {
    id: "household-water-pattern",
    title: "Water preference and routines shape exposure",
    summary:
      "The household prefers the taste of Broad Street water and collects it during errands. Water is carried home to people who do not visit the pump themselves.",
    confidence: "reported",
    sourceType: "interview",
    sourceLabel: "Household 2 interview",
    supports: ["Exposure history", "Common-source testing"],
    complicates: ["Anecdote alone", "Person-to-person spread alone", "Miasma alone"],
  },
  {
    id: "pump-water-inspection",
    title: "Pump water gives no decisive visible proof",
    summary:
      "The sample looks clear. Ordinary inspection reveals no decisive sign of contamination.",
    confidence: "observed",
    sourceType: "observation",
    sourceLabel: "Broad Street pump inspection",
    supports: ["Uncertainty", "Need for epidemiological evidence"],
    complicates: ["Waterborne exposure as obvious contamination"],
  },
  {
    id: "workhouse-exception",
    title: "St. James Workhouse has few deaths",
    summary:
      "The St. James Workhouse held over 500 inmates near the affected streets, but had very few deaths. They used a separate water supply.",
    confidence: "reported",
    sourceType: "interview",
    sourceLabel: "St. James Workhouse steward interview",
    supports: ["Water source matters", "Negative evidence"],
    complicates: ["Distance from bad air"],
  },
  {
    id: "brewery-exception",
    title: "No Lion Brewery workers died during the outbreak",
    summary:
      "The Lion Brewery was close to the outbreak, but no workers died. Workers were provided beer, as well as access to a private well at the brewery, and were not regular users of the street pump.",
    confidence: "reported",
    sourceType: "interview",
    sourceLabel: "Edward and John Huggins interview",
    supports: ["Exposure history", "Negative evidence"],
    complicates: ["Street-level miasma"],
  },
  { id: "nonlocal-exposure", title: "Residence is not necessarily exposure", summary: "A man who fell ill at home farther away drank Broad Street water while working nearby and sometimes carried a jug home.", confidence: "reported", sourceType: "interview", sourceLabel: "Household 3 interview", supports: ["Exposure history"], complicates: ["Distance alone"] },
  { id: "walking-access", title: "Walking access describes convenience, not consumption", summary: "Routes from two starting points compare Broad Street with the Marlborough and Rupert Street pumps. Street turns affect the journey; taste, errands and work also influence which water people use.", confidence: "inferred", sourceType: "inference", sourceLabel: "Paired pump-route comparisons", supports: ["Access as an exposure clue"], complicates: ["Nearest pump equals actual consumption"] },
];

export const fieldStudyGoal: StudyGoal = {
  title: "Build the inquiry from records, testimony, and exceptions",
  summary:
    "Begin at the General Register Office and consult the daily returns ledger for cholera deaths. Use those records to guide interviews, check water histories, inspect the pump sample, and test exceptions before drawing conclusions.",
};

// Conversations are actor-specific authored graphs in conversations.ts.
export const dialogueNodes: DialogueNode[] = [];

export const locations: InvestigationLocation[] = [
  {
    id: "snow-desk",
    title: "Snow's Desk",
    shortTitle: "Snow's Desk",
    description: "Return to Snow's working notes and the wider question of waterborne transmission.",
    mapPoint: { x: 50, y: 96 },
  },
  {
    id: "broad-street",
    title: "Broad Street Pump",
    shortTitle: "Pump",
    description: "The public pump whose water Snow suspects may be contaminated.",
    mapPoint: { x: 60, y: 45 },
  },
  {
    id: "household",
    title: "Household 1",
    shortTitle: "Household 1",
    description: "A bereaved household across the street from the pump.",
    mapPoint: { x: 53, y: 44 },
  },
  {
    id: "registrar",
    title: "Registrar's Ledger",
    shortTitle: "Registrar",
    description: "Daily mortality returns and addresses.",
    mapPoint: { x: 92, y: 92 },
  },
  {
    id: "workhouse",
    title: "St. James Workhouse",
    shortTitle: "St. James Workhouse",
    description: "A nearby institution that complicates any simple bad-air explanation.",
    mapPoint: { x: 50, y: 28 },
  },
  {
    id: "brewery",
    title: "Lion Brewery",
    shortTitle: "Lion Brewery",
    description: "A workplace exception that makes exposure history matter.",
    mapPoint: { x: 78, y: 40 },
  },
  {
    id: "board-room",
    title: "Board of Guardians",
    shortTitle: "Board",
    description: "Where the evidence becomes a public health recommendation.",
    mapPoint: { x: 50, y: 80 },
    boardOnly: true,
  },
  {id:"household-routines",title:"Household 2",shortTitle:"Household 2",description:"A household west of the Broad Street pump.",mapPoint:{x:42,y:49}},
  {id:"household-away",title:"Household 3",shortTitle:"Household 3",description:"A household farther southwest of the Broad Street pump.",mapPoint:{x:26,y:61}},
  {id:"marlborough-pump",title:"Marlborough Street Pump",shortTitle:"Marlborough pump",description:"An alternative water source for the pump-route comparison.",mapPoint:{x:16.4,y:33.9}},
  {id:"rupert-pump",title:"Rupert Street Pump",shortTitle:"Rupert pump",description:"The southern pump in the walking-route comparison.",mapPoint:{x:97.4,y:73.2}},
];

export const locationEvidenceIds: Partial<Record<LocationId, string[]>> = {
  "snow-desk": ["pump-cluster"],
  "broad-street": ["pump-water-inspection", "walking-access"],
  household: ["household-exposure"],
  "household-routines": ["household-water-pattern"],
  "household-away": ["nonlocal-exposure"],
  registrar: ["attack-timeline"],
  workhouse: ["workhouse-exception"],
  brewery: ["brewery-exception"],
};

export const hotspots: Hotspot[] = [
  {id:'workhouse-pump',locationId:'workhouse',label:'Workhouse pump',shortLabel:'Water sample',description:'Work the handle, then select the pump to inspect its water.',position:[3,1.4,-5.8]},
  {id:'survey-marlborough',locationId:'broad-street',label:'Compare nearby pumps · western starting point',shortLabel:'Compare pumps',description:'Compare both routes from this same marked origin.',position:[-8.5,1.25,-2]},
  {id:'survey-rupert',locationId:'broad-street',label:'Compare nearby pumps · eastern starting point',shortLabel:'Compare pumps',description:'Compare both routes from this same marked origin.',position:[8,1.25,-2]},
  {id:"resident-west",locationId:"broad-street",label:"Street shopkeeper",shortLabel:"Shopkeeper",description:"Ask about the chloride of lime and the neighborhood.",position:[-10,1.82,-7]},
  {id:"resident-east",locationId:"broad-street",label:"Street neighbor",shortLabel:"Neighbor",description:"Ask about the neighborhood’s disrupted routines.",position:[11,1.82,-7]},
  {id:"routines-household",locationId:"household-routines",label:"Householder",shortLabel:"Householder",description:"Speak with the householder.",position:[-.65,1.4,-.2],evidenceId:"household-water-pattern"},
  {id:"away-household",locationId:"household-away",label:"Householder",shortLabel:"Householder",description:"Speak with the householder.",position:[1,1.4,-1],evidenceId:"nonlocal-exposure"},
  {id:"board-hearing",locationId:"board-room",label:"Board hearing",shortLabel:"Hearing",description:"Begin or resume the presentation.",position:[0,1.4,-2.2]},
  { id: "whitehead", locationId: "broad-street", label: "Reverend Henry Whitehead", shortLabel: "Whitehead",
    description: "Speak with the local curate about the neighborhood and how to question an explanation.", position: [-6.5, 1.82, -5.6] },
  {
    id: "broad-street-pump",
    locationId: "broad-street",
    label: "Broad Street pump",
    shortLabel: "Pump",
    description: "Work the handle, then select the pump to inspect the water.",
    evidenceId: "pump-water-inspection",
    position: [-3.8, 1.45, 1.3],
  },
  {
    id: "registrar-ledger",
    locationId: "registrar",
    label: "Registrar's ledger",
    shortLabel: "Ledger",
    description: "Daily returns show how quickly the outbreak intensified.",
    evidenceId: "attack-timeline",
    position: [3.2, 1.3, 2.2],
  },
  {
    id: "broad-street-household",
    locationId: "household",
    label: "Bereaved household",
    shortLabel: "Household",
    description: "A survivor can confirm the water source and timing behind one death mark.",
    evidenceId: "household-exposure",
    position: [-2.25, 1.42, -0.95],
  },
  {
    id: "poland-workhouse",
    locationId: "workhouse",
    label: "St. James Workhouse",
    shortLabel: "St. James Workhouse",
    description: "A nearby institution appears to have escaped the worst of the outbreak.",
    evidenceId: "workhouse-exception",
    position: [3.6, 1.55, -1.7],
  },
  {
    id: "broad-street-brewery",
    locationId: "brewery",
    label: "Lion Brewery",
    shortLabel: "Lion Brewery",
    description: "No workers died here despite the Lion Brewery's proximity to the outbreak.",
    evidenceId: "brewery-exception",
    position: [3.4, 1.7, 1.8],
  },
  {
    id: "john-snow",
    locationId: "snow-desk",
    label: "John Snow",
    shortLabel: "Snow",
    description: "Snow asks what the pattern would look like if the water were the vehicle.",
    position: [-2.8, 1.55, 2.4],
  },
];
