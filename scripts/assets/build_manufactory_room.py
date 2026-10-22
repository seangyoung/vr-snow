"""Interpretive small workshop at 37 Broad Street; not a documented floor plan.
Blender -b --factory-startup --python scripts/assets/build_manufactory_room.py
Work surfaces and packed metal goods suggest the trade without demonstrating manufacture.
"""
import bpy, math, json, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).resolve().parent))
from bake_scene_lighting import bake_lighting
layout=json.loads((ROOT/'src/walkable/manufactory-layout.json').read_text())
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
M={}
def material(name,color):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');c=[int(color[i:i+2],16)/255 for i in (0,2,4)]
 p.inputs['Base Color'].default_value=(*[(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4) for v in c],1);p.inputs['Roughness'].default_value=.85;M[name]=m
for n,c in [('Oak','75644d'),('Dark timber','443a2d'),('Lime plaster','b1aea0'),('Iron','383c3b'),('Paper','bfb08b'),('Copper','a3764e'),('Water','526b6a'),('Daylight','d3dfde'),('Paint','4c5e59')]:material(n,c)
p=M['Daylight'].node_tree.nodes.get('Principled BSDF');p.inputs['Emission Color'].default_value=(.6,.7,.7,1);p.inputs['Emission Strength'].default_value=.55
M['Water'].node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.2
for name in ['Oak','Dark timber']:
 m=M[name];n=m.node_tree.nodes;t=n.new('ShaderNodeTexImage');t.image=bpy.data.images.load(str(ROOT/'assets/broad-street/textures/wood.jpg'),check_existing=True)
 mix=n.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=.65;mix.inputs[2].default_value=n.get('Principled BSDF').inputs['Base Color'].default_value
 m.node_tree.links.new(t.outputs['Color'],mix.inputs[1]);m.node_tree.links.new(mix.outputs[0],n.get('Principled BSDF').inputs['Base Color'])
def box(n,x,y,z,w,h,d,mat,bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y));o=bpy.context.object;o.name=n;o.dimensions=(w,d,h);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(M[mat])
 if bevel:
  mod=o.modifiers.new('Worn edges','BEVEL');mod.width=bevel;mod.segments=2;bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
def cyl(n,x,y,z,r,h,mat):
 bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=r,depth=h,location=(x,-z,y));o=bpy.context.object;o.name=n;o.data.materials.append(M[mat]);return o
def ring(n,x,y,z,r,thick,mat):
 bpy.ops.mesh.primitive_torus_add(major_segments=24,minor_segments=6,major_radius=r,minor_radius=thick,location=(x,-z,y));o=bpy.context.object;o.name=n;o.data.materials.append(M[mat]);return o
for i in range(24):
 for j in range(8):box('Floor board',-4+(i+.5)/3,-.035,-4+j+.5,.325,.06,.995,'Dark timber')
for x in [-4.05,4.05]:box('Wall',x,1.7,0,.1,3.4,8.2,'Lime plaster')
for z in [-4.05,4.05]:box('Wall',0,1.7,z,8.2,3.4,.1,'Lime plaster')
box('Ceiling',0,3.45,0,8.2,.1,8.2,'Lime plaster')
for z in [-3,-.4,2.2]:
 box('Ceiling beam',0,3.24,z,8,.28,.20,'Dark timber')
 box('Window recess',3.94,2.1,z,.04,2.05,1.65,'Iron');box('Window glass',3.90,2.1,z,.025,1.94,1.54,'Daylight')
 for zz in [z-.82,z,z+.82]:box('Sash upright',3.84,2.1,zz,.14,2.1,.05,'Paint')
 for y in [1.08,1.6,2.1,2.62,3.12]:box('Sash rail',3.84,y,z,.14,.045,1.7,'Paint')
 box('Window sill',3.77,1.04,z,.35,.08,1.8,'Oak',.01)
for z in [-3.97,3.97]:box('Skirting',0,.1,z,8,.2,.06,'Dark timber')
box('Closed entrance',0,1.25,3.94,1.3,2.5,.10,'Paint',.02)
for x in [-.72,.72]:box('Door frame',x,1.32,3.87,.12,2.64,.15,'Oak')
box('Door lintel',0,2.67,3.87,1.56,.12,.15,'Oak');box('Door handle',.46,1.1,3.78,.04,.16,.05,'Iron')
for f in layout['furniture']:
 x,z=f['x'],f['z']
 if f['id'].startswith('bench'):
  box('Work bench',x,.77,z,1.55,.10,1.35,'Oak',.018)
  for dx in [-.64,.64]:
   for dz in [-.55,.55]:box('Bench leg',x+dx,.36,z+dz,.10,.72,.10,'Dark timber',.008)
  box('Bench stretcher',x,.23,z,1.4,.08,.08,'Dark timber')
  # Empty places, small covered stock boxes and flat copper pieces, no operative machinery.
  cyl('Low stool',x,.43,z+.52,.24,.08,'Dark timber')
  for dx in [-.13,.13]:box('Stool leg',x+dx,.21,z+.52,.055,.42,.055,'Dark timber')
  box('Stock box',x-.35,.91,z-.35,.38,.18,.29,'Oak',.008)
  box('Work parcel',x+.34,.87,z+.25,.28,.10,.23,'Paper',.01)
  box('Sorting tray',x+.18,.837,z-.20,.46,.028,.35,'Dark timber',.006)
  for j in range(6):cyl('Copper piece',x+.02+(j%3)*.11,.859,z-.28+(j//3)*.13,.03,.012,'Copper')
 elif f['id'].startswith('tub'):
  cyl('Tub base',x,.07,z,.36,.08,'Dark timber')
  for j in range(24):
   angle=j*math.tau/24;o=box('Tub stave',x+.36*math.sin(angle),.46,z+.36*math.cos(angle),.09,.8,.045,'Oak',.003);o.rotation_euler.z=angle
  for y in [.15,.73]:ring('Tub hoop',x,y,z,.377,.016,'Iron')
  cyl('Water in tub',x,.76,z,.337,.012,'Water')
  ring('Tub rim',x,.87,z,.36,.025,'Dark timber')
 else:
  box('Shelf back',x,.95,z,.06,1.9,1.2,'Dark timber')
  for y in [.15,.7,1.25,1.85]:box('Stock shelf',x+.2,y,z,.48,.05,1.2,'Oak')
  for zz in [z-.56,z+.56]:box('Shelf upright',x+.15,.95,zz,.5,1.9,.06,'Dark timber')
  for zz in [z-.3,z+.3]:box('Paper-wrapped stock',x+.2,.87,zz,.32,.28,.39,'Paper',.005)
# One small drinking cup on a stool between the tubs, distinct from the fixed water vessels.
cyl('Cup stool',0,.6,-3.1,.24,.07,'Dark timber')
for dx in [-.14,.14]:box('Cup stool leg',dx,.3,-3.1,.06,.6,.06,'Dark timber')
cyl('Drinking cup',0,.70,-3.1,.065,.13,'Paint');ring('Cup rim',0,.768,-3.1,.065,.007,'Iron')
lighting=bake_lighting(M,ROOT,asset='manufactory-room',size=1024,lights=[('Window '+str(z),(3.65,2.3,z),(0,1,z),190,1.6,(.91,.96,1)) for z in [-3,-.4,2.2]]+[('Ceiling bounce',(0,3.1,0),(0,0,0),80,5,(1,.94,.85))])
asset=ROOT/'assets/manufactory-room';asset.mkdir(exist_ok=True);bpy.context.preferences.filepaths.save_version=0
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(asset/'manufactory-room.blend'))
for mat in M.values():
 obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials and o.data.materials[0]==mat]
 if not obs:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in obs:o.select_set(True)
 bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join()
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/manufactory-room.glb'),export_format='GLB',export_yup=True,export_cameras=False,export_lights=False)
(asset/'build-report.json').write_text(json.dumps(dict(triangles=sum(len(p.vertices)-2 for o in bpy.context.scene.objects if o.type=='MESH' for p in o.data.polygons),bakedLighting=lighting,interpretive=True,layout=layout),indent=2)+'\n')
