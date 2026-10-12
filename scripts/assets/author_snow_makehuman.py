"""One-time MakeHuman import/pose setup. Normal exports load snow-source.blend.

Usage: blender -b --factory-startup --python author_snow_makehuman.py -- MPFB_ROOT SYSTEM_ASSETS
Requires the pinned MPFB checkout and CC0 system pack recorded in SOURCE.md.
Never overwrites an existing authored source unless --replace-source is supplied.
"""
import bpy, bmesh, sys, math, json
from pathlib import Path
from mathutils import Vector, Matrix

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/snow-character/snow-source.blend'
args=sys.argv[sys.argv.index('--')+1:]
if OUT.exists() and '--replace-source' not in args:
    raise RuntimeError('The authored source exists. Export it with build_snow_character.py; do not regenerate it.')
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
macro.update(gender=1.,age=.55,muscle=.43,weight=.49,height=.5)
macro['race']={'caucasian':1.,'african':0.,'asian':0.}
body=HumanService.create_human(macro_detail_dict=macro);body.name='Snow anatomy'
# Interpretive portrait proportions, not a claim of a measured historical likeness.
targets={'head/head-oval':.18,'head/head-age-incr':.22,'nose/nose-scale-depth-incr':.20,
         'nose/nose-scale-vert-incr':.14,'nose/nose-hump-incr':.12,
         'chin/chin-width-incr':.10,'chin/chin-prominent-incr':.10,
         'mouth/mouth-lowerlip-volume-decr':.18}
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

skin=material('Skin','c3a38e',.68,ASSETS/'skins/middleage_caucasian_male/middleage_lightskinned_male_diffuse.png',size=1024)
body.data.materials.clear();body.data.materials.append(skin)
def asset(path,kind,name,mat):
    ob=HumanService.add_mhclo_asset(str(ASSETS/path),body,asset_type=kind,subdiv_levels=0,material_type='NONE')
    ob.name=name;ob.data.materials.clear();ob.data.materials.append(mat)
    for p in ob.data.polygons:p.use_smooth=True
    return ob
eyes=asset('eyes/high-poly/high-poly.mhclo','Eyes','Snow eyes',material('Eyes','c8c2b8',.3,ASSETS/'eyes/materials/grey_eye.png',True,256))
hair=asset('hair/short04/short04.mhclo','Hair','Snow swept hair',material('Hair','302720',.85,ASSETS/'hair/short04/short04_diffuse.png',True,512))
hm=hair.data.materials[0];nodes=hm.node_tree.nodes;bs=nodes.get('Principled BSDF')
texlink=bs.inputs['Base Color'].links[0].from_socket
mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(.32,.26,.21,1)
hm.node_tree.links.new(texlink,mix.inputs[1]);hm.node_tree.links.new(mix.outputs[0],bs.inputs['Base Color'])
brows=asset('eyebrows/eyebrow001/eyebrow001.mhclo','Eyebrows','Snow eyebrows',material('Brows','32251b',.95,ASSETS/'eyebrows/eyebrow001/eyebrow001.png',True,256))
coat=asset('clothes/male_elegantsuit01/male_elegantsuit01.mhclo','Clothes','Snow tailored coat and trousers',material('Coat','383b37',.9))
boots=asset('clothes/shoes02/shoes02.mhclo','Clothes','Snow leather shoes',material('Boot','27221e',.52))

# Rework the stock garment: remove its long modern necktie, distinguish linen
# cuffs/collar, lengthen the side/back skirt, and add a high-buttoned waistcoat.
shirt=material('Shirt','ded7c4',.9);vestmat=material('Waistcoat','665e50',.88)
neckwear=material('Neckwear','262922',.88);buttons=material('Buttons','716149',.55)
coat.data.materials.append(shirt)
texture=bpy.data.images.load(str(ASSETS/'clothes/male_elegantsuit01/male_elegantsuit01_diffuse.png'))
pixels=list(texture.pixels);tw,th=texture.size
bm=bmesh.new();bm.from_mesh(coat.data);uv=bm.loops.layers.uv.active;remove=[]
for f in bm.faces:
    u,v=sum((l[uv].uv for l in f.loops),Vector((0,0)))/len(f.loops)
    p=f.calc_center_median();idx=4*(min(th-1,int(v*th))*tw+min(tw-1,int(u*tw)))
    if .345<u<.49 and .80<v<.985 and p.z<1.46 and abs(p.x)<.055:
        remove.append(f)
    elif sum(pixels[idx:idx+3])/3>.45:f.material_index=1
bmesh.ops.delete(bm,geom=remove,context='FACES');bm.to_mesh(coat.data);bm.free()
for v in coat.data.vertices:
    if v.index>=1357 and v.co.z<1.03:
        # A longer skirt at the hips/back; retain a clear seated front opening.
        v.co.z-=.085*max(0,min(1,(1.03-v.co.z)/.12))*max(.25,min(1,(v.co.y+.13)/.11))

def mesh_object(name,verts,faces,mat):
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob);ob.data.materials.append(mat);ob.parent=rig
    for p in me.polygons:p.use_smooth=True
    return ob
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
rig.location.z=-.36
for side,suffix in [(1,'l'),(-1,'r')]:
    aim('thigh_'+suffix,(side*.04,-.99,-.13))
    aim('calf_'+suffix,(side*.02,.04,-1))
    aim('foot_'+suffix,(0,-.92,-.38))
    aim('ball_'+suffix,(0,-1,0))
    aim('upperarm_'+suffix,(side*.19,-.74,-.64))
    aim('lowerarm_'+suffix,(-side*.16,-.984,-.045))
    # The wrist's rest hand axis is oblique; reconstruct a flat palm from its fingers.
    p=rig.pose.bones['hand_'+suffix];rest=p.bone.matrix_local.to_3x3()
    a=rig.data.bones['middle_01_'+suffix].head_local-p.bone.head_local
    across=rig.data.bones['index_01_'+suffix].head_local-rig.data.bones['pinky_01_'+suffix].head_local
    y=a.normalized();x=(across-y*across.dot(y)).normalized();z=x.cross(y).normalized()
    old=Matrix((x,y,z)).transposed()
    ny=Vector((-side*.10,-1,-.025)).normalized();nx=Vector((-side,.10,0)).normalized();nz=nx.cross(ny).normalized();nx=ny.cross(nz).normalized()
    new=Matrix((nx,ny,nz)).transposed()
    r=(new@old.transposed()@rest).to_4x4();r.translation=p.head;p.matrix=r;bpy.context.view_layer.update()
    for i,finger in enumerate(['index','middle','ring','pinky']):
        for segment,pitch in [(1,-.035),(2,-.07),(3,-.10)]:
            aim(f'{finger}_{segment:02d}_{suffix}',(-side*.10+side*(i-1.5)*.055,-1,pitch))
    for segment in [1,2,3]:
        aim(f'thumb_{segment:02d}_{suffix}',(-side*(.58-.10*segment),-.90,-.025))

for ob in [body,eyes,hair,brows,coat,boots]:
    for p in ob.data.polygons:p.use_smooth=True
body['source']='MakeHuman hm08 via MPFB';body['portrait_targets']=json.dumps(targets)
rig['pose_note']='Seated, palms down; editable FK pose. Static export, no runtime skeleton.'
bpy.context.preferences.filepaths.save_version=0;bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT))
print('AUTHORED SOURCE',OUT)
