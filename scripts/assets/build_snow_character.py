"""Original interpretive seated Snow figure. See docs/presence-and-sound.md.
Uses the office as a lighting/occlusion reference; exports only the character.
"""
import bpy,bmesh,math,json,sys
from mathutils.noise import noise_vector
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).resolve().parent))
from bake_scene_lighting import bake_lighting
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/snow-office/snow-office.blend'))
from character_geometry import create_geometry, paint_albedo
room=set(bpy.context.scene.objects)
globals().update(create_geometry())
paint_albedo(M,parts)
# Give every part a base UV set; the bake provides a second independent set.
for ob in parts:
 if not ob.data.uv_layers:ob.data.uv_layers.new(name='UVMap')
root.location=(-.65,2.28,0);bpy.context.view_layer.update()
# Thin folded lapels use the neutral irradiance patch: opposite faces closer
# than a bake texel otherwise self-occlude to black despite outward normals.
report=bake_lighting(M,ROOT,asset='snow-character',size=1024,environment_width=256,
                    lights=[],exterior={o for o in parts if o.name.startswith(('Coat lapel','Brow','Eye white','Iris','Upper lid','Lower lid','Upper lip','Lower lip','Nostril','Waistcoat button'))},neutral_value=.85,occluders={o for o in room if o.type=='MESH'},probe=(-.65,1.35,-2.1))
# Batch within each animated part; preserve head and torso pivots.
for group in [root,upper,head]:
 for name,material in M.items():
  obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==group and o.data.materials[0]==material]
  if not obs:continue
  bpy.ops.object.select_all(action='DESELECT')
  for ob in obs:ob.select_set(True)
  bpy.context.view_layer.objects.active=obs[0]
  if len(obs)>1:bpy.ops.object.join()
  obs[0].name=f'{group.name}_{name}'
character=[o for o in bpy.context.scene.objects if o not in room and o.type in {'MESH','EMPTY'}]
asset=ROOT/'assets/snow-character';asset.mkdir(exist_ok=True)
bpy.context.preferences.filepaths.save_version=0;bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(asset/'snow-character.blend'))
bpy.ops.object.select_all(action='DESELECT')
for ob in character:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/snow-character.glb'),export_format='GLB',use_selection=True,export_yup=True,export_cameras=False,export_lights=False)
triangles=sum(len(p.vertices)-2 for o in character if o.type=='MESH' for p in o.data.polygons)
summary={'version':3,'triangles':triangles,'materialBatches':sum(o.type=='MESH' for o in character),'bakedLighting':report,'interpretive':True,'reference':'https://epi-snow.ph.ucla.edu/Stream1_introduction_b.html'}
(asset/'build-report.json').write_text(json.dumps(summary,indent=2)+'\n');print('SNOW CHARACTER',summary)
