import type { ConversationBeat, ConversationDefinition, ActorId } from './conversations';
import type { InquiryDay, ObjectiveId } from './campaign';
import type { LocationId } from './types';
const choice = (id: string, label: string, next: string) => ({id,label,next});
const source = 'Authored teaching dialogue informed by Snow (1855), On the Mode of Communication of Cholera, Broad Street account and Table I. Dates are compressed; these are not verbatim historical conversations.';
const composite = source + ' This household, its room and testimony are composites; no named historical family or surveyed address is represented.';
// Keep graph/choice identifiers stable so saved conversations resume after copy edits.
function interview(id: string, actorId: ActorId, locationId: LocationId, speaker: string, anchor: [number,number,number], objective: ObjectiveId, evidenceId: string,
 opening: string, approaches: [string,string][], followup: string, details: [string,string], context: [string,string], summary: string): ConversationDefinition {
 return {id,actorId,locationId,title:actorId==='pump'?'Pump inspection':'Field interview',anchor,start:'opening',sourceNote:locationId.startsWith('household')?composite:source,beats:[
  {id:'opening',speaker,text:opening,choices:approaches.map(([label],i)=>choice(`approach-${i}`,label,`answer-${i}`))},
  ...approaches.map(([,text],i)=>({id:`answer-${i}`,speaker,text,choices:[choice('follow',actorId==='pump'?'Examine the water.':'Please, go on.','followup')]})),
  {id:'followup',speaker,text:followup,choices:[choice('limits',details[0],'limits'),choice('compare',context[0],'comparison')]},
  {id:'limits',speaker,text:details[1],choices:[choice('record',actorId==='pump'?'Note the result.':'Thank you. I’ll make a note.','conclusion')]},
  {id:'comparison',speaker,text:context[1],choices:[choice('record',actorId==='pump'?'Note the result.':'Thank you. I’ll make a note.','conclusion')]},
  {id:'conclusion',speaker,text:summary,choices:[],conclusion:{objective,evidenceId}},
 ]};
}
export const campaignConversations: ConversationDefinition[] = [
 {id:'snow-progress',actorId:'john-snow',locationId:'snow-desk',title:'Today’s inquiries',anchor:[-.65,1.35,-2.15],start:'opening',sourceNote:source,beats:[
  {id:'opening',speaker:'John Snow',text:'There is still work to do. Please finish today’s assignments, and we’ll discuss the findings this evening.',choices:[choice('remind','What still needs doing?','reminder')]},
  {id:'reminder',speaker:'John Snow',text:'Please finish the remaining assignments, then bring your notes back this evening.',choices:[],conclusion:{}},
 ]},
 interview('registrar-records','registrar','registrar','Registrar',[0,1.3,-.12],'records','attack-timeline',
 'You’re here for Dr. Snow? I have the cholera returns ready. There are a great many entries from the streets around Broad Street.',[
 ['May I see the dates?','Here are the dates of death, with the duration of illness where it was supplied. Several of these people were taken ill very suddenly.'],
 ['Are the addresses recorded?','Yes, here beside each name: street and house number. Take your time with the handwriting; some of the returns are easier to read than others.'],
 ['What cause is entered?','Cholera, in these returns. I enter the particulars sent to this office; the medical attendant supplies the cause of death.']],
 'The entries crowd these pages from the end of August and the first days of September. You may copy the dates and addresses for Dr. Snow.',
 ['Are any particulars missing?','A few entries lack a house number or a duration of illness. I have left those spaces blank.'],
 ['Has the office been this busy throughout?','The returns have come in faster than we can enter them. There are families waiting for certificates as well.'],
 'There, you have the copies. Please leave the ledger open at this page; I must return to the entries.'),
 interview('household-first','survivor','household','Bereaved householder',[.25,1.2,-.55],'first-household','household-exposure',
 'I can tell you what I remember, though the days have run together. Please ask one thing at a time.',[
 ['May we begin with when the illness started?','It came on during those terrible first days of September. By the time we had fetched help, the illness was already severe.'],
 ['Where did you get drinking water?','We brought it from Broad Street, as we always did. There was usually a jug here in the room.'],
 ['Who cared for the sick person?','We took turns beside the bed. There was scarcely room to move, but we could not leave them alone.']],
 'We had been drinking the Broad Street water before the illness began. Then it was all nursing and fetching help, until we lost them.',
 ['Do you remember which day the illness began?','It was in those first days of September. I cannot be certain of the day now; we hardly slept.'],
 ['Were you able to get any rest?','Very little. Someone had to stay beside the bed, and there was always another cloth to wash or something to fetch.'],
 'Thank you for hearing me. If Dr. Snow can do anything to spare another family this, I hope he will.'),
 interview('pump-sample','pump','broad-street','Pump inspection',[-3.8,1.4,1.3],'sample','pump-water-inspection',
 'Water runs from the spout into the vessel. You hold the sample up to the light.',[
 ['Look for discoloration.','The water looks clear in the light.'],
 ['Look for visible material.','Nothing in the sample gives an obvious explanation for the illness.'],
 ['Compare its appearance with the household accounts.','This is the water the households described collecting for drinking. Its appearance is unremarkable.']],
 'Ordinary inspection reveals no decisive sign of contamination.',
 ['Can appearance settle the question?','The clear appearance cannot tell you whether the water caused the illness.'],
 ['What should go in the notes?','Broad Street pump sample: clear-looking water; no decisive visible finding.'],
 'You record the inspection beside the household accounts.'),
 interview('household-routines','water-householder','household-routines','Householder',[-.65,1.2,-.2],'water-routines','household-water-pattern',
 'Yes, we fetch our water from Broad Street. It is a little farther to carry, but we like it better.',[
 ['What do you prefer about it?','The taste. We have tried water from elsewhere and gone back to Broad Street.'],
 ['Who collects it?','Whoever is going out on an errand takes the jug. Often I drink it here without going to the pump myself.'],
 ['Does everyone drink the same water?','At home, usually. But those out at work drink there too, and I cannot tell you every cup they have.']],
 'The Broad Street jug comes home with the errands, and we keep it for drinking. We have carried on that way for some time.',
 ['Did that routine change when people fell ill?','Fetching everything became harder. Some days we depended on someone already going that way.'],
 ['Why not save the extra walk?','It is worth the trouble to us. Water you dislike is no pleasure to drink.'],
 'That is how we manage it. I never thought our daily jug would be of interest to a doctor.'),
 interview('workhouse-supply','steward','workhouse','Workhouse steward',[-1.5,1.45,-7.8],'workhouse','workhouse-exception',
 'I can spare a moment before my next round. You wanted to ask about illness among the inmates?',[
 ['How many people live here?','Over five hundred. Keeping everyone fed and the wards in order takes a good deal of work.'],
 ['Where do you obtain drinking water?','We have our own supply here. There is no need to send out to the Broad Street pump for the inmates’ drinking water.'],
 ['Have there been many cholera deaths?','Very few here, thank goodness. We hear dreadful accounts from the streets just outside.']],
 'With over five hundred inmates, we have had very few deaths. Our drinking water comes from our separate supply, here within the institution.',
 ['May I draw some water to inspect?','Certainly. The pump is over there by the covered well; you may draw what you need.'],
 ['How has the outbreak affected your work?','There is constant concern for the wards. I have the inmates and staff to attend to, whatever is happening outside.'],
 'You have the particulars, then. If you’ll excuse me, I must get back to my round.'),
 interview('brewery-supply','brewery-owner','brewery','Edward and John Huggins',[-2.65,1.4,2.5],'brewery','brewery-exception',
 'Dr. Snow has sent you? We have been fortunate here: none of our men has died in this outbreak.',[
 ['What do the men drink during work?','They have an allowance of beer, and we have our own well. They do not generally fetch water from the street pump.'],
 ['Have they continued working here?','Yes, here at the brewery, close to all this trouble. We have been anxious for them and their families.'],
 ['Does the brewery use the public pump?','We have our own well on the premises. We do not rely on the Broad Street pump.']],
 'No deaths among our workers. The men have beer and access to our well; Broad Street pump water is not their usual drink.',
 ['Is the beer allowance part of their usual day?','Yes, it is our ordinary practice. It was not introduced because of the outbreak.'],
 ['Are you still keeping the brewery running?','We are. There is work to be done, though everyone is thinking of what is happening in the neighboring streets.'],
 'Give Dr. Snow our regards. We are thankful the men have been spared.'),
 interview('household-away','away-householder','household-away','Householder',[1.0,1.2,-1.0],'nonlocal','nonlocal-exposure',
 'We live some way from Broad Street, yes. But my brother went there for work each day before he fell ill.',[
 ['Did he drink water while he was there?','He told me he used the Broad Street pump during the working day.'],
 ['Was any water brought home?','Sometimes he brought back a jug. We liked it, and he was coming this way anyway.'],
 ['Was he here when he became ill?','Yes, here at home. We sent for help here, though he had been out at work before the illness.']],
 'My brother drank at Broad Street while working there, and sometimes carried water home. He became ill here, away from the pump.',
 ['Did he go there only for the water?','No, his work took him there. Bringing a jug home was just part of his journey.'],
 ['Did you know the neighborhood was so badly affected?','We heard more as people began asking after one another. At first all our attention was on him.'],
 'I hope that helps explain his journey. This is his home, but it is not where he spent the working day.'),
];

for (const day of [2,3] as const) campaignConversations.push({id:`snow-day-${day}`,actorId:'john-snow',locationId:'snow-desk',title:`Day ${day} assignments`,anchor:[-.65,1.35,-2.15],start:'opening',sourceNote:source,beats:[
 {id:'opening',speaker:'John Snow',text:day===2?'Yesterday’s addresses gather around Broad Street. I want to know more about the water people drink, especially where nearby people have escaped the worst.':'Before you go out today, come to the map table. I have measured the walking times to the pumps; let us see what the streets tell us.',choices:[choice('plan','What shall I investigate?','plan'),choice('doubt','What would challenge our interpretation?','doubt')]},
 {id:'doubt',speaker:'John Snow',text:'People who used the pump and remained well trouble Whitehead. I want to hear about them too, and about anyone who fell ill without drinking its water.',choices:[choice('plan','Let us plan the inquiries.','plan')]},
 {id:'plan',speaker:'John Snow',text:day===2?'Inspect the pump sample, visit Household 2 and ask about their experience, and ask the workhouse steward about its supply. Bring all three accounts back.':'I walked from each of two starting points to Broad Street and an alternative pump, measuring the time. Let us compare the journeys from each point, then look beyond the area nearest Broad Street.',choices:[choice('accept',day===3?'Let us examine the map.':'I will bring back those findings.','conclusion')]},
 {id:'conclusion',speaker:'John Snow',text:day===3?'Here is the map. Follow the streets from the marked point; I will show you the times I measured.':'Come back when you have those accounts. I shall be here working through the addresses.',choices:[],...(day===3?{terminalAction:'resume-survey' as const}:{}),conclusion:{assignmentDay:day}},
]});
for (const day of [1,2,3] as InquiryDay[]) campaignConversations.push({id:`snow-recap-${day}`,actorId:'john-snow',locationId:'snow-desk',title:`Day ${day} review`,anchor:[-.65,1.35,-2.15],start:'opening',sourceNote:source,beats:[
 {id:'opening',speaker:'John Snow',text:day===1?'You have brought the returns and spoken with the household. Let us put these addresses on the map.':day===2?'You found nothing obvious in the sample, but the workhouse account is striking. Let us go over what you heard.':'We have the brewery’s account, the brother’s journey and our map comparison. Let us prepare for the Board’s questions.',choices:[choice('pattern',day===1?'Plot the addresses.':'Compare the exposure accounts.','pattern'),choice('limits','Start with what remains uncertain.','limits')]},
 {id:'pattern',speaker:'John Snow',text:day===1?'Look how closely the deaths gather around Broad Street. The household you visited drank from this pump; tomorrow we must ask about other water supplies.':day===2?'The workhouse has over five hundred inmates, very few deaths and its own water supply. Outside its walls, families fetch the Broad Street water because they prefer it.':'The brewery men breathe the neighborhood’s air but have their own drinks. And the man who fell ill farther away drank Broad Street water while at work.',choices:[choice('limits','What still troubles you?','limits')]},
 {id:'limits',speaker:'John Snow',text:day===1?'The deaths cluster around Broad Street, but the map cannot settle whether water or another local cause is responsible. We need to learn who used the pump and who did not.':day===2?'We have not found the cause by looking at the water. I would like more accounts of people who escaped, particularly the brewery men.':'A convenient pump is not always the one people use. The household preferred Broad Street water enough to carry it farther; we must explain that to the Board.',choices:[choice('next','What should happen next?','next')]},
 {id:'next',speaker:'John Snow',text:day<3?'Let us finish for tonight, unless there is someone you wish to see again. We shall take up the remaining questions tomorrow.':'I believe the pump should be closed while we investigate further. Let us set down our argument and the action we will ask the Guardians to take.',choices:[choice('record','Record our review.','conclusion')]},
 {id:'conclusion',speaker:'John Snow',text:day<3?'I have your notes here. We can leave the rest until morning.':'Once our recommendation is ready, we can go before the Guardians.',choices:[],terminalAction:day<3?'end-day':'review-theory',conclusion:{recapDay:day,...(day===1?{evidenceId:'pump-cluster'}:{})}},
]});

const street: Record<string,{actor: ActorId; speaker:string; anchor:[number,number,number]; days:[string,string,string]}> = {
 whitehead:{actor:'whitehead',speaker:'Reverend Henry Whitehead',anchor:[-6.5,1.5,-5.6],days:[
 '',
 'I remain unconvinced that Broad Street water explains the outbreak. The nearby people who escaped deserve as much attention as those who died.',
 'You have found exceptions to examine, but I am not persuaded by the pump explanation. A thorough inquiry among the families is still needed before such claims can be settled.']},
 'resident-west':{actor:'resident-west',speaker:'Street resident · shopkeeper',anchor:[-10,1.5,-7],days:[
 'The street smells strongly of chloride of lime. The parish has been washing the roadway, and the stones and gutters show the white residue.',
 'They are still spreading lime. I hope it does some good; the smell reaches right into my shop.',
 'I have scrubbed the step again, but there is hardly any trade. People hurry past where they once stopped to talk.']},
 'resident-east':{actor:'resident-east',speaker:'Street resident · neighbor',anchor:[11,1.5,-7],days:[
 'Ordinary errands have become visits for help and news. A closed shutter may mean illness, mourning, or a household that has gone away.',
 'Some neighbors have left, while others carry water or provisions for people who cannot go out. Our routines are not what they were a week ago.',
 'I went to call on a neighbor and found the shutters closed. I still do not know whether the family has gone away or needs help.']},
};
for (const [id,person] of Object.entries(street)) for(const day of [1,2,3] as const) {
 if(id==='whitehead' && day===1)continue;
 campaignConversations.push({id:`${id}-day-${day}`,actorId:person.actor,locationId:'broad-street',title:'Neighborhood conversation',anchor:person.anchor,start:'opening',sourceNote:'Authored contextual conversation, informed by Whitehead and contemporary accounts reproduced in UCLA John Snow archive, Stream 2e. No evidence card; Whitehead’s later findings are reserved for the epilogue.',beats:[
  {id:'opening',speaker:person.speaker,text:person.days[day-1],choices:[choice('follow',id==='whitehead'?'Why do you still doubt the water theory?':id==='resident-west'?'How is the shop managing?':'Have you been helping your neighbors?','follow'),choice('listen','Thank you. I will keep your account in mind.','conclusion')]},
  {id:'follow',speaker:person.speaker,text:id==='whitehead'?'Everyone’s account matters, especially an account that contradicts Dr. Snow. I will not accept the water explanation merely because the deaths are close together.':id==='resident-west'?['With so many households in trouble, ordinary business scarcely seems to matter. I open the shop, but I spend much of the day waiting for news.','Some customers have left the neighborhood. Others ask me to send what they need because they cannot leave the sick.','I want to see familiar faces at the counter again. Every time someone returns, I am relieved.'][day-1]:['I have carried a few provisions and knocked at doors. Sometimes all a person wants is news of someone in the next street.','Those who are well enough are doing what they can. It is hard when several homes need help at once.','I shall call again later. I do not like leaving without knowing whether someone is inside.'][day-1],choices:[choice('thanks','Thank you for speaking with me.','conclusion')]},
  {id:'conclusion',speaker:person.speaker,text:id==='whitehead'?'I still think Dr. Snow has blamed the pump too readily. I have families to visit; good day to you.':'Thank you for stopping. I hope you find something that will help us.',choices:[],conclusion:{}},
 ]});
}

const hearing: ConversationBeat[] = [];
const objections = [
 ['air','Chair of the Board','The streets smell foul. Why should we act on the pump rather than the atmosphere?',
  ['Nearby institutions had different water supplies and few or no deaths.','A bad smell proves that water is harmless.','The water looked clear, so there is no uncertainty.'],
  'The workhouse and brewery are close by and share this air. Yet they have few or no deaths, and both have alternatives to the Broad Street water.'],
 ['nearby','Board member · tradesman','Some nearby people escaped illness. Does that not defeat the pump theory?',
  ['Proximity does not establish consumption; compare people’s drinking routines.','Everyone near the pump must have become ill.','Only the number of deaths matters.'],
  'Some neighbors drink from other supplies. At the brewery, the men have beer and their own well; living or working nearby does not mean drinking this water.'],
 ['distant','Board member · guardian','And what of people who fell ill at more distant addresses?',
  ['Work, errands and carried water can connect a distant home to Broad Street.','We should discard any address that does not fit.','Walking time proves what each household drank.'],
  'The man whose household we visited worked near Broad Street and drank there. He also carried water home: the water could reach beyond the neighboring streets.'],
 ['declining','Chair of the Board','The deaths are already declining. Why remove the pump handle now?',
  ['The well could be poisoned again; closing it would prevent further exposure.','The decline proves that the pump is now safe.','Removing the handle will prove what caused the outbreak.'],
  'We have not yet found how the poison entered the well. Whatever poisoned it before could do so again. We must stop people drawing this water and prevent the poison from spreading any farther.'],
] as const;
objections.forEach(([id,speaker,text,answers,clarification],i)=>{
 hearing.push({id,speaker,text,actorId:(['board-chair','board-tradesman','board-guardian'] as const)[i % 3],choices:answers.map((a,j)=>choice(`response-${j}`,a,`${id}-${j===0?'supported':'clarify'}`))});
 for(const branch of ['supported','clarify'])hearing.push({id:`${id}-${branch}`,speaker:'John Snow',actorId:'john-snow',text:(branch==='clarify'?'Let us correct that claim. ':'')+clarification,choices:[choice('continue','Continue the hearing.',i<objections.length-1?objections[i+1][0]:'recommendation')]});
});
hearing.push({id:'recommendation',actorId:'john-snow',speaker:'John Snow',text:'Gentlemen, I believe the Broad Street water carries the poison. I ask you to remove the handle and close the pump while the inquiry continues.',choices:[choice('submit','Support Snow: close the pump.','snow-response')]},
 {id:'snow-response',speaker:'John Snow',actorId:'john-snow',text:'Thank you. Closing the pump is a precaution we can take now, while we continue to seek the source of the poison.',choices:[choice('decision','Hear the Board’s decision.','conclusion')]},
 {id:'conclusion',speaker:'Chair of the Board',actorId:'board-chair',text:'We shall follow Dr. Snow’s advice. The pump handle is to be removed tomorrow morning.',choices:[],terminalAction:'board-decision',conclusion:{hearing:true}});
campaignConversations.push({id:'board-hearing',actorId:'board-chair',locationId:'board-room',title:'Board hearing',anchor:[0,1.4,-4.5],start:'air',sourceNote:source+' The officials and objections are representative teaching interpretations.',beats:hearing});

campaignConversations.push({id:'walking-review',actorId:'john-snow',locationId:'snow-desk',title:'Walking-access comparison',anchor:[-.65,1.35,-2.15],start:'opening',sourceNote:source,beats:[
 {id:'opening',speaker:'John Snow',text:'Household 3 is beyond the boundary, where another pump is closer. Someone there has fallen ill. We should find out whether they ever used Broad Street water.',choices:[choice('meaning','Does the nearer pump establish what someone drank?','limits'),choice('exceptions','Why might someone use a farther pump?','preferences')]},
 {id:'preferences',speaker:'John Snow',text:'The route to Rupert Street winds through the streets. A shorter walk may be convenient, but the household’s preference for Broad Street water also matters.',choices:[choice('limits','What does that mean for our evidence?','limits')]},
 {id:'limits',speaker:'John Snow',text:'Living outside the boundary need not mean drinking different water. Ask this household about the days before the illness; let their account tell us whether there is a connection.',choices:[choice('record','I will visit Household 3. What else needs doing?','conclusion')]},
 {id:'conclusion',speaker:'John Snow',text:'Visit Household 3 outside the boundary, and speak with the brewery owners, whose men seem to have escaped despite working nearby. Bring both accounts back this evening.',choices:[],conclusion:{objective:'walking-access',evidenceId:'walking-access'}}
]});


campaignConversations.push({id:'workhouse-sample',actorId:'workhouse-pump',locationId:'workhouse',
 title:'Workhouse water inspection',anchor:[3,1.3,-5.8],start:'opening',sourceNote:source+' Optional reconstructed sample comparison, not a documented test by Snow.',beats:[
 {id:'opening',speaker:'Workhouse pump inspection',text:'You hold the freshly drawn water up to the light. It looks clear.',choices:[choice('look','Look for visible material.','inspect'),choice('compare','Examine its appearance closely.','inspect')]},
 {id:'inspect',speaker:'Workhouse pump inspection',text:'Nothing unusual is visible in the sample. Its appearance gives no explanation for the workhouse’s few deaths.',choices:[choice('record','Record the inspection.','conclusion')]},
 {id:'conclusion',speaker:'Workhouse pump inspection',text:'You record clear-looking water and an inconclusive inspection. The result can be compared with your Broad Street sample notes.',choices:[],conclusion:{}},
]});
