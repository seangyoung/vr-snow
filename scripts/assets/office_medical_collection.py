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

    # Compact leather lancet case, three folded blades retained together as a pickup.
    lx=-1.96;lz=2.77
    box('Lancet case shell',lx,1.338,lz,.15,.019,.105,'Dark walnut',.005)
    box('Lancet case lining',lx,1.350,lz,.137,.005,.092,'Red binding')
    box('Lancet case lid',lx,1.354,lz+.087,.15,.008,.065,'Dark walnut',.003)
    for dx in [-.045,0,.045]:
        box('Lancet handle',lx+dx,1.357,lz+.011,.017,.006,.063,'Recess',.003)
        vertices=[(lx+dx+a,y,lz+b) for y in [1.358,1.360] for a,b in [(-.007,-.016),(.007,-.016),(0,-.041)]]
        mesh_object('Lancet blade',vertices,[(0,1,2),(5,4,3),(0,3,4,1),(1,4,5,2),(2,5,3,0)],materials['Pewter'])
        cylinder('Lancet pivot',lx+dx,1.361,lz-.010,.003,.003,'Brass')
    box('Lancet case clasp',lx,1.341,lz-.055,.022,.014,.004,'Brass')

    # Sick syphon rests flat: curved drinking tube, rim hook and pierced strainer.
    sx=-1.73;sz=2.76
    points=[(sx-.038,1.343,sz+.047),(sx-.038,1.343,sz-.020)]
    points += [(sx+.030*math.cos(a),1.343,sz-.020+.030*math.sin(a)) for a in [math.pi+j*math.pi/16 for j in range(17)]]
    points += [(sx+.030,1.343,sz+.045)]
    tube('Sick syphon tube',points,.004,materials['Pewter'],8)
    tube('Sick syphon hook',[(sx-.035,1.343,sz+.012),(sx-.018,1.343,sz+.010),(sx-.018,1.343,sz+.030)],.0025,materials['Pewter'],6)
    cylinder('Sick syphon strainer',sx-.038,1.343,sz+.045,.011,.009,'Pewter')
    for dx,dz in [(0,0),(-.005,0),(.005,0),(0,-.005),(0,.005)]:
        verts=[(sx-.038+dx+.0015*math.sin(j*math.pi/4),1.3481,sz+.045+dz+.0015*math.cos(j*math.pi/4)) for j in range(8)]
        mesh_object('Strainer perforation',verts,[tuple(range(8))],materials['Recess'])

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
