import type { InquiryDay, ObjectiveId } from './campaign';
/** Deterministic teaching observations, inspired by Snow's changing samples on September 3–5.
 * The three-day campaign relocates them; these are not dated laboratory findings. */
export const waterSamples: Record<InquiryDay,{conversation:string;objective:ObjectiveId;observation:string;comparison:string}> = {
  1:{conversation:'pump-sample-1',objective:'sample-1',observation:'Almost clear water; very little visible material.',comparison:'This first inspection supplies a starting point. Appearance alone cannot settle what caused the illness.'},
  2:{conversation:'pump-sample',objective:'sample',observation:'A few small white, flocculent particles drift in otherwise clear water.',comparison:'More visible material than yesterday, but no decisive sign of what caused the illness.'},
  3:{conversation:'pump-sample-3',objective:'sample-3',observation:'Clearer than yesterday, with only an occasional pale fleck.',comparison:'The visible material has varied between samples. A clearer sample today cannot establish what people drank earlier.'},
};
export const sampleConversation = (day: InquiryDay): string => waterSamples[day].conversation;
