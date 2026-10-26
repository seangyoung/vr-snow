"""Adapt the user-supplied Hand pump.blend; scripts in the source are disabled.
blender --background --factory-startup --disable-autoexec --python scripts/assets/prepare_workhouse_pump.py -- SOURCE.blend
"""
import bpy,bmesh,json,sys,hashlib,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
source=Path(sys.argv[sys.argv.index('--')+1]);out=ROOT/'assets/workhouse-hand-pump';out.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False,use_scripts=False)
scale=.15
origin=Vector((-.1287586093,0,-4.579515934))
def position(p):return (Vector(p)-origin)*scale+Vector((0,0,.43))
pivot=position((1.5463171,0,3.5019412))
moving={'Handel','Bolt','Handel bolt','Nut'}
source_objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent and o.parent.name=='Over all hand pump control' and not o.hide_render and o.name!='Pipe']
mat=bpy.data.materials.new('Workhouse cast iron');mat.use_nodes=True
bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.045,.061,.049,1);bs.inputs['Metallic'].default_value=.3;bs.inputs['Roughness'].default_value=.72
mat.use_backface_culling=True
parts={False:[],True:[]};dg=bpy.context.evaluated_depsgraph_get()
for src in source_objects:
 mesh=bpy.data.meshes.new_from_object(src.evaluated_get(dg),depsgraph=dg)
 for v in mesh.vertices:v.co=position(src.matrix_world@v.co)
 mesh.materials.clear();mesh.materials.append(mat)
 for p in mesh.polygons:p.material_index=0;p.use_smooth=True
 ob=bpy.data.objects.new('Prepared '+src.name,mesh);bpy.context.collection.objects.link(ob)
 bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
 mod=ob.modifiers.new('Mobile simplification','DECIMATE');mod.ratio=.16 if src.name=='Handel' else .08
 bpy.ops.object.modifier_apply(modifier=mod.name)
 bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
 for edge in bm.edges:edge.smooth=edge.is_manifold and edge.calc_face_angle(0)<math.radians(40)
 bm.to_mesh(ob.data);bm.free()
 normals=ob.modifiers.new('Weighted casting normals','WEIGHTED_NORMAL');normals.keep_sharp=True
 bpy.ops.object.modifier_apply(modifier=normals.name)
 parts[src.name in moving].append(ob)
kept=[]
for is_moving,objects in parts.items():
 bpy.ops.object.select_all(action='DESELECT')
 for ob in objects:ob.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();ob=objects[0]
 ob.name='Workhouse pump handle' if is_moving else 'Workhouse pump body'
 if is_moving:
  for v in ob.data.vertices:v.co-=pivot
  ob.location=pivot
 kept.append(ob)
for ob in list(bpy.data.objects):
 if ob not in kept:bpy.data.objects.remove(ob,do_unlink=True)
for _ in range(3):bpy.data.orphans_purge(do_recursive=True)
bpy.context.scene.world=None;bpy.context.preferences.filepaths.save_version=0
bpy.context.scene.unit_settings.system='METRIC'
bpy.ops.wm.save_as_mainfile(filepath=str(out/'workhouse-hand-pump.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/workhouse-hand-pump.glb'),export_format='GLB',export_yup=True,export_cameras=False,export_lights=False)
triangles=0
for ob in kept:ob.data.calc_loop_triangles();triangles+=len(ob.data.loop_triangles)
report={'sourceFile':'Hand pump.blend','sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sourceUrl':'https://blendswap.com/blend/23714','author':'Mdfaizan','license':'CC BY','licenseVersion':None,'status':'Source listing verified on 2026-10-26: Hand pump by Mdfaizan, CC-BY. The listing does not specify a license version.','triangles':triangles,'meshBatches':2,'scale':scale,'pivot':[pivot.x,pivot.z,-pivot.y],'changes':'Simplified evaluated meshes; repaired normals; replaced source procedural materials with plain cast iron; separated lever and its joint fasteners. Piston rod is rebuilt and animated at runtime.'}
(out/'source.json').write_text(json.dumps(report,indent=2)+'\n');print('WORKHOUSE PUMP',report)
