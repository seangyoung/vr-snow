"""One-time, idempotent household variety pass; preserve the approved anatomical poses."""
import bpy,json,numpy as np
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def expose_hair_colour():
 # Older sources have a constant-colour Mix node overriding the strand image.
 for name in ['Hair','BunHair','Brows']:
  material=bpy.data.materials.get(name)
  if not material:continue
  bs=material.node_tree.nodes.get('Principled BSDF')
  tex=next((n for n in material.node_tree.nodes if n.type=='TEX_IMAGE'),None)
  if not tex:continue
  for link in list(bs.inputs['Base Color'].links):material.node_tree.links.remove(link)
  material.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
profiles={'water-householder':{'scale':(1.065,1.02,.965),'hair':(1.22,.83,.65),'coat':(.075,.105,.095),'vest':(.26,.19,.105),'jaw':1.06},'away-householder':{'scale':(.955,1,1),'hair':(1.65,1.65,1.60),'coat':(.065,.075,.115),'vest':(.19,.13,.11),'jaw':.94},'survivor':{'scale':(1,1,1),'hair':(.90,.88,.87),'coat':(.085,.055,.07),'jaw':1.0}}
for actor,profile in profiles.items():
 path=ROOT/f'assets/scene-people/{actor}.blend';bpy.ops.wm.open_mainfile(filepath=str(path));rig=bpy.data.objects['Snow authoring rig']
 if rig.get('household_variety_revision'):
  expose_hair_colour();bpy.context.preferences.filepaths.save_version=0;bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(path));print('Preserved anatomy; refreshed hair material',actor);continue
 rig.scale=profile['scale']
 for name,color in [('Coat',profile['coat']),('Waistcoat',profile.get('vest'))]:
  if color and name in bpy.data.materials:bpy.data.materials[name].node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(*color,1)
 # Tint packed hair images, retaining their cutout alpha and every fitted strand.
 seen=set()
 for name in ['Hair','BunHair','Brows']:
  mat=bpy.data.materials.get(name)
  if not mat:continue
  for node in mat.node_tree.nodes:
   if node.type!='TEX_IMAGE' or not node.image or node.image in seen:continue
   image=node.image;seen.add(image);data=np.array(image.pixels[:],dtype=np.float32).reshape(-1,4)
   data[:,:3]=np.clip(data[:,:3]*profile['hair'],0,1)
   if actor=='away-householder':data[:,:3]=np.clip(data[:,:3]*.65+(.10 if name=='Hair' else .045),0,1)
   elif actor=='water-householder':data[:,:3]=np.clip(data[:,:3]*[1.15,.9,.7]+[.025,.008,.002],0,1)
   image.pixels.foreach_set(data.reshape(-1));image.pack()
 # Small lower-face changes stay below the nose/eyes and do not disturb eye fitting.
 body=bpy.data.objects['Snow anatomy'];keys=body.data.shape_keys
 coords=[k.data for k in keys.key_blocks] if keys else [body.data.vertices]
 for points in coords:
  for v in points:
   if 1.43<v.co.z<1.56 and abs(v.co.x)<.11:
    weight=max(0,1-abs(v.co.z-1.49)/.07);v.co.x*=1+(profile['jaw']-1)*weight
 expose_hair_colour()
 rig['household_variety_revision']=1;rig['household_variety_profile']=json.dumps(profile)
 bpy.context.preferences.filepaths.save_version=0;bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(path))
