import type { ConversationBeat, ConversationDefinition, ActorId } from './conversations';
import type { InquiryDay, ObjectiveId } from './campaign';
import { snowMorningReport } from './campaign';
import type { LocationId } from './types';
import characterDefinitions from '../walkable/scene-characters.json' with { type: 'json' };
const choice = (id: string, label: string, next: string) => ({id,label,next});
const source = 'Authored teaching dialogue informed by Snow (1855), On the Mode of Communication of Cholera, Broad Street account and Table I. Dates are compressed; these are not verbatim historical conversations.';
const composite = source + ' This household, its room and testimony are composites; no named historical family or surveyed address is represented.';
const populationFlightSource = ' Authored resident observations informed by Snow (1855), Broad Street account, passage beginning “The mortality would undoubtedly have been much greater”: lodgers leaving, furniture left behind, closed houses and tradesmen sending away their families. Not verbatim witness testimony.';
// Keep graph/choice identifiers stable so saved conversations resume after copy edits.
function interview(id: string, actorId: ActorId, locationId: LocationId, speaker: string, anchor: [number,number,number], objective: ObjectiveId, evidenceId: string,
 opening: string, approaches: [string,string][], followup: string, details: [string,string], context: [string,string], summary: string, followupQuestion?: string): ConversationDefinition {
 return {id,actorId,locationId,title:actorId==='pump'?'Pump inspection':'Field interview',anchor,start:'opening',sourceNote:locationId==='manufactory'?source+' The witness and workshop are reconstructed. About a dozen is an authored interim estimate, not a documented September 6 count; Snow later reported eighteen deaths among roughly two hundred workers.':locationId.startsWith('household')?composite:source,beats:[
  {id:'opening',speaker,text:opening,choices:approaches.map(([label],i)=>choice(`approach-${i}`,label,`answer-${i}`))},
  ...approaches.map(([,text],i)=>({id:`answer-${i}`,speaker,text,choices:[choice('follow',followupQuestion ?? (actorId==='pump'?'Examine the water.':'Please, go on.'),'followup')]})),
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
 'Thank you for hearing me. If Dr. Snow can do anything to spare another family this, I hope he will.',
 'What water was the household drinking before the illness began?'),
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
 'You wanted to ask about our household? I can spare a few minutes before the next errand.',[
 ['Which drinking water do you prefer?','Broad Street water. We prefer the taste; we have tried water from elsewhere and gone back to it.'],
 ['Who collects your drinking water?','Whoever is going out on an errand takes the jug to Broad Street. Often I drink it here without going to the pump myself.'],
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
 'You have the particulars, then. If you’ll excuse me, I must get back to my round.',
 'Do the inmates use Broad Street water, or a separate supply?'),
 {id:'manufactory-supply',actorId:'factory-worker',locationId:'manufactory',title:'Field interview',anchor:[-.9,1.4,-.4],start:'opening',
 sourceNote:source+' The witness and workshop are reconstructed. About a dozen is an authored interim estimate, not a documented September 6 count; Snow later reported eighteen deaths among roughly two hundred workers.',beats:[
  {id:'opening',speaker:'Workshop worker',text:'You’re here for Dr. Snow? I can spare a few minutes. What would he like to know about the workshop?',choices:[
   choice('approach-0','How many people work here?','answer-0'),
   choice('approach-1','How has cholera affected the workers?','answer-1'),
   choice('approach-2','Have workers been taken ill here at the workshop?','answer-2')]},
  {id:'answer-0',speaker:'Workshop worker',text:'About two hundred, men and women, when everyone is here. There are far fewer at the benches now.',choices:[choice('follow','Have many been ill with cholera?','answer-1')]},
  {id:'answer-1',speaker:'Workshop worker',text:'We have lost about a dozen, I think, and some are sick now. Their families send word from home; it is hard to keep account.',choices:[choice('follow','What drinking water is provided at work?','followup')]},
  {id:'answer-2',speaker:'Workshop worker',text:'I cannot say where each person first felt unwell. The people we have lost died at their own homes, in different streets.',choices:[choice('follow','How many have you lost?','answer-1')]},
  {id:'followup',speaker:'Workshop worker',text:'Those two tubs are kept filled from the Broad Street pump for any of our two hundred or so workers who want a drink.',choices:[
   choice('limits','Did everyone drink from them?','limits'),choice('compare','Did those who died live together?','comparison')]},
  {id:'limits',speaker:'Workshop worker',text:'I could not say what each person drank. The tubs were there for all of us, but I did not watch everyone take a drink. Those we have lost died at home, in different streets.',choices:[choice('record','Thank you. I’ll make a note.','conclusion')]},
  {id:'comparison',speaker:'Workshop worker',text:'No, they lived in different streets. Their work brought them here together, but their families sent word of their deaths from home.',choices:[choice('record','Thank you. I’ll make a note.','conclusion')]},
  {id:'conclusion',speaker:'Workshop worker',text:'Please tell Dr. Snow what we have told you. We are waiting for news of the others.',choices:[],conclusion:{objective:'manufactory',evidenceId:'manufactory-exposure'}},
 ]},
 interview('brewery-supply' ,'brewery-owner','brewery','Edward and John Huggins',[-2.65,1.4,2.5],'brewery','brewery-exception',
 'Dr. Snow has sent you? We have been fortunate here: none of our men has died in this outbreak.',[
 ['What do the men drink during work?','They have an allowance of beer, and we have our own well. They do not generally fetch water from the street pump.'],
 ['Have they continued working here?','Yes, here at the brewery, close to all this trouble. We have been anxious for them and their families.'],
 ['Does the brewery use the public pump?','We have our own well on the premises. We do not rely on the Broad Street pump.']],
 'No deaths among our workers. The men have beer and access to our well; Broad Street pump water is not their usual drink.',
 ['Is the beer allowance part of their usual day?','Yes, it is our ordinary practice. It was not introduced because of the outbreak.'],
 ['Are you still keeping the brewery running?','We are. There is work to be done, though everyone is thinking of what is happening in the neighboring streets.'],
 'Give Dr. Snow our regards. We are thankful the men have been spared.',
 'What do the men usually drink here instead of Broad Street water?'),
 interview('household-away','away-householder','household-away','Householder',[1.0,1.2,-1.0],'nonlocal','nonlocal-exposure',
 'We live some way from Broad Street, yes. But my brother went there for work each day before he fell ill.',[
 ['Did he drink water while he was there?','He told me he used the Broad Street pump during the working day.'],
 ['Was any water brought home?','Sometimes he brought back a jug. We liked it, and he was coming this way anyway.'],
 ['Was he here when he became ill?','Yes, here at home. We sent for help here, though he had been out at work before the illness.']],
 'My brother drank at Broad Street while working there, and sometimes carried water home. He became ill here, away from the pump.',
 ['Did he go there only for the water?','No, his work took him there. Bringing a jug home was just part of his journey.'],
 ['Did you know the neighborhood was so badly affected?','We heard more as people began asking after one another. At first all our attention was on him.'],
 'I hope that helps explain his journey. This is his home, but it is not where he spent the working day.',
 'Was Broad Street water something he drank at work or brought home?'),
];

for (const day of [2,3] as const) campaignConversations.push({id:`snow-day-${day}`,actorId:'john-snow',locationId:'snow-desk',title:`Day ${day} assignments`,anchor:[-.65,1.35,-2.15],start:'opening',sourceNote:source,beats:[
 {id:'opening',speaker:'John Snow',text:`${snowMorningReport(day)} ${day===2?'Today we must ask about the water people drink, especially where nearby people have escaped the worst.':'Come to the map table before you go out; I have measured the walking times to the pumps.'}`,choices:[choice('plan','What shall I investigate?','plan'),choice('doubt','What would challenge our interpretation?','doubt')]},
 {id:'doubt',speaker:'John Snow',text:'People who used the pump and remained well trouble Whitehead. I want to hear about them too, and about anyone who fell ill without drinking its water.',choices:[choice('plan','Let us plan the inquiries.','plan')]},
 {id:'plan',speaker:'John Snow',text:day===2?'Inspect the pump sample and visit Household 2, the workhouse, and the manufactory at 37 Broad Street. Ask about illness and where people get their drinking water.':'I walked from each of two starting points to Broad Street and an alternative pump, measuring the time. Let us compare the journeys from each point, then look beyond the area nearest Broad Street.',choices:[choice('accept',day===3?'Let us examine the map.':'I will bring back those findings.','conclusion')]},
 {id:'conclusion',speaker:'John Snow',text:day===3?'Here is the map. Follow the streets from the marked point; I will show you the times I measured.':'Come back when you have those accounts. I shall be here working through the addresses.',choices:[],...(day===3?{terminalAction:'resume-survey' as const}:{}),conclusion:{assignmentDay:day}},
]});
for (const day of [1,2,3] as InquiryDay[]) campaignConversations.push({id:`snow-recap-${day}`,actorId:'john-snow',locationId:'snow-desk',title:`Day ${day} review`,anchor:[-.65,1.35,-2.15],start:'opening',sourceNote:source,...(day===1?{map:'deaths' as const}:{}),beats:[
 {id:'opening',...(day===1?{map:'base' as const}:{}),speaker:'John Snow',text:day===1?'Here are the streets and pumps around Broad Street. Now let us add the addresses from the death returns and see where they gather.':day===2?'You found nothing obvious in the sample, but the workhouse account is striking. Let us go over what you heard.':'We have the brewery’s account, the brother’s journey and our map comparison. Let us prepare for the Board’s questions.',choices:[choice('pattern',day===1?'Plot the addresses.':'Compare the exposure accounts.','pattern'),...(day===1?[]:[choice('limits','Start with what remains uncertain.','limits')])]},
 {id:'pattern',speaker:'John Snow',text:day===1?'Look how closely the deaths gather around Broad Street. The household you visited drank from this pump; tomorrow we must ask about other water supplies.':day===2?'The workhouse has few deaths and its own supply. At the manufactory, many workers have died at different homes, but they shared a workplace supplied with Broad Street water; Household 2 also uses that pump.':'The brewery men breathe the neighborhood’s air but have their own drinks. And the man who fell ill farther away drank Broad Street water while at work.',choices:[choice('limits','What still troubles you?','limits')]},
 {id:'limits',speaker:'John Snow',text:day===1?'The deaths cluster around Broad Street, but the map cannot settle whether water or another local cause is responsible. We need to learn who used the pump and who did not.':day===2?'We have not found the cause by looking at the water. I would like more accounts of people who escaped, particularly the brewery men.':'A convenient pump is not always the one people use. The household preferred Broad Street water enough to carry it farther; we must explain that to the Board.',choices:[choice('next','What should happen next?','next')]},
 {id:'next',speaker:'John Snow',text:day<3?'Let us finish for tonight, unless there is someone you wish to see again. We shall take up the remaining questions tomorrow.':'I believe the pump should be closed while we investigate further. Let us set down our argument and the action we will ask the Guardians to take.',choices:[choice('record','Record our review.','conclusion')]},
 {id:'conclusion',speaker:'John Snow',text:day<3?'I have your notes here. We can leave the rest until morning.':'Once our recommendation is ready, we can go before the Guardians.',choices:[],terminalAction:day<3?'end-day':'review-theory',conclusion:{recapDay:day,...(day===1?{evidenceId:'pump-cluster'}:{})}},
]});

const street: Record<string,{actor: ActorId; speaker:string; anchor:[number,number,number]; days:[string,string,string]}> = {
 whitehead:{actor:'whitehead',speaker:'Reverend Henry Whitehead',anchor:[-6.5,1.5,-5.6],days:[
 '',
 'I have been calling on the families again. Some are mourning; others need help tending the sick.',
 'There are still families I must visit. The street may be quieter, but there is much to be done behind those doors.']},
 'resident-west':{actor:'resident-west',speaker:'Street resident · shopkeeper',anchor:[-10,1.5,-7],days:[
 'The street smells strongly of chloride of lime. The parish has been washing the roadway, and the stones and gutters show the white residue.',
 'They are still spreading lime. I hope it does some good; the smell reaches right into my shop.',
 'I have scrubbed the step again, but there is hardly any trade. People hurry past where they once stopped to talk.']},
 'resident-east':{actor:'resident-east',speaker:'Street resident · neighbor',anchor:[11,1.5,-7],days:[
 'So many people have gone away these past few days. Houses where I used to hear children and visitors are shut up; in some, the people who kept them have died.',
 'Several tradesmen are still opening their shops, but they have sent their families away. You can walk past door after door without seeing a familiar face.',
 'The street is quieter, but so many families have fled that I would not take the silence for good news. There are still sick people behind some of those shutters.']},
};
for (const [id,person] of Object.entries(street)) for(const day of [1,2,3] as const) {
 if(id==='whitehead' && day===1)continue;
 campaignConversations.push({id:`${id}-day-${day}`,actorId:person.actor,locationId:'broad-street',title:'Neighborhood conversation',anchor:person.anchor,start:'opening',sourceNote:'Authored contextual conversation, informed by Whitehead and contemporary accounts reproduced in UCLA John Snow archive, Stream 2e. No evidence card; Whitehead’s later findings are reserved for the epilogue.'+(id==='resident-east'?populationFlightSource:''),beats:[
  {id:'opening',speaker:person.speaker,text:person.days[day-1],choices:[choice('follow',id==='whitehead'?'Dr. Snow suspects the pump water. Do you agree?':id==='resident-west'?'How is the shop managing?':'Have you been helping your neighbors?','follow'),choice('listen','Thank you. I will keep your account in mind.','conclusion')]},
  {id:'follow',speaker:person.speaker,text:id==='whitehead'?'Everyone’s account matters, especially an account that contradicts Dr. Snow. I will not accept the water explanation merely because the deaths are close together.':id==='resident-west'?['With so many households in trouble, ordinary business scarcely seems to matter. I open the shop, but I spend much of the day waiting for news.','Some customers have left the neighborhood. Others ask me to send what they need because they cannot leave the sick.','I want to see familiar faces at the counter again. Every time someone returns, I am relieved.'][day-1]:['I have carried a few provisions and knocked at doors. Sometimes all a person wants is news of someone in the next street.','Those who are well enough are doing what they can. It is hard when several homes need help at once.','I shall call again later. I do not like leaving without knowing whether someone is inside.'][day-1],choices:[choice('thanks','Thank you for speaking with me.','conclusion')]},
  {id:'conclusion',speaker:person.speaker,text:id==='whitehead'?'I have families to visit. Give them time to speak if you call; good day to you.':'Thank you for stopping. I hope you find something that will help us.',choices:[],conclusion:{}},
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
// Each turn uses the actual figure's position, including Snow's separate Board model.
for(const beat of hearing) {
 const modelId=beat.actorId==='john-snow'?'board-snow':beat.actorId;
 const actor=characterDefinitions.board.actors.find(actor=>actor.id===modelId);
 if(actor)beat.anchor=[actor.position[0],actor.position[1]+actor.height*.85,actor.position[2]];
}
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

// Optional neighbors report their own work and worries, without advancing assignments.
const additionalNeighbors: {actor:ActorId;speaker:string;openings:[string,string,string];topics:[string,string][];closing:string}[] = [
 {actor:'seamstress',speaker:'Seamstress',openings:[
  'The people in furnished lodgings were among the first to leave. I have been taking mending round this morning and finding nobody there to receive it.',
  'A customer has asked me to finish a mourning dress. I keep putting the work down to listen for news from next door.',
  'I am trying to deliver the work I promised. Some families have gone, and I do not know where to leave it.'],topics:[
  ['Have many people gone away?','A great many. Some lodgers have even left their furniture behind; they say they will send for it when they have somewhere to put it.'],
  ['Are your neighbors helping one another?','Those who can go out carry a message or a parcel for those who cannot. I knock before I leave, in case there is something they need.'],
  ['How are you managing?','By keeping my hands occupied. Sitting idle and listening to every footstep is worse.']],closing:'If you call on the families, give them a little time to answer. Some have been awake all night.'},
 {actor:'laundress',speaker:'Laundress',openings:[
  'I am waiting to hear whether another bundle is ready. There has been so much linen to wash, and so little rest in those rooms.',
  'A woman asked me for clean cloths before I had even finished the last bundle. I wish I had another pair of hands.',
  'There is still washing to be done in the houses where people have been ill. A quieter street does not mean their work is over.'],topics:[
  ['What have the families needed?','Clean sheets and cloths, mostly. Sometimes a neighbor brings the bundle because the person nursing cannot leave the bedside.'],
  ['Have you been going into the houses?','Usually someone brings things to the door. I do not linger; there is scarcely room for the family and whoever is helping.'],
  ['Has anyone been helping you?','A neighbor has carried bundles when I could not manage them all. We do what we can, but everyone is tired.']],closing:'I must go back for the next bundle. I hope the people you visit have better news today.'},
 {actor:'porter',speaker:'Porter',openings:[
  'Mind your step. I have been carrying bundles through here since early morning; several families are sending their things away.',
  'There are fewer carts coming through. The people who stop me mostly want a parcel carried or news of someone in the next street.',
  'I have work again today, though many shutters are still closed. I would rather see the shops busy than hear another rumor.'],topics:[
  ['Are people leaving the neighborhood?','Some are. They ask me to take a box or bedding to a cart. Others cannot leave someone who is ill, however much they wish to go.'],
  ['What are people saying about the street?','Everyone has an explanation, and no two agree. I can tell you which door I carried a bundle from, but not what caused the illness inside.'],
  ['Is the lime troublesome?','The smell catches you as you pass. The roadway has been washed and treated, but I still have to carry my loads through it.']],closing:'You will learn more by knocking at the doors than by taking every story in the street as true.'},
 {actor:'messenger',speaker:'Messenger',openings:[
  'I am taking a message to a family near here. The person who sent it asked me to wait until someone answered.',
  'I have doubled back twice already. A name on a note is not much help when nobody knows whether the family is still at home.',
  'I am carrying word to relatives outside these streets. They want to know who is well enough to write back.'],topics:[
  ['Are you having trouble finding people?','Some doors are shut and some people have gone away. I ask a neighbor rather than leave the note where it may never be found.'],
  ['Do your errands take you far?','Across several streets, sometimes farther. I go where the message must go, then return for an answer if one is wanted.'],
  ['What kind of news are you carrying?','Requests for help, mostly, and word for relatives. I would rather the families told you their own affairs.']],closing:'Excuse me; I should not keep them waiting for this note.'},
];
for(const person of additionalNeighbors)for(const day of [1,2,3] as const)campaignConversations.push({
 id:`${person.actor}-day-${day}`,actorId:person.actor,locationId:'broad-street',title:'Neighborhood conversation',anchor:[0,1.45,0],
 sourceNote:'Authored composite street resident. Everyday work, disrupted errands and mutual aid are interpretive context; this is not testimony from a named historical witness.'+(person.actor==='seamstress'?populationFlightSource:''),start:'opening',beats:[
  {id:'opening',speaker:person.speaker,text:person.openings[day-1],choices:person.topics.map(([label],i)=>choice(`ask-${i}`,label,`answer-${i}`))},
  ...person.topics.map(([,text],i)=>({id:`answer-${i}`,speaker:person.speaker,text,choices:[choice('another','May I ask something else?','followup'),choice('thanks','Thank you. I will let you get on.','conclusion')]})),
  {id:'followup',speaker:person.speaker,text:'Of course. What did you want to know?',choices:person.topics.map(([label],i)=>choice(`ask-${i}`,label,`detail-${i}`))},
  ...person.topics.map(([,text],i)=>({id:`detail-${i}`,speaker:person.speaker,text,choices:[choice('thanks','Thank you for speaking with me.','conclusion')]})),
  {id:'conclusion',speaker:person.speaker,text:person.closing,choices:[],conclusion:{}},
 ]
});
