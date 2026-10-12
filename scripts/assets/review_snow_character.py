"""Offline pose/atlas review; this is not a browser rendering or listening test."""
import bpy,math,sys
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[2]
output=Path(sys.argv[sys.argv.index('--')+1]) if '--' in sys.argv else root/'tmp/snow-character-review'
output.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(root/'assets/snow-character/snow-character.blend'))
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=32;s.cycles.use_denoising=True
s.render.resolution_x=1100;s.render.resolution_y=850;s.render.resolution_percentage=100;s.view_settings.view_transform='AgX'
# Display character illumination using its atlas, while leaving the reference office lit normally.
im=bpy.data.images.load(str(root/'public/models/snow-character-lightmap.png'));im.colorspace_settings.name='sRGB'
for ob in bpy.context.scene.objects:
 if ob.type!='MESH' or not ob.name.startswith('Snow_'):continue
 for mat in ob.data.materials:
  ns=mat.node_tree.nodes;ls=mat.node_tree.links;bs=ns.get('Principled BSDF')
  uv=ns.new('ShaderNodeUVMap');uv.uv_map='Lightmap';tex=ns.new('ShaderNodeTexImage');tex.image=im;ls.new(uv.outputs['UV'],tex.inputs['Vector'])
  mul=ns.new('ShaderNodeMixRGB');mul.blend_type='MULTIPLY';mul.inputs[0].default_value=1;mul.inputs[2].default_value=bs.inputs['Base Color'].default_value

  if bs.inputs['Base Color'].is_linked:ls.new(bs.inputs['Base Color'].links[0].from_socket,mul.inputs[2])
  ls.new(tex.outputs['Color'],mul.inputs[1]);em=ns.new('ShaderNodeEmission');em.inputs['Strength'].default_value=4;ls.new(mul.outputs[0],em.inputs['Color'])
  if bs.inputs['Alpha'].is_linked:
   transparent=ns.new('ShaderNodeBsdfTransparent');mix=ns.new('ShaderNodeMixShader')
   ls.new(bs.inputs['Alpha'].links[0].from_socket,mix.inputs[0]);ls.new(transparent.outputs[0],mix.inputs[1]);ls.new(em.outputs[0],mix.inputs[2]);ls.new(mix.outputs[0],ns.get('Material Output').inputs['Surface'])
  else:ls.new(em.outputs[0],ns.get('Material Output').inputs['Surface'])
camdata=bpy.data.cameras.new('Review');cam=bpy.data.objects.new('Review',camdata);s.collection.objects.link(cam);s.camera=cam
for name,pos,target,lens in ([] if '--anatomy-only' in sys.argv else [('room',(1.65,1.62,1.65),(-.65,1.1,-2),32),('face',(-.05,1.48,-.55),(-.65,1.40,-2.28),65),('torso',(-.05,1.25,-.50),(-.65,.99,-2.20),55),('hands',(-.55,1.42,-1.22),(-.65,.835,-1.66),55)]):
 cam.location=(pos[0],-pos[2],pos[1]);cam.rotation_euler=(Vector((target[0],-target[2],target[1]))-cam.location).to_track_quat('-Z','Y').to_euler();camdata.lens=lens
 s.render.filepath=str(output/f'snow-character-{name}.png');bpy.ops.render.render(write_still=True)
for ob in s.objects:
 if ob.type=='MESH':ob.hide_render=not ob.name.startswith('Snow_')
camdata.type='ORTHO';camdata.ortho_scale=1.8
s.render.resolution_x=720;s.render.resolution_y=1000
for name,pos in [('front',(-.5,.8,1)),('side',(2.3,.8,-1.4)),('face',(-.61,1.39,-1.28))]:
 cam.location=(pos[0],-pos[2],pos[1]);target=Vector((-.65,2.12,.8))
 if name=='face':
  target=Vector((-.65,2.28,1.275));camdata.ortho_scale=.36;s.render.resolution_y=720
 cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
 s.render.filepath=str(output/f'snow-character-{name}.png');bpy.ops.render.render(write_still=True)
