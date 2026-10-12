"""Apply the portrait study to an existing Snow source, retaining its body/pose.

blender -b --factory-startup --python refine_snow_portrait.py -- MPFB ASSETS INPUT OUTPUT
INPUT/OUTPUT are explicit so iterative studies can start from a saved source.
Normal builds do not run this script: they export the edited Blender source.
"""
import bpy, sys, math, json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[2]
args=sys.argv[sys.argv.index('--')+1:]
mpfb_root,assets,source,dest=map(Path,args[:4])
sys.path.insert(0,str(mpfb_root/'src'))
bpy.utils.extension_path_user=lambda *a,**k:str(ROOT/'tmp/mpfb-user')
import mpfb
bpy.context.preferences.addons.new().module='mpfb';mpfb.register()
from mpfb.services.targetservice import TargetService
from mpfb.services.clothesservice import ClothesService
from mpfb.entities.clothes.mhclo import Mhclo
bpy.ops.wm.open_mainfile(filepath=str(source.resolve()))
body=bpy.data.objects['Snow anatomy'];rig=bpy.data.objects['Snow authoring rig']
if body.get('portrait_study'):
    raise RuntimeError('This source already contains the portrait study. Use the original study input or edit the source directly.')
targets={
    'head/head-oval':.27,'head/head-age-incr':.62,
    'head/head-fat-decr':.08,
    'forehead/forehead-temple-decr':.12,
    'nose/nose-scale-depth-incr':.26,'nose/nose-scale-vert-incr':.23,
    'nose/nose-hump-incr':.22,'nose/nose-scale-horiz-decr':.12,
    'chin/chin-width-incr':0.,'chin/chin-width-decr':.15,
    'chin/chin-prominent-incr':.03,
    'mouth/mouth-lowerlip-volume-decr':.32,
    'mouth/mouth-upperlip-volume-decr':.20,
    'mouth/mouth-laugh-lines-out':.25,
    'mouth/mouth-scale-horiz-decr':.06,
}
for side in ['l','r']:
    targets.update({
        f'eyes/{side}-eye-bag-incr':.28,
        f'eyes/{side}-eye-bag-height-incr':.18,
        f'eyes/{side}-eye-eyefold-down':.18,
        f'eyes/{side}-eye-height2-decr':.10,
        f'cheek/{side}-cheek-inner-decr':.15,
        f'cheek/{side}-cheek-volume-decr':.10,
        f'cheek/{side}-cheek-bones-incr':.08,
    })
for name,weight in targets.items():
    path=str(mpfb_root/'src/mpfb/data/targets'/f'{name}.target.gz')
    keyname=TargetService.filename_to_shapekey_name(path)
    existing=body.data.shape_keys.key_blocks.get(keyname)
    if existing:existing.value=weight
    else:TargetService.load_target(body,path,weight=weight)

# Refit facial accessories only. Refitting the suit would undo its tailoring.
for name,path in [('Snow eyes','eyes/high-poly/high-poly.mhclo'),
                  ('Snow eyebrows','eyebrows/eyebrow001/eyebrow001.mhclo'),
                  ('Snow swept hair','hair/short04/short04.mhclo')]:
    ob=bpy.data.objects[name];mhclo=Mhclo();mhclo.load(str(assets/path));mhclo.clothes=ob
    ClothesService.fit_clothes_to_human(ob,body,mhclo,set_parent=False)

# Use the actual anatomical surface for the hairline and sideburns. Work in
# the unposed shape-key mix, preserving the seated skeleton and all hand poses.
mixed=body.shape_key_add(name='Portrait surface temporary',from_mix=True)
coords=[v.co.copy() for v in mixed.data]
group=body.vertex_groups['body'].index
body_vertices={v.index for v in body.data.vertices if any(g.group==group for g in v.groups)}
faces=[tuple(p.vertices) for p in body.data.polygons if all(i in body_vertices for i in p.vertices)]
tree=BVHTree.FromPolygons(coords,faces)
hair=bpy.data.objects['Snow swept hair']
for v in hair.data.vertices:
    p=v.co.copy()
    if p.y<-.012 and p.z>1.64:
        a=math.atan2(p.z-1.63,-p.y);r=math.hypot(p.y,p.z-1.63)
        front=max(0,min(1,(-p.y-.012)/.045))
        rise=(.27+.27*min(1,abs(p.x)/.065))*front*max(0,min(1,(1.55-a)/.7))
        p.y=-r*math.cos(a+rise);p.z=1.63+r*math.sin(a+rise)
        hit,normal,_,_=tree.find_nearest(p)
        if hit is not None:p=hit+normal*.0030
        v.co=p

# Long cheek-side whiskers are the portrait's strongest distinguishing feature.
# They stop short of the mouth and chin: these are sideburns, not a full beard.
selected=[]
ear_group=body.vertex_groups['ears'].index
ears={v.index for v in body.data.vertices if any(g.group==ear_group for g in v.groups)}
for f in faces:
    p=sum((coords[i] for i in f),Vector())/len(f)
    front=-.071-.037*max(0,min(1,(1.67-p.z)/.115))
    if 1.540<p.z<1.690 and .053<abs(p.x)<.094 and front<p.y<-.003 and not any(i in ears for i in f):
        selected.append(f)
ids=sorted(set(i for f in selected for i in f));lookup={v:i for i,v in enumerate(ids)}
points=[]
for i in ids:
    p=coords[i];hit,normal,_,_=tree.find_nearest(p)
    points.append(p+normal*.0018)
mesh=bpy.data.meshes.new('Portrait sideburns');mesh.from_pydata(points,[],[tuple(lookup[i] for i in f) for f in selected]);mesh.update()
ob=bpy.data.objects.new('Snow sideburns',mesh);bpy.context.scene.collection.objects.link(ob);ob.parent=rig
mesh.materials.append(hair.data.materials[0]);uv=mesh.uv_layers.new(name='UVMap')
for p in mesh.polygons:
    p.use_smooth=True
    for li in p.loop_indices:
        co=mesh.vertices[mesh.loops[li].vertex_index].co
        uv.data[li].uv=(.32+(co.y+.08)*2,.59+(co.z-1.536)*1.6)
vg=ob.vertex_groups.new(name='head');vg.add(list(range(len(points))),1.,'REPLACE')
mod=ob.modifiers.new('Armature','ARMATURE');mod.object=rig
dec=ob.modifiers.new('Mobile whisker surface','DECIMATE');dec.ratio=.28
body.shape_key_remove(mixed)
body['portrait_study']=json.dumps({'reference':'https://epi-snow.ph.ucla.edu/Stream1_introduction_b.html',
    'targets':targets,'notes':'1856/1857 photograph is a later visual reference for the 1854 scenario. Interpretive proportions and hair; no photograph pixels.'})
bpy.context.preferences.filepaths.save_version=0;bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(dest.resolve()))
print('PORTRAIT STUDY',len(selected),'sideburn faces',dest)
