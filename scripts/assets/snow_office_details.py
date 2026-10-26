"""Original low-poly office props and an interpretive exterior, in Three.js metres.
Period references and limits: docs/snow-office-window-and-instruments.md.
"""
import bpy, math
from mathutils import Vector


def mesh_object(name, verts, faces, mat):
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata([(x,-z,y) for x,y,z in verts],[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def turned(name, origin, axis, profile, mat, segments=24):
    """Surface of revolution; profile can return along an inner wall for hollow ends."""
    axis=Vector(axis).normalized()
    u=axis.cross(Vector((0,1,0)) if abs(axis.y)<.9 else Vector((1,0,0))).normalized()
    v=axis.cross(u);origin=Vector(origin)
    verts=[origin+axis*t+r*(u*math.cos(2*math.pi*j/segments)+v*math.sin(2*math.pi*j/segments))
           for t,r in profile for j in range(segments)]
    faces=[(i*segments+j,i*segments+(j+1)%segments,(i+1)*segments+(j+1)%segments,(i+1)*segments+j)
           for i in range(len(profile)-1) for j in range(segments)]
    obj=mesh_object(name,verts,faces,mat)
    for poly in obj.data.polygons:poly.use_smooth=True
    return obj


def tube(name, points, radius, mat, sides=10):
    verts=[]
    for i,p in enumerate(points):
        if (Vector(points[0])-Vector(points[-1])).length<1e-7 and i in (0,len(points)-1):
            tangent=(Vector(points[1])-Vector(points[-2])).normalized()
        else:
            tangent=(Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])).normalized()
        u=tangent.cross(Vector((0,1,0)) if abs(tangent.y)<.9 else Vector((1,0,0))).normalized();v=tangent.cross(u)
        for j in range(sides):
            angle=2*math.pi*j/sides
            verts.append(Vector(p)+radius*(u*math.cos(angle)+v*math.sin(angle)))
    faces=[(i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j)
           for i in range(len(points)-1) for j in range(sides)]
    obj=mesh_object(name,verts,faces,mat)
    for poly in obj.data.polygons:poly.use_smooth=True
    return obj


def window_exterior(box, cylinder, material, materials, root):
    # The opaque luminous pane is replaced by geometry at different depths.
    # This is a generic Georgian London prospect, not Snow's surveyed street view.
    material('Exterior brick','ffffff')
    mat=materials['Exterior brick'];bs=mat.node_tree.nodes.get('Principled BSDF')
    tex=mat.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image=bpy.data.images.load(str(root/'assets/broad-street/finish-textures/stock-brick.jpg'),check_existing=True)
    mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
    bs=materials['Daylight'].node_tree.nodes.get('Principled BSDF')
    # The existing daylight material is now only the distant sky enclosure.
    bs.inputs['Base Color'].default_value=(.56,.65,.68,1)
    bs.inputs['Emission Color'].default_value=(.56,.65,.68,1)
    bs.inputs['Emission Strength'].default_value=.7
    box('Distant overcast sky',45,15,0,.2,100,200,'Daylight')
    for zz in [-90,90]:box('Sky side',24,15,zz,42,100,.2,'Daylight')
    box('Sky overhead',24,40,0,42,.2,180,'Daylight')
    box('Street ground',23,-.53,0,40,.15,180,'Recess')
    box('Near pavement',4.15,-.38,0,2.5,.20,22,'Ceiling')
    box('Far pavement',12.4,-.38,0,2.0,.20,24,'Ceiling')
    for x in [3.35,4.1,4.85,11.8,12.5,13.2]:
        for z in range(-11,12):box('Paving joint',x,-.274,z,.014,.004,1,'Oak')
    for z in range(-11,12):
        box('Near paving joint',4.15,-.274,z,2.5,.004,.014,'Oak')
        box('Far paving joint',12.4,-.274,z,2,.004,.014,'Oak')
    # An area railing gives strong near-field parallax below the sill.
    for z in [i*.24 for i in range(-19,20)]:
        cylinder('Area railing',3.6,.19,z,.014,.96,'Recess')
        cylinder('Railing finial',3.6,.70,z,.023,.065,'Recess')
    for y in [-.05,.57]:box('Area rail',3.6,y,0,.035,.035,9.4,'Recess')
    for index,z in enumerate([-8.1,-2.7,2.7,8.1]):
        height=7.6+(.35 if index%2 else 0)
        x=14.1+(.35 if index%2 else 0)
        body=box('Opposite Georgian house',x+1,height/2-.3,z,2,height,5.35,'Exterior brick')
        # Metric UVs prevent stretched mortar on differently sized surfaces.
        uv=body.data.uv_layers.active
        for p in body.data.polygons:
            axes=[1,2] if abs(p.normal.x)>.5 else [0,2] if abs(p.normal.y)>.5 else [0,1]
            for li in p.loop_indices:
                co=body.matrix_world @ body.data.vertices[body.data.loops[li].vertex_index].co
                uv.data[li].uv=(co[axes[0]]/1.92,co[axes[1]]/1.92)
        for y in [1.25,3.65,5.95]:
            for dz in [-1.45,1.45]:
                zz=z+dz
                box('Exterior sash recess',x-.022,y,zz,.04,1.65,1.10,'Recess')
                box('Exterior window reflection',x-.05,y,zz,.015,1.48,.94,'Blue binding')
                for rz in [-.55,0,.55]:box('Exterior sash stile',x-.09,y,zz+rz,.07,1.68,.045,'Trim')
                for ry in [-.84,0,.84]:box('Exterior sash rail',x-.09,y+ry,zz,.07,.045,1.15,'Trim')
                box('Exterior stone sill',x-.13,y-.90,zz,.30,.12,1.30,'Ceiling')
                box('Exterior lintel',x-.08,y+.92,zz,.16,.18,1.30,'Ceiling')
        box('Exterior entrance',x-.04,.70,z,.065,2.0,1.0,'Green leather')
        for zz in [-.58,.58]:box('Entrance surround',x-.1,.70,z+zz,.16,2.1,.11,'Ceiling')
        box('Entrance lintel',x-.1,1.81,z,.18,.12,1.3,'Ceiling')
        box('Parapet cap',x+.05,height-.28,z,.28,.15,5.42,'Ceiling')
        box('Slate roof',x+1,height-.08,z,2.1,.24,5.4,'Blue binding')
        for dz in [-2.35,2.35]:
            box('Chimney stack',x+1,height+.46,z+dz,.65,1.0,.60,'Exterior brick')
            for dx in [-.16,.16]:cylinder('Chimney pot',x+1+dx,height+1.08,z+dz,.10,.32,'Red binding')
    # Near neighboring walls frame oblique views, without becoming walkable space.
    for zz in [-6.2,6.2]:
        box('Neighbor return wall',6.9,3.2,zz,6.6,7,.28,'Plaster')
        box('Neighbor coping',6.9,6.74,zz,6.75,.15,.40,'Ceiling')


def medical_instruments(box, cylinder, materials, x, z):
    # Original geometry after the RCP photograph of Richardson's apparatus,
    # designed by Snow in 1847. Proportions are interpreted, not measured.
    base=.837;cx=x-.11;cz=z+.015
    profile=[(0,0),(0,.080),(.004,.090),(.012,.090),(.017,.080),
             (.076,.080),(.080,.087),(.088,.087),(.092,.075),(.092,0)]
    turned('Ether chamber',(cx,base,cz),(0,1,0),profile,materials['Recess'],40)
    turned('Chamber rolled rim',(cx,base+.078,cz),(0,1,0),
           [(0,.085),(.002,.088),(.005,.088),(.007,.085)],materials['Pewter'],40)
    # The brass outlet stands above the dark, low drum; the second neck is open.
    coupling=(cx-.018,base+.091,cz-.024)
    turned('Ether outlet',coupling,(0,1,0),
           [(0,.021),(.009,.021),(.012,.014),(.050,.014),(.053,.021),
            (.062,.021),(.066,.016),(.095,.016)],materials['Brass'],24)
    box('Outlet thumb wing',cx+.003,base+.151,cz-.024,.066,.008,.014,'Brass',.002)
    turned('Ether filler neck',(cx+.040,base+.091,cz+.025),(0,1,0),
           [(0,.016),(.022,.016),(.024,.019),(.029,.019),(.029,.012),(.007,.012)],materials['Brass'],24)
    # Long cloth-covered loop. Parallel transport prevents the tube's cross-section
    # flipping at its crest; small checks use existing materials, no extra texture.
    start=Vector((coupling[0],base+.185,coupling[2]))
    end=Vector((x+.135,.880,z+.130))
    a=Vector((cx-.10,1.50,z-.015));b=Vector((x+.48,1.24,z+.20))
    points=[]
    for i in range(81):
        t=i/80;points.append((1-t)**3*start+3*(1-t)**2*t*a+3*(1-t)*t*t*b+t**3*end)
    sides=12;verts=[];u=Vector((0,0,1))
    for i,p in enumerate(points):
        tangent=(points[min(i+1,80)]-points[max(0,i-1)]).normalized()
        u=(u-tangent*u.dot(tangent)).normalized();v=tangent.cross(u)
        for j in range(sides):
            angle=j*2*math.pi/sides
            verts.append(p+.016*(u*math.cos(angle)+v*math.sin(angle)))
    checks=[[],[],[]]
    for i in range(80):
        for j in range(sides):
            # Muted blue/grey cloth with a narrow, warm crosshatch.
            material=1 if i%4==0 and j%3==0 else (2 if i%4==0 or j%3==0 else 0)
            checks[material].append((i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j))
    # Keep shared vertices through the light bake: separate checker fragments
    # would create thousands of tiny UV islands and visibly black atlas seams.
    o=mesh_object('Woven ether hose',verts,[f for group in checks for f in group],materials['Blue binding'])
    for mat in ['Paper','Oak']:o.data.materials.append(materials[mat])
    offset=0
    for index,faces in enumerate(checks):
        for p in list(o.data.polygons)[offset:offset+len(faces)]:
            p.material_index=index;p.use_smooth=True
        offset+=len(faces)
    # Hollow pear-shaped facepiece, tipped towards the visitor, with padded edge.
    mx=x+.075;mz=z+.170;n=32
    def mask_point(px,py,pz):
        angle=math.radians(33)
        return (mx+px,.864+py*math.cos(angle)-pz*math.sin(angle),
                mz+py*math.sin(angle)+pz*math.cos(angle))
    rings=[(0,.36),(.017,.62),(.048,1),(.048,.88),(.017,.50),(.005,.28),(.004,0)]
    verts=[]
    for yy,scale in rings:
        for i in range(n):
            a=2*math.pi*i/n;pear=1-.18*math.cos(a)
            verts.append(mask_point(.049*scale*math.sin(a)*pear,yy,.071*scale*math.cos(a)))
    faces=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(rings)-1) for i in range(n)]
    o=mesh_object('Ether facepiece',verts,faces,materials['Recess'])
    for p in o.data.polygons:p.use_smooth=True
    rim=[mask_point(.049*math.sin(a)*(1-.18*math.cos(a)),.048,.071*math.cos(a)) for a in [i*2*math.pi/48 for i in range(49)]]
    tube('Padded facepiece rim',rim,.007,materials['Red binding'],8)
    tube('Facepiece inlet',[end,Vector(mask_point(.025,.005,-.005))],.014,materials['Brass'],12)
    # Small metal retaining bow under the padded facepiece.
    bow=[mask_point(.053*math.sin(a),.029,.073*math.cos(a)) for a in [i*math.pi/20 for i in range(21)]]
    tube('Facepiece retaining bow',bow,.0025,materials['Pewter'],6)
    # Open red-lined timber storage case. Distinct walls leave a visible recess.
    bx=x-.43;bz=z-.015
    box('Instrument case base',bx,.844,bz,.30,.016,.24,'Dark walnut',.003)
    box('Instrument case lining',bx,.854,bz,.276,.005,.216,'Red binding')
    for dx in [-.144,.144]:box('Instrument case wall',bx+dx,.872,bz,.012,.050,.24,'Dark walnut',.002)
    for dz in [-.114,.114]:box('Instrument case wall',bx,.872,bz+dz,.28,.050,.012,'Dark walnut',.002)
    box('Instrument case open lid',bx,1.014,bz-.123,.30,.28,.018,'Dark walnut',.004)
    box('Instrument case lid lining',bx,1.014,bz-.112,.27,.245,.005,'Red binding')
    turned('Case maker disc',(bx,1.046,bz-.108),(0,0,1),[(0,.015),(.002,.015),(.002,0)],materials['Paper'],24)
    for dx in [-.10,.10]:box('Case hinge',bx+dx,.891,bz-.113,.032,.014,.024,'Brass')
    box('Case clasp',bx,.871,bz+.123,.025,.027,.008,'Brass',.002)
    box('Case keyhole',bx,.873,bz+.128,.004,.009,.002,'Recess')
    box('Case instrument',bx,.861,bz,.21,.008,.027,'Oak',.002)
    box('Case instrument scale',bx,.866,bz,.18,.002,.012,'Paper')


def desk_stethoscope(box, materials):
    # A single-ear wooden instrument, 238 mm long, with hollow bell and ear plate.
    origin=(-1.53,.859,-1.13);axis=(0,0,1)
    profile=[(0,.004),(0,.0255),(.005,.0255),(.009,.013),(.015,.011),(.035,.008),
             (.18,.008),(.20,.012),(.226,.022),(.238,.024),(.238,.020),(.225,.018),(.20,.006),(.02,.004),(0,.004)]
    turned('Wooden monaural stethoscope',origin,axis,profile,materials['Dark walnut'],32)
    for t,r in [(.012,.012),(.182,.010)]:
        turned('Stethoscope pale collar',(origin[0],origin[1],origin[2]+t),axis,[(0,r),(.006,r)],materials['Paper'])
    # A ruled observation sheet makes the instrument part of an active workspace.
    box('Clinical observation sheet',-.03,.834,-.91,.31,.004,.22,'Paper')
    for i in range(6):box('Observation note lines',-.03,.837,-.99+i*.028,.23-.02*(i%3),.002,.002,'Oak')
