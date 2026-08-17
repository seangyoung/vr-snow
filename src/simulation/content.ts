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

export const hypothesisDefinitions: HypothesisDefinition[] = [
  {
    id: "waterborne",
    title: "Broad Street pump water",
    shortTitle: "Water",
    summary:
      "A common-source exposure centered on drinking water from the Broad Street pump or water carried from it.",
    boardAction: "Remove the Broad Street pump handle temporarily while inquiry continues.",
    supportingEvidenceIds: [
      "pump-cluster",
      "household-exposure",
      "household-water-pattern",
      "attack-timeline",
      "workhouse-exception",
      "brewery-exception",
    ],
    complicatingEvidenceIds: ["pump-water-inspection"],
    snowChallenge:
      "Strongest case. Snow wants us to state the uncertainty plainly: a clean-looking sample does not give final proof, but a mapped pattern and exposure histories may justify temporary action.",
  },
  {
    id: "miasma",
    title: "Miasma or bad air",
    shortTitle: "Miasma",
    summary:
      "Poisonous air from smells, drains, sewers, weather, or street conditions is driving illness near Broad Street.",
    boardAction: "Prioritize street cleansing, drainage, and odor abatement around the affected streets.",
    supportingEvidenceIds: ["pump-cluster", "pump-water-inspection"],
    complicatingEvidenceIds: ["household-exposure", "household-water-pattern", "workhouse-exception", "brewery-exception"],
    snowChallenge:
      "Snow asks us why nearby institutions and workplaces exposed to the same street air were not devastated in the same way.",
  },
  {
    id: "person-to-person",
    title: "Household transmission",
    shortTitle: "Household",
    summary:
      "Cholera is spreading mainly through nursing, shared rooms, and direct contact between sick people and families.",
    boardAction: "Emphasize household isolation and care precautions while collecting more case histories.",
    supportingEvidenceIds: ["household-exposure"],
    complicatingEvidenceIds: ["attack-timeline", "pump-cluster", "pump-water-inspection", "household-water-pattern"],
    snowChallenge:
      "Snow asks us whether a slow chain of household spread predicts the abrupt surge and dense pump-centered geography.",
  },
  {
    id: "crowding",
    title: "Crowding, poverty, or occupation",
    shortTitle: "Crowding",
    summary:
      "The pattern follows class, occupation, crowded lodging, or institutional living more than a shared water exposure.",
    boardAction: "Target inspections and relief at crowded homes and affected occupations.",
    supportingEvidenceIds: ["pump-cluster"],
    complicatingEvidenceIds: [
      "household-exposure",
      "household-water-pattern",
      "pump-water-inspection",
      "workhouse-exception",
      "brewery-exception",
    ],
    snowChallenge:
      "Snow asks us why the St. James Workhouse and Lion Brewery complicate a simple social or occupational explanation.",
  },
];

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
      "Parish figures show a sharp surge after August 30: 31 fatal attacks on August 31, then 131 and 125 over the next two days.",
    confidence: "reported",
    sourceType: "document",
    sourceLabel: "Registrar's daily returns",
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
    sourceLabel: "Local household interview",
    supports: ["Exposure history", "Household field inquiry", "Common-source testing"],
    complicates: ["Place-only explanations"],
  },
  {
    id: "household-water-pattern",
    title: "Other household interviews show pump-water exposure",
    summary:
      "Among 75 early deaths with known pump-use histories, household respondents identified 68 Broad Street pump users, one probable user, and six non-users.",
    confidence: "reported",
    sourceType: "interview",
    sourceLabel: "Follow-up household interviews",
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
];

export const fieldStudyGoal: StudyGoal = {
  title: "Build the inquiry from records, testimony, and exceptions",
  summary:
    "Begin at the General Register Office and consult the daily returns ledger for cholera deaths. Use those records to guide interviews, check water histories, inspect the pump sample, and test exceptions before drawing conclusions.",
};

export const dialogueNodes: DialogueNode[] = [
  {
    id: "snow-briefing",
    locationId: "snow-desk",
    speaker: "John Snow",
    role: "Physician and investigator",
    intro:
      "Snow stands over his notes, careful and methodical. He wants every claim we make tied to an address, a date, or a witness.",
    questions: [
      {
        id: "snow-method-question",
        prompt: "Where should we begin the inquiry?",
        response:
          "We begin with the records. We should go to the General Register Office and consult the daily returns ledger for cholera deaths: dates, addresses, and fatal attacks. Then we can use those records to guide household interviews, check water histories, inspect the pump sample, and test exceptions.",
      },
      {
        id: "ledger-address-question",
        prompt: "Why copy addresses from the registrar's ledger?",
        response:
          "The register's totals show severity. Its addresses show pattern. We need both to compare the timing with the geography.",
        requiresEvidenceIds: ["attack-timeline"],
      },
      {
        id: "pump-cluster-question",
        prompt: "What do our plotted addresses show?",
        response:
          "The marks crowd around Broad Street. The pattern does not explain every case, but it gives our inquiry a center of gravity. Open the map to inspect the plotted deaths around the pump.",
        unlocksEvidenceId: "pump-cluster",
        requiresEvidenceIds: ["attack-timeline"],
      },
      {
        id: "pump-limits-question",
        prompt: "Does the cluster alone settle the cause?",
        response:
          "No. A cluster is a lead, not proof. We still need timing, exposure histories, and an explanation for exceptions to the pattern.",
        requiresEvidenceIds: ["pump-cluster", "pump-water-inspection"],
      },
      {
        id: "household-contact-question",
        prompt: "Could nursing the sick person explain the spread?",
        response:
          "Close care may matter inside a home, but we have to ask whether many separate households were struck after drawing from the same pump.",
        requiresEvidenceIds: ["household-exposure"],
      },
      {
        id: "workhouse-miasma-question",
        prompt: "What does the St. James Workhouse exception tell us about street air?",
        response:
          "We would expect the nearby institution to suffer heavily as well. Its relative escape pushes the inquiry back toward water source and exposure.",
        requiresEvidenceIds: ["workhouse-exception"],
      },
      {
        id: "brewery-exposure-question",
        prompt: "Why does the Lion Brewery exception matter?",
        response:
          "It reminds us why place alone is not enough. We must ask what people actually consumed, not merely where they stood.",
        requiresEvidenceIds: ["brewery-exception"],
      },
    ],
  },
  {
    id: "pump-observation",
    locationId: "broad-street",
    speaker: "Broad Street pump",
    role: "Street observation",
    intro:
      "Snow suspects the pump water may carry the danger, but suspicion is not the same as proof. The sample must be inspected for any visible sign of contamination.",
    questions: [
      {
        id: "pump-caution-question",
        prompt: "What did Snow's water sample show?",
        response:
          "The sample did not give decisive proof by sight, taste, smell, or simple inspection. Snow records that absence as a problem for the argument, not a reason to ignore the map.",
        unlocksEvidenceId: "pump-water-inspection",
      },
    ],
  },
  {
    id: "registrar-ledger-interview",
    locationId: "registrar",
    speaker: "Registrar",
    role: "Parish records",
    intro:
      "The registrar's ledger turns the outbreak into dates, addresses, and a curve of fatal attacks.",
    questions: [
      {
        id: "ledger-timeline-question",
        prompt: "When did the outbreak surge?",
        response:
          "The returns rise sharply after August 30: 31 fatal attacks on August 31, then 131 and 125 over the next two days before falling.",
        unlocksEvidenceId: "attack-timeline",
      },
    ],
  },
  {
    id: "household-interview",
    locationId: "household",
    speaker: "Bereaved household survivor",
    role: "Household witness",
    intro:
      "A black ribbon hangs at the door. Snow has the address from the returns; now he needs the timing, care, and water habits behind the death mark.",
    questions: [
      {
        id: "household-water-question",
        prompt: "What water did the household use before the illness?",
        response:
          "The family fetched from the Broad Street pump because it was near and well regarded. We'll record the water source and the time symptoms began.",
        unlocksEvidenceId: "household-exposure",
      },
      {
        id: "household-pattern-question",
        prompt: "Conduct interviews at other households",
        response:
          "Taken one by one, the accounts are imperfect; taken together, they become a pattern. Of 75 early deaths where pump use could be learned, 68 were Broad Street pump users, one was a probable user, and six were non-users.",
        unlocksEvidenceId: "household-water-pattern",
        requiresEvidenceIds: ["household-exposure"],
      },
    ],
  },
  {
    id: "workhouse-interview",
    locationId: "workhouse",
    speaker: "St. James Workhouse steward",
    role: "Institutional witness",
    intro:
      "The St. James Workhouse holds over 500 inmates close to affected streets, but reports very few deaths. Snow wants to know whether its water supply explains the exception.",
    questions: [
      {
        id: "workhouse-water-question",
        prompt: "Where did the inmates get water?",
        response:
          "The St. James Workhouse had its own supply. With over 500 inmates so near Broad Street, the very small number of deaths becomes important negative evidence.",
        unlocksEvidenceId: "workhouse-exception",
      },
    ],
  },
  {
    id: "brewery-interview",
    locationId: "brewery",
    speaker: "Edward and John Huggins",
    role: "Lion Brewery owners",
    intro:
      "Edward and John Huggins receive Snow's questions at the Lion Brewery. The brewery stands near the affected area, yet no workers are reported dead. Snow wants to know what made this workplace different.",
    questions: [
      {
        id: "brewery-drink-question",
        prompt: "What did your workers drink during the day?",
        response:
          "Edward and John Huggins report that no Lion Brewery workers died during the outbreak. Workers had beer or the brewery's own water available and were not regular users of the Broad Street pump.",
        unlocksEvidenceId: "brewery-exception",
      },
    ],
  },
];

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
    title: "Golden Square Household",
    shortTitle: "Household",
    description: "A household interview turns a death mark into timing, care, and water-use testimony.",
    mapPoint: { x: 45, y: 67 },
    unlocksWith: "pump-cluster",
  },
  {
    id: "registrar",
    title: "Registrar's Ledger",
    shortTitle: "Ledger",
    description: "Daily mortality returns and addresses.",
    mapPoint: { x: 92, y: 92 },
  },
  {
    id: "workhouse",
    title: "St. James Workhouse",
    shortTitle: "St. James Workhouse",
    description: "A nearby institution that complicates any simple bad-air explanation.",
    mapPoint: { x: 50, y: 28 },
    unlocksWith: "pump-cluster",
  },
  {
    id: "brewery",
    title: "Lion Brewery",
    shortTitle: "Lion Brewery",
    description: "A workplace exception that makes exposure history matter.",
    mapPoint: { x: 78, y: 40 },
    unlocksWith: "pump-cluster",
  },
  {
    id: "board-room",
    title: "Board of Guardians",
    shortTitle: "Board",
    description: "Where the evidence becomes a public health recommendation.",
    mapPoint: { x: 50, y: 80 },
    boardOnly: true,
  },
];

export const locationEvidenceIds: Partial<Record<LocationId, string[]>> = {
  "snow-desk": ["pump-cluster"],
  "broad-street": ["pump-water-inspection"],
  household: ["household-exposure", "household-water-pattern"],
  registrar: ["attack-timeline"],
  workhouse: ["workhouse-exception"],
  brewery: ["brewery-exception"],
};

export const hotspots: Hotspot[] = [
  {
    id: "broad-street-pump",
    locationId: "broad-street",
    label: "Broad Street pump",
    shortLabel: "Pump",
    description: "Snow can inspect whether the pump water itself gives any visible sign of danger.",
    evidenceId: "pump-water-inspection",
    position: [1.45, 1.45, -5.4],
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

export const boardThreshold = 6;
