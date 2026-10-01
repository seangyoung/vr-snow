"""Diffuse-only atlas review, not a browser screenshot or reflection preview.
Run in Blender: --python scripts/assets/review_baked_lighting.py -- <asset> <output-directory>
"""
import bpy,math,sys,json
from mathutils import Vector
from pathlib import Path
root=Path(__file__).resolve().parents[2]
args=sys.argv[sys.argv.index('--')+1:]
asset=args[0];output=Path(args[1]);output.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(root/f'assets/{asset}/{asset}.blend'))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=8
scene.render.resolution_x=1280;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
lightmap=bpy.data.images.load(str(root/f'public/models/{asset}-lightmap.png'),check_existing=False)
lightmap.colorspace_settings.name='sRGB'
for mat in bpy.data.materials:
 if not mat.use_nodes or mat.name=='Daylight':continue
 nodes=mat.node_tree.nodes;links=mat.node_tree.links;bs=nodes.get('Principled BSDF')
 if not bs:continue
 color=bs.inputs['Base Color'].default_value[:]
 color_source=bs.inputs['Base Color'].links[0].from_socket if bs.inputs['Base Color'].links else None
 uv=nodes.new('ShaderNodeUVMap');uv.uv_map='Lightmap'
 tex=nodes.new('ShaderNodeTexImage');tex.image=lightmap;links.new(uv.outputs['UV'],tex.inputs['Vector'])
 mul=nodes.new('ShaderNodeMixRGB');mul.blend_type='MULTIPLY';mul.inputs[0].default_value=1
 links.new(tex.outputs['Color'],mul.inputs[1])
 if color_source:links.new(color_source,mul.inputs[2])
 else:mul.inputs[2].default_value=color
 source=mul.outputs[0]
 if asset=='broad-street':
  vertex=nodes.new('ShaderNodeVertexColor');vertex.layer_name='Color'
  weather=nodes.new('ShaderNodeMixRGB');weather.blend_type='MULTIPLY';weather.inputs[0].default_value=1
  links.new(source,weather.inputs[1]);links.new(vertex.outputs['Color'],weather.inputs[2]);source=weather.outputs[0]
 emit=nodes.new('ShaderNodeEmission');emit.inputs['Strength'].default_value=4
 links.new(source,emit.inputs['Color']);links.new(emit.outputs[0],nodes.get('Material Output').inputs['Surface'])
camdata=bpy.data.cameras.new('Atlas check');cam=bpy.data.objects.new('Atlas check',camdata);scene.collection.objects.link(cam);scene.camera=cam
views={
 'snow-office':[((1.65,1.62,1.65),(-.35,1.25,-1.2),25)],
 'household-room':[((.95,1.62,1.6),(-.25,1.15,-1.2),22)],
 'registrar-room':[((1.2,1.62,5.2),(-.5,1.5,-2),22)],
 'brewery-room':[((1.5,1.62,4),(0,1.5,-2.5),22)],
 'workhouse-courtyard':[((1.8,1.62,5.9),(-.5,1.3,-3.5),22)],
 'broad-street':[((1.6,1.62,-2),(-4,2.6,3),22),((1.6,1.62,-2),(-3,2.5,-10),22)]}
for idx,(pos,target,lens) in enumerate(views[asset]):
 cam.location=(pos[0],-pos[2],pos[1]);cam.rotation_euler=(Vector((target[0],-target[2],target[1]))-cam.location).to_track_quat('-Z','Y').to_euler();camdata.lens=lens
 scene.render.filepath=str(output/f'{asset}-baked-{idx}.png');bpy.ops.render.render(write_still=True)
