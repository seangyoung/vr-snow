"""Illustrative Broad Street household, not a surveyed or identified family interior.
Run with Blender --background --factory-startup --python scripts/assets/build_household_room.py.
"""
import bpy, math, json, random
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
layout=json.loads((ROOT/'src/walkable/household-layout.json').read_text())
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
for name,color in [('Plaster','afa38b'),('Ceiling','b9ad95'),('Oak','685941'),('Walnut','574630'),('Paint','666650'),('Trim','9d917a'),('Recess','302d29'),('Linen','c4b89a'),('Blanket','827560'),('Brick','81634e'),('Pottery','a69270'),('Iron','393c39')]:material(name,color,wood=name=='Oak')
material('Daylight','d3d6c8',emission=True)
def box(name,x,y,z,w,h,d,mat,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y));o=bpy.context.object;o.name=name;o.dimensions=(w,d,h)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(M[mat])
    if bevel:
        mod=o.modifiers.new('Soft edges','BEVEL');mod.width=bevel;mod.segments=1;bpy.ops.object.modifier_apply(modifier=mod.name)
    return o
def cylinder(name,x,y,z,r,h,mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=r,depth=h,location=(x,-z,y));o=bpy.context.object;o.name=name;o.data.materials.append(M[mat]);return o
w,d,h=layout['width'],layout['depth'],layout['height']
for i in range(20):
    for j in range(5):box('Floorboard',-w/2+(i+.5)*w/20,-.035,-d/2+(j+.5)*d/5,w/20-.008,.06,d/5-.006,'Oak')
box('Ceiling',0,h+.05,0,w+.2,.1,d+.2,'Ceiling')
for z in [-d/2-.05,d/2+.05]:box('Wall',0,h/2,z,w+.2,h,.1,'Plaster')
for x in [-w/2-.05,w/2+.05]:box('Wall',x,h/2,0,.1,h,d,'Plaster')
for x in [-w/2+.03,w/2-.03]:
    box('Skirting',x,.10,0,.08,.20,d,'Walnut');box('Cornice',x,h-.12,0,.12,.1,d,'Trim')
for z in [-d/2+.03,d/2-.03]:
    box('Skirting',0,.10,z,w,.20,.08,'Walnut');box('Cornice',0,h-.12,z,w,.1,.12,'Trim')
# Public entrance/exit with a substantial paneled door.
doorX=layout['door'][0]
box('Return door',doorX,1.2,d/2-.065,1.1,2.4,.09,'Paint',.015)
for x in [doorX-.62,doorX+.62]:box('Door jamb',x,1.22,d/2-.13,.12,2.44,.16,'Trim',.01)
box('Door lintel',doorX,2.50,d/2-.13,1.4,.13,.16,'Trim',.01)
for y in [.6,1.8]:
    for x in [doorX-.26,doorX+.26]:box('Door panel',x,y,d/2-.12,.42,1.0,.04,'Walnut',.012)
box('Door handle',doorX-.43,1.03,d/2-.2,.035,.18,.05,'Iron',.006)
# A single sash window lights the modest room; opaque glazing avoids extra transparency passes.
box('Window recess',2.67,1.97,-1.62,.025,1.6,1.25,'Recess')
box('Daylight window',2.64,1.97,-1.62,.025,1.48,1.13,'Daylight')
for dz in [-.61,0,.61]:box('Sash upright',2.60,1.97,-1.62+dz,.10,1.62,.05,'Trim')
for y in [1.17,1.7,2.24,2.77]:box('Sash rail',2.60,y,-1.62,.10,.045,1.3,'Trim')
box('Window sill',2.5,1.15,-1.62,.33,.08,1.4,'Walnut',.012)
# Household furniture. All footprints come from the same layout used for navigation.
def furniture(id):return next(f for f in layout['furniture'] if f['id']==id)
f=furniture('bed');x,z=f['x'],f['z']
box('Bed frame',x,.38,z,1.25,.16,2.25,'Walnut',.015)
box('Straw mattress',x,.53,z,1.15,.19,2.1,'Linen',.055)
box('Wool coverlet',x,.64,z+.3,1.17,.04,1.48,'Blanket',.015)
for dx in [-.60,.60]:
    box('Hanging coverlet',x+dx,.53,z+.3,.025,.24,1.47,'Blanket')
for dx in [-.55,.55]:
    for dz in [-1.05,1.05]:box('Bed post',x+dx,.49,z+dz,.085,.98,.085,'Walnut',.01)
box('Headboard',x,.84,z-1.08,1.16,.50,.06,'Walnut',.01)
box('Footboard',x,.70,z+1.08,1.16,.28,.06,'Walnut',.01)
box('Pillow',x,.69,z-.72,.78,.17,.44,'Linen',.075)
for dx in [-.32,-.1,.13,.35]:box('Coverlet seam',x+dx,.663,z+.30,.008,.002,1.38,'Linen')
f=furniture('interview-chair');x,z=f['x'],f['z']
box('Interview chair seat',x,.46,z,.65,.09,.65,'Walnut',.022)
for dx in [-.27,.27]:
    for dz in [-.27,.27]:box('Chair leg',x+dx,.23,z+dz,.065,.46,.065,'Walnut',.008)
for dx in [-.28,.28]:box('Chair back post',x+dx,.76,z-.285,.07,.52,.07,'Walnut',.008)
for y in [.73,.95]:box('Chair back rail',x,y,z-.285,.60,.095,.065,'Walnut',.008)
box('Woven chair seat',x,.51,z,.51,.012,.51,'Blanket')
f=furniture('table');x,z=f['x'],f['z']
box('Kitchen table top',x,.735,z,1.2,.09,.9,'Oak',.02)
for dx in [-.5,.5]:
    for dz in [-.35,.35]:box('Kitchen table leg',x+dx,.34,z+dz,.07,.68,.07,'Walnut')
for dz in [-.34,.34]:box('Table apron',x,.63,z+dz,1.06,.15,.05,'Walnut')
# Turned earthenware jug and shallow basin, decorative rather than extra action targets.
def vessel(name,x,y,z,profile,mat):
    n=20;verts=[];faces=[]
    for radius,height in profile:
        verts.extend((x+radius*math.cos(i*2*math.pi/n),-z+radius*math.sin(i*2*math.pi/n),y+height) for i in range(n))
    for j in range(len(profile)-1):
        for i in range(n):
            a=j*n+i;b=j*n+(i+1)%n;faces.append((a,b,b+n,a+n))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob);ob.data.materials.append(M[mat]);return ob
vessel('Water jug',x+.18,.785,z-.12,[(0,0),(.11,0),(.15,.09),(.145,.24),(.08,.33),(.08,.39),(.06,.39),(.06,.33),(.105,.22),(.09,.035),(0,.035)],'Pottery')
bpy.ops.mesh.primitive_torus_add(major_segments=16,minor_segments=6,location=(x+.32,-z+.12,.985),major_radius=.092,minor_radius=.017)
o=bpy.context.object;o.name='Jug handle';o.rotation_euler.x=math.pi/2;o.scale.x=.65;o.data.materials.append(M['Pottery'])
vessel('Drinking cup',x-.25,.785,z+.1,[(0,0),(.06,0),(.075,.11),(.063,.11),(.05,.02),(0,.02)],'Pottery')
box('Folded cloth',x-.30,.80,z-.21,.3,.025,.22,'Linen',.01)
f=furniture('hearth');x,z=f['x'],f['z']
box('Chimney breast',x,2.25,z-.17,1.4,1.8,.24,'Plaster')
box('Hearth slab',x,.055,z,1.55,.11,.6,'Brick',.008)
box('Firebox shadow',x,.62,z-.11,.92,1.02,.06,'Recess')
for dx in [-.60,.60]:
    for row in range(7):box('Hearth brick',x+dx,.19+row*.16,z,.23,.15,.44,'Brick',.006)
box('Hearth lintel',x,1.28,z,1.48,.19,.52,'Brick',.009)
box('Mantel shelf',x,1.42,z,1.55,.10,.6,'Walnut',.015)
for dx in [-.35,-.17,0,.17,.35]:box('Cold fire grate',x+dx,.32,z+.19,.025,.35,.025,'Iron')
for yy in [.2,.48]:box('Grate rail',x,yy,z+.19,.77,.025,.025,'Iron')
vessel('Mantel jar',x-.46,1.48,z,[(0,0),(.08,0),(.09,.15),(.065,.2),(.05,.2),(.065,.04),(0,.04)],'Pottery')
f=furniture('chest');x,z=f['x'],f['z']
box('Clothes chest',x,.28,z,.65,.53,1.1,'Oak',.022)
box('Chest lid',x,.575,z,.65,.05,1.1,'Walnut',.01)
for dz in [-.36,.36]:box('Chest iron strap',x,.605,z+dz,.64,.008,.035,'Iron')
f=furniture('washstand');x,z=f['x'],f['z']
box('Washstand top',x,.81,z,.55,.08,.8,'Walnut',.015)
for dx in [-.22,.22]:
    for dz in [-.32,.32]:box('Washstand leg',x+dx,.39,z+dz,.06,.78,.06,'Walnut')
box('Washstand shelf',x,.3,z,.48,.035,.69,'Walnut')
vessel('Wash basin',x,.86,z,[(0,0),(.12,0),(.23,.13),(.21,.145),(.105,.025),(0,.025)],'Pottery')
# The mourning ribbon referred to by the existing interview.
box('Mourning ribbon',doorX+.28,2.04,d/2-.18,.055,.38,.008,'Recess')
for angle in [-.55,.55]:
    o=box('Ribbon loop',doorX+.28,2.18,d/2-.19,.065,.18,.012,'Recess');o.rotation_euler.y=angle
asset=ROOT/'assets/household-room';asset.mkdir(exist_ok=True)
bpy.context.scene.unit_settings.system='METRIC';bpy.context.preferences.filepaths.save_version=0
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(asset/'household-room.blend'))
for name,mat in M.items():
    obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials and o.data.materials[0]==mat]
    if not obs:continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:o.select_set(True)
    bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name=name
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/household-room.glb'),export_format='GLB',export_yup=True,export_cameras=False,export_lights=False)
triangles=sum(len(p.vertices)-2 for o in bpy.context.scene.objects if o.type=='MESH' for p in o.data.polygons)
report={'triangles':triangles,'materialBatches':len([o for o in bpy.context.scene.objects if o.type=='MESH']),'layout':layout}
(asset/'build-report.json').write_text(json.dumps(report,indent=2)+'\n')
print('HOUSEHOLD BUILD',triangles,'triangles;',report['materialBatches'],'material batches')
