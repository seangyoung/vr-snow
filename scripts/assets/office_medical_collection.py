"""Pick-up medical collection for the 1854 office; original interpretive geometry.
Sources, date limits and rebuild instructions: docs/office-medical-collection.md.
"""
import bpy, math
from snow_office_details import mesh_object, turned, tube


def medical_collection(box, cylinder, materials, root):
    # One shared label atlas, packed in the GLB, for five distinct sealed bottles.
    mat=bpy.data.materials.new('Medicine labels');mat.use_nodes=True
    bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.9
    tex=mat.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image=bpy.data.images.load(str(root/'assets/snow-office/medicine-labels.png'),check_existing=True)
    mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
    materials[mat.name]=mat
    def bottle(name,x,y,z,index,r=.035,front=1):
        turned(name+' body',(x,y,z),(0,1,0),
               [(0,0),(0,r*.88),(.006,r),(.105,r),(.126,r*.49),(.151,r*.49),(.154,r*.57)],
               materials['Green binding' if index in (0,3) else 'Recess'],12)
        cylinder(name+' stopper',x,y+.163,z,r*.47,.022,'Oak')
        turned(name+' lip',(x,y+.148,z),(0,1,0),[(0,r*.54),(.005,r*.59),(.009,r*.59)],materials['Pewter'],12)
        verts=[]
        for yy in [.026,.099]:
            for j in range(9):
                angle=-.96+j*1.92/8
                verts.append((x+math.sin(angle)*(r+.0007),y+yy,z+front*math.cos(angle)*(r+.0007)))
        faces=[(j,j+1,10+j,9+j) if front==1 else (9+j,10+j,j+1,j) for j in range(8)]
        ob=mesh_object(name+' label',verts,faces,mat);uv=ob.data.uv_layers.new(name='UVMap')
        for poly in ob.data.polygons:
            for li in poly.loop_indices:
                vi=ob.data.loops[li].vertex_index
                u=(vi%9)/8 if front==1 else 1-(vi%9)/8
                uv.data[li].uv=((index%3+u)/3,1-(index//3+1-(vi//9))/2)
        for p in ob.data.polygons:p.use_smooth=True
    for index,(name,x) in enumerate([('Ether bottle',1.43),('Chloroform bottle',1.57),('Ethyl nitrate bottle',1.71),('Chloric ether bottle',1.85)]):
        bottle(name,x,.825,-2.71,index)
    bottle('Castor oil bottle',-2.53,1.32,2.85,4,front=-1)

    # The cabinet's existing top supplies a second working surface; no new obstacle.
    box('Medical cabinet cloth',-1.94,1.324,2.80,1.02,.008,.35,'Paper')
    def spoon(name,x,z,length=.16):
        # Closed outer/inner shell, concave bowl and a flattened handle.
        n=16;verts=[]
        for radius,y in [(0,1.333),(1,1.344),(1,1.346),(.84,1.344),(0,1.336)]:
            for j in range(n):
                a=j*2*math.pi/n;verts.append((x+radius*.019*math.sin(a),y,z+radius*.029*math.cos(a)))
        faces=[(k*n+j,k*n+(j+1)%n,(k+1)*n+(j+1)%n,(k+1)*n+j) for k in range(4) for j in range(n)]
        ob=mesh_object(name+' bowl',verts,faces,materials['Pewter'])
        for p in ob.data.polygons:p.use_smooth=True
        box(name+' stem',x,1.340,z+.029+(length-.058)/2,.010,.003,length-.058,'Pewter',.001)
        cylinder(name+' terminal',x,1.340,z+length-.029,.009,.003,'Pewter')
    spoon('Medicine spoon',-2.38,2.69)
    spoon('Small medicine spoon',-2.29,2.70,.125)

    # Wishbone scraper: broad rounded end, two flat arms and small grip terminals.
    sx=-2.16;sz=2.78
    path=[(sx+.020*math.sin(a),1.337,sz+.050*math.cos(a)) for a in [math.pi/2+j*math.pi/20 for j in range(21)]]
    tube('Tongue scraper bow',path,.0028,materials['Pewter'],6)
    for dx in [-.020,.020]:
        box('Tongue scraper arm',sx+dx,1.337,sz+.027,.005,.003,.054,'Pewter')
        box('Tongue scraper grip',sx+dx,1.337,sz+.059,.008,.004,.012,'Pewter',.002)

    # Open leather wallet: recessed fitted slots, separate horn scales, steel tangs
    # and double-edged blades (38-44 mm), rather than oversized triangular tips.
    lx=-1.98;lz=2.745
    box('Lancet case shell',lx,1.339,lz,.178,.024,.144,'Dark walnut',.005)
    box('Lancet case lining',lx,1.352,lz,.163,.006,.130,'Red binding',.003)
    for dx in [-.083,.083]:box('Lancet case piping',lx+dx,1.356,lz,.004,.004,.134,'Dark walnut',.001)
    for dz in [-.065,.065]:box('Lancet case piping',lx,1.356,lz+dz,.166,.004,.004,'Dark walnut',.001)
    lid=box('Lancet case lid',lx,1.394,lz+.112,.178,.010,.112,'Dark walnut',.004)
    lid.rotation_euler.x=math.radians(-40)
    pad=box('Lancet lid lining',lx,1.398,lz+.108,.161,.004,.094,'Red binding',.002)
    pad.rotation_euler.x=math.radians(-40)
    for dx in [-.052,.052]:box('Lancet case hinge',lx+dx,1.357,lz+.072,.025,.007,.009,'Brass',.002)
    box('Lancet case clasp',lx,1.344,lz-.074,.024,.014,.005,'Brass',.002)
    # Small stitches distinguish leather from a plain wooden slab.
    for j in range(12):
        for dz in [-.060,.060]:box('Lancet case stitching',lx-.071+j*.013,1.359,lz+dz,.004,.0008,.001,'Paper')
    def outline_prism(name,outline,bottom,top,mat):
        verts=[(x,y,z) for y in [bottom,top] for x,z in outline];n=len(outline)
        return mesh_object(name,verts,[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+
            [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],materials[mat])
    for index,dx in enumerate([-.054,0,.054]):
        cx=lx+dx;pz=lz+.014
        box('Lancet fitted slot',cx,1.356,lz,.025,.001,.116,'Recess',.003)
        # Two gently tapered protective scales, joined by a pivot and end rivet.
        outline=[(cx-.005,pz-.006),(cx+.005,pz-.006),(cx+.007,pz+.006),
                 (cx+.0055,pz+.052),(cx+.002,pz+.059),(cx-.003,pz+.059),(cx-.006,pz+.051),(cx-.007,pz+.006)]
        outline_prism('Lancet handle',outline,1.357,1.359,'Recess')
        outline_prism('Lancet handle',outline,1.362,1.364,'Recess')
        box('Lancet spine',cx,1.3605,pz+.029,.002,.002,.050,'Pewter')
        length=.038+index*.003
        blade=[(cx-.0025,pz+.004),(cx+.0025,pz+.004),(cx+.003,pz-.009),
               (cx+.0055,pz-.019),(cx,pz-length),(cx-.0055,pz-.019),(cx-.003,pz-.009)]
        # A raised central ridge catches the light along both sharpened edges.
        verts=[(x,1.360,z) for x,z in blade]+[(cx,1.363,pz-.018)]
        n=len(blade)
        mesh_object('Lancet blade',verts,[(i,(i+1)%n,n) for i in range(n)]+[tuple(range(n-1,-1,-1))],materials['Pewter'])
        cylinder('Lancet pivot',cx,1.365,pz,.0025,.002,'Pewter')
        cylinder('Lancet end rivet',cx,1.365,pz+.051,.0015,.0015,'Brass')

    # S-shaped silver feeding pipe with flared, flattened intake and a rim clip.
    # Slightly enlarged (~15 cm across) for close inspection; not a measured replica.
    from mathutils import Vector
    sx=-1.72;sz=2.77;n=28;sides=12;verts=[];points=[]
    for i in range(n+1):
        t=i/n
        p=Vector((sx-.074+.148*t,1.351+.006*math.cos(math.pi*t),sz+.028*math.sin(math.pi*2*t)))
        tangent=Vector((.148,-.006*math.pi*math.sin(math.pi*t),.056*math.pi*math.cos(math.pi*2*t))).normalized()
        u=tangent.cross(Vector((0,1,0))).normalized();v=tangent.cross(u)
        # Broad oval strainer tapers into a round, continuous drinking tube.
        width=.005+.013*max(0,1-t/.28)**2
        height=.005+.001*max(0,1-t/.25)
        points.append((p,tangent,u,v))
        for j in range(sides):
            angle=2*math.pi*j/sides;verts.append(p+u*width*math.cos(angle)+v*height*math.sin(angle))
    faces=[(i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j) for i in range(n) for j in range(sides)]
    body=mesh_object('Sick syphon tube',verts,faces,materials['Pewter'])
    for poly in body.data.polygons:poly.use_smooth=True
    # Rolled, hollow mouthpiece with a visible inner wall.
    end,tangent,_,_=points[-1]
    turned('Sick syphon mouthpiece',end,tangent,[(0,.005),(.004,.0054),(.005,.0051),(.005,.0036),(-.006,.0036)],materials['Pewter'],12)
    # The pierced cover is an elliptical silver plate with actual open apertures.
    p,tangent,u,v=points[0]
    count=24
    capverts=[p-tangent*depth+u*(.018*math.cos(j*2*math.pi/count))+v*(.006*math.sin(j*2*math.pi/count))
              for depth in [0,.001] for j in range(count)]
    capfaces=[tuple(range(count)),tuple(range(2*count-1,count-1,-1))]
    capfaces += [(j,j+count,(j+1)%count+count,(j+1)%count) for j in range(count)]
    plate=mesh_object('Sick syphon strainer',capverts,capfaces,materials['Pewter'])
    # Boolean holes in the thin cap are real geometry, visible from both sides.
    for row in [-1,0,1]:
        for col in range(-3,4):
            if abs(col)==3 and row:continue
            center=p+u*(col*.004)+v*(row*.003)
            bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=.00105,depth=.008,
                location=(center.x,-center.z,center.y))
            cutter=bpy.context.object
            direction=Vector((-tangent.x,tangent.z,-tangent.y))
            cutter.rotation_euler=direction.to_track_quat('Z','Y').to_euler()
            mod=plate.modifiers.new('Pierced strainer','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
            bpy.context.view_layer.objects.active=plate;bpy.ops.object.modifier_apply(modifier=mod.name)
            bpy.data.objects.remove(cutter,do_unlink=True)
    # A flattened clip doubles back along the underside to catch a cup rim.
    clip=[(sx+.018,1.345,sz-.019),(sx+.018,1.335,sz-.019),(sx-.026,1.335,sz+.006)]
    tube('Sick syphon hook',clip,.0022,materials['Pewter'],6)

    # Three eyed suture needles in an open padded case: straight and curved forms.
    nx=-1.51;nz=2.78
    box('Needle case base',nx,1.338,nz,.13,.018,.095,'Green leather',.004)
    box('Needle case pad',nx,1.350,nz,.116,.006,.080,'Red binding')
    for index,offset in enumerate([-.036,0,.036]):
        if index==0:points=[(nx+offset,1.356,nz-.026),(nx+offset,1.356,nz+.026)]
        else:points=[(nx+offset+.015*math.sin(j*math.pi/16),1.356,nz-.026+.052*j/16) for j in range(17)]
        tube('Suture needle',points,.001,materials['Pewter'],5)
        eye=[(points[-1][0]+.0017*math.sin(a),1.356,points[-1][2]+.003+.003*math.cos(a)) for a in [j*2*math.pi/12 for j in range(13)]]
        tube('Needle eye',eye,.0006,materials['Pewter'],4)
    box('Needle case flap',nx,1.344,nz+.067,.13,.005,.038,'Green leather',.002)

    # Experimental thermometer on the medical table, separate from the apparatus.
    tx=1.56;tz=-2.54
    box('Thermometer backing',tx,.834,tz,.043,.015,.215,'Dark walnut',.003)
    box('Thermometer scale',tx,.843,tz,.034,.003,.201,'Paper')
    tube('Thermometer stem',[(tx,.847,tz-.084),(tx,.847,tz+.079)],.0025,materials['Pewter'],6)
    cylinder('Thermometer bulb',tx,.847,tz+.084,.006,.005,'Pewter')
    for j in range(17):
        for side in [-1,1]:box('Thermometer graduation',tx+side*.010,.8455,tz-.077+j*.009,.011 if j%4==0 else .006,.001,.001,'Recess')
