/** Interpretive sound placement; no audio carries evidence or unique information. */
export const clipGroups = {
  wagon: ["wagon"], wood: ["wood-1", "wood-2"], paper: ["paper-1", "paper-2"],
  metal: ["metal-1", "metal-2"], creak: ["creak-1", "creak-2"],
  cloth: ["cloth"], door: ["door"],
  stoneStep: ["step-stone-1", "step-stone-2"], woodStep: ["step-wood-1", "step-wood-2"],
} as const;
export type ClipGroup = keyof typeof clipGroups;
export type SoundPoint = readonly [number, number, number];
export type AmbientEvent = { kind: ClipGroup; at: SoundPoint; end?: SoundPoint; gain: number; cutoff: number; weight?: number };
export type AmbientProfile = { origin: SoundPoint; air: number; cutoff: number; interval: readonly [number, number]; events: readonly AmbientEvent[] };
const windowCart = (at: SoundPoint, gain = .19): AmbientEvent => ({kind:"wagon",at,gain,cutoff:650});
export const ambienceProfiles: Record<string, AmbientProfile> = {
  "broad-street": {origin:[-9,2,-6],air:.26,cutoff:900,interval:[12,26],events:[
    {kind:"wagon",at:[-22,1,-5.4],end:[20,1,-5.4],gain:.52,cutoff:2100,weight:3},
    {kind:"stoneStep",at:[-10,.1,-8],end:[-8,.1,-8],gain:.21,cutoff:1600},
    {kind:"door",at:[-8,1,-10],gain:.16,cutoff:1100},
  ]},
  "snow-desk": {origin:[3.4,2,-.3],air:.08,cutoff:350,interval:[20,38],events:[
    windowCart([3.4,2,-.3]),
    {kind:"creak",at:[-1,.3,-2],gain:.11,cutoff:1200},
  ]},
  registrar: {origin:[4,2,-1.7],air:.10,cutoff:430,interval:[9,20],events:[
    {kind:"paper",at:[-3,1,-3],gain:.17,cutoff:2300,weight:2},
    {kind:"wood",at:[3,.8,-4],gain:.11,cutoff:1400},
    {kind:"creak",at:[-3,.3,-3],gain:.09,cutoff:1100},windowCart([4,2,-1.7],.11),
  ]},
  household: {origin:[2.7,2,-1.62],air:.06,cutoff:280,interval:[27,46],events:[
    windowCart([2.7,2,-1.62],.12),
    {kind:"cloth",at:[-2,1,-1],gain:.08,cutoff:1400},
    {kind:"creak",at:[-1,.2,2],gain:.08,cutoff:900},
  ]},
  workhouse: {origin:[0,3,-8],air:.19,cutoff:720,interval:[16,31],events:[
    {kind:"stoneStep",at:[-6,.1,-7],end:[-4,.1,-7],gain:.19,cutoff:1500,weight:2},
    {kind:"door",at:[0,1,-10],gain:.16,cutoff:1100},
    windowCart([0,2,12],.09),
  ]},
  brewery: {origin:[4.8,2.8,0],air:.11,cutoff:450,interval:[10,23],events:[
    {kind:"wood",at:[4.4,.8,-2],gain:.19,cutoff:1900,weight:2},
    {kind:"metal",at:[-2.35,1,-3],gain:.13,cutoff:2000},
    {kind:"creak",at:[-4,1,-1],gain:.11,cutoff:1400},
    {kind:"cloth",at:[-4,.7,3],gain:.10,cutoff:1500},
  ]},
};

// Reuse the established acoustic palette for the compact teaching locations.
ambienceProfiles['household-routines'] = ambienceProfiles.household;
ambienceProfiles['household-away'] = ambienceProfiles.household;
ambienceProfiles['marlborough-pump'] = ambienceProfiles['broad-street'];
ambienceProfiles['rupert-pump'] = ambienceProfiles['broad-street'];
ambienceProfiles['board-room'] = ambienceProfiles.registrar;
