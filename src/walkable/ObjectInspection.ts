import * as THREE from "three";
import type { InspectableProp } from "./InspectableProps";

type ObjectNote = { text: string; source?: string; sourceLabel?: string };
export const objectNotes: Record<string,ObjectNote> = {
  "South London water-supply map": {
    text: "Snow’s other inquiry compares the Lambeth and Southwark and Vauxhall water supplies. The colours distinguish each company’s area and the neighbourhoods where their pipes intermingle.",
    source: "https://commons.wikimedia.org/wiki/File:Map_showing_the_intimate_mixture_of_the_water_supply..._Wellcome_L0063432.jpg",
    sourceLabel: "Wellcome Library, London · 1855 map · CC BY 4.0 · resized",
  },
  "Wooden stethoscope": {
    text: "A single-ear stethoscope carries sounds from the patient’s chest through a wooden tube. Instruments like this helped doctors listen to the heart and lungs.",
    source: "https://collection.sciencemuseumgroup.org.uk/objects/co91097/monaural-stethoscope",
    sourceLabel: "Science Museum Group · example dated 1840–1850",
  },
  "Chloroform inhaler": {
    text: "Snow studied how to administer anaesthetics. His chloroform inhaler used a water jacket to help regulate temperature, with a tube and facepiece for inhaling the vapour.",
    source: "https://collection.sciencemuseumgroup.org.uk/objects/co75826/snow-type-chloroform-inhaler-inhaler",
    sourceLabel: "Science Museum Group · Snow-type inhaler",
  },
  "Medical case book": { text: "A working case book for recording symptoms, treatments, and observations. Careful notes help a doctor compare one patient’s experience with another’s." },
  "Returns ledger": { text: "These registers bring individual deaths together as names, addresses, and recorded causes. Each entry represents a household affected by the outbreak." },
  "Water bucket": { text: "A wooden bucket carries water from the workhouse’s own supply. Where people obtain their drinking water matters more to the inquiry than how clear it looks." },
  "Thread spool": { text: "Thread and folded cloth belong to the household’s daily work. Paid work, domestic tasks, and errands continue around the illness." },
};

/** A small, non-modal caption: never pauses movement or takes keyboard focus. */
export class ObjectInspection {
  private current?: InspectableProp;
  private readonly element: HTMLElement;
  private sprite?: THREE.Sprite;
  constructor(private readonly scene: THREE.Scene) {
    this.element=document.createElement("aside");
    this.element.className="object-inspection";
    this.element.setAttribute("aria-label","Held object");
    this.element.hidden=true;document.body.append(this.element);
  }
  update(prop: InspectableProp | undefined, vr: boolean, camera: THREE.Camera): void {
    if(prop!==this.current) {
      this.current=prop;this.element.replaceChildren();
      if(this.sprite){this.scene.remove(this.sprite);this.sprite.material.map?.dispose();this.sprite.material.dispose();this.sprite=undefined;}
      const note=prop&&objectNotes[prop.name];
      if(prop&&note) {
        const title=document.createElement("strong");title.textContent=prop.name;
        const body=document.createElement("p");body.textContent=note.text;this.element.append(title,body);
        if(note.source) {
          const source=document.createElement("a");source.href=note.source;source.target="_blank";source.rel="noopener noreferrer";
          source.textContent=`${note.sourceLabel} · Collection photograph ↗`;this.element.append(source);
        }
        const canvas=document.createElement("canvas");canvas.width=1024;canvas.height=580;
        const ctx=canvas.getContext("2d")!;
        ctx.fillStyle="rgba(26,27,23,.96)";ctx.fillRect(0,0,1024,580);
        ctx.fillStyle="#f7e7c4";ctx.font="600 46px system-ui";ctx.fillText(prop.name,40,70);
        ctx.fillStyle="#f5f2e8";ctx.font="36px system-ui";
        let line="",y=139;
        for(const word of note.text.split(" ")) {
          const next=line?`${line} ${word}`:word;
          if(ctx.measureText(next).width>944){ctx.fillText(line,40,y);y+=49;line=word;}else line=next;
        }
        ctx.fillText(line,40,y);
        if(note.sourceLabel){ctx.fillStyle="#d8c9ac";ctx.font="25px system-ui";ctx.fillText(note.sourceLabel,40,528,944);}
        const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
        this.sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthWrite:false,depthTest:false}));
        this.sprite.renderOrder=1000;this.sprite.scale.set(.66,.374,1);
        camera.getWorldPosition(this.sprite.position);
        this.sprite.position.add(new THREE.Vector3(.55,.08,-1.25).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion())));
        this.scene.add(this.sprite);
      }
    }
    this.element.hidden=vr||!prop||!objectNotes[prop.name];
    if(this.sprite)this.sprite.visible=vr;
  }
}
