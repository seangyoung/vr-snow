"""Interpretive parish Board room, inspired by the app's panorama, not a survey.
Blender --background --factory-startup --python scripts/assets/build_board_room.py
"""
import bpy,math,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).resolve().parent))
from bake_scene_lighting import bake_lighting
layout=json.loads((ROOT/'src/walkable/board-layout.json').read_text())
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
M={}
def material(name,color):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
 c=[int(color[i:i+2],16)/255 for i in (0,2,4)];p.inputs['Base Color'].default_value=(*[((v+.055)/1.055)**2.4 if v>.04045 else v/12.92 for v in c],1);p.inputs['Roughness'].default_value=.8;M[name]=m
for n,c in [('Oak','745b40'),('Walnut','4c3828'),('Plaster','b9b09a'),('Trim','a18f6a'),('Linen','d6cba8'),('Green','394a40'),('Iron','242728'),('Daylight','d5e1df')]:material(n,c)
p=M['Daylight'].node_tree.nodes.get('Principled BSDF');p.inputs['Emission Color'].default_value=(.65,.75,.73,1);p.inputs['Emission Strength'].default_value=.5
# Existing wood image, shared provenance with other rooms.
for name in ['Oak','Walnut']:
 m=M[name];nodes=m.node_tree.nodes;t=nodes.new('ShaderNodeTexImage');t.image=bpy.data.images.load(str(ROOT/'assets/broad-street/textures/wood.jpg'),check_existing=True)
 mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=.65;mix.inputs[2].default_value=m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value
 m.node_tree.links.new(t.outputs['Color'],mix.inputs[1]);m.node_tree.links.new(mix.outputs[0],nodes.get('Principled BSDF').inputs['Base Color'])
def box(n,x,y,z,w,h,d,mat,bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y));o=bpy.context.object;o.name=n;o.dimensions=(w,d,h);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(M[mat])
 if bevel:
  mod=o.modifiers.new('Worn edges','BEVEL');mod.width=bevel;mod.segments=2;bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
for i in range(24):
 for j in range(7):box('Floor board',-4+(i+.5)/3,-.035,-6+(j+.5)*12/7,.329,.06,12/7-.008,'Oak')
box('Ceiling',0,3.95,0,8.2,.1,12.2,'Plaster')
for x in [-4.05,4.05]:box('Wall',x,1.95,0,.1,3.9,12,'Plaster')
for z in [-6.05,6.05]:box('Wall',0,1.95,z,8.2,3.9,.1,'Plaster')
for x in [-3.98,3.98]:
 box('Wainscot',x,.59,0,.06,1.18,12,'Walnut');box('Dado rail',x,1.2,0,.11,.09,12,'Trim');box('Cornice',x,3.75,0,.14,.14,12,'Trim')
 for z in range(-5,6):box('Panel stile',x,.58,z,.10,1.1,.045,'Oak')
for z in [-5.98,5.98]:
 box('Wainscot',0,.59,z,8,1.18,.06,'Walnut');box('Dado rail',0,1.2,z,8,.09,.11,'Trim');box('Cornice',0,3.75,z,8,.14,.14,'Trim')
for z in [-3.6,-.3,3]:
 box('Window recess',3.94,2.35,z,.05,2.5,1.7,'Iron');box('Window daylight',3.90,2.35,z,.02,2.4,1.6,'Daylight')
 for zz in [z-.85,z,z+.85]:box('Sash upright',3.84,2.35,zz,.13,2.55,.055,'Linen')
 for y in [1.1,1.73,2.36,2.99,3.62]:box('Sash rail',3.84,y,z,.13,.05,1.8,'Linen')
 box('Sill',3.77,1.06,z,.35,.09,1.9,'Trim')
box('Meeting table',0,.82,-.8,2.4,.10,6,'Walnut',.065)
for z in [-3,1.4]:
 box('Table pedestal',0,.4,z,.55,.8,.6,'Oak',.04);box('Pedestal foot',0,.08,z,1.65,.16,.8,'Walnut',.04)
for f in layout['furniture']:
 if 'chair' not in f['id']:continue
 x,z=f['x'],f['z'];yaw=0 if 'chair-board-chair'==f['id'] else math.pi/2 if x<0 else -math.pi/2
 def chairpart(n,dx,y,dz,w,h,d,mat):
  xx=x+dx*math.cos(yaw)+dz*math.sin(yaw);zz=z-dx*math.sin(yaw)+dz*math.cos(yaw)
  o=box(n,xx,y,zz,w,h,d,mat,.012);o.rotation_euler.z=yaw
 chairpart('Chair seat',0,.455,0,.58,.09,.58,'Green')
 chairpart('Chair back',0,.88,-.28,.60,.68,.075,'Walnut')
 chairpart('Upholstered back',0,.88,-.23,.44,.45,.045,'Green')
 for dx in [-.24,.24]:
  for dz in [-.24,.24]:chairpart('Chair leg',dx,.22,dz,.065,.44,.065,'Walnut')
box('Fireplace recess',-3.92,.68,-3.6,.05,1.35,1.4,'Iron')
for z in [-4.43,-2.77]:box('Mantel pier',-3.7,.77,z,.55,1.54,.18,'Trim',.02)
box('Mantel shelf',-3.67,1.58,-3.6,.62,.15,1.9,'Trim',.02)
box('Cold hearth',-3.65,.04,-3.6,.65,.08,1.8,'Iron')
box('Records cabinet',-3.7,.53,.1,.6,1.06,2.6,'Walnut',.02)
box('Closed entrance',0,1.3,5.93,1.3,2.6,.10,'Walnut',.02)
for x in [-.72,.72]:box('Door jamb',x,1.35,5.86,.12,2.7,.15,'Trim')
box('Door lintel',0,2.74,5.86,1.56,.14,.15,'Trim')
for y in [.65,1.95]:box('Door panel',0,y,5.86,1.02,1.06,.04,'Oak',.02)
box('Handle',.49,1.06,5.77,.04,.18,.05,'Trim')
# Schematic map sheet and registers: no invented historical numbers on the props.
box('Map sheet',0,.878,-.5,1.4,.01,1.9,'Linen')
for x in [-.48,-.15,.25,.5]:box('Map street',x,.885,-.5,.015,.003,1.6,'Oak')
for z in [-1.2,-.7,-.2,.2]:box('Map street',0,.886,z,1.2,.003,.012,'Oak')
for x,z in [(-.7,-2),(.7,-2.7),(0,-3.3)]:
 box('Register cover',x,.88,z,.43,.04,.55,'Green',.005);box('Register pages',x,.91,z,.40,.025,.52,'Linen')
 for i in range(3):box('Loose papers',x,.89+i*.009,z+.65,.33,.007,.43,'Linen')
lighting=bake_lighting(M,ROOT,asset='board-room',size=2048,lights=[('Window '+str(z),(3.7,2.5,z),(0,1,z),170,1.7,(.9,.95,1)) for z in [-3.6,-.3,3]]+[('Ceiling bounce',(0,3.65,0),(0,0,0),90,5,(1,.94,.85))])
asset=ROOT/'assets/board-room';bpy.context.preferences.filepaths.save_version=0;bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(asset/'board-room.blend'))
for mat in M.values():
 obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials and o.data.materials[0]==mat]
 if not obs:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in obs:o.select_set(True)
 bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join()
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/board-room.glb'),export_format='GLB',export_yup=True,export_cameras=False,export_lights=False,export_vertex_color='ACTIVE')
report=dict(triangles=sum(len(p.vertices)-2 for o in bpy.context.scene.objects if o.type=='MESH' for p in o.data.polygons),bakedLighting=lighting,interpretive=True)
(asset/'build-report.json').write_text(json.dumps(report,indent=2)+'\n')
