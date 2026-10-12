"""Build original interpretive witnesses and street residents in their room lighting.
Usage: blender --background --factory-startup --python ... -- registrar
"""
import bpy,math,json,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).resolve().parent))
from character_geometry import create_geometry,paint_albedo,stabilize_head_lighting,facial_details
from bake_scene_lighting import bake_lighting
key=sys.argv[sys.argv.index('--')+1]
config=json.loads((ROOT/'src/walkable/scene-characters.json').read_text())[key]
asset=config['asset'];room_name=config['room']
bpy.ops.wm.open_mainfile(filepath=str(ROOT/f'assets/{room_name}/{room_name}.blend'))
room=set(bpy.context.scene.objects);all_parts={};all_materials={};actors=[];neutral=set()

def color(mat,hex):
 rgb=[int(hex[i:i+2],16)/255 for i in (0,2,4)]
 mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(*[((v+.055)/1.055)**2.4 if v>.04045 else v/12.92 for v in rgb],1)

def warp(ob,fn):
 bpy.context.view_layer.update();matrix=ob.matrix_world.copy();inverse=matrix.inverted()
 for v in ob.data.vertices:
  p=matrix@v.co;x,y,z=fn(p.x,p.z,-p.y);v.co=inverse@Vector((x,-z,y))
 ob.data.update()

for spec in config['actors']:
 g=create_geometry(spec.get("appearance"),spec["pose"]);M,parts,root,upper,head=[g[n] for n in ('M','parts','root','upper','head')]
 def remove(prefixes):
  for ob in list(parts):
   if ob.name.startswith(prefixes):parts.pop(ob);bpy.data.objects.remove(ob,do_unlink=True)
 color(M['Coat'],spec['coat']);color(M['Waistcoat'],spec['vest']);color(M['Hair'],spec['hair'])
 # Individual face proportions and hair tones distinguish these interpretive adults.
 for ob in parts:
  if ob.parent==head:warp(ob,lambda x,y,z:(x*spec['faceWidth'],(1.62 if spec['pose']=='standing' else 1.37)+(y-(1.62 if spec['pose']=='standing' else 1.37))*spec['faceHeight'],z))
 if spec.get('dress'):
  remove(('Coat lapel','Waistcoat','Cravat','Shirt collar','Standing shirt collar','Sideburn','Trouser','Coat seated skirt'))
  g['ellipsoid']('Hair bun',(0,1.399,-.089),(.035,.036,.025),'Hair',head)
  # A modest gathered skirt, not an invented hoop costume or a documented uniform.
  skirt=g['rings']('Gathered skirt',[(.07,.24,.42,.14),(.20,.25,.43,.14),(.43,.24,.43,.15),(.57,.18,.27,.14),(.73,.15,.125,.13)],'Coat',root)
  for v in skirt.data.vertices:
   angle=math.atan2(v.co.x,-v.co.y);v.co.x*=1+.018*math.sin(angle*18);v.co.y*=1+.018*math.sin(angle*18)
  # Small neckcloth follows the shoulders, with dress fastenings and a waist seam.
  g['patch']('Plain neck kerchief',[(-.098,1.187,.09),(0,1.219,.070),(.098,1.187,.09),(.045,1.151,.112),(0,1.139,.123),(-.045,1.151,.112)],'Shirt',upper)
  for yy in [.79,.85,.91,.97,1.03,1.09]:g['ellipsoid']('Dress fastening',(0,yy,.129),(.004,.004,.003),'Button',segments=8,rings=4)
  g['limb']('Dress waist seam',(-.12,.733,.108),(.12,.733,.108),.003,.003,'Coat')
 # Retain facial contour detail, reducing otherwise invisible small cross-sections.
 for ob in parts:
  if len(ob.data.polygons)>80:
   bpy.context.view_layer.objects.active=ob
   dec=ob.modifiers.new('Witness geometry budget','DECIMATE');dec.ratio=.85 if ob.name.startswith(('Continuous face','Swept hair')) else .63
   bpy.ops.object.modifier_apply(modifier=dec.name)
 paint_albedo(M,parts)
 for ob in parts:
  if not ob.data.uv_layers:ob.data.uv_layers.new(name='UVMap')
  if ob.name.startswith(('Coat lapel','Plain neck kerchief','Brow','Eye white','Iris','Upper lid','Lower lid','Upper lip','Lower lip','Nostril','Waistcoat button')):neutral.add(ob)
 root.name=spec['id']+'_root';upper.name=spec['id']+'_upper';head.name=spec['id']+'_head'
 x,y,z=spec['position'];root.location=(x,-z,y);root.rotation_euler.z=spec.get('yaw',0)
 bpy.context.view_layer.update()
 actors.append((spec,root,upper,head,M,parts));all_parts.update(parts)
 all_materials.update({spec['id']+'_'+n:m for n,m in M.items()})
if '--draft' in sys.argv:
 from review_character_anatomy import review_anatomy
 review_anatomy(actors,key)
 sys.exit(0)
probe=config['actors'][0]['position'];probe=(probe[0],1.45,probe[2]+.4)
# Do not let overlay eyes/lips cast shadows into the face atlas they will sample.
details=facial_details(all_parts)
for detail in details:detail.hide_render=True
report=bake_lighting(all_materials,ROOT,asset=asset,size=1024,environment_width=256,character_charts=True,
 lights=[],exterior=neutral,neutral_value=.16 if key in ('workhouse','street') else .85,occluders={o for o in room if o.type=='MESH'},probe=probe,island_margin=.01)
for detail in details:detail.hide_render=False
for spec,root,upper,head,M,parts in actors:
 for group in (root,upper,head):
  for name,material in M.items():
   obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==group and o.data.materials[0]==material]
   if not obs:continue
   bpy.ops.object.select_all(action='DESELECT')
   for ob in obs:ob.select_set(True)
   bpy.context.view_layer.objects.active=obs[0]
   if len(obs)>1:bpy.ops.object.join()
   obs[0].name=group.name+'_'+name
for _,_,_,head,_,_ in actors:stabilize_head_lighting(head)
objects=[o for o in bpy.context.scene.objects if o not in room and o.type in {'MESH','EMPTY'}]
folder=ROOT/f'assets/{asset}';folder.mkdir(exist_ok=True)
bpy.context.preferences.filepaths.save_version=0;bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(folder/(asset+'.blend')))
bpy.ops.object.select_all(action='DESELECT')
for ob in objects:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/f'public/models/{asset}.glb'),export_format='GLB',use_selection=True,export_yup=True,export_cameras=False,export_lights=False)
summary={'scene':key,'actors':config['actors'],'triangles':sum(len(p.vertices)-2 for ob in objects if ob.type=='MESH' for p in ob.data.polygons),'materialBatches':sum(ob.type=='MESH' for ob in objects),'bakedLighting':report,'interpretive':True}
(folder/'build-report.json').write_text(json.dumps(summary,indent=2)+'\n');print('CHARACTERS',summary)
