"""Build original interpretive witnesses and street residents in their room lighting.
Usage: blender --background --factory-startup --python ... -- registrar
"""
import bpy,math,json,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).resolve().parent))
from character_geometry import create_geometry,paint_albedo
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
 g=create_geometry();M,parts,root,upper,head=[g[n] for n in ('M','parts','root','upper','head')]
 def remove(prefixes):
  for ob in list(parts):
   if ob.name.startswith(prefixes):parts.pop(ob);bpy.data.objects.remove(ob,do_unlink=True)
 color(M['Coat'],spec['coat']);color(M['Waistcoat'],spec['vest']);color(M['Hair'],spec['hair'])
 # Individual face proportions and hair tones distinguish these interpretive adults.
 for ob in parts:
  if ob.parent==head:warp(ob,lambda x,y,z:(x*spec['faceWidth'],1.37+(y-1.37)*spec['faceHeight'],z))
 if spec.get('dress'):
  remove(('Coat lapel','Waistcoat','Cravat','Shirt collar','Standing shirt collar','Sideburn','Trouser','Coat seated skirt'))
  g['ellipsoid']('Hair bun',(0,1.399,-.089),(.035,.036,.025),'Hair',head)
  # A modest gathered skirt, not an invented hoop costume or a documented uniform.
  skirt=g['rings']('Gathered skirt',[(.07,.24,.42,.14),(.20,.25,.43,.14),(.43,.24,.43,.15),(.57,.18,.27,.14),(.73,.15,.125,.13)],'Coat',root)
  for v in skirt.data.vertices:
   angle=math.atan2(v.co.x,-v.co.y);v.co.x*=1+.018*math.sin(angle*18);v.co.y*=1+.018*math.sin(angle*18)
  g['patch']('Plain neck kerchief',[(-.125,1.18,.10),(0,1.22,.07),(.125,1.18,.10),(0,1.12,.14)],'Shirt',upper)
 if spec['pose']=='standing':
  # Replace bent seated legs with full-length standing trousers.
  for ob in list(parts):
   if ob.parent==root:parts.pop(ob);bpy.data.objects.remove(ob,do_unlink=True)
  for ob in parts:warp(ob,lambda x,y,z:(x,y+.25,z))
  for side in (-1,1):
   x=side*.10
   g['limb']('Standing thigh',(x,.83,0),(x,.47,.015),.105,.075,'Coat',root)
   g['limb']('Standing shin',(x,.47,.015),(x,.12,.025),.075,.055,'Coat',root)
   g['ellipsoid']('Standing boot',(x,.065,.08),(.07,.06,.14),'Boot',root)
  if key=='street':
   # Residents hold their hands low in front instead of an unsupported desk pose.
   for ob in parts:
    if ob.parent==upper and ob.name.startswith(('Frock coat torso','Hand','Tailored shirt cuff')):
     warp(ob,lambda x,y,z:(x,y-.31*min(1,max(0,(z-.13)/.36)),z-.29*min(1,max(0,(z-.13)/.36))))
 elif spec['pose']=='lap':
  for ob in parts:
   if ob.parent==upper and ob.name.startswith(('Frock coat torso','Hand','Tailored shirt cuff')):
    warp(ob,lambda x,y,z:(x,y-.205*min(1,max(0,(z-.13)/.36)),z-.27*min(1,max(0,(z-.13)/.36))))
 elif spec['pose']=='table':
  for ob in parts:
   if ob.parent==upper and ob.name.startswith(('Frock coat torso','Hand','Tailored shirt cuff')):warp(ob,lambda x,y,z:(x,y-.10*min(1,max(0,(z-.13)/.36)),z))
 # Rebuild the bent sleeve surface after the lap pose so folded triangles do
 # not overlap and create black/bright speckling in the baked lighting.
 if spec['pose']=='lap':
  for ob in parts:
   if ob.name.startswith('Frock coat torso'):
    bpy.context.view_layer.objects.active=ob
    remesh=ob.modifiers.new('Relax posed cloth','REMESH');remesh.mode='VOXEL';remesh.voxel_size=.009
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth=ob.modifiers.new('Soften posed cloth','SMOOTH');smooth.factor=.6;smooth.iterations=3
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    dec=ob.modifiers.new('Posed cloth budget','DECIMATE');dec.ratio=.20
    bpy.ops.object.modifier_apply(modifier=dec.name)
    for poly in ob.data.polygons:poly.use_smooth=True
 # Retain facial contour detail, reducing otherwise invisible small cross-sections.
 for ob in parts:
  if len(ob.data.polygons)>80:
   bpy.context.view_layer.objects.active=ob
   dec=ob.modifiers.new('Witness geometry budget','DECIMATE');dec.ratio=.63
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
probe=config['actors'][0]['position'];probe=(probe[0],1.45,probe[2]+.4)
report=bake_lighting(all_materials,ROOT,asset=asset,size=1024,environment_width=256,
 lights=[],exterior=neutral,neutral_value=.16 if key in ('workhouse','street') else .85,occluders={o for o in room if o.type=='MESH'},probe=probe,island_margin=.01)
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
objects=[o for o in bpy.context.scene.objects if o not in room and o.type in {'MESH','EMPTY'}]
folder=ROOT/f'assets/{asset}';folder.mkdir(exist_ok=True)
bpy.context.preferences.filepaths.save_version=0;bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(folder/(asset+'.blend')))
bpy.ops.object.select_all(action='DESELECT')
for ob in objects:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/f'public/models/{asset}.glb'),export_format='GLB',use_selection=True,export_yup=True,export_cameras=False,export_lights=False)
summary={'scene':key,'actors':config['actors'],'triangles':sum(len(p.vertices)-2 for ob in objects if ob.type=='MESH' for p in ob.data.polygons),'materialBatches':sum(ob.type=='MESH' for ob in objects),'bakedLighting':report,'interpretive':True}
(folder/'build-report.json').write_text(json.dumps(summary,indent=2)+'\n');print('CHARACTERS',summary)
