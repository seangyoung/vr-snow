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
for name,color in [('Stone','a09c89'),('Trim','aaa795'),('Paint','485248'),('Recess','272e2c'),('Glass','596464'),('Iron','353e38'),('Paper','c7bfa1')]:material(name,color)
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
# Partition the ground instead of stacking paving 0.5 mm above full-size
# cobbles. Shared edges are fine; overlapping top faces flicker at grazing angles.
paving_width=1.3
# A worn flagstone route connects the entrance and administrative doorway.
# Partition the cobbles around it rather than layering a second floor on top.
path_width=1.2
for side in [-1,1]:
    span=(w-2*paving_width-path_width)/2
    box('Courtyard cobbles',side*(path_width+span)/2,-.035,0,span,.06,d-2*paving_width,'Setts')
box('Worn doorway path',0,-.035,0,path_width,.06,d-2*paving_width,'Paving')
for x in [-w/2+paving_width/2,w/2-paving_width/2]:
    box('Side paving',x,-.017,0,paving_width,.025,d,'Paving')
for z in [-d/2+paving_width/2,d/2-paving_width/2]:
    box('End paving',0,-.017,z,w-2*paving_width,.025,paving_width,'Paving')
# Each wing is built facing inward. All projection remains outside the walking boundary.
def wing(width,office=False):
    if office:
        # A real opening, rather than a black door painted over a solid facade.
        for side in [-1,1]:
            box('Office wing pier',side*(width+1.6)/4,1.25,-.55,(width-1.6)/2,2.5,1.1,'Stock brick')
            box('Office plinth',side*(width+1.6)/4,.25,.045,(width-1.6)/2,.5,.09,'Stone')
        box('Office wing above doorway',0,(h+2.5)/2,-.55,width,h-2.5,1.1,'Stock brick')
    else:
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
    before=set(bpy.context.scene.objects);wing(width+.6,office=(angle==0))
    from mathutils import Matrix,Vector
    transform=Matrix.Translation(Vector((x,-z,0))) @ Matrix.Rotation(angle,4,'Z')
    for ob in set(bpy.context.scene.objects)-before:ob.matrix_world=transform @ ob.matrix_world
# Closed administrative door: the courtyard is the entire playable setting.
# Its position and detailing are interpretive, not documented 1854 plans.
for x in [-.88,.88]:box('Office door jamb',x,1.28,-9.96,.16,2.56,.22,'Stone',.008)
box('Office lintel',0,2.56,-9.96,1.92,.18,.22,'Stone')
box('Office threshold',0,.015,-9.99,1.6,.05,.32,'Paving')
box('Closed office door',0,1.24,-10.02,1.6,2.48,.12,'Paint',.012)
for x in [-.39,.39]:
    for y in [.65,1.80]:box('Office door inset',x,y,-9.95,.62,.94,.035,'Timber',.008)
box('Office door handle',.65,1.03,-9.90,.035,.18,.055,'Iron',.005)
# A restrained central clock gives the far wing an institutional focal point.
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
# A covered well and pump symbolise the separate supply discussed in the interview.
# Its form and placement are artistic choices, not claims about the actual 1854 fittings.
f=furniture('water-supply');x,z=f['x'],f['z']
box('Well stone base',x,.12,z,2.45,.24,2.25,'Paving',.02)
box('Well coping',x,.30,z,2.6,.12,2.4,'Stone',.02)
for i in range(9):box('Well cover boards',x-1.12+i*.28,.39,z,.27,.065,2.19,'Timber')
before_pump=set(bpy.context.scene.objects)
cylinder('Pump foot',x,1.06,z,.19,.1,'Iron');cylinder('Pump stem',x,1.47,z,.10,.8,'Iron')
cylinder('Pump barrel',x,2.05,z,.16,.45,'Iron');cylinder('Pump cap',x,2.32,z,.19,.09,'Iron')
for yy in [1.86,2.26]:cylinder('Pump collar',x,yy,z,.18,.05,'Iron')
tube('Pump spout',[(x,2.03,z),(x-.29,2.03,z),(x-.43,1.94,z),(x-.43,1.80,z)],.055,'Iron')
tube('Pump handle',[(x+.12,2.17,z),(x+.4,2.3,z),(x+.72,1.86,z),(x+.9,1.20,z),(x+.96,1.12,z)],.032,'Iron')
for ob in set(bpy.context.scene.objects)-before_pump:ob.location.z-=.60
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
# Two open wooden buckets sit within the water-supply collision footprint.
f=furniture('water-supply');x,z=f['x'],f['z']
for dx,dz in [(-.88,.58),(.87,.53)]:
    bx,bz=x+dx,z+dz
    cylinder('Bucket base',bx,.43,bz,.16,.035,'Timber')
    for i in range(12):
        a=i*math.tau/12
        ob=box('Bucket stave',bx+.17*math.cos(a),.59,bz+.17*math.sin(a),.094,.30,.03,'Timber',.003)
        ob.rotation_euler.z=-a-math.pi/2
    for yy in [.48,.69]:
        pts=[(bx+.185*math.cos(i*math.tau/16),yy,bz+.185*math.sin(i*math.tau/16)) for i in range(17)]
        tube('Bucket hoop',pts,.009,'Iron')
    tube('Bucket handle',[(bx-.18,.70,bz),(bx-.16,.91,bz),(bx,.98,bz),(bx+.16,.91,bz),(bx+.18,.70,bz)],.008,'Iron')
# Flush grate and shallow perimeter gutter; no overlapping coplanar floor faces.
# These shallow details are inside the well envelope or outside walking bounds.
for dx in [-.5,-.3,-.1,.1,.3,.5]:box('Supply drain grate',x+dx,.022,z+1.24,.035,.025,.24,'Iron')
for zz in range(-8,9):box('Perimeter gutter',8.72,.006,zz,.12,.012,.92,'Recess')
f=furniture('storage-chest');x,z=f['x'],f['z']
box('Yard storage chest',x,.49,z,1.6,.98,1.1,'Timber',.015)
box('Storage lid',x,1.02,z,1.6,.08,1.1,'Paint',.01)
for dx in [-.5,.5]:box('Chest strap',x+dx,.5,z+.558,.05,.9,.012,'Iron')
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from bake_scene_lighting import bake_lighting
lighting_report=bake_lighting(M,ROOT,asset='workhouse-courtyard',lights=[], world_strength=1.6, sun=(1.8,.22))
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
report={'bakedLighting':lighting_report,'triangles':triangles,'materialBatches':len([o for o in bpy.context.scene.objects if o.type=='MESH']),'layout':layout}
(asset/'build-report.json').write_text(json.dumps(report,indent=2)+'\n')
print('WORKHOUSE BUILD',triangles,'triangles;',report['materialBatches'],'material batches')
