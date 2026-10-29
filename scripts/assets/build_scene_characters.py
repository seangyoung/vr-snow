"""Export saved MakeHuman scene figures into existing scene/interaction contracts.
Usage: blender -b --factory-startup --python build_scene_characters.py -- SCENE
Authoring sources and profiles: assets/scene-people/. No MPFB required to export.
"""
import bpy,bmesh,json,sys,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).resolve().parent))
from bake_scene_lighting import bake_lighting
key=sys.argv[sys.argv.index('--')+1]
config=json.loads((ROOT/'src/walkable/scene-characters.json').read_text())[key]
asset=config['asset'];room_name=config['room'];count=len(config['actors'])
bpy.ops.wm.open_mainfile(filepath=str(ROOT/f'assets/{room_name}/{room_name}.blend'))
room=set(bpy.context.scene.objects);all_parts=[];actors=[];sources={}
def empty(name,z=0):
    ob=bpy.data.objects.new(name,None);bpy.context.scene.collection.objects.link(ob);ob.location.z=z;return ob

for index,spec in enumerate(config['actors']):
    source=ROOT/f"assets/scene-people/{spec.get('source',spec['id'])}.blend"
    if not source.exists():raise RuntimeError(f'Missing authored source {source}')
    sources[spec['id']]=hashlib.sha256(source.read_bytes()).hexdigest()
    with bpy.data.libraries.load(str(source),link=False) as (available,loaded):loaded.objects=available.objects
    authoring=[o for o in loaded.objects if o is not None]
    for ob in authoring:bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
    standing=spec['pose']=='standing'
    rig=next(o for o in authoring if o.type=='ARMATURE')
    neck=(rig.matrix_world@rig.pose.bones['neck_01'].head).z
    cutoff=neck-.025
    root=empty(spec['id']+'_root');upper=empty(spec['id']+'_upper',.96 if standing else .69);head=empty(spec['id']+'_head',neck+.025)
    upper.parent=root;head.parent=root;parts=[]
    def attach(ob,group):
        bpy.context.view_layer.update();world=ob.matrix_world.copy();ob.parent=group;ob.matrix_world=world;parts.append(ob)
    for original in authoring:
        if original.type!='MESH':continue
        role=original.name.split('.')[0]
        evaluated=original.evaluated_get(deps)
        mesh=bpy.data.meshes.new_from_object(evaluated,preserve_all_data_layers=True,depsgraph=deps)
        mesh.transform(evaluated.matrix_world)
        ob=bpy.data.objects.new(original.name,mesh);bpy.context.scene.collection.objects.link(ob)
        for p in mesh.polygons:p.use_smooth=True
        if role=='Snow anatomy':
            for is_head,group in [(True,head),(False,upper)]:
                cp=ob.copy();cp.data=mesh.copy();bpy.context.scene.collection.objects.link(cp)
                bm=bmesh.new();bm.from_mesh(cp.data)
                bmesh.ops.delete(bm,geom=[f for f in bm.faces if (f.calc_center_median().z>cutoff)!=is_head],context='FACES')
                bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
                bm.to_mesh(cp.data);bm.free()
                cp.name='Continuous face MakeHuman' if is_head else 'MakeHuman hands'
                attach(cp,group)
                if is_head:
                    bpy.context.view_layer.objects.active=cp
                    dec=cp.modifiers.new('Mobile face','DECIMATE');dec.ratio=.82
                    bpy.ops.object.modifier_apply(modifier=dec.name)
            bpy.data.objects.remove(ob,do_unlink=True)
        else:
            group=head if role.startswith(('Whitehead beard','Whitehead moustache')) or role in ['Snow eyes','Snow swept hair','Snow eyebrows','Snow sideburns','Snow hair bun','Street cap','Street cap peak'] else (root if role in ['Snow leather shoes','Snow gathered skirt','Street apron'] else upper)
            attach(ob,group)
            ratio=.44 if role=='Snow tailored coat and trousers' else (.35 if role=='Snow leather shoes' else (.5 if role in ['Snow high waistcoat','Snow gathered skirt'] else 1))
            if ratio<1:
                bpy.context.view_layer.objects.active=ob
                dec=ob.modifiers.new('Mobile geometry','DECIMATE');dec.ratio=ratio
                bpy.ops.object.modifier_apply(modifier=dec.name)
    for ob in authoring:bpy.data.objects.remove(ob,do_unlink=True)

    # Keep MakeHuman's base UVs; use an independent continuous head lighting chart.
    for ob in parts:
        if not ob.data.uv_layers:ob.data.uv_layers.new(name='UVMap')
        if ob.name.startswith('Snow tailored coat and trousers'):
            ob['lightmap_rect']=[.025+index*.94/count,.025,.94/count,.235]
            ob['garment_chart']=True
        if ob.name.startswith('Snow gathered skirt'):
            ob['lightmap_rect']=[.025,.145,.94,.115]
            ob['garment_chart']=True
        if ob.name.startswith(('Continuous face','MakeHuman hands')):
            # Keep the authored non-overlapping face/ear/mouth islands. A cylindrical
            # projection overlaps the mouth cavity and paints black patches on lips.
            uv0=ob.data.uv_layers[0]
            us=[item.uv.x for item in uv0.data];vs=[item.uv.y for item in uv0.data]
            ulo,uhi=min(us),max(us);vlo,vhi=min(vs),max(vs)
            faceuv=ob.data.uv_layers.new(name='FaceLighting')
            for i,item in enumerate(uv0.data):
                faceuv.data[i].uv=((item.uv.x-ulo)/(uhi-ulo),(item.uv.y-vlo)/(vhi-vlo))
            if ob.name.startswith('MakeHuman hands'):ob['lightmap_rect']=[.025+index*.94/count,.35,.94/count,.20]
        colors=ob.data.color_attributes.new(name='Albedo',type='FLOAT_COLOR',domain='POINT')
        for item in colors.data:item.color=(1,1,1,1)
        ob.data.color_attributes.active_color=colors

    # Upper and lower garments share a continuous source, with a seam only for
    # the existing idle pivots. No invented pelvis or separate cone legs.
    for ob in list(parts):
        if not ob.name.startswith('Snow tailored coat and trousers'):continue
        for lower,group in [(True,root),(False,upper)]:
            cp=ob.copy();cp.data=ob.data.copy();bpy.context.scene.collection.objects.link(cp)
            bm=bmesh.new();bm.from_mesh(cp.data)
            split=.93 if standing else .62
            bmesh.ops.delete(bm,geom=[f for f in bm.faces if ((ob.matrix_world@f.calc_center_median()).z<split)!=lower],context='FACES')
            bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
            bm.to_mesh(cp.data);bm.free()
            if lower:
                for poly in cp.data.polygons:poly.material_index=0
            if len(cp.data.polygons):attach(cp,group)
            else:bpy.data.objects.remove(cp,do_unlink=True)
        parts.remove(ob);bpy.data.objects.remove(ob,do_unlink=True)
    x,y,z=spec['position'];root.location=(x,-z,y);root.rotation_euler.z=spec.get('yaw',0)
    bpy.context.view_layer.update()
    actors.append((spec,root,upper,head,parts));all_parts.extend(parts)

M={m.name:m for ob in all_parts for m in ob.data.materials}
probe=config['actors'][0]['position'];probe=(probe[0],1.45,probe[2]+.4)
report=bake_lighting(M,ROOT,asset=asset,size=2048 if key=='street' else 1024,environment_width=256,character_charts=True,
                    lights=[],occluders={o for o in room if o.type=='MESH'},probe=probe,island_margin=.01)
# Eyes and dense facial hair sit against skin. Reuse neighboring cheek illumination
# rather than baking small eye islands into their own occluded socket shadows.
from mathutils.bvhtree import BVHTree
for spec,root,upper,head,parts in actors:
    face=next(ob for ob in parts if ob.name.startswith('Continuous face'))
    coords=[face.matrix_world@v.co for v in face.data.vertices]
    tree=BVHTree.FromPolygons(coords,[tuple(p.vertices) for p in face.data.polygons])
    for ob in parts:
        if not ob.name.startswith(('Snow eyes','Whitehead beard','Whitehead moustache')):continue
        uv=ob.data.uv_layers['Lightmap'];faceuv=face.data.uv_layers['Lightmap']
        for side in [-1,1]:
            vertices=[ob.matrix_world@v.co for v in ob.data.vertices if (v.co.x>=0)==(side>0)]
            if not vertices:continue
            center=sum(vertices,Vector())/len(vertices)
            # Aim below the eyelid toward the exposed upper cheek.
            query=(root.matrix_world@Vector((-.045,-.14,1.62))) if ob.name.startswith('Whitehead') else center+root.matrix_world.to_3x3()@Vector((0,-.008,-.022))
            hit,normal,pi,_=tree.find_nearest(query)
            poly=face.data.polygons[pi]
            sample=sum((faceuv.data[i].uv for i in poly.loop_indices),Vector((0,0)))/len(poly.loop_indices)
            for loop in ob.data.loops:
                if (ob.data.vertices[loop.vertex_index].co.x>=0)==(side>0):uv.data[loop.index].uv=sample
for ob in all_parts:
    chart=ob.data.uv_layers.get('FaceLighting')
    if chart:ob.data.uv_layers.remove(chart)
    ob.data.uv_layers.active_index=0;ob.data.uv_layers[0].active_render=True
for ob in list(all_parts):
    if len(ob.data.materials)<=1:continue
    bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.separate(type='MATERIAL');bpy.ops.object.mode_set(mode='OBJECT')
for spec,root,upper,head,_ in actors:
    for group in [root,upper,head]:
        for name,mat in M.items():
            obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==group and o.data.materials[0]==mat]
            if not obs:continue
            bpy.ops.object.select_all(action='DESELECT')
            for ob in obs:ob.select_set(True)
            bpy.context.view_layer.objects.active=obs[0]
            if len(obs)>1:bpy.ops.object.join()
            obs[0].name=group.name+'_'+name.split('.')[0]
objects=[o for o in bpy.context.scene.objects if o not in room and o.type in {'MESH','EMPTY'}]
triangles=sum(len(p.vertices)-2 for ob in objects if ob.type=='MESH' for p in ob.data.polygons)
assert triangles<count*30000,triangles
folder=ROOT/f'assets/{asset}';folder.mkdir(exist_ok=True)
bpy.context.preferences.filepaths.save_version=0;bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(folder/(asset+'.blend')))
bpy.ops.object.select_all(action='DESELECT')
for ob in objects:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/f'public/models/{asset}.glb'),export_format='GLB',use_selection=True,export_yup=True,export_cameras=False,export_lights=False,export_vertex_color='ACTIVE',export_all_vertex_colors=False)
summary={'scene':key,'actors':config['actors'],'anatomicalBase':'MakeHuman hm08 / MPFB','sources':sources,'runtimeSkeleton':False,'triangles':triangles,'materialBatches':sum(ob.type=='MESH' for ob in objects),'bakedLighting':report,'interpretive':True}
(folder/'build-report.json').write_text(json.dumps(summary,indent=2)+'\n');print('CHARACTERS',summary)
