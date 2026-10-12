"""Export the authored MakeHuman Snow source without regenerating its anatomy.

Blender -b --factory-startup --python scripts/assets/build_snow_character.py
The separate snow-source.blend retains its editable rig, shape keys and wardrobe.
The office-reference snow-character.blend and GLB are disposable build outputs.
"""
import bpy, bmesh, math, json, sys, hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).resolve().parent))
from bake_scene_lighting import bake_lighting

source=ROOT/'assets/snow-character/snow-source.blend'
if not source.exists():raise RuntimeError('Missing authored Snow source. See assets/snow-character/SOURCE.md.')
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/snow-office/snow-office.blend'))
room=set(bpy.context.scene.objects)
with bpy.data.libraries.load(str(source),link=False) as (available,loaded):
    loaded.objects=available.objects
authoring=[o for o in loaded.objects if o is not None]
for ob in authoring:bpy.context.scene.collection.objects.link(ob)
bpy.context.view_layer.update()
deps=bpy.context.evaluated_depsgraph_get()
def empty(name,z=0):
    ob=bpy.data.objects.new(name,None);bpy.context.scene.collection.objects.link(ob);ob.location.z=z;return ob
root=empty('Snow_character');upper=empty('Snow_upper',.69);head=empty('Snow_head',1.17)
upper.parent=root;head.parent=root
parts=[]
def attach(ob,group):
    bpy.context.view_layer.update();world=ob.matrix_world.copy();ob.parent=group;ob.matrix_world=world
    parts.append(ob)

for original in authoring:
    if original.type!='MESH':continue
    evaluated=original.evaluated_get(deps)
    mesh=bpy.data.meshes.new_from_object(evaluated,preserve_all_data_layers=True,depsgraph=deps)
    mesh.transform(evaluated.matrix_world)
    ob=bpy.data.objects.new(original.name,mesh);bpy.context.scene.collection.objects.link(ob)
    for p in mesh.polygons:p.use_smooth=True
    if original.name=='Snow anatomy':
        for is_head,group in [(True,head),(False,upper)]:
            cp=ob.copy();cp.data=mesh.copy();bpy.context.scene.collection.objects.link(cp)
            bm=bmesh.new();bm.from_mesh(cp.data)
            bmesh.ops.delete(bm,geom=[f for f in bm.faces if (f.calc_center_median().z>1.08)!=is_head],context='FACES')
            bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
            bm.to_mesh(cp.data);bm.free()
            cp.name='Continuous face MakeHuman' if is_head else 'MakeHuman hands'
            attach(cp,group)
            if is_head:
                bpy.context.view_layer.objects.active=cp
                dec=cp.modifiers.new('Mobile face','DECIMATE');dec.ratio=.90
                bpy.ops.object.modifier_apply(modifier=dec.name)
        bpy.data.objects.remove(ob,do_unlink=True)
    else:
        group=head if original.name in ['Snow eyes','Snow swept hair','Snow eyebrows','Snow sideburns'] else (root if original.name=='Snow leather shoes' else upper)
        attach(ob,group)
        ratio=.56 if original.name=='Snow tailored coat and trousers' else (.40 if original.name=='Snow leather shoes' else (.50 if original.name=='Snow high waistcoat' else 1))
        if ratio<1:
            bpy.context.view_layer.objects.active=ob
            dec=ob.modifiers.new('Mobile geometry','DECIMATE');dec.ratio=ratio
            bpy.ops.object.modifier_apply(modifier=dec.name)
for ob in authoring:bpy.data.objects.remove(ob,do_unlink=True)

# Keep MakeHuman's base UVs; use an independent continuous head lighting chart.
for ob in parts:
    if not ob.data.uv_layers:ob.data.uv_layers.new(name='UVMap')
    if ob.name.startswith(('Continuous face','MakeHuman hands')):
        # Keep the authored non-overlapping face/ear/mouth islands. A cylindrical
        # projection overlaps the mouth cavity and paints black patches on lips.
        uv0=ob.data.uv_layers[0]
        us=[item.uv.x for item in uv0.data];vs=[item.uv.y for item in uv0.data]
        ulo,uhi=min(us),max(us);vlo,vhi=min(vs),max(vs)
        faceuv=ob.data.uv_layers.new(name='FaceLighting')
        for i,item in enumerate(uv0.data):
            faceuv.data[i].uv=((item.uv.x-ulo)/(uhi-ulo),(item.uv.y-vlo)/(vhi-vlo))
        if ob.name.startswith('MakeHuman hands'):ob['lightmap_rect']=[.025,.35,.94,.20]
    colors=ob.data.color_attributes.new(name='Albedo',type='FLOAT_COLOR',domain='POINT')
    for item in colors.data:item.color=(1,1,1,1)
    ob.data.color_attributes.active_color=colors

if '--stats' in sys.argv:
    print('PART BUDGETS',[(o.name,sum(len(p.vertices)-2 for p in o.data.polygons)) for o in parts]);sys.exit(0)
root.location=(-.65,2.28,0);bpy.context.view_layer.update()
M={m.name:m for ob in parts for m in ob.data.materials}
report=bake_lighting(M,ROOT,asset='snow-character',size=1024,environment_width=256,character_charts=True,
                    lights=[],occluders={o for o in room if o.type=='MESH'},probe=(-.65,1.35,-2.1))
for ob in parts:
    chart=ob.data.uv_layers.get('FaceLighting')
    if chart:ob.data.uv_layers.remove(chart)
    ob.data.uv_layers.active_index=0;ob.data.uv_layers[0].active_render=True

# Batch within each idle-motion pivot; the runtime needs no skeletal animation.
for ob in list(parts):
    if len(ob.data.materials)<=1:continue
    bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.separate(type='MATERIAL');bpy.ops.object.mode_set(mode='OBJECT')
parts=[o for o in bpy.context.scene.objects if o.type=='MESH' and o not in room]
for group in [root,upper,head]:
    for name,mat in M.items():
        obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==group and o.data.materials[0]==mat]
        if not obs:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in obs:o.select_set(True)
        bpy.context.view_layer.objects.active=obs[0]
        if len(obs)>1:bpy.ops.object.join()
        obs[0].name=f'{group.name}_{name}'
character=[o for o in bpy.context.scene.objects if o not in room and o.type in {'MESH','EMPTY'}]
triangles=sum(len(p.vertices)-2 for o in character if o.type=='MESH' for p in o.data.polygons)
assert triangles<30000,triangles
asset=ROOT/'assets/snow-character'
bpy.context.preferences.filepaths.save_version=0;bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(asset/'snow-character.blend'))
bpy.ops.object.select_all(action='DESELECT')
for ob in character:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/snow-character.glb'),export_format='GLB',use_selection=True,
    export_yup=True,export_cameras=False,export_lights=False,export_vertex_color='ACTIVE',export_all_vertex_colors=False)
summary={'version':5,'anatomicalBase':'MakeHuman hm08 / MPFB','authoringSource':'snow-source.blend',
         'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'runtimeSkeleton':False,
         'triangles':triangles,'materialBatches':sum(o.type=='MESH' for o in character),
         'bakedLighting':report,'interpretive':True,'reference':'https://epi-snow.ph.ucla.edu/Stream1_introduction_b.html'}
(asset/'build-report.json').write_text(json.dumps(summary,indent=2)+'\n');print('SNOW CHARACTER',summary)
