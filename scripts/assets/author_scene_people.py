"""One-time MakeHuman scene actor authoring. Normal exports read the saved sources.
Usage: blender -b --factory-startup --python author_scene_people.py -- MPFB ASSETS ACTOR
Explicit --replace-source restarts this actor and discards subsequent Blender edits.
"""
import bpy, bmesh, sys, math, json
from pathlib import Path
from mathutils import Vector, Matrix

ROOT=Path(__file__).resolve().parents[2]

args=sys.argv[sys.argv.index('--')+1:]
actor_id=args[2]
profiles=json.loads((ROOT/'assets/scene-people/appearance.json').read_text())
spec=profiles[actor_id]
scene_specs=json.loads((ROOT/'src/walkable/scene-characters.json').read_text())
placement=next(a for scene in scene_specs.values() for a in scene['actors'] if a['id']==actor_id)
OUT=ROOT/f'assets/scene-people/{actor_id}.blend'
if OUT.exists() and '--replace-source' not in args:
    raise RuntimeError('The authored source exists. Export it with build_scene_characters.py; do not regenerate it.')
MPFB=Path(args[0]);ASSETS=Path(args[1])
sys.path.insert(0,str(MPFB/'src'))
# Register only in this factory-startup process; do not install or save preferences.
bpy.utils.extension_path_user=lambda *a,**k:str(ROOT/'tmp/mpfb-user')
import mpfb
bpy.context.preferences.addons.new().module='mpfb';mpfb.register()
from mpfb.services.humanservice import HumanService
from mpfb.services.targetservice import TargetService

bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
macro=TargetService.get_default_macro_info_dict()
macro.update(gender=spec['gender'],age=spec['age'],muscle=spec['muscle'],weight=spec['weight'],height=.7 if placement.get('dress') else .5)
macro['race']={'caucasian':1.,'african':0.,'asian':0.}
body=HumanService.create_human(macro_detail_dict=macro);body.name='Snow anatomy'
# Interpretive portrait proportions, not a claim of a measured historical likeness.
targets={f"head/head-{spec['head']}":spec['headShape'],
         'head/head-age-incr':max(0,(spec['age']-.3)*.95)}
def signed(category,value):
    if abs(value)>.001:targets[category+('-incr' if value>0 else '-decr')]=abs(value)
signed('nose/nose-scale-vert',spec['noseLength'])
signed('nose/nose-scale-depth',spec['noseLength']*.7)
signed('nose/nose-scale-horiz',spec['noseWidth'])
signed('chin/chin-width',spec['jaw'])
signed('mouth/mouth-scale-horiz',spec['mouth'])
for side in ['l','r']:
    signed(f'cheek/{side}-cheek-volume',spec['cheeks'])
    targets[f'eyes/{side}-eye-bag-incr']=max(0,(spec['age']-.25)*.55)
    targets[f'eyes/{side}-eye-height2-decr']=.10
    # Horizontal translation separates eye placement without changing the eyeball fit.
    targets[f'eyes/{side}-eye-trans-{"out" if spec["eyeSpacing"]>0 else "in"}']=abs(spec['eyeSpacing'])
for name,weight in targets.items():
    TargetService.load_target(body,str(MPFB/'src/mpfb/data/targets'/f'{name}.target.gz'),weight=weight)
rig=HumanService.add_builtin_rig(body,'game_engine');rig.name='Snow authoring rig'

def material(name,hexcolor,rough=.8,texture=None,alpha=False,size=None):
    m=bpy.data.materials.new(name);m.use_fake_user=True;m.use_nodes=True;n=m.node_tree.nodes;bs=n.get('Principled BSDF')
    srgb=[int(hexcolor[i:i+2],16)/255 for i in (0,2,4)]
    bs.inputs['Base Color'].default_value=(*[(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4) for v in srgb],1)
    bs.inputs['Roughness'].default_value=rough
    bs.inputs['Specular IOR Level'].default_value=.22
    if texture:
        im=bpy.data.images.load(str(texture),check_existing=True)
        if size:im.scale(size,size)
        im.use_fake_user=True;im.pack();tex=n.new('ShaderNodeTexImage');tex.image=im
        m.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
        if alpha:
            # Binary coverage avoids sorting dozens of overlapping hair cards in WebXR.
            cut=n.new('ShaderNodeMath');cut.operation='GREATER_THAN';cut.inputs[1].default_value=.45
            m.node_tree.links.new(tex.outputs['Alpha'],cut.inputs[0]);m.node_tree.links.new(cut.outputs[0],bs.inputs['Alpha'])
            m.surface_render_method='DITHERED';m['gltf_alpha_mode']='MASK';m.alpha_threshold=.45
    return m

skin=material('Skin','c3a38e',.68,ASSETS/'skins'/spec['skin'],size=1024)
body.data.materials.clear();body.data.materials.append(skin)
def asset(path,kind,name,mat):
    ob=HumanService.add_mhclo_asset(str(ASSETS/path),body,asset_type=kind,subdiv_levels=0,material_type='NONE')
    ob.name=name;ob.data.materials.clear();ob.data.materials.append(mat)
    for p in ob.data.polygons:p.use_smooth=True
    return ob
eyes=asset('eyes/high-poly/high-poly.mhclo','Eyes','Snow eyes',material('Eyes','c8c2b8',.3,ASSETS/f"eyes/materials/{spec['eye']}_eye.png",True,256))
hair=asset(f"hair/{spec['hair']}/{spec['hair']}.mhclo",'Hair','Snow swept hair',material('Hair','302720',.85,ASSETS/f"hair/{spec['hair']}/{spec['hair']}_diffuse.png",True,512))
hm=hair.data.materials[0];nodes=hm.node_tree.nodes;bs=nodes.get('Principled BSDF')
# Author a packed greying variant while retaining the strand texture and alpha.
# This changes the Blender material asset, not any upstream source image.
if spec.get('grey',0):
    import numpy as np
    texture_node=next(n for n in nodes if n.type=='TEX_IMAGE')
    im=texture_node.image.copy();im.name=actor_id+' greying hair';texture_node.image=im
    rgba=np.array(im.pixels[:],dtype=np.float32).reshape(-1,4)
    strand=np.mean(rgba[:,:3],axis=1,keepdims=True)
    grey=.20+.42*np.sqrt(np.maximum(strand,0))
    rgba[:,:3]=rgba[:,:3]*(1-spec['grey'])+grey*spec['grey']
    im.pixels.foreach_set(rgba.ravel());im.update();im.pack()

texlink=bs.inputs['Base Color'].links[0].from_socket
mix=nodes.new('ShaderNodeMix');mix.data_type='RGBA';mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[7].default_value=(*spec['hairTint'],1)
hm.node_tree.links.new(texlink,mix.inputs[6]);hm.node_tree.links.new(mix.outputs[2],bs.inputs['Base Color'])
brows=asset(f"eyebrows/{spec['brows']}/{spec['brows']}.mhclo",'Eyebrows','Snow eyebrows',material('Brows','32251b',.95,ASSETS/f"eyebrows/{spec['brows']}/{spec['brows']}.png",True,256))
garment='female_elegantsuit01' if placement.get('dress') else 'male_elegantsuit01'
coat=asset(f'clothes/{garment}/{garment}.mhclo','Clothes','Snow tailored coat and trousers',material('Coat',placement['coat'],.9))
boots=asset('clothes/shoes02/shoes02.mhclo','Clothes','Snow leather shoes',material('Boot','27221e',.52))

# Rework the stock garment: remove its long modern necktie, distinguish linen
# cuffs/collar, lengthen the side/back skirt, and add a high-buttoned waistcoat.
shirt=material('Shirt','ded7c4',.9);vestmat=material('Waistcoat',placement['vest'],.88)
neckwear=material('Neckwear','262922',.88);buttons=material('Buttons','716149',.55)
coat.data.materials.append(shirt)
texture=bpy.data.images.load(str(ASSETS/f'clothes/{garment}/{garment}_diffuse.png'))
pixels=list(texture.pixels);tw,th=texture.size
bm=bmesh.new();bm.from_mesh(coat.data);uv=bm.loops.layers.uv.active;remove=[]
for f in bm.faces:
    u,v=sum((l[uv].uv for l in f.loops),Vector((0,0)))/len(f.loops)
    p=f.calc_center_median();idx=4*(min(th-1,int(v*th))*tw+min(tw-1,int(u*tw)))
    if placement.get('dress'):
        if p.z<.94:remove.append(f)
    elif .345<u<.49 and .80<v<.985 and p.z<1.46 and abs(p.x)<.055:
        remove.append(f)
    elif sum(pixels[idx:idx+3])/3>.45:f.material_index=1
bmesh.ops.delete(bm,geom=remove,context='FACES');bm.to_mesh(coat.data);bm.free()
for v in coat.data.vertices:
    if not placement.get('dress') and v.index>=1357 and v.co.z<1.03:
        # A longer skirt at the hips/back; retain a clear seated front opening.
        v.co.z-=.085*max(0,min(1,(1.03-v.co.z)/.12))*max(.25,min(1,(v.co.y+.13)/.11))

def mesh_object(name,verts,faces,mat):
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob);ob.data.materials.append(mat);ob.parent=rig
    for p in me.polygons:p.use_smooth=True
    return ob
if not placement.get('dress'):
    profile=[(1.01,.132,.13),(1.10,.147,.14),(1.24,.163,.135),(1.36,.151,.105),(1.44,.064,.07)]
    vs=[];fs=[];n=24
    for z,rx,depth in profile:
        for i in range(n):
            a=(i/(n-1)-.5)*math.pi;vs.append((rx*math.sin(a),-depth*math.cos(a)-.014,z))
    for j in range(len(profile)-1):
        for i in range(n-1):a=j*n+i;fs.append((a,a+1,a+1+n,a+n))
    waistcoat=mesh_object('Snow high waistcoat',vs,fs,vestmat)
    solid=waistcoat.modifiers.new('Cloth thickness','SOLIDIFY');solid.thickness=.002
    sub=waistcoat.modifiers.new('Tailored cloth','SUBSURF');sub.levels=1

    def oval(name,location,scale,mat):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,location=location)
        ob=bpy.context.object;ob.name=name;ob.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        ob.data.materials.append(mat);ob.parent=rig
        for p in ob.data.polygons:p.use_smooth=True
        return ob
    for z in [1.24,1.285,1.33,1.375]:
        depth=.149-(z-1.24)*.28
        oval('Snow waistcoat button',(0,-depth-.004,z),(.0035,.002,.0035),buttons)
    oval('Snow cravat knot',(0,-.104,1.456),(.020,.015,.017),neckwear)
    for side in [-1,1]:
        o=oval('Snow folded cravat',(side*.026,-.102,1.452),(.025,.010,.010),neckwear);o.rotation_euler.y=side*.16


# Solve joint directions in armature space; matrices preserve parent transforms.
def aim(name,direction,twist=0):
    p=rig.pose.bones[name];bpy.context.view_layer.update()
    old=(p.tail-p.head).normalized();q=old.rotation_difference(Vector(direction).normalized())
    r=q.to_matrix().to_4x4()@p.matrix
    r.translation=p.head;p.matrix=r;bpy.context.view_layer.update()
standing=placement['pose']=='standing'
rig.location.z=0 if standing else -.36
for side,suffix in [(1,'l'),(-1,'r')]:
    if not standing:
        aim('thigh_'+suffix,(side*.04,-.99,-.13))
        aim('calf_'+suffix,(side*.02,.04,-1))
        aim('foot_'+suffix,(0,-.92,-.38));aim('ball_'+suffix,(0,-1,0))
    lap=placement['pose']=='lap'
    aim('upperarm_'+suffix,(side*.08,-.06,-1) if standing else (side*.16,-.30,-.94) if lap else (side*.19,-.74,-.64))
    aim('lowerarm_'+suffix,(-side*.04,-.10,-1) if standing else (-side*.33,-.84,-.40) if lap else (-side*.16,-.984,-.18))
    p=rig.pose.bones['hand_'+suffix];rest=p.bone.matrix_local.to_3x3()
    a=rig.data.bones['middle_01_'+suffix].head_local-p.bone.head_local
    across=rig.data.bones['index_01_'+suffix].head_local-rig.data.bones['pinky_01_'+suffix].head_local
    y=a.normalized();x=(across-y*across.dot(y)).normalized();z=x.cross(y).normalized()
    old=Matrix((x,y,z)).transposed()
    if standing:
        ny=Vector((0,-.10,-1)).normalized();nx=Vector((0,-1,.10)).normalized()
    else:
        ny=Vector((-side*.18,-1,-.025)).normalized();nx=Vector((-side,.18,0)).normalized()
    nz=nx.cross(ny).normalized();nx=ny.cross(nz).normalized()
    r=(Matrix((nx,ny,nz)).transposed()@old.transposed()@rest).to_4x4()
    r.translation=p.head;p.matrix=r;bpy.context.view_layer.update()
    for i,finger in enumerate(['index','middle','ring','pinky']):
        for segment,pitch in [(1,-.035),(2,-.07),(3,-.10)]:
            direction=(-side*.10+side*(i-1.5)*.055,-1,pitch)
            if standing:direction=(-side*.06,-.12+segment*.10,-1)
            aim(f'{finger}_{segment:02d}_{suffix}',direction)
    for segment in [1,2,3]:
        aim(f'thumb_{segment:02d}_{suffix}',(0,-.60,-.80) if standing else (-side*(.58-.10*segment),-.90,-.025))

# Recede the short style on the actual anatomical scalp. Each age has a different
# amount; younger figures keep a lower hairline rather than inheriting Snow's face.
if spec['recession']:
    from mathutils.bvhtree import BVHTree
    mixed=body.shape_key_add(name='Hair fitting surface',from_mix=True)
    coords=[v.co.copy() for v in mixed.data]
    group=body.vertex_groups['body'].index
    ids={v.index for v in body.data.vertices if any(g.group==group for g in v.groups)}
    faces=[tuple(p.vertices) for p in body.data.polygons if all(i in ids for i in p.vertices)]
    tree=BVHTree.FromPolygons(coords,faces)
    for v in hair.data.vertices:
        p=v.co.copy()
        if p.y<-.012 and p.z>1.64:
            a=math.atan2(p.z-1.63,-p.y);radius=math.hypot(p.y,p.z-1.63)
            rise=spec['recession']*(.65+.7*min(1,abs(p.x)/.065))*max(0,min(1,(-p.y-.012)/.045))*max(0,min(1,(1.55-a)/.7))
            p.y=-radius*math.cos(a+rise);p.z=1.63+radius*math.sin(a+rise)
            hit,normal,_,_=tree.find_nearest(p)
            if hit is not None:p=hit+normal*.003
            v.co=p
    body.shape_key_remove(mixed)

if placement.get('dress'):
    # Fitted swept-back cap plus a low bun; no loose modern fringe.
    # The source remains fully editable and textured.
    bm=bmesh.new();bm.from_mesh(hair.data)
    bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.calc_center_median().z<rig.data.bones['head'].head_local.z-.04],context='FACES')
    bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
    bm.to_mesh(hair.data);bm.free()
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=(0,.105,rig.data.bones['head'].head_local.z+.015))
    bun=bpy.context.object;bun.name='Snow hair bun';bun.scale=(.066,.040,.051)
    bpy.ops.object.transform_apply(location=True,rotation=False,scale=True)
    bun.parent=rig;bun.data.materials.append(hm)
    for poly in bun.data.polygons:
        poly.use_smooth=True
        for li in poly.loop_indices:
            uv=bun.data.uv_layers[0].data[li].uv;uv.x=.3+uv.x*.2;uv.y=.3+uv.y*.25
    vg=bun.vertex_groups.new(name='head');vg.add(list(range(len(bun.data.vertices))),1,'REPLACE')
    mod=bun.modifiers.new('Armature','ARMATURE');mod.object=rig
    # Seated gathered skirt: rounded over the lap, generous at the hem, with
    # restrained cloth folds. Coordinates are in rig space (before its lowering).
    profile=[(.40,.275,.40,-.19),(.49,.285,.42,-.19),(.70,.28,.43,-.19),(.91,.25,.42,-.17),(1.00,.20,.30,-.10),(1.06,.15,.145,-.01)]
    verts=[];faces=[];segments=64
    for z,rx,ry,cy in profile:
        for i in range(segments):
            angle=i*math.tau/segments;fold=1+.017*math.sin(angle*20)+.008*math.sin(angle*13)
            verts.append((rx*math.sin(angle)*fold,cy+ry*math.cos(angle)*fold,z))
    for j in range(len(profile)-1):
        for i in range(segments):a=j*segments+i;b=j*segments+(i+1)%segments;faces.append((a,a+segments,b+segments,b))
    skirt=mesh_object('Snow gathered skirt',verts,faces,coat.data.materials[0])
    uv=skirt.data.uv_layers.new(name='UVMap')
    for poly in skirt.data.polygons:
        indices=list(poly.vertices);seam=any(i%segments==0 for i in indices) and any(i%segments==segments-1 for i in indices)
        for li in poly.loop_indices:
            vi=skirt.data.loops[li].vertex_index;u=(vi%segments)/segments
            if seam and vi%segments==0:u=1
            uv.data[li].uv=(u,(vi//segments)/(len(profile)-1))
    sub=skirt.modifiers.new('Soft cloth','SUBSURF');sub.levels=1
    neck=rig.data.bones['neck_01'].head_local.z
    kerchief=mesh_object('Snow plain neckcloth',[
        (-.055,-.092,neck-.04),(.055,-.092,neck-.04),
        (.078,-.130,neck-.08),(0,-.160,neck-.155),(-.078,-.130,neck-.08)],
        [(0,4,3,2,1)],shirt)
    solid=kerchief.modifiers.new('Linen thickness','SOLIDIFY');solid.thickness=.002

for ob in [body,eyes,hair,brows,coat,boots]:
    for p in ob.data.polygons:p.use_smooth=True
body['source']='MakeHuman hm08 via MPFB';body['portrait_targets']=json.dumps(targets)
rig['pose_note']=placement['pose']+'; editable FK pose. Static export, no runtime skeleton.'
body['appearance_profile']=json.dumps(spec)
body['interpretive']=True
bpy.context.preferences.filepaths.save_version=0;bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT))
print('AUTHORED SOURCE',OUT)
