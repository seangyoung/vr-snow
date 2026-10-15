import type { ConversationBeat, ConversationDefinition, ActorId } from './conversations';
import type { InquiryDay, ObjectiveId } from './campaign';
import type { LocationId } from './types';
const choice = (id: string, label: string, next: string) => ({id,label,next});
const source = 'Authored teaching dialogue informed by Snow (1855), On the Mode of Communication of Cholera, Broad Street account and Table I. Dates are compressed; these are not verbatim historical conversations.';
const composite = source + ' This household, its room and testimony are composites; no named historical family or surveyed address is represented.';
function interview(id: string, actorId: ActorId, locationId: LocationId, speaker: string, anchor: [number,number,number], objective: ObjectiveId, evidenceId: string,
 opening: string, approaches: [string,string][], followup: string, limit: string, summary: string): ConversationDefinition {
 return {id,actorId,locationId,title:'Field interview',anchor,start:'opening',sourceNote:locationId.startsWith('household')?composite:source,beats:[
  {id:'opening',speaker,text:opening,choices:approaches.map(([label],i)=>choice(`approach-${i}`,label,`answer-${i}`))},
  ...approaches.map(([,text],i)=>({id:`answer-${i}`,speaker,text,choices:[choice('follow','Let me check that I understand.','followup')]})),
  {id:'followup',speaker,text:followup,choices:[choice('limits','What remains uncertain?','limits'),choice('compare','How should we compare this with the other accounts?','comparison')]},
  {id:'limits',speaker,text:limit,choices:[choice('record','I will record the account with that qualification.','conclusion')]},
  {id:'comparison',speaker:'John Snow · field note',text:'Record the source and separate what was seen from what was recalled. A useful account must still be compared with the others, including accounts that disagree.',choices:[choice('record','Add the account and its limits to the notebook.','conclusion')]},
  {id:'conclusion',speaker,text:summary,choices:[],conclusion:{objective,evidenceId}},
 ]};
}
export const campaignConversations: ConversationDefinition[] = [
 interview('registrar-records','registrar','registrar','Registrar',[0,1.3,-.12],'records','attack-timeline',
 'These returns record deaths, addresses and reported durations of illness. What would you like to establish before you copy them?',[
 ['Which dates belong on our inquiry sheet?','Keep the date of death separate from the beginning of illness. A death recorded today may follow an attack that began earlier.'],
 ['Can we plot the addresses?','Copy the house number as well as the street. A hospital death must be traced back to the person’s residence; a hospital dot would answer a different question.'],
 ['Do the records name a cause?','They identify deaths attributed to cholera, not the water each person drank. That requires inquiry among households.']],
 'The sudden concentration of deaths demands attention, but the return is a starting point. Snow’s later Table I separates deaths from estimated fatal attacks; the notebook labels that retrospective series.',
 'Some addresses and durations are incomplete. Do not pretend that the returns alone reveal either the place of exposure or every case of illness.',
 'The records are copied. Take them to the households, then return to Snow to plot the addresses.'),
 interview('household-first','survivor','household','Bereaved householder',[.25,1.2,-.55],'first-household','household-exposure',
 'I can tell you what I remember, though the days have run together. Please ask one thing at a time.',[
 ['May we begin with when the illness started?','It came on during those terrible first days of September. We were fetching help and caring for the sick; I cannot give you the hour.'],
 ['Where did the household get drinking water?','We brought drinking water from Broad Street. It was familiar, and fetching it was part of the day’s work.'],
 ['Who cared for the sick person?','We shared the room and took turns caring for them. Close contact was unavoidable, so please do not leave that out of your account.']],
 'Our account includes Broad Street water, illness during the surge, and close nursing contact. Any explanation must consider all three, not simply choose the detail it prefers.',
 'I cannot say that everyone drank the same amount, or that water caused this death. What I remember is not a measurement.',
 'You have recorded this household’s testimony. Please carry our words carefully when you speak to Dr. Snow.'),
 interview('pump-sample','pump','broad-street','John Snow · sample notes',[-3.8,1.4,1.3],'sample','pump-water-inspection',
 'The pump still supplies water. Before drawing a conclusion from a sample, what would you examine?',[
 ['Does it look obviously contaminated?','Ordinary inspection does not provide decisive visible evidence of danger. Appearance alone cannot establish that the water is safe.'],
 ['Would clear water rule out Snow’s idea?','No. Clear-looking water can still be an uncertain exposure; the inquiry cannot be settled by appearance.'],
 ['Should we compare the sample with the interviews?','Yes. The sample is one observation, while testimony concerns what people consumed before they became ill. They answer different questions.']],
 'The recorded result is inconclusive. We still need the drinking histories and the nearby exceptions to test the explanation.',
 'Do not write “poison found,” or “proved safe.” Neither follows from this inspection.',
 'The sample observation and its limits are in the notebook.'),
 interview('household-routines','water-householder','household-routines','Householder · water routines',[-.65,1.2,-.2],'water-routines','household-water-pattern',
 'The nearest pump is not always the one a household chooses. We have our habits, and someone must carry every jug.',[
 ['Why choose Broad Street water?','We preferred it to water we disliked elsewhere. A little extra carrying seemed worthwhile; distance was not our only consideration.'],
 ['Who collected the water?','Someone already going on an errand could bring it back. A person might drink it here without going near the pump themselves.'],
 ['Did everyone follow the same routine?','No. Work and errands took us to different places, and people drank different amounts. A household address does not describe each person’s day.']],
 'Broad Street water entered this home through preference and routine. Compare that with the first household, but do not turn two accounts into a population survey.',
 'We are reconstructing ordinary habits from memory. This interview gives a plausible exposure history, not a count of every pump user in Soho.',
 'Record water preference, errands and carried water together. They may explain why simple distance is misleading.'),
 interview('workhouse-supply','steward','workhouse','Workhouse steward',[-1.5,1.45,-7.8],'workhouse','workhouse-exception',
 'Our institution stands close to the affected streets. That makes the difference in mortality worth examining.',[
 ['How many people lived here?','There were over five hundred inmates, yet very few deaths. Proximity to the outbreak did not bring the same experience as the neighboring households.'],
 ['Where did the drinking water come from?','The workhouse had a separate supply. We did not depend on the Broad Street street-pump for ordinary drinking water.'],
 ['Does this disprove foul air?','It challenges an explanation based only on being near these streets. It does not mean we have controlled every difference between life here and outside.']],
 'Many people nearby, relatively few deaths, and a separate water supply: those facts must be considered together.',
 'The workhouse differs from a private household in many ways. Use it as a comparison that tests a theory, not as a perfectly controlled experiment.',
 'The institutional exception is recorded, including its separate water supply.'),
 interview('brewery-supply','brewery-owner','brewery','Edward and John Huggins',[-2.65,1.4,2.5],'brewery','brewery-exception',
 'Our brewery is close to Broad Street, yet we report no deaths among our workers. Ask about their day before deciding what that means.',[
 ['What did the workers drink?','Beer was available to the workers, and the brewery had its own well. They were not regular users of the public pump.'],
 ['Were the men breathing different street air?','They worked near the affected neighborhood. A simple account of a deadly atmosphere must explain their apparent escape.'],
 ['Does this prove beer protects people?','No. It points to a different drinking routine. It cannot establish that a particular drink is a cure or protection.']],
 'Compare the brewery with the workhouse: different institutions, both with alternatives to Broad Street pump water.',
 'A report of no deaths does not by itself prove that no worker had any illness. Keep that distinction in your notes.',
 'The owners’ account is recorded as an exception that tests exposure, rather than as proof by itself.'),
 interview('household-away','away-householder','household-away','Householder · a daily journey',[1.0,1.2,-1.0],'nonlocal','nonlocal-exposure',
 'Our home is away from the pump, but our days were not spent entirely here. That is what I want you to understand.',[
 ['Did work take someone to Broad Street?','Yes. Work brought a member of this household into the neighborhood, where water could be obtained during the day.'],
 ['Could drinking water be brought home?','A jug could travel farther than the person who eventually drank it. Please ask where water came from rather than assuming it came from the closest pump.'],
 ['Why does the distant address matter?','A distant death might look like an objection to the pump theory. A connection to Broad Street makes it a different question, though the connection must be checked.']],
 'This composite account illustrates a distinction: residence, place of illness and place of exposure may differ. Snow described distant cases connected through work, school or carried water.',
 'The reconstructed household is not a newly discovered historical case. Its lesson is to trace a connection, not to assume every distant case fits.',
 'The nonlocal exposure finding is recorded with its composite source note.'),
];

for (const day of [2,3] as const) campaignConversations.push({id:`snow-day-${day}`,actorId:'john-snow',locationId:'snow-desk',title:`Day ${day} assignments`,anchor:[-.65,1.35,-2.15],start:'opening',sourceNote:source,beats:[
 {id:'opening',speaker:'John Snow',text:day===2?'Yesterday’s map showed a concentration, but place alone does not establish cause. Today we test the water explanation against observation and contrasting routines.':'Today we must explain the exceptions: people nearby who escaped, and illness at addresses farther away. Then we will consider what action the Board can justify.',choices:[choice('plan','What shall I investigate?','plan'),choice('doubt','What would challenge our interpretation?','doubt')]},
 {id:'doubt',speaker:'John Snow',text:'An explanation must accommodate evidence that seems inconvenient. Seek the differences in exposure and acknowledge where the account remains uncertain.',choices:[choice('plan','Let us plan the inquiries.','plan')]},
 {id:'plan',speaker:'John Snow',text:day===2?'Inspect the pump sample, visit the second household about water preferences, and ask the workhouse steward about its supply. Bring all three accounts back.':'Speak with the brewery owners and the household describing a daily journey. At the marked survey origins on Broad Street, compare access to Marlborough and Rupert Street pumps, then return here.',choices:[choice('accept','I will bring back those findings.','conclusion')]},
 {id:'conclusion',speaker:'John Snow',text:'The assignments are in your notebook and on the map. You may revisit earlier witnesses along the way.',choices:[],conclusion:{assignmentDay:day}},
]});
for (const day of [1,2,3] as InquiryDay[]) campaignConversations.push({id:`snow-recap-${day}`,actorId:'john-snow',locationId:'snow-desk',title:`Day ${day} review`,anchor:[-.65,1.35,-2.15],start:'opening',sourceNote:source,beats:[
 {id:'opening',speaker:'John Snow',text:day===1?'We have the copied returns and a household history. Let us plot the addresses and ask what the pattern can establish.':day===2?'The sample, the second household and the workhouse now belong in the same argument. Which result should we examine first?':'We have the brewery, a nonlocal connection and the access comparisons. Let us test our argument before we meet the Board.',choices:[choice('pattern',day===1?'Plot the addresses.':'Compare the exposure accounts.','pattern'),choice('limits','Start with what remains uncertain.','limits')]},
 {id:'pattern',speaker:'John Snow',text:day===1?'The plotted addresses concentrate around Broad Street. That guides the next questions; it does not tell us the water each person drank.':day===2?'The clear-looking sample was inconclusive; testimony describes water choices, and the nearby workhouse had a separate supply. The comparison is stronger than any one item.':'The brewery challenges a place-only explanation; the distant household shows why residence is not exposure. Walking access helps explain convenience, not actual consumption.',choices:[choice('limits','What must we avoid claiming?','limits')]},
 {id:'limits',speaker:'John Snow',text:day===1?'The plotted addresses cluster around Broad Street, but that pattern can fit more than one explanation. We need comparisons of exposure; testimony alone is not proof.':day===2?'Two illustrative households cannot establish a population tally. Institutions also differ in ways other than water; acknowledge those limits.':'Four teaching routes do not calculate the historical boundary. Nor does a convenient pump prove that someone drank from it: preferences, work and carried water can create exceptions.',choices:[choice('next','What should happen next?','next')]},
 {id:'next',speaker:'John Snow',text:day<3?'You may revisit the neighborhood before we close today’s work. When ready, choose End day; tomorrow’s questions will build on these findings.':'Choose the theory that best accounts for the evidence, including its strongest objection. We can recommend a temporary action without claiming final proof.',choices:[choice('record','Record our review.','conclusion')]},
 {id:'conclusion',speaker:'John Snow',text:day<3?'Today’s review is recorded. End the day when you are ready.':'The field inquiry is reviewed. Prepare the argument, then choose Attend the meeting.',choices:[],terminalAction:day<3?'end-day':'review-theory',conclusion:{recapDay:day,...(day===1?{evidenceId:'pump-cluster'}:{})}},
]});

const street: Record<string,{actor: ActorId; speaker:string; anchor:[number,number,number]; days:[string,string,string]}> = {
 whitehead:{actor:'whitehead',speaker:'Reverend Henry Whitehead',anchor:[-6.5,1.5,-5.6],days:[
 '',
 'I remain unconvinced that Broad Street water explains the outbreak. The nearby people who escaped deserve as much attention as those who died.',
 'You have found exceptions to examine, but I am not persuaded by the pump explanation. A thorough inquiry among the families is still needed before such claims can be settled.']},
 'resident-west':{actor:'resident-west',speaker:'Street resident · shopkeeper',anchor:[-10,1.5,-7],days:[
 'The street smells strongly of chloride of lime. The parish has been washing the roadway, and the stones and gutters show the white residue.',
 'The lime is still being used. People hope that cleaning the street will help, but a sharp smell does not tell us whether the danger is gone.',
 'We have scrubbed and waited for news. Please tell the Board what you actually found, not merely which remedy the neighborhood hopes will work.']},
 'resident-east':{actor:'resident-east',speaker:'Street resident · neighbor',anchor:[11,1.5,-7],days:[
 'Ordinary errands have become visits for help and news. A closed shutter may mean illness, mourning, or a household that has gone away.',
 'Some neighbors have left, while others carry water or provisions for people who cannot go out. Our routines are not what they were a week ago.',
 'An empty house does not mean everyone escaped, and an occupied one does not tell you who is ill. Ask the families before turning an address into a conclusion.']},
};
for (const [id,person] of Object.entries(street)) for(const day of [1,2,3] as const) {
 if(id==='whitehead' && day===1)continue;
 campaignConversations.push({id:`${id}-day-${day}`,actorId:person.actor,locationId:'broad-street',title:'Neighborhood conversation',anchor:person.anchor,start:'opening',sourceNote:'Authored contextual conversation, informed by Whitehead and contemporary accounts reproduced in UCLA John Snow archive, Stream 2e. No evidence card; Whitehead’s later findings are reserved for the epilogue.',beats:[
  {id:'opening',speaker:person.speaker,text:person.days[day-1],choices:[choice('follow',id==='whitehead'?'What would you want an inquiry to account for?':'What should I keep in mind?','follow'),choice('listen','Thank you. I will keep your account in mind.','conclusion')]},
  {id:'follow',speaker:person.speaker,text:id==='whitehead'?'Everyone’s account matters, especially an account that contradicts Dr. Snow. I will not accept the water explanation merely because the deaths are close together.':'Distinguish what a person saw from what they heard. We are trying to make sense of loss, and reports travel quickly.',choices:[choice('thanks','I will record that distinction.','conclusion')]},
  {id:'conclusion',speaker:person.speaker,text:id==='whitehead'?'My disagreement stands. Continue the inquiries, including the awkward cases.':'Thank you for listening. There are other neighbors and witnesses you can speak with.',choices:[],conclusion:{}},
 ]});
}

const hearing: ConversationBeat[] = [];
const objections = [
 ['air','Chair of the Board','The streets smell foul. Why should we act on the pump rather than the atmosphere?',
  ['Nearby institutions had different water supplies and few or no deaths.','A bad smell proves that water is harmless.','The water looked clear, so there is no uncertainty.'],
  'The workhouse and brewery challenge a simple neighborhood-air explanation. Their different water supplies are relevant comparisons, though not controlled experiments.'],
 ['nearby','Board member · tradesman','Some nearby people escaped illness. Does that not defeat the pump theory?',
  ['Proximity does not establish consumption; compare people’s drinking routines.','Everyone near the pump must have become ill.','Only the number of deaths matters.'],
  'Living nearby does not mean using the pump. The exceptions test actual exposure, and we must not claim that every user became ill.'],
 ['distant','Board member · guardian','And what of people who fell ill at more distant addresses?',
  ['Work, errands and carried water can connect a distant home to Broad Street.','We should discard any address that does not fit.','Walking time proves what each household drank.'],
  'Residence is not necessarily the place of exposure. Trace the connection rather than assuming it; walking access alone cannot establish consumption.'],
] as const;
objections.forEach(([id,speaker,text,answers,clarification],i)=>{
 hearing.push({id,speaker,text,actorId:(['board-chair','board-tradesman','board-guardian'] as const)[i],choices:answers.map((a,j)=>choice(`response-${j}`,a,`${id}-${j===0?'supported':'clarify'}`))});
 for(const branch of ['supported','clarify'])hearing.push({id:`${id}-${branch}`,speaker:'John Snow',actorId:'john-snow',text:(branch==='clarify'?'Let us correct that claim. ':'')+clarification,choices:[choice('continue','Continue the hearing.',i<2?objections[i+1][0]:'recommendation')]});
});
hearing.push({id:'recommendation',speaker:'John Snow',text:'The Board has heard the comparisons and their limits. We will now submit the theory and action prepared at my desk; uncertainty does not remove the need to decide.',choices:[choice('submit','Submit our prepared recommendation.','conclusion')]},
 {id:'conclusion',speaker:'Chair of the Board',text:'The presentation is complete. Read the decision and the clearly labeled historical or alternate conclusion.',choices:[],terminalAction:'board-decision',conclusion:{hearing:true}});
campaignConversations.push({id:'board-hearing',actorId:'board-chair',locationId:'board-room',title:'Board hearing',anchor:[0,1.4,-4.5],start:'air',sourceNote:source+' The officials and objections are representative teaching interpretations.',beats:hearing});

campaignConversations.push({id:'walking-review',actorId:'survey',locationId:'broad-street',title:'Walking-access comparison',anchor:[-8.5,1.3,-2],start:'opening',sourceNote:source,beats:[
 {id:'opening',speaker:'John Snow · field notes',text:'Both pairs are recorded from matched origins. The historical access boundary is now visible on the map; it was not calculated from these four teaching walks.',choices:[choice('meaning','Does the nearer pump establish what someone drank?','limits'),choice('exceptions','Why might someone use a farther pump?','preferences')]},
 {id:'preferences',speaker:'John Snow · field notes',text:'Snow described avoidance of unsuitable Marlborough water and circuitous access to Rupert Street. Preference and the actual street route can matter more than a straight line on the map.',choices:[choice('limits','What does that mean for our evidence?','limits')]},
 {id:'limits',speaker:'John Snow · field notes',text:'Convenient access is a clue, not proof of consumption. Errands, work and water carried home can all create exceptions.',choices:[choice('record','Record the comparison and its limits.','conclusion')]},
 {id:'conclusion',speaker:'John Snow · field notes',text:'The walking-access finding is in the notebook. Return to Snow when the day’s remaining assignments are complete.',choices:[],conclusion:{objective:'walking-access',evidenceId:'walking-access'}}
]});
