"""Rebuild curated mono WAVs. Requires numpy + soundfile; no runtime dependency.
Usage: python prepare_ambience.py [download-cache-directory]
Original files are cached outside the repository; source hashes and licenses ship.
"""
from pathlib import Path
import hashlib, io, json, sys, tempfile, urllib.request, zipfile
import numpy as np
import soundfile as sf
ROOT=Path(__file__).resolve().parents[2]
CACHE=Path(sys.argv[1]) if len(sys.argv)>1 else Path(tempfile.gettempdir())/'vr-snow-audio'
CACHE.mkdir(parents=True,exist_ok=True)
OUT=ROOT/'public/audio';OUT.mkdir(exist_ok=True)
SOURCES={
 'kenney':('https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip','https://kenney.nl/assets/impact-sounds','Kenney','CC0-1.0'),
 'rpg':('https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip','https://kenney.nl/assets/rpg-audio','Kenney','CC0-1.0'),
 'wagon':('https://upload.wikimedia.org/wikipedia/commons/a/a9/WWS_Woodenwagon.ogg','https://commons.wikimedia.org/wiki/File:WWS_Woodenwagon.ogg','Work With Sounds / Museum of Municipal Engineering; recordist Monika Widzicka','CC-BY-4.0'),
}
selected={
 'kenney':{'wood-1':'impactWood_medium_000','wood-2':'impactWood_medium_001',
 'step-wood-1':'footstep_wood_000','step-wood-2':'footstep_wood_001',
 'step-stone-1':'footstep_concrete_000','step-stone-2':'footstep_concrete_001'},
 'rpg':{'paper-1':'bookFlip1','paper-2':'bookFlip2','creak-1':'creak1','creak-2':'creak2',
 'metal-1':'metalPot1','metal-2':'metalPot2','cloth':'cloth1','door':'doorClose_1'},
 'wagon':{'wagon':'WWS Woodenwagon'},
}
manifest=[]
for key,(url,page,author,license) in SOURCES.items():
 path=CACHE/(key+('.ogg' if key=='wagon' else '.zip'))
 if not path.exists():
  request=urllib.request.Request(url,headers={'User-Agent':'VR-Snow-asset-preparation/1.0'})
  with urllib.request.urlopen(request,timeout=60) as response:path.write_bytes(response.read())
 archive=zipfile.ZipFile(path) if key!='wagon' else None
 if archive:(OUT/f'{key}-license.txt').write_bytes(archive.read('License.txt'))
 for name,original in selected[key].items():
  raw=archive.read(f'Audio/{original}.ogg') if archive else path.read_bytes()
  samples,rate=sf.read(io.BytesIO(raw),always_2d=True);samples=samples.mean(axis=1)
  # Band-limit before resampling; moving-average prefilter avoids high-frequency
  # aliases on the intentionally distant/muffled ambience.
  width=max(1,round(rate/22050));samples=np.convolve(samples,np.ones(width)/width,mode='same')
  data=np.interp(np.arange(round(len(samples)*22050/rate))*rate/22050,np.arange(len(samples)),samples)
  if key=='wagon':data=data[22050:22050*13] # 12-second excerpt, excluding the initial handling
  peak=float(np.max(np.abs(data)))
  if peak:data*=.65/peak
  fade=min(len(data)//2,round(22050*(.35 if key=='wagon' else .012)))
  data[:fade]*=np.linspace(0,1,fade);data[-fade:]*=np.linspace(1,0,fade)
  target=OUT/(name+'.wav');sf.write(target,data,22050,subtype='PCM_16')
  manifest.append(dict(file=target.name,original=original+'.ogg',source=page,author=author,license=license,
    sourceSha256=hashlib.sha256(raw).hexdigest(),sha256=hashlib.sha256(target.read_bytes()).hexdigest(),
    seconds=round(len(data)/22050,4),bytes=target.stat().st_size,
    changes='Mono, low-pass/downsampled to 22050 Hz, peak normalized, edge fades; wagon excerpt 1-13 seconds' if key=='wagon' else 'Mono, low-pass/downsampled to 22050 Hz, peak normalized, edge fades'))
(OUT/'sources.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f'{len(manifest)} clips; {sum(x["bytes"] for x in manifest):,} download bytes; {sum(x["seconds"] for x in manifest):.2f} seconds')
