"""Interpretive brewhouse inspired by the existing panorama, not a surveyed 1854 plan.
Run: blender --background --factory-startup --python scripts/assets/build_brewery_room.py.
"""
import bpy, math, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
layout=json.loads((ROOT/'src/walkable/brewery-layout.json').read_text())
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
material('Brick','775141','red-brick',1.92)
material('Paving','99947f','flags',2.4)
material('Timber','62523d','wood',1.5)
for name,color in [('Stone','96917f'),('Trim','a9a18d'),('Paint','485248'),('Recess','272b28'),('Iron','363b37'),('Paper','c7bfa1'),('Copper','b5794e'),('Sacking','9e9071'),('Pottery','b3a180'),('Daylight','cfdbd7')]:material(name,color)
M['Copper'].node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value=.3
M['Copper'].node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.56
bs=M['Daylight'].node_tree.nodes.get('Principled BSDF');bs.inputs['Emission Color'].default_value=bs.inputs['Base Color'].default_value;bs.inputs['Emission Strength'].default_value=.3
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
box('Flagstone floor',0,-.035,0,w,.06,d,'Paving')
box('Timber ceiling',0,h+.06,0,w+.2,.12,d+.2,'Timber')
for z in [-d/2-.06,d/2+.06]:box('Brick end wall',0,h/2,z,w+.24,h,.12,'Brick')
for x in [-w/2-.06,w/2+.06]:box('Brick side wall',x,h/2,0,.12,h,d,'Brick')
for x in [-w/2+.035,w/2-.035]:box('Stone wall base',x,.14,0,.07,.28,d,'Stone')
for z in [-d/2+.035,d/2-.035]:box('Stone wall base',0,.14,z,w,.28,.07,'Stone')
for z in [-4,-1,2,5]:
    box('Cross beam',0,h-.17,z,w,.34,.24,'Timber')
    # Corbels stay above head height and inside the wall clearance envelope.
    for x in [-w/2+.1,w/2-.1]:box('Beam corbel',x,h-.48,z,.20,.3,.32,'Timber',.012)
for x in [-2.5,0,2.5]:box('Ceiling joist',x,h-.045,0,.12,.09,d,'Timber')
# High side windows and back-wall sash windows, without transparent blending.
for z in [-3.5,0,3.4]:
    box('Window recess',4.965,2.8,z,.025,2.0,1.5,'Recess')
    box('Window light',4.94,2.8,z,.025,1.88,1.38,'Daylight')
    for dz in [-.74,0,.74]:box('Window upright',4.88,2.8,z+dz,.12,2.06,.06,'Trim')
    for y in [1.8,2.3,2.8,3.3,3.8]:box('Window rail',4.88,y,z,.12,.05,1.56,'Trim')
    box('Window sill',4.82,1.74,z,.3,.1,1.7,'Stone',.01)
for x in [-.65,.65]:
    box('Back window light',x,2.7,-5.975,1.05,2,.025,'Daylight')
    for dx in [-.55,0,.55]:box('Back sash bar',x+dx,2.7,-5.91,.05,2.1,.12,'Trim')
    for y in [1.65,2.175,2.7,3.225,3.75]:box('Back sash rail',x,y,-5.91,1.15,.05,.12,'Trim')
# Single marked exit, with identical proportions to the other walkable rooms.
x=layout['door'][0]
box('Return door',x,1.2,5.91,1.1,2.4,.09,'Paint',.015)
for dx in [-.62,.62]:box('Door jamb',x+dx,1.22,5.87,.12,2.44,.16,'Trim',.01)
box('Door lintel',x,2.5,5.87,1.4,.13,.16,'Stone',.01)
for y in [.6,1.8]:
    for dx in [-.26,.26]:box('Door panel',x+dx,y,5.84,.42,1,.035,'Timber',.008)
box('Door handle',x-.43,1.03,5.78,.035,.18,.05,'Iron')
# Turned vessels. Profile is (radius, height), Three.js coordinates.
def lathe(name,x,y,z,profile,mat,sides=32):
    verts=[];faces=[]
    for r,yy in profile:verts.extend((x+r*math.cos(i*math.tau/sides),-z+r*math.sin(i*math.tau/sides),y+yy) for i in range(sides))
    for j in range(len(profile)-1):
        for i in range(sides):faces.append((j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    uv=mesh.uv_layers.new(name='UVMap')
    for p in mesh.polygons:
        for li in p.loop_indices:
            vi=mesh.loops[li].vertex_index;uv.data[li].uv=((vi%sides)/sides*3,profile[vi//sides][1]/REPEAT[mat])
        p.use_smooth=True
    ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob);ob.data.materials.append(M[mat]);return ob
def furniture(id):return next(f for f in layout['furniture'] if f['id']==id)
for id in ['west-copper','east-copper']:
    f=furniture(id);x,z=f['x'],f['z']
    lathe('Brick copper plinth',x,0,z,[(0,0),(1.22,0),(1.22,.76),(0,.76)],'Brick')
    lathe('Brewing copper',x,0,z,[(0,.74),(1.17,.74),(1.17,1.75),(1.2,1.8),(1.18,1.91),(.97,2.10),(.7,2.27),(.43,2.50),(.26,2.78),(.20,2.95),(.20,4.5),(0,4.5)],'Copper')
    for yy in [.79,1.75]:lathe('Copper band',x,yy,z,[(1.18,0),(1.22,.025),(1.22,.07),(1.18,.095)],'Iron')
    box('Closed firebox',x,.37,z+1.225,.48,.49,.025,'Iron',.04)
    for dx in [-.15,-.05,.05,.15]:box('Firebox vent',x+dx,.33,z+1.244,.035,.17,.012,'Recess')
    tube('Copper tap',[(x,.97,z+1.16),(x,.97,z+1.28),(x,.88,z+1.28)],.03,'Iron')
# Large timber vat with an opaque open top; it remains decorative and non-climbable.
f=furniture('timber-vat');x,z=f['x'],f['z']
lathe('Timber vat',x,0,z,[(0,0),(.72,0),(.80,.25),(.80,2.5),(.75,2.55),(.72,2.48),(.72,.15),(0,.15)],'Timber')
for yy in [.12,.72,1.55,2.42]:lathe('Vat hoop',x,yy,z,[(.795,0),(.825,.02),(.825,.1),(.795,.12)],'Iron')
cylinder('Vat dark interior',x,2.30,z,.70,.02,'Recess')
# Two tiers of horizontal casks, enclosed by one simple rack collision footprint.
f=furniture('barrel-rack');x,z=f['x'],f['z']
for y in [.08,1.15,2.23]:box('Rack shelf',x,y,z,.9,.1,4.8,'Timber')
for zz in [-2.32,0,2.32]:
    for dx in [-.38,.38]:box('Rack post',x+dx,1.4,z+zz,.10,2.8,.10,'Timber')
for y in [.18,1.25]:
    for zz in [-1.75,-.6,.6,1.75]:
        # Author upright, then rotate around its center so its axis faces the aisle.
        before=set(bpy.context.scene.objects)
        profile=[(0,-.40),(.38,-.40),(.44,-.28),(.46,0),(.44,.28),(.38,.40),(0,.40)]
        lathe('Cask staves',0,0,0,profile,'Timber',24)
        for yy in [-.33,0,.33]:lathe('Cask hoop',0,yy,0,[(.44,0),(.465,.015),(.465,.05),(.44,.065)],'Iron',24)
        from mathutils import Matrix,Vector
        transform=Matrix.Translation(Vector((x,-(z+zz),y+.46))) @ Matrix.Rotation(math.pi/2,4,'Y')
        for ob in set(bpy.context.scene.objects)-before:ob.matrix_world=transform @ ob.matrix_world
# Interview table and two low stools; no new action on vessels or barrels.
f=furniture('owners-table');x,z=f['x'],f['z']
box('Owners table top',x,.795,z,2,.09,.95,'Timber',.025)
for dx in [-.86,.86]:
    for dz in [-.35,.35]:box('Table leg',x+dx,.37,z+dz,.09,.74,.09,'Timber',.01)
for dz in [-.36,.36]:box('Table apron',x,.65,z+dz,1.8,.18,.06,'Timber')
box('Closed account book',x-.55,.885,z-.10,.42,.075,.55,'Paint',.008)
box('Book pages',x-.55,.887,z-.083,.38,.045,.52,'Paper')
for xx in [.1,.53]:lathe('Drinking mug',x+xx,.84,z+.05,[(0,0),(.08,0),(.09,.15),(.075,.15),(.065,.025),(0,.025)],'Pottery',20)
for id in ['west-stool','east-stool']:
    f=furniture(id);x,z=f['x'],f['z'];cylinder('Stool seat',x,.555,z,.25,.09,'Timber')
    for dx,dz in [(-.15,-.15),(.15,-.15),(0,.18)]:box('Stool leg',x+dx,.26,z+dz,.065,.52,.065,'Timber')
f=furniture('sacks');x,z=f['x'],f['z']
box('Sack pallet',x,.06,z,1,.12,1.8,'Timber')
for dz in [-.52,.3]:
    lathe('Grain sack',x,.12,z+dz,[(0,0),(.32,0),(.41,.22),(.35,.65),(.20,.83),(.08,.87),(0,.87)],'Sacking',16)
    lathe('Sack tie',x,.94,z+dz,[(.08,0),(.09,.02),(.09,.05),(.08,.06)],'Iron',12)
f=furniture('bench');x,z=f['x'],f['z']
box('Waiting bench',x,.475,z,1.9,.09,.5,'Timber',.015)
for dx in [-.78,.78]:
    for dz in [-.17,.17]:box('Bench leg',x+dx,.22,z+dz,.08,.44,.08,'Timber')
# Flush drainage grate is scenery, with no hidden step in the walking surface.
box('Floor drain',0,.002,-4.8,.6,.006,.42,'Recess')
for dx in [-.24,-.16,-.08,0,.08,.16,.24]:box('Drain bar',dx,.008,-4.8,.025,.008,.40,'Iron')
asset=ROOT/'assets/brewery-room';asset.mkdir(exist_ok=True)
bpy.context.scene.unit_settings.system='METRIC';bpy.context.preferences.filepaths.save_version=0
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(asset/'brewery-room.blend'))
for name,mat in M.items():
    obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials and o.data.materials[0]==mat]
    if not obs:continue
    bpy.ops.object.select_all(action='DESELECT')
    for ob in obs:ob.select_set(True)
    bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name=name
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/brewery-room.glb'),export_format='GLB',export_yup=True,export_cameras=False,export_lights=False)
triangles=sum(len(p.vertices)-2 for o in bpy.context.scene.objects if o.type=='MESH' for p in o.data.polygons)
report={'triangles':triangles,'materialBatches':len([o for o in bpy.context.scene.objects if o.type=='MESH']),'layout':layout}
(asset/'build-report.json').write_text(json.dumps(report,indent=2)+'\n')
print('BREWERY BUILD',triangles,'triangles;',report['materialBatches'],'material batches')
