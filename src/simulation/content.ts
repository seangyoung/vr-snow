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
    title: "Late September",
    subtitle: "Three weeks after the meeting",
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
      { evidenceIds: ["household-water-pattern", "workhouse-exception"], text: "Composite household accounts describe pump use; the nearby workhouse had few deaths and a separate supply." },
      { evidenceIds: ["household-water-pattern"], text: "The composite household accounts describe Broad Street water use and the routines behind it." },
      { evidenceIds: ["workhouse-exception"], text: "The nearby workhouse had few deaths and used a separate water supply." },
      { evidenceIds: ["brewery-exception"], text: "No brewery workers died; they did not regularly drink from the street pump." },
      { evidenceIds: ["household-exposure"], text: "The bereaved household reports using Broad Street pump water." },
      { evidenceIds: ["pump-cluster"], text: "Deaths cluster around the pump, consistent with a shared local water source." },
    ],
    complicatingEvidence: [
      { evidenceIds: ["household-water-pattern", "pump-water-inspection"], text: "Illustrative interviews cannot establish a population rate; inspecting the water gave no decisive proof." },
      { evidenceIds: ["household-water-pattern"], text: "The small set of illustrative accounts cannot establish a population rate; recalled exposure needs checking." },
      { evidenceIds: ["pump-water-inspection"], text: "The water sample gave no decisive visible proof. Clear-looking water does not establish safety." },
    ],
  },
  {
    id: "miasma",
    title: "Miasma or bad air",
    shortTitle: "Miasma",
    summary: "An unhealthy local atmosphere spreads cholera.",
    boardAction: "Prioritize street cleansing, drains and odor control.",
    supportingEvidence: [
      { evidenceIds: ["pump-cluster"], text: "Deaths cluster in one neighborhood, consistent with a local influence but not specific evidence of bad air." },
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
      { evidenceIds: ["household-water-pattern"], text: "Many affected households report the same pump-water exposure." },
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
      { evidenceIds: ["pump-cluster"], text: "Deaths are concentrated locally, leaving shared living conditions possible; the map alone cannot establish them as the cause." },
    ],
    complicatingEvidence: [
      { evidenceIds: ["workhouse-exception"], text: "Over 500 people lived in the nearby workhouse, yet very few died; their water supply was separate." },
      { evidenceIds: ["brewery-exception"], text: "No brewery workers died despite working near the outbreak; they did not regularly use the street pump." },
      { evidenceIds: ["household-water-pattern"], text: "Interview histories point to a shared water source rather than establishing a class or occupational cause." },
    ],
  },
];

export const locationInteractionHints: Record<LocationId, string> = {
  "snow-desk": "Select John Snow at his desk to speak with him.",
  "broad-street": "Select the pump to investigate the water. Speak with Whitehead and both street residents. Day 3 survey origins are marked on the pavement.",
  household: "Select the seated household survivor to interview her.",
  registrar: "Select the registrar or the open ledger to review the death returns.",
  workhouse: "Select the steward to ask about the workhouse water supply.",
  brewery: "Select either brewery owner to ask about the workers' drinking water.",
  "household-routines": "Select the householder to ask about water preferences and errands.",
  "household-away": "Select the householder to trace a connection to Broad Street.",
  "marlborough-pump": "Inspect the survey stop and record the selected route comparison.",
  "rupert-pump": "Inspect the survey stop and record the selected route comparison.",
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
    title: "The outbreak rises and falls abruptly",
    summary:
      "Snow’s retrospective 1855 Table I lists 56 fatal attacks on August 31, 143 on September 1 and 116 on September 2. These estimated attack dates differ from death dates; the figures were compiled after the outbreak.",
    confidence: "reported",
    sourceType: "document",
    sourceLabel: "Snow (1855), Table I; retrospective fatal-attack series, not same-day death reports",
    supports: ["Common-source exposure", "Urgent public health action"],
    complicates: ["Slow person-to-person spread"],
  },
  {
    id: "household-exposure",
    title: "A bereaved household gives an exposure history",
    summary:
      "A local survivor reports a death during the surge and records the household's pump-water use, attack timing, and close nursing contact.",
    confidence: "reported",
    sourceType: "interview",
    sourceLabel: "Composite household and reconstructed testimony; Snow (1855), Broad Street account",
    supports: ["Exposure history", "Household field inquiry", "Common-source testing"],
    complicates: ["Place-only explanations"],
  },
  {
    id: "household-water-pattern",
    title: "Water preference and routines shape exposure",
    summary:
      "A second composite household describes choosing Broad Street water for its taste and collecting it during errands. These illustrative accounts support an exposure explanation but do not establish a population tally.",
    confidence: "reported",
    sourceType: "interview",
    sourceLabel: "Composite household and reconstructed testimony; Snow (1855), water preferences",
    supports: ["Exposure history", "Statistical pattern", "Common-source testing"],
    complicates: ["Anecdote alone", "Person-to-person spread alone", "Miasma alone"],
  },
  {
    id: "pump-water-inspection",
    title: "Pump water gives no decisive visible proof",
    summary:
      "Snow's sample from the Broad Street pump did not make the danger obvious by ordinary inspection, leaving the case dependent on exposure histories and mapped pattern.",
    confidence: "observed",
    sourceType: "observation",
    sourceLabel: "Snow's pump-water inspection",
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
  { id: "nonlocal-exposure", title: "Residence is not necessarily exposure", summary: "A composite household account connects a distant residence to Broad Street through daily activity and carried water. Snow described distant cases with work, school or water connections; each link still needs checking.", confidence: "reported", sourceType: "interview", sourceLabel: "Composite household; Snow (1855), explanation of the map and distant cases", supports: ["Exposure history"], complicates: ["Distance alone"] },
  { id: "walking-access", title: "Walking access describes convenience, not consumption", summary: "Two paired route comparisons use the same origin within each pair and a 1.2 m/s teaching walking-speed assumption. The revealed PumpServiceArea is the historical walking-access boundary, not a polygon calculated from these four walks. Preferences, errands and carried water can override proximity.", confidence: "inferred", sourceType: "inference", sourceLabel: "Teaching route estimates on the historical map; Snow (1855), discussion of Marlborough and Rupert Street pumps", supports: ["Access as an exposure clue"], complicates: ["Nearest pump equals actual consumption"] },
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
    title: "Broad Street Household",
    shortTitle: "Household",
    description: "A representative Broad Street household interview explores timing, care, and water-use testimony; this doorway is illustrative.",
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
  {id:"household-routines",title:"Household: Water Routines",shortTitle:"Water routines",description:"A second composite household explores preference, errands and carried water; the map placement is illustrative.",mapPoint:{x:42,y:49}},
  {id:"household-away",title:"Household: A Daily Journey",shortTitle:"Daily journey",description:"A composite household away from the pump illustrates a connection through daily activity; this is not a documented address.",mapPoint:{x:26,y:61}},
  {id:"marlborough-pump",title:"Marlborough Street Pump",shortTitle:"Marlborough pump",description:"A compact interpretive fieldwork stop at the alternative pump.",mapPoint:{x:16.4,y:33.9}},
  {id:"rupert-pump",title:"Rupert Street Pump",shortTitle:"Rupert pump",description:"A compact interpretive fieldwork stop for the southern comparison.",mapPoint:{x:97.4,y:73.2}},
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
  {id:'survey-marlborough',locationId:'broad-street',label:'Survey A · western origin',shortLabel:'Survey A',description:'Compare both routes from this same marked origin.',position:[-8.5,1.25,-2]},
  {id:'survey-rupert',locationId:'broad-street',label:'Survey B · eastern origin',shortLabel:'Survey B',description:'Compare both routes from this same marked origin.',position:[8,1.25,-2]},
  {id:'survey-broad-pump',locationId:'broad-street',label:'Record Broad Street route',shortLabel:'Survey stop',description:'Record the selected walk at the pump.',position:[-3.0,1.2,1.9]},
  {id:'survey-marlborough-pump',locationId:'marlborough-pump',label:'Marlborough survey stop',shortLabel:'Record route',description:'Record the selected route.',position:[.65,1.25,-2]},
  {id:'survey-rupert-pump',locationId:'rupert-pump',label:'Rupert survey stop',shortLabel:'Record route',description:'Record the selected route.',position:[.65,1.25,-2]},
  {id:"resident-west",locationId:"broad-street",label:"Street shopkeeper",shortLabel:"Shopkeeper",description:"Ask about the chloride of lime and the neighborhood.",position:[-10,1.82,-7]},
  {id:"resident-east",locationId:"broad-street",label:"Street neighbor",shortLabel:"Neighbor",description:"Ask about the neighborhood’s disrupted routines.",position:[11,1.82,-7]},
  {id:"routines-household",locationId:"household-routines",label:"Householder",shortLabel:"Householder",description:"Ask about water preferences.",position:[-.65,1.4,-.2],evidenceId:"household-water-pattern"},
  {id:"away-household",locationId:"household-away",label:"Householder",shortLabel:"Householder",description:"Trace a connection to Broad Street.",position:[1,1.4,-1],evidenceId:"nonlocal-exposure"},
  {id:"board-hearing",locationId:"board-room",label:"Board hearing",shortLabel:"Hearing",description:"Begin or resume the presentation.",position:[0,1.4,-2.2]},
  { id: "whitehead", locationId: "broad-street", label: "Reverend Henry Whitehead", shortLabel: "Whitehead",
    description: "Speak with the local curate about the neighborhood and how to question an explanation.", position: [-6.5, 1.82, -5.6] },
  {
    id: "broad-street-pump",
    locationId: "broad-street",
    label: "Broad Street pump",
    shortLabel: "Pump",
    description: "Snow can inspect whether the pump water itself gives any visible sign of danger.",
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
