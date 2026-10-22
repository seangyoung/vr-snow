import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const root=process.argv[2]??'public';
const html=await readFile(`${root}/preview/inquiry/index.html`,'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const oldKey='broad-street-inquiry:v1:/vr-snow/preview/inquiry/';
const mainKey='broad-street-inquiry:v1:/vr-snow/';
for(const existing of [undefined,'existing main save'])for(const blocked of [false,true])for(const suffix of ['', 'index.html']) {
 const store=new Map([[oldKey,'preview save']]);if(existing)store.set(mainKey,existing);
 let redirected;
 const location={href:`https://example.org/vr-snow/preview/inquiry/${suffix}?revision=old#chapter`,search:'?revision=old',hash:'#chapter',replace:url=>redirected=url};
 const window={location,get localStorage(){if(blocked)throw Error('Storage denied');return {getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value)};}};
 vm.runInNewContext(script,{window,URL});
 assert.equal(redirected,'https://example.org/vr-snow/?revision=old#chapter');
 assert.equal(store.get(oldKey),'preview save');
 assert.equal(store.get(mainKey),existing??(blocked?undefined:'preview save'));
}
console.log('Preview redirect preserves query/hash, retains saves, respects existing main saves and handles denied storage.');
