"""Prototype records office, interpretive rather than a surveyed historical interior.
Run with Blender --background --factory-startup --python scripts/assets/build_registrar_room.py.
"""
import bpy, math, json, random
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
layout=json.loads((ROOT/'src/walkable/registrar-layout.json').read_text())
random.seed(1854)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
M={}
def linear(v):return ((v+.055)/1.055)**2.4 if v>.04045 else v/12.92
def material(name,color,wood=False,emission=False):
    m=bpy.data.materials.new(name);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF')
    c=tuple(linear(int(color[i:i+2],16)/255) for i in (0,2,4))
    bs.inputs['Base Color'].default_value=(*c,1);bs.inputs['Roughness'].default_value=.88
    if wood:
        tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(ROOT/'assets/broad-street/textures/wood.jpg'),check_existing=True)
        m.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
    if emission:bs.inputs['Emission Color'].default_value=(*c,1);bs.inputs['Emission Strength'].default_value=.6
    M[name]=m
for name,color in [('Plaster','b1ada0'),('Ceiling','c7c2b5'),('Oak','685941'),('Walnut','514536'),('Paint','536055'),('Trim','b9b4a3'),('Recess','282a26'),('Paper','d9cfad'),('Brass','a28d5e'),('Red binding','705045'),('Green binding','4e5b4c'),('Blue binding','56616a')]:material(name,color,wood=name=='Oak')
material('Daylight','d8e3df',emission=True)
def box(name,x,y,z,w,h,d,mat,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y));o=bpy.context.object;o.name=name;o.dimensions=(w,d,h)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(M[mat])
    if bevel:
        mod=o.modifiers.new('Soft edges','BEVEL');mod.width=bevel;mod.segments=1;bpy.ops.object.modifier_apply(modifier=mod.name)
    return o
def cylinder(name,x,y,z,r,h,mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=r,depth=h,location=(x,-z,y));o=bpy.context.object;o.name=name;o.data.materials.append(M[mat]);return o
w,d,h=layout['width'],layout['depth'],layout['height']
for i in range(28):
    for j in range(5):box('Floorboard',-w/2+(i+.5)*w/28,-.035,-d/2+(j+.5)*d/5,w/28-.008,.06,d/5-.006,'Oak')
box('Ceiling',0,h+.05,0,w+.2,.1,d+.2,'Ceiling')
for z in [-d/2-.05,d/2+.05]:box('Wall',0,h/2,z,w+.2,h,.1,'Plaster')
for x in [-w/2-.05,w/2+.05]:box('Wall',x,h/2,0,.1,h,d,'Plaster')
for x in [-w/2+.03,w/2-.03]:
    box('Skirting',x,.10,0,.08,.20,d,'Walnut');box('Cornice',x,h-.12,0,.12,.1,d,'Trim')
for z in [-d/2+.03,d/2-.03]:
    box('Skirting',0,.10,z,w,.20,.08,'Walnut');box('Cornice',0,h-.12,z,w,.1,.12,'Trim')
for z in [-2.55,0,2.55]:
    box('Window recess',3.96,2.0,z,.025,2.12,1.52,'Recess')
    box('Daylight window',3.93,2.0,z,.025,2.0,1.42,'Daylight')
    for dz in [-.76,0,.76]:box('Sash upright',3.88,2.0,z+dz,.12,2.15,.055,'Trim')
    for y in [.94,1.63,2.32,3.06]:box('Sash rail',3.88,y,z,.12,.055,1.60,'Trim')
    box('Window sill',3.80,.92,z,.36,.10,1.7,'Trim',.015)
# Public entrance/exit with a substantial paneled door.
doorX=layout['door'][0]
box('Return door',doorX,1.2,d/2-.065,1.1,2.4,.09,'Paint',.015)
for x in [doorX-.62,doorX+.62]:box('Door jamb',x,1.22,d/2-.13,.12,2.44,.16,'Trim',.01)
box('Door lintel',doorX,2.50,d/2-.13,1.4,.13,.16,'Trim',.01)
for y in [.6,1.8]:
    for x in [doorX-.26,doorX+.26]:box('Door panel',x,y,d/2-.12,.42,1.0,.04,'Walnut',.012)
box('Door handle',doorX-.43,1.03,d/2-.2,.035,.18,.05,'Brass',.006)
# Ledger table stays low enough for a seated visitor to inspect with a ray.
f=next(f for f in layout['furniture'] if f['id']=='ledger-table');x,z=f['x'],f['z']
box('Ledger table top',x,.815,z,2.6,.09,1.2,'Walnut',.025)
for dx in [-1.12,1.12]:
    for dz in [-.47,.47]:box('Table leg',x+dx,.39,z+dz,.10,.78,.10,'Walnut',.015)
for dz in [-.46,.46]:box('Table apron',x,.69,z+dz,2.35,.18,.075,'Walnut')
box('Writing surface',0,.87,z,1.4,.012,.9,'Paint',.015)
# Open returns ledger, with decorative ruled rows rather than invented historical records.
for dx in [-.24,.24]:
    box('Ledger binding',dx,.90,z+.09,.46,.065,.64,'Red binding',.008)
    box('Ledger pages',dx,.94,z+.09,.43,.02,.61,'Paper',.004)
    for row in range(12):box('Ruled row',dx,.952,z-.15+row*.044,.39,.003,.003,'Walnut')
    for col in [-.09,.03,.14]:box('Ledger column',dx+col,.953,z+.09,.003,.002,.55,'Walnut')
for i in range(4):box('Copied returns',.97,.872+i*.009,z+.05,.38,.006,.5,'Paper')
cylinder('Inkwell',-.99,.91,z-.15,.055,.1,'Recess');box('Pen',-.84,.882,z-.12,.29,.008,.012,'Walnut')
# Records counter and a low balustrade, both confined to the collision envelope.
f=next(f for f in layout['furniture'] if f['id']=='counter');x,z=f['x'],f['z']
box('Counter front',0,.5,z+.29,4.6,.95,.10,'Walnut')
box('Counter top',0,1.01,z,4.6,.08,.75,'Walnut',.02)
for x in [-2.24,-1.12,0,1.12,2.24]:box('Counter stile',x,.5,z+.36,.07,.95,.07,'Oak')
for x in [-1.65,-.55,.55,1.65]:box('Counter field',x,.49,z+.36,.99,.77,.035,'Paint',.012)
for x in [-1.3,1.3]:
    for i in range(4):box('Closed register',x,1.08+i*.08,z,.56,.07,.43,random.choice(['Red binding','Green binding','Blue binding']),.005)
# Archive cupboards: shelves, bound volumes and paper bundles.
for f in [f for f in layout['furniture'] if f['id'].startswith('archive')]:
    x,z,bw=f['x'],f['z'],f['width']
    box('Archive back',x,1.35,z-.2,bw,2.7,.06,'Walnut')
    for dx in [-bw/2,0,bw/2]:box('Archive upright',x+dx,1.35,z,.07,2.7,.5,'Walnut')
    for y in [.12,.7,1.3,1.9,2.5,2.7]:box('Archive shelf',x,y,z,bw+.06,.055,.52,'Walnut')
    for level,y in enumerate([.15,.73,1.33,1.93]):
        for i in range(23):
            bx=x-bw/2+.11+i*.135;bh=random.uniform(.37,.5)
            box('Register volume',bx,y+bh/2,z+.05,.105,bh,.32,random.choice(['Red binding','Green binding','Blue binding','Oak']),.004)
            box('Spine label',bx,y+bh*.57,z+.214,.073,.12,.004,'Paper')
# Shallow drawer bank and waiting bench on the west wall.
f=next(f for f in layout['furniture'] if f['id']=='drawers');x,z=f['x'],f['z']
box('Drawer case',x,.7,z,.5,1.4,4.8,'Walnut',.012)
for j in range(8):
    for i in range(4):
        zz=z-2.1+j*.6;yy=.2+i*.32
        box('Record drawer',x+.27,yy,zz,.035,.27,.53,'Oak',.006)
        box('Drawer label',x+.292,yy+.035,zz,.007,.065,.16,'Paper')
        box('Drawer pull',x+.31,yy-.065,zz,.03,.025,.12,'Brass',.005)
f=next(f for f in layout['furniture'] if f['id']=='bench');x,z=f['x'],f['z']
box('Bench seat',x,.47,z,.65,.09,1.8,'Walnut',.018)
box('Bench back',x-.28,.75,z,.065,.4,1.8,'Paint',.012)
for dz in [-.73,.73]:
    for dx in [-.24,.24]:box('Bench leg',x+dx,.23,z+dz,.065,.46,.065,'Walnut')
for f in [f for f in layout['furniture'] if f['id'].startswith('chair')]:
    x,z=f['x'],f['z'];box('Clerk chair seat',x,.45,z,.58,.09,.58,'Paint',.02)
    box('Clerk chair back',x,.84,z-.25,.56,.52,.07,'Walnut',.02)
    for dx in [-.23,.23]:
        for dz in [-.23,.23]:box('Chair leg',x+dx,.23,z+dz,.06,.46,.06,'Walnut')
clock=cylinder('Clock case',0,3.1,-4.10,.25,.07,'Walnut');clock.rotation_euler.x=math.pi/2
face=cylinder('Clock face',0,3.1,-4.045,.21,.02,'Paper');face.rotation_euler.x=math.pi/2
box('Clock hand',0,3.16,-4.025,.012,.14,.01,'Recess');box('Clock hand',.065,3.1,-4.025,.14,.012,.01,'Recess')
for x in [-1.2,1.2]:
    cylinder('Pendant cord',x,3.22,-1.8,.012,.5,'Recess')
    cylinder('Pendant shade',x,2.93,-1.8,.20,.10,'Brass')
    cylinder('Pendant diffuser',x,2.875,-1.8,.17,.015,'Paper')
asset=ROOT/'assets/registrar-room';asset.mkdir(exist_ok=True)
bpy.context.scene.unit_settings.system='METRIC';bpy.context.preferences.filepaths.save_version=0
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(asset/'registrar-room.blend'))
for name,mat in M.items():
    obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials and o.data.materials[0]==mat]
    if not obs:continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:o.select_set(True)
    bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name=name
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/registrar-room.glb'),export_format='GLB',export_yup=True,export_cameras=False,export_lights=False)
triangles=sum(len(p.vertices)-2 for o in bpy.context.scene.objects if o.type=='MESH' for p in o.data.polygons)
report={'triangles':triangles,'materialBatches':len([o for o in bpy.context.scene.objects if o.type=='MESH']),'layout':layout}
(asset/'build-report.json').write_text(json.dumps(report,indent=2)+'\n')
print('REGISTRAR BUILD',triangles,'triangles;',report['materialBatches'],'material batches')
