export type SoundChannel = "ambience" | "effects";
export type SoundSettings = { muted: boolean; ambience: number; effects: number };
export type SoundEffect = "select" | "paper" | "evidence" | "step";
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

type AmbientSource={source:AudioBufferSourceNode;filter:BiquadFilterNode;panner:PannerNode;gain:GainNode};
/** Quiet original synthesized sounds. Audio never controls progression or carries unique information. */
export class Soundscape implements SoundControls {
  private settings: SoundSettings;
  private context?: AudioContext;
  private master?: GainNode;
  private ambience?: GainNode;
  private effects?: GainNode;
  private air?: AudioBuffer;
  private noise?: AudioBuffer;
  private cart?: AudioBuffer;
  private active: AmbientSource[]=[];
  private allSources=new Set<AmbientSource>();
  private oneShots=new Set<AudioBufferSourceNode>();
  private location="snow-desk";
  private steps=new FootstepTracker();
  private lastEffect=-Infinity;
  private hidden=false;
  private hiddenSources=new Set<"document"|"xr">();
  private disposed=false;
  private failed=false;
  constructor(private readonly createContext=()=>new AudioContext()) {
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
    this.applyLevels();
  }
  private applyLevels(): void {
    if(!this.context)return;
    const time=this.context.currentTime;
    this.master?.gain.setTargetAtTime(this.settings.muted||this.hidden?0:.65,time,.04);
    this.ambience?.gain.setTargetAtTime(this.settings.ambience,time,.08);
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
        // Seeded and bounded, with a gentle seam taper. No recordings or voice synthesis.
        this.air=this.makeNoise(8,true);this.noise=this.makeNoise(.3,false);this.cart=this.makeCart();
        this.configureAmbient();
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
  setLocation(location: string): void {
    if(location===this.location)return;
    this.location=location;this.steps.reset();this.configureAmbient();
  }
  private configureAmbient(): void {
    const c=this.context;if(!c||!this.air||!this.ambience||this.disposed)return;
    for(const node of this.active) {
      node.gain.gain.cancelScheduledValues(c.currentTime);
      node.gain.gain.setTargetAtTime(0,c.currentTime,.08);node.source.stop(c.currentTime+.4);
    }
    this.active=[];
    // Interior sound enters from a window/door; courtyard/street air is more open.
    const outside=this.location==="broad-street"||this.location==="workhouse";
    const origin=this.location==="snow-desk"?[3.4,2,-.3]:this.location==="registrar"?[4,2,-1.7]:this.location==="household"?[2.7,2,-1.62]:this.location==="brewery"?[4.8,2.8,0]:[-9,2,-6];
    const addSource=(buffer:AudioBuffer,position:number[],volume:number,cutoff:number,rate:number)=>{
      const source=c.createBufferSource();source.buffer=buffer;source.loop=true;source.playbackRate.value=rate;
      const filter=c.createBiquadFilter();filter.type="lowpass";filter.frequency.value=cutoff;
      const panner=c.createPanner();panner.panningModel="HRTF";panner.distanceModel="inverse";panner.refDistance=5;panner.rolloffFactor=.5;
      panner.positionX.value=position[0];panner.positionY.value=position[1];panner.positionZ.value=position[2];
      const gain=c.createGain();gain.gain.value=0;gain.gain.setTargetAtTime(volume,c.currentTime,.3);
      source.connect(filter);filter.connect(panner);panner.connect(gain);gain.connect(this.ambience!);
      const node={source,filter,panner,gain};this.active.push(node);this.allSources.add(node);
      source.onended=()=>{source.disconnect();filter.disconnect();panner.disconnect();gain.disconnect();this.allSources.delete(node);};source.start();
    };
    addSource(this.air,origin,outside?.32:.12,outside?650:310,outside?.8:.65);
    if(outside && this.cart)addSource(this.cart,[-12,1,-8],.24,850,1);
  }

  update(position: Point,forward: Point,up: Point,walking: boolean): void {
    if(this.disposed)return;
    if(this.steps.update(position,walking&&!this.hidden))this.effect("step");
    const c=this.context;if(!c||c.state!=="running"||this.hidden)return;
    const listener=c.listener;
    if(listener.positionX) {
      for(const [param,value] of [[listener.positionX,position.x],[listener.positionY,position.y],[listener.positionZ,position.z],
        [listener.forwardX,forward.x],[listener.forwardY,forward.y],[listener.forwardZ,forward.z],
        [listener.upX,up.x],[listener.upY,up.y],[listener.upZ,up.z]] as const)param.value=value;
    } else {listener.setPosition(position.x,position.y,position.z);listener.setOrientation(forward.x,forward.y,forward.z,up.x,up.y,up.z);}
  }
  effect(kind: SoundEffect): void {
    const c=this.context;if(!c||!this.noise||!this.effects||c.state!=="running"||this.hidden||this.settings.muted||!this.settings.effects)return;
    const now=c.currentTime;if(kind!=="evidence"&&now-this.lastEffect<.07)return;this.lastEffect=now;
    const source=c.createBufferSource();source.buffer=this.noise;
    const filter=c.createBiquadFilter();filter.type="bandpass";
    const paper=kind==="paper"||kind==="evidence";
    filter.frequency.value=paper?1450:kind==="step"?(this.location==="snow-desk"||this.location==="household"||this.location==="registrar"?310:620):900;
    filter.Q.value=paper?.5:.8;
    const gain=c.createGain(),duration=paper?.23:kind==="step"?.12:.045;
    gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(paper?.24:kind==="step"?.5:.28,now+.008);
    gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
    source.connect(filter);filter.connect(gain);gain.connect(this.effects);this.oneShots.add(source);
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();this.oneShots.delete(source);};
    source.start();source.stop(now+duration+.02);
  }
  setHidden(hidden: boolean,source: "document"|"xr"="document"): void {
    if(hidden)this.hiddenSources.add(source);else this.hiddenSources.delete(source);
    this.hidden=this.hiddenSources.size>0;this.steps.reset();this.applyLevels();
    if(this.hidden)void this.context?.suspend().then(()=>{if(!this.hidden)void this.unlock();}).catch(()=>{});
    else if(this.context)void this.unlock();
  }
  dispose(): void {
    this.disposed=true;
    for(const node of this.allSources) {try{node.source.stop();}catch{}node.source.disconnect();node.filter.disconnect();node.panner.disconnect();node.gain.disconnect();}
    for(const source of this.oneShots){try{source.stop();}catch{}source.disconnect();}
    this.active=[];this.allSources.clear();this.oneShots.clear();this.steps.reset();
    this.master?.disconnect();this.ambience?.disconnect();this.effects?.disconnect();
    void this.context?.close().catch(()=>{});
  }
}
