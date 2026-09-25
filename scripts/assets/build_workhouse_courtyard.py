"""Interpretive courtyard matching the existing workhouse panorama's setting.
Not a measured reconstruction of St. James Workhouse. Run with Blender --background
--factory-startup --python scripts/assets/build_workhouse_courtyard.py.
"""
import bpy, math, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
layout=json.loads((ROOT/'src/walkable/workhouse-layout.json').read_text())
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
M={}; REPEAT={}
def linear(v):return ((v+.055)/1.055)**2.4 if v>.04045 else v/12.92
def material(name,color,texture=None,repeat=1):
    m=bpy.data.materials.new(name);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF')
    c=tuple(linear(int(color[i:i+2],16)/255) for i in (0,2,4))
    bs.inputs['Base Color'].default_value=(*c,1);bs.inputs['Roughness'].default_value=.88
    if texture:
        tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(ROOT/f'assets/broad-street/textures/{texture}.jpg'),check_existing=True)
        m.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
    M[name]=m;REPEAT[name]=repeat
material('Stock brick','756950','stock-brick',1.92)
material('Setts','777771','setts',2.4)
material('Paving','a5a18b','flags',2.4)
material('Slate','555c60','slate',2.4)
material('Timber','62523d','wood',1.5)
for name,color in [('Stone','a09c89'),('Trim','aaa795'),('Paint','485248'),('Recess','272e2c'),('Glass','596464'),('Iron','353e38'),('Paper','c7bfa1'),('Soil','514f3b'),('Leaves','686f51')]:material(name,color)
# Cube UVs are projected in metres so brick and paving retain their scale.
def box(name,x,y,z,w,h,d,mat,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y));o=bpy.context.object;o.name=name;o.dimensions=(w,d,h)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(M[mat])
    uv=o.data.uv_layers.active
    for p in o.data.polygons:
        axis=max(range(3),key=lambda i:abs(p.normal[i]));axes=[i for i in range(3) if i!=axis]
        for li in p.loop_indices:
            co=o.data.vertices[o.data.loops[li].vertex_index].co
            uv.data[li].uv=(co[axes[0]]/REPEAT[mat],co[axes[1]]/REPEAT[mat])
    if bevel:
        mod=o.modifiers.new('Soft edges','BEVEL');mod.width=bevel;mod.segments=1;bpy.ops.object.modifier_apply(modifier=mod.name)
    return o
def cylinder(name,x,y,z,r,h,mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=r,depth=h,location=(x,-z,y));o=bpy.context.object;o.name=name;o.data.materials.append(M[mat]);return o
def tube(name,points,r,mat):
    from mathutils import Vector
    for a,b in zip(points,points[1:]):
        aa=Vector((a[0],-a[2],a[1]));bb=Vector((b[0],-b[2],b[1]));delta=bb-aa
        bpy.ops.mesh.primitive_cylinder_add(vertices=10,radius=r,depth=delta.length,location=(aa+bb)/2)
        o=bpy.context.object;o.name=name;o.rotation_euler=delta.to_track_quat('Z','Y').to_euler();o.data.materials.append(M[mat])
w,d,h=layout['width'],layout['depth'],layout['height']
box('Courtyard cobbles',0,-.035,0,w,.06,d,'Setts')
# Flat perimeter paving remains flush with the navigable ground.
for x in [-w/2+.65,w/2-.65]:box('Side paving',x,-.017,0,1.3,.025,d,'Paving')
for z in [-d/2+.65,d/2-.65]:box('End paving',0,-.017,z,w,.025,1.3,'Paving')
# Each wing is built facing inward. All projection remains outside the walking boundary.
def wing(width):
    box('Brick wing',0,h/2,-.55,width,h,1.1,'Stock brick')
    box('Stone plinth',0,.25,.045,width,.5,.09,'Stone')
    for y in [2.9,5.75,8.55]:box('Brick string course',0,y,.045,width,.12,.09,'Stone')
    box('Roof coping',0,h+.08,-.55,width+.08,.16,1.3,'Stone')
    box('Slate roof',0,h+.16,-1.5,width,.08,2.6,'Slate')
    columns=int(width//2.8)
    for i in range(columns):
        x=(i-(columns-1)/2)*2.8
        for y in [1.65,4.4,7.15]:
            box('Window recess',x,y,.015,1.18,1.83,.035,'Recess')
            box('Opaque glazing',x,y,.045,1.08,1.71,.025,'Glass')
            for dx in [-.58,.58]:box('Window jamb',x+dx,y,.09,.07,1.9,.1,'Trim')
            for yy in [y-.9,y,y+.9]:box('Sash rail',x,yy,.1,1.22,.055,.1,'Trim')
            for dx in [-.18,.18]:box('Glazing bar',x+dx,y,.105,.028,1.8,.08,'Trim')
            for yy in [y-.45,y+.45]:box('Glazing bar',x,yy,.105,1.15,.028,.08,'Trim')
            box('Window sill',x,y-.98,.085,1.42,.12,.17,'Stone',.007)
            box('Window lintel',x,y+1.01,.055,1.4,.15,.12,'Stone')
    for x in [-width*.34,width*.34]:
        box('Chimney',x,h+.58,-.7,.75,1.0,.65,'Stock brick')
        box('Chimney cap',x,h+1.1,-.7,.85,.12,.74,'Stone')
        for dx in [-.19,.19]:cylinder('Chimney pot',x+dx,h+1.33,-.7,.105,.35,'Iron')
for width,x,z,angle in [(w,0,-d/2-.2,0),(w,0,d/2+.2,math.pi),(d,-w/2-.2,0,math.pi/2),(d,w/2+.2,0,-math.pi/2)]:
    before=set(bpy.context.scene.objects);wing(width+.6)
    from mathutils import Matrix,Vector
    transform=Matrix.Translation(Vector((x,-z,0))) @ Matrix.Rotation(angle,4,'Z')
    for ob in set(bpy.context.scene.objects)-before:ob.matrix_world=transform @ ob.matrix_world
# A restrained central clock gives the far wing an institutional focal point.
box('Central entrance surround',0,1.3,-9.94,1.8,2.6,.09,'Stone')
box('Closed service door',0,1.23,-9.875,1.42,2.44,.035,'Paint')
for x in [-.52,.52]:box('Service door stile',x,1.2,-9.845,.065,2.4,.025,'Trim')
clock=cylinder('Yard clock surround',0,8.02,-9.8,.4,.10,'Iron');clock.rotation_euler.x=math.pi/2
clock=cylinder('Yard clock face',0,8.02,-9.73,.34,.035,'Stone');clock.rotation_euler.x=math.pi/2
box('Clock minute hand',0,8.14,-9.705,.025,.26,.012,'Iron');box('Clock hour hand',.10,8.02,-9.705,.22,.025,.012,'Iron')
# Only the near exit is marked for travel; other doors are closed scenery.
x=layout['door'][0]
box('Exit surround',x,1.27,9.96,1.52,2.54,.075,'Stone')
box('Return door',x,1.2,9.89,1.1,2.4,.09,'Paint',.015)
for dx in [-.62,.62]:box('Exit jamb',x+dx,1.22,9.87,.12,2.44,.16,'Trim',.01)
box('Exit lintel',x,2.50,9.87,1.4,.13,.16,'Trim',.01)
for y in [.6,1.8]:
    for dx in [-.26,.26]:box('Door panel',x+dx,y,9.83,.42,1,.035,'Timber',.008)
box('Door handle',x-.43,1.03,9.78,.035,.18,.05,'Iron')
# Furniture bounds are shared with the runtime collision and floor-teleport checks.
def furniture(id):return next(f for f in layout['furniture'] if f['id']==id)
f=furniture('steward-table');x,z=f['x'],f['z']
box('Steward table top',x,.785,z,2,.09,1.1,'Timber',.022)
for dx in [-.87,.87]:
    for dz in [-.42,.42]:box('Table leg',x+dx,.37,z+dz,.10,.74,.10,'Paint',.01)
for dz in [-.43,.43]:box('Table apron',x,.65,z+dz,1.82,.18,.065,'Timber')
box('Closed register',x-.2,.87,z,.52,.08,.65,'Paint',.008)
box('Register pages',x-.2,.87,z+.018,.48,.055,.63,'Paper')
box('Register top cover',x-.2,.92,z,.52,.025,.65,'Paint')
for i in range(3):box('Blank papers',x+.55,.84+i*.008,z+.1,.35,.006,.46,'Paper')
cylinder('Ink pot',x-.73,.89,z-.22,.055,.12,'Iron')
f=furniture('steward-chair');x,z=f['x'],f['z']
box('Steward chair seat',x,.48,z,.65,.09,.65,'Timber',.015)
box('Steward chair back',x,.85,z-.29,.65,.5,.07,'Paint',.015)
for dx in [-.27,.27]:
    for dz in [-.27,.27]:box('Chair leg',x+dx,.24,z+dz,.07,.48,.07,'Paint')
# A covered well and pump symbolise the separate supply discussed in the interview.
# Its form and placement are artistic choices, not claims about the actual 1854 fittings.
f=furniture('water-supply');x,z=f['x'],f['z']
box('Well stone base',x,.42,z,2.45,.84,2.25,'Paving',.02)
box('Well coping',x,.90,z,2.6,.12,2.4,'Stone',.02)
for i in range(9):box('Well cover boards',x-1.12+i*.28,.99,z,.27,.065,2.19,'Timber')
cylinder('Pump foot',x,1.06,z,.19,.1,'Iron');cylinder('Pump stem',x,1.47,z,.10,.8,'Iron')
cylinder('Pump barrel',x,2.05,z,.16,.45,'Iron');cylinder('Pump cap',x,2.32,z,.19,.09,'Iron')
for yy in [1.86,2.26]:cylinder('Pump collar',x,yy,z,.18,.05,'Iron')
tube('Pump spout',[(x,2.03,z),(x-.29,2.03,z),(x-.43,1.94,z),(x-.43,1.80,z)],.055,'Iron')
tube('Pump handle',[(x+.12,2.17,z),(x+.4,2.3,z),(x+.72,1.86,z),(x+.9,1.20,z),(x+.96,1.12,z)],.032,'Iron')
# Small trough, contained inside the supply's obstacle envelope.
box('Trough bottom',x,.10,z+1.18,1.55,.12,.35,'Timber')
for dz in [1.02,1.35]:box('Trough edge',x,.23,z+dz,1.55,.26,.05,'Timber')
for dx in [-.75,.75]:box('Trough end',x+dx,.23,z+1.18,.05,.26,.35,'Timber')
for id in ['west-bench','east-bench']:
    f=furniture(id);x,z=f['x'],f['z'];back=-1 if x<0 else 1
    box('Yard bench seat',x,.46,z,.65,.09,3,'Timber',.015)
    for yy in [.73,.99]:box('Yard bench back',x+back*.28,yy,z,.075,.12,3,'Paint',.01)
    for dz in [-1.25,1.25]:
        for dx in [-.24,.24]:box('Bench leg',x+dx,.23,z+dz,.08,.46,.08,'Paint')
        box('Bench back support',x+back*.28,.75,z+dz,.07,.55,.07,'Paint')
f=furniture('garden-bed');x,z=f['x'],f['z']
box('Garden soil',x,.20,z,1.4,.4,5.6,'Soil')
for dx in [-.67,.67]:box('Garden edge',x+dx,.25,z,.06,.5,5.6,'Stone')
for dz in [-2.77,2.77]:box('Garden edge',x,.25,z+dz,1.4,.5,.06,'Stone')
for i in range(9):
    for dx in [-.35,.35]:
        for angle in [-.55,.55]:
            ob=box('Garden leaves',x+dx,.49,z-2.35+i*.58,.3,.035,.18,'Leaves',.01);ob.rotation_euler.y=angle
f=furniture('storage-chest');x,z=f['x'],f['z']
box('Yard storage chest',x,.49,z,1.6,.98,1.1,'Timber',.015)
box('Storage lid',x,1.02,z,1.6,.08,1.1,'Paint',.01)
for dx in [-.5,.5]:box('Chest strap',x+dx,.5,z+.558,.05,.9,.012,'Iron')
asset=ROOT/'assets/workhouse-courtyard';asset.mkdir(exist_ok=True)
bpy.context.scene.unit_settings.system='METRIC';bpy.context.preferences.filepaths.save_version=0
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(asset/'workhouse-courtyard.blend'))
for name,mat in M.items():
    obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials and o.data.materials[0]==mat]
    if not obs:continue
    bpy.ops.object.select_all(action='DESELECT')
    for ob in obs:ob.select_set(True)
    bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name=name
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/workhouse-courtyard.glb'),export_format='GLB',export_yup=True,export_cameras=False,export_lights=False)
triangles=sum(len(p.vertices)-2 for o in bpy.context.scene.objects if o.type=='MESH' for p in o.data.polygons)
report={'triangles':triangles,'materialBatches':len([o for o in bpy.context.scene.objects if o.type=='MESH']),'layout':layout}
(asset/'build-report.json').write_text(json.dumps(report,indent=2)+'\n')
print('WORKHOUSE BUILD',triangles,'triangles;',report['materialBatches'],'material batches')
