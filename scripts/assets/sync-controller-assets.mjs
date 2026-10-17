// Unpack @webxr-input-profiles/assets@1.0.20, then pass its package directory.
// Copy the profiles we use, deduplicating identical GLBs across generic fallbacks.
import { readFile, writeFile, mkdir, copyFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
const source=resolve(process.argv[2]??'/tmp/vr-snow-xr-assets/package');
const pkg=JSON.parse(await readFile(`${source}/package.json`));
if(pkg.version!=='1.0.20')throw new Error('Expected audited assets version 1.0.20');
const root=resolve('public/controllers');
const all=JSON.parse(await readFile(`${source}/dist/profiles/profilesList.json`));
const known=JSON.parse(await readFile('src/walkable/controller-buttons.json'));
const ids=Object.keys(all).filter(id=>Object.hasOwn(known,id)||id.startsWith('generic-')&&!id.includes('hand'));
const files=new Set(),list={};await mkdir(`${root}/models`,{recursive:true});
for(const id of ids){
  list[id]=all[id];const dir=`${source}/dist/profiles/${id}`;
  const profile=JSON.parse(await readFile(`${dir}/profile.json`));
  await mkdir(`${root}/${id}`,{recursive:true});
  for(const layout of Object.values(profile.layouts)){
    const original=layout.assetPath,bytes=await readFile(resolve(dir,original));
    const file=createHash('sha256').update(bytes).digest('hex').slice(0,20)+'.glb';
    if(!files.has(file)){await writeFile(`${root}/models/${file}`,bytes);files.add(file);}
    layout.assetPath=`../models/${file}`;
    // Remove un-deduplicated copies from earlier exports, if present.
    if(dirname(original)==='.')await rm(`${root}/${id}/${original}`,{force:true});
  }
  await writeFile(`${root}/${id}/profile.json`,JSON.stringify(profile,null,2)+'\n');
}
await writeFile(`${root}/profilesList.json`,JSON.stringify(list,null,2)+'\n');
await copyFile(`${source}/LICENSE.md`,`${root}/LICENSE.txt`);
console.log(`${ids.length} profiles, ${files.size} distinct controller models`);
