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
  "Ether apparatus": {
    text: "Snow designed apparatus for administering ether as an anaesthetic in 1847. A chamber, flexible tube and padded facepiece connect his work as a doctor with his experiments on inhaled vapours.",
    source: "https://history.rcp.ac.uk/collections/art-and-objects/medical-collections",
    sourceLabel: "Royal College of Physicians · Snow’s 1847 design",
  },
  "Ether bottle": {
    text: "Sulphuric ether is the period name for diethyl ether. Snow studied its vapour and developed apparatus to make anaesthesia more controlled.",
    source: "https://www.woodlibrarymuseum.org/wp-content/uploads/rare-books/S_ADRI.pdf",
    sourceLabel: "John Snow · On Narcotism by the Inhalation of Vapours · 1848",
  },
  "Chloroform bottle": {
    text: "Chloroform is another anaesthetic used by Snow. His work compares the effects of inhaled vapours and the quantities needed to produce insensibility.",
    source: "https://www.woodlibrarymuseum.org/wp-content/uploads/rare-books/S_ADRI.pdf",
    sourceLabel: "John Snow · On Narcotism by the Inhalation of Vapours · 1848",
  },
  "Ethyl nitrate bottle": {
    text: "The label’s ‘nitrate of oxide of ethyle’ means ethyl nitrate. Snow included it in his experimental comparisons of vapours; it belongs among his research substances.",
    source: "https://www.woodlibrarymuseum.org/wp-content/uploads/rare-books/S_ADRI.pdf",
    sourceLabel: "John Snow · experimental vapour studies · 1848",
  },
  "Chloric ether bottle": {
    text: "Despite its name, chloric ether is chloroform dissolved in alcohol. Snow discussed the preparation and its variable effects when inhaled.",
    source: "https://epi-snow.ph.ucla.edu/Stream1_introduction_d5.html",
    sourceLabel: "Snow’s publications · UCLA collection",
  },
  "Castor oil bottle": {
    text: "Castor oil was a familiar purgative. Its unpleasant taste inspired specially designed medicine spoons, alongside the ordinary spoons used to give liquid medicines.",
    source: "https://www.rcp.ac.uk/news-and-media/news-and-opinion/symons-collection/",
    sourceLabel: "Royal College of Physicians · medicine spoons",
  },
  "Medicine spoon": {
    text: "A small metal spoon for giving liquid medicine. Medicine spoons came in many forms, including double-ended and covered designs.",
    source: "https://www.rcp.ac.uk/news-and-media/news-and-opinion/symons-collection/",
    sourceLabel: "Royal College of Physicians · Symons collection",
  },
  "Small medicine spoon": {
    text: "A smaller spoon sits beside the larger medicine spoon. These implements belong to the everyday work of feeding and nursing sick people.",
    source: "https://www.rcp.ac.uk/news-and-media/news-and-opinion/symons-collection/",
    sourceLabel: "Royal College of Physicians · feeding and medicine spoons",
  },
  "Tongue scraper": {
    text: "This wishbone-shaped scraper is used to clean deposits from the tongue. Silver examples were made in London well before the outbreak.",
    source: "https://collection.sciencemuseumgroup.org.uk/objects/co98610/silver-tongue-scraper-london-england-1827",
    sourceLabel: "Science Museum Group · London tongue scraper · 1827",
  },
  "Lancet case": {
    text: "A pocket case protects small folding lancets. Such blades were used for bloodletting, a longstanding practice in medicine.",
    source: "https://blog.sciencemuseum.org.uk/not-for-the-squeamish/",
    sourceLabel: "Science Museum · lancets and bloodletting instruments · 1750–1850",
  },
  "Sick syphon": {
    text: "A curved drinking tube helps a sick person drink from a cup. Its pierced end strains out larger pieces of food; the hook rests over the cup’s rim.",
    source: "https://collection.sciencemuseumgroup.org.uk/objects/co121637/silver-sick-siphon-1801-1830",
    sourceLabel: "Science Museum Group · silver sick siphon · 1801–1830",
  },
  "Suture needle case": {
    text: "Straight and curved eyed needles sit in a padded case. They carry thread for stitching, rather than injecting liquids.",
    source: "https://collection.sciencemuseumgroup.org.uk/objects/co169613/7-suture-needles-suture-needles",
    sourceLabel: "Science Museum Group · nineteenth-century suture needles",
  },
  "Experimental thermometer": {
    text: "Temperature matters when comparing vapours. A glass thermometer with a marked scale belongs beside Snow’s apparatus and experimental notes.",
    source: "https://www.woodlibrarymuseum.org/wp-content/uploads/rare-books/S_ADRI.pdf",
    sourceLabel: "John Snow · temperature and vapour experiments · 1848",
  },
  "Medical case book": { text: "A working case book for recording symptoms, treatments, and observations. Careful notes help a doctor compare one patient’s experience with another’s." },
  "Returns ledger": { text: "These registers bring individual deaths together as names, addresses, and recorded causes. Each entry represents a household affected by the outbreak." },
  "Water bucket": { text: "A wooden bucket carries water from the workhouse’s own supply. Where people obtain their drinking water matters more to the inquiry than how clear it looks." },
  "Flat iron": {
    text: "A solid smoothing iron is heated at the hearth or stove, then carried to the cloth. Its weight and retained heat press out creases; it has no electric element.",
    source: "https://heritage.southwark.gov.uk/objects/21726/flatiron",
    sourceLabel: "Southwark Heritage · example dated 1850–1900",
  },
  "Warming pan": {
    text: "A long-handled metal pan held hot embers and was passed between the sheets to warm a bed before use. This pan is stored cold with the household belongings.",
    source: "https://historicodessa.org/collections/museum/warming-pan-or-bed-warmer-1971-944",
    sourceLabel: "Historic Odessa · English example, 1790–1850",
  },
  "Feeding boat": {
    text: "A small open feeding vessel, sometimes called a pap boat, helps someone offer soft food to an infant or a person too weak to sit up. It belongs to the work of nursing at home.",
    source: "https://wellcomecollection.org/works/v89pgj6q",
    sourceLabel: "Wellcome Collection · pap boat and feeding cup, c.1850",
  },
  "Tea caddy": {
    text: "A lidded container keeps loose tea together between uses. Wooden caddies could remain in a household for years, passing between generations.",
    source: "https://collections.museumofthehome.org.uk/object18568",
    sourceLabel: "Museum of the Home · wooden example, c.1750–1800",
  },
  "Inkwell": {
    text: "An inkwell keeps a small supply of ink beside the writer. Pens must be dipped again as letters, accounts and registers are filled by hand.",
    source: "https://www.londonmuseum.org.uk/collections/v/object-500513/inkwell/",
    sourceLabel: "London Museum · nineteenth-century glass example",
  },
  "Sewing scissors": {text: "Small scissors and thread belong to work that could be done at home: mending garments, trimming seams and finishing a customer's order."},
  "Chamber candlestick": {text: "A shallow dish catches wax beneath a candle. A portable light can be carried from the work table to the bedside."},
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
