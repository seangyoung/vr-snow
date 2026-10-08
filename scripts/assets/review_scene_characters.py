"""Offline room and portrait views. These do not replace WebXR headset review."""
import bpy,sys,json,math
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[2];key=sys.argv[sys.argv.index('--')+1]
config=json.loads((root/'src/walkable/scene-characters.json').read_text())[key];asset=config['asset']
out=Path('/private/tmp')/asset;out.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(root/f'assets/{asset}/{asset}.blend'))
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=32;s.cycles.use_denoising=True
s.render.resolution_x=1100;s.render.resolution_y=850;s.render.resolution_percentage=100;s.view_settings.view_transform='AgX'
im=bpy.data.images.load(str(root/f'public/models/{asset}-lightmap.png'));im.colorspace_settings.name='sRGB'
seen=set()
for ob in s.objects:
 if ob.type!='MESH' or not any(ob.name.startswith(a['id']+'_') for a in config['actors']):continue
 for mat in ob.data.materials:
  if mat in seen:continue
  seen.add(mat);ns=mat.node_tree.nodes;ls=mat.node_tree.links;bs=ns.get('Principled BSDF')
  uv=ns.new('ShaderNodeUVMap');uv.uv_map='Lightmap';tex=ns.new('ShaderNodeTexImage');tex.image=im;ls.new(uv.outputs['UV'],tex.inputs['Vector'])
  mul=ns.new('ShaderNodeMixRGB');mul.blend_type='MULTIPLY';mul.inputs[0].default_value=1
  if bs.inputs['Base Color'].is_linked:ls.new(bs.inputs['Base Color'].links[0].from_socket,mul.inputs[2])
  else:mul.inputs[2].default_value=bs.inputs['Base Color'].default_value
  ls.new(tex.outputs['Color'],mul.inputs[1]);em=ns.new('ShaderNodeEmission');em.inputs['Strength'].default_value=4;ls.new(mul.outputs[0],em.inputs['Color']);ls.new(em.outputs[0],ns.get('Material Output').inputs['Surface'])
camdata=bpy.data.cameras.new('Review');cam=bpy.data.objects.new('Review',camdata);s.collection.objects.link(cam);s.camera=cam
actor=config['actors'][0];x,y,z=actor['position'];height=actor['height']
views=[('portrait',(x+.65,y+height-.05,z+1.9),(x,y+height*.62,z+.1),48)]
if key!='street':
 layout=json.loads((root/f'src/walkable/{key if key!="registrar" else "registrar"}-layout.json').read_text())
 sx,_,sz=layout['spawn'];views.insert(0,('room',(sx,1.62,sz),(x,y+1.1,z),32))
else:views.insert(0,('room',(-6,1.62,-1),(-10,1,-7),32))
if key=='brewery':views.append(('both',(0,1.62,3.7),(0,1.0,.1),42))
for name,pos,target,lens in views:
 cam.location=(pos[0],-pos[2],pos[1]);cam.rotation_euler=(Vector((target[0],-target[2],target[1]))-cam.location).to_track_quat('-Z','Y').to_euler();camdata.lens=lens
 s.render.filepath=str(out/f'{name}.png');bpy.ops.render.render(write_still=True)
