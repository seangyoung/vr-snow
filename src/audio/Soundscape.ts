import { ambienceProfiles, clipGroups, type AmbientEvent, type ClipGroup, type SoundPoint } from "./ambience";
export type SoundChannel = "ambience" | "effects";
export type SoundSettings = { muted: boolean; ambience: number; effects: number };
export type SoundEffect = "select" | "paper" | "evidence" | "step" | "water";
type Point = { x: number; y: number; z: number };
export interface SoundControls {
  getSettings(): SoundSettings;
  setLevel(channel: SoundChannel, value: number): void;
  toggleMuted(): void;
}
const storageKey="vr-snow-sound-v1";
export const defaultSoundSettings: SoundSettings={muted:false,ambience:.2,effects:.35};
export function sanitizeSoundSettings(value: unknown): SoundSettings {
  const raw=(value && typeof value==="object"?value:{}) as Partial<SoundSettings>;
  const level=(n: unknown,fallback: number)=>typeof n==="number"&&Number.isFinite(n)?Math.max(0,Math.min(1,n)):fallback;
  return {muted:typeof raw.muted==="boolean"?raw.muted:false,ambience:level(raw.ambience,.2),effects:level(raw.effects,.35)};
}
/** Measures travelled distance, excluding teleports and pause/resume jumps. */
export class FootstepTracker {
  private previous?: Point;
  private distance=0;
  reset(): void {this.previous=undefined;this.distance=0;}
  update(position: Point, walking: boolean): boolean {
    const last=this.previous;this.previous={...position};
    if(!walking || !last){this.distance=0;return false;}
    const delta=Math.hypot(position.x-last.x,position.z-last.z);
    if(!Number.isFinite(delta) || delta>.4){this.distance=0;return false;}
    this.distance+=delta;
    if(this.distance<.65)return false;
    this.distance%=.65;return true;
  }
}

type AmbientSource={source:AudioBufferSourceNode;filter:BiquadFilterNode;panner:PannerNode;gain:GainNode;retiring?:boolean};
type ClipLoader=(url:string,signal:AbortSignal)=>Promise<ArrayBuffer>;
const fetchClip:ClipLoader=async(url,signal)=>{
  const response=await fetch(url,{signal});
  if(!response.ok)throw new Error(`Audio ${response.status}`);
  return response.arrayBuffer();
};
/** Quiet recorded foley with synthesized fallback. Sound never carries unique evidence. */
export class Soundscape implements SoundControls {
  private settings: SoundSettings;
  private context?: AudioContext;
  private master?: GainNode;
  private ambience?: GainNode;
  private effects?: GainNode;
  private air?: AudioBuffer;
  private noise?: AudioBuffer;
  private cart?: AudioBuffer;
  private water?: AudioBuffer;
  private waterSource?: AudioBufferSourceNode;
  private active: AmbientSource[]=[];
  private events=new Set<AmbientSource>();
  private recordings=new Map<string,AudioBuffer>();
  private walkingClips=new Map<AudioBuffer,AudioBuffer>();
  private recordingLoad?:Promise<void>;
  private loadAbort=new AbortController();
  private reading=false;
  private nextEvent=Infinity;
  private lastEventKind?:ClipGroup;
  private lastClips=new Map<ClipGroup,string>();
  private allSources=new Set<AmbientSource>();
  private oneShots=new Set<AudioBufferSourceNode>();
  private location="snow-desk";
  private steps=new FootstepTracker();
  private lastEffect=-Infinity;
  private hidden=false;
  private hiddenSources=new Set<"document"|"xr">();
  private disposed=false;
  private failed=false;
  constructor(private readonly createContext=()=>new AudioContext(), private readonly loadClip:ClipLoader=fetchClip, private readonly random:()=>number=Math.random) {
    try {this.settings=sanitizeSoundSettings(JSON.parse(localStorage.getItem(storageKey)??"null"));}
    catch {this.settings={...defaultSoundSettings};}
  }
  getSettings(): SoundSettings {return {...this.settings};}
  toggleMuted(): void {this.settings.muted=!this.settings.muted;this.save();}
  setLevel(channel: SoundChannel,value: number): void {
    this.settings=sanitizeSoundSettings({...this.settings,[channel]:value});this.save();
  }
  private save(): void {
    try {localStorage.setItem(storageKey,JSON.stringify(this.settings));}catch {/* Private browsing can deny storage. */}
    this.deferEvent();this.applyLevels();
  }
  private applyLevels(): void {
    if(!this.context)return;
    const time=this.context.currentTime;
    this.master?.gain.setTargetAtTime(this.settings.muted||this.hidden?0:.65,time,.04);
    this.ambience?.gain.setTargetAtTime(this.settings.ambience*(this.reading?.22:1),time,this.reading?.12:.45);
    this.effects?.gain.setTargetAtTime(this.settings.effects,time,.04);
  }
  /** Invoke directly from a pointer, keyboard or XR select gesture, never on page load. */
  async unlock(): Promise<void> {
    if(this.disposed||this.failed||this.hidden)return;
    try {
      if(!this.context) {
        const c=this.context=this.createContext();
        this.master=c.createGain();this.master.connect(c.destination);
        this.ambience=c.createGain();this.ambience.connect(this.master);
        this.effects=c.createGain();this.effects.connect(this.master);
        this.master.gain.value=0;this.applyLevels();
        // Original, bounded fallback buffers are ready before recordings finish loading.
        this.air=this.makeNoise(8,true);this.noise=this.makeNoise(.3,false);this.cart=this.makeCart();this.water=this.makeWater();
        this.configureAmbient();
        this.recordingLoad=this.loadRecordings();
      }
      if(this.context.state==="suspended")await this.context.resume().catch(()=>{});
    } catch {this.failed=true;this.dispose();}
  }
  private makeNoise(seconds: number,brown: boolean): AudioBuffer {
    const buffer=this.context!.createBuffer(1,Math.floor(22050*seconds),22050),data=buffer.getChannelData(0);
    let seed=1854,previous=0;
    for(let i=0;i<data.length;i++) {
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const white=seed/4294967296*2-1;
      previous=(previous+.025*white)/1.025;
      const edge=Math.min(1,i/(brown?2205:44),(data.length-1-i)/(brown?2205:44));
      data[i]=(brown?previous*3:white*.65)*edge*(brown?.68+.16*Math.sin(i/22050*.8):1);
    }
    return buffer;
  }
  private makeCart(): AudioBuffer {
    const rate=22050,buffer=this.context!.createBuffer(1,rate*16,rate),data=buffer.getChannelData(0);
    let seed=923;
    // A brief distant wooden-wheel/hoof impression, separated by quiet air.
    for(let i=0;i<data.length;i++) {
      const t=i/rate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const noise=seed/4294967296*2-1;
      const pass=t>3&&t<10?Math.sin((t-3)/7*Math.PI)**2:0;
      const beat=t% .46;const envelope=Math.exp(-beat*70);
      data[i]=pass*(.12*noise*envelope+.12*Math.sin(2*Math.PI*155*beat)*envelope+.009*noise);
    }
    return buffer;
  }
  private makeWater(): AudioBuffer {
    const rate=22050,buffer=this.context!.createBuffer(1,Math.ceil(rate*.95),rate),data=buffer.getChannelData(0);
    let seed=1854,low=0,phase=0,dropAge=0,dropLength=0,frequency=0;
    // A continuous splash with irregular, descending bubble resonances. Generated
    // locally so feedback never depends on a recording download completing.
    for(let i=0;i<data.length;i++) {
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const random=seed/4294967296,white=random*2-1,t=i/rate;
      low+=.24*(white-low);
      if(dropAge>=dropLength){dropAge=0;dropLength=.025+random*.055;frequency=650+random*1600;phase=0;}
      phase+=2*Math.PI*frequency*Math.exp(-dropAge*12)/rate;
      const bubble=Math.sin(phase)*Math.exp(-dropAge*60)*Math.min(1,dropAge*1200);
      data[i]=(.3*white+.4*low)*(.8+.2*Math.sin(t*41))+.25*bubble;
      dropAge+=1/rate;
    }
    return buffer;
  }
  stopWater(): void {
    const source=this.waterSource;this.waterSource=undefined;
    if(source){try{source.stop();}catch{}source.disconnect();}
  }
  setLocation(location: string): void {
    if(location===this.location)return;
    this.stopWater();
    this.location=location;this.steps.reset();this.configureAmbient();
  }
  /** Reduce distractions while reading without changing the saved volume. */
  setReading(reading:boolean):void {
    if(this.reading===reading)return;
    this.reading=reading;this.deferEvent();this.applyLevels();
  }
  private deferEvent():void {
    this.nextEvent=(this.context?.currentTime??0)+4+this.random()*5;
  }
  private async loadRecordings():Promise<void> {
    const c=this.context!;
    const queue=[...new Set(Object.values(clipGroups).flat())];
    // Two small downloads/decodes at a time, only after a user gesture. Failures
    // retain procedural sounds; late completion never starts a scene or source.
    const timer=setTimeout(()=>this.loadAbort.abort(),20000);
    const worker=async()=>{
      while(queue.length&&!this.disposed&&!this.loadAbort.signal.aborted) {
        const name=queue.shift()!;
        try {
          const base=import.meta.env?.BASE_URL??"/";
          const bytes=await this.loadClip(`${base}audio/${name}.wav`,this.loadAbort.signal);
          if(this.disposed||this.loadAbort.signal.aborted)break;
          const decoded=await c.decodeAudioData(bytes);
          if(!this.disposed&&!this.loadAbort.signal.aborted)this.recordings.set(name,decoded);
        } catch { /* Optional foley must never prevent playing the game. */ }
      }
    };
    try {await Promise.all([worker(),worker()]);} finally {clearTimeout(timer);}
  }
  private pickClip(kind:ClipGroup):AudioBuffer|undefined {
    const available=clipGroups[kind].filter(name=>this.recordings.has(name));
    const alternatives=available.filter(name=>name!==this.lastClips.get(kind));
    const choices=alternatives.length?alternatives:available;
    if(!choices.length)return undefined;
    const name=choices[Math.floor(this.random()*choices.length)];
    this.lastClips.set(kind,name);return this.recordings.get(name);
  }
  private retire(node:AmbientSource):void {
    if(node.retiring)return;
    node.retiring=true;
    const now=this.context!.currentTime;
    node.gain.gain.cancelScheduledValues(now);
    node.gain.gain.setTargetAtTime(0,now,.08);
    try {node.source.stop(now+.4);} catch { /* Already ended. */ }
  }
  private spatial(buffer:AudioBuffer,at:SoundPoint,volume:number,cutoff:number,
      rate:number,loop=false,end?:SoundPoint):AmbientSource {
    const c=this.context!,now=c.currentTime;
    const source=c.createBufferSource();source.buffer=buffer;source.loop=loop;source.playbackRate.value=rate;
    const filter=c.createBiquadFilter();filter.type="lowpass";filter.frequency.value=cutoff;
    const panner=c.createPanner();panner.panningModel="HRTF";panner.distanceModel="inverse";
    panner.refDistance=5;panner.rolloffFactor=.65;
    const duration=buffer.duration/rate;
    [panner.positionX,panner.positionY,panner.positionZ].forEach((param,i)=>{
      param.setValueAtTime(at[i],now);
      if(end)param.linearRampToValueAtTime(end[i],now+duration);
    });
    const gain=c.createGain();gain.gain.value=0;
    if(loop)gain.gain.setTargetAtTime(volume,now,.3);
    else {
      const fade=duration>5?duration*.3:Math.min(.025,duration*.15);
      gain.gain.setValueAtTime(0,now);
      gain.gain.linearRampToValueAtTime(volume,now+fade);
      gain.gain.setValueAtTime(volume,now+duration-fade);
      gain.gain.linearRampToValueAtTime(0,now+duration);
    }
    source.connect(filter);filter.connect(panner);panner.connect(gain);gain.connect(this.ambience!);
    const node={source,filter,panner,gain};this.allSources.add(node);
    source.onended=()=>{
      source.disconnect();filter.disconnect();panner.disconnect();gain.disconnect();
      this.allSources.delete(node);this.events.delete(node);
    };
    source.start();if(!loop)source.stop(now+duration+.02);
    return node;
  }
  private configureAmbient(): void {
    const c=this.context;if(!c||!this.air||!this.ambience||this.disposed)return;
    for(const node of this.allSources)this.retire(node);
    this.active=[];this.events.clear();this.lastEventKind=undefined;this.deferEvent();
    // Bound overlap even when travelling repeatedly before a fade has finished.
    for(const node of [...this.allSources].slice(0,Math.max(0,this.allSources.size-3))) {
      try {node.source.stop();}catch { /* Ended. */ }
      node.source.onended?.(new Event("ended"));
    }
    const profile=ambienceProfiles[this.location];
    if(profile)this.active.push(this.spatial(this.air,profile.origin,profile.air,profile.cutoff,.65,true));
  }
  private ambientEvent():void {
    const c=this.context!,profile=ambienceProfiles[this.location];
    if(!profile||c.currentTime<this.nextEvent)return;
    if(this.reading||this.settings.muted||!this.settings.ambience) {this.deferEvent();return;}
    const [low,high]=profile.interval;
    this.nextEvent=c.currentTime+low+this.random()*(high-low);
    if(this.events.size>=2)return;
    const choices=profile.events.filter(event=>event.kind!==this.lastEventKind);
    const pool=choices.length?choices:profile.events;
    let pick=this.random()*pool.reduce((sum,event)=>sum+(event.weight??1),0);
    const event=pool.find(event=>(pick-=event.weight??1)<0)??pool[pool.length-1];
    this.lastEventKind=event.kind;this.playAmbientEvent(event);
  }
  private playAmbientEvent(event:AmbientEvent):void {
    let buffer=this.pickClip(event.kind)??(event.kind==="wagon"?this.cart:undefined);
    if(!buffer)return;
    if(event.kind==="stoneStep") {
      let walk=this.walkingClips.get(buffer);
      if(!walk) {
        const rate=buffer.sampleRate,gap=Math.round(rate*.52);
        walk=this.context!.createBuffer(1,gap*3+buffer.length,rate);
        const samples=walk.getChannelData(0),step=buffer.getChannelData(0);
        for(let n=0;n<4;n++)for(let i=0;i<step.length;i++)samples[n*gap+i]+=step[i]*(n%2?.86:1);
        this.walkingClips.set(buffer,walk);
      }
      buffer=walk;
    }
    const rate=.94+this.random()*.12;
    let at=event.at,end=event.end;
    if(end&&this.random()<.5)[at,end]=[end,at];
    this.events.add(this.spatial(buffer,at,event.gain*(.85+this.random()*.3),event.cutoff,rate,false,end));
  }

  update(position: Point,forward: Point,up: Point,walking: boolean): void {
    if(this.disposed)return;
    if(this.steps.update(position,walking&&!this.hidden))this.effect("step");
    const c=this.context;if(!c||c.state!=="running"||this.hidden)return;
    this.ambientEvent();
    const listener=c.listener;
    if(listener.positionX) {
      for(const [param,value] of [[listener.positionX,position.x],[listener.positionY,position.y],[listener.positionZ,position.z],
        [listener.forwardX,forward.x],[listener.forwardY,forward.y],[listener.forwardZ,forward.z],
        [listener.upX,up.x],[listener.upY,up.y],[listener.upZ,up.z]] as const)param.value=value;
    } else {listener.setPosition(position.x,position.y,position.z);listener.setOrientation(forward.x,forward.y,forward.z,up.x,up.y,up.z);}
  }
  effect(kind: SoundEffect): void {
    const c=this.context;if(!c||!this.noise||!this.effects||c.state!=="running"||this.hidden||this.settings.muted||!this.settings.effects)return;
    const water=kind==="water";
    const now=c.currentTime;
    if(!water){if(kind!=="evidence"&&now-this.lastEffect<.07)return;this.lastEffect=now;}
    else this.stopWater();
    const indoor=["snow-desk","household","household-routines","household-away","registrar","manufactory","board-room"].includes(this.location);
    const recorded=water?this.pickClip("water"):kind==="step"?this.pickClip(indoor?"woodStep":"stoneStep"):
      kind==="paper"||kind==="evidence"?this.pickClip("paper"):undefined;
    const source=c.createBufferSource();source.buffer=recorded??(water?this.water!:this.noise);
    source.playbackRate.value=water?1:.96+this.random()*.08;
    const filter=c.createBiquadFilter();filter.type=water?"lowpass":"bandpass";
    const paper=kind==="paper"||kind==="evidence";
    filter.frequency.value=water?4500:paper?1450:kind==="step"?(indoor?310:620):900;
    filter.Q.value=paper?.5:.8;
    const gain=c.createGain(),duration=water?.95:recorded?recorded.duration/source.playbackRate.value:paper?.23:kind==="step"?.12:.045;
    const start=now;
    gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(water?.85:paper?.24:kind==="step"?(recorded?.32:.5):.28,start+(water?.025:.008));
    if(water){gain.gain.setValueAtTime(.85,start+.72);gain.gain.linearRampToValueAtTime(0,start+duration);this.waterSource=source;}
    else gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    source.connect(filter);filter.connect(gain);gain.connect(this.effects);this.oneShots.add(source);
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();this.oneShots.delete(source);if(this.waterSource===source)this.waterSource=undefined;};
    source.start(start);source.stop(start+duration+.02);
  }
  setHidden(hidden: boolean,source: "document"|"xr"="document"): void {
    if(hidden)this.hiddenSources.add(source);else this.hiddenSources.delete(source);
    this.hidden=this.hiddenSources.size>0;this.steps.reset();this.deferEvent();this.applyLevels();
    if(this.hidden)this.stopWater();
    if(this.hidden)void this.context?.suspend().then(()=>{if(!this.hidden)void this.unlock();}).catch(()=>{});
    else if(this.context)void this.unlock();
  }
  dispose(): void {
    this.stopWater();
    this.disposed=true;this.loadAbort.abort();this.recordings.clear();this.walkingClips.clear();
    for(const node of this.allSources) {try{node.source.stop();}catch{}node.source.disconnect();node.filter.disconnect();node.panner.disconnect();node.gain.disconnect();}
    for(const source of this.oneShots){try{source.stop();}catch{}source.disconnect();}
    this.active=[];this.events.clear();this.allSources.clear();this.oneShots.clear();this.steps.reset();
    this.master?.disconnect();this.ambience?.disconnect();this.effects?.disconnect();
    void this.context?.close().catch(()=>{});
  }
}
