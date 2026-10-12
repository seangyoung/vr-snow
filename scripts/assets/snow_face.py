"""Continuous, portrait-informed head surfaces for the original seated Snow model.
Dimensions are interpretive rather than a scan or verified reconstruction.
"""
import bpy, math

def build_face(M, head, finish, ellipsoid, limb, appearance=None):
    appearance=appearance or {}
    age=appearance.get("age", .45)
    nose=appearance.get("nose", 1.0)
    jaw=appearance.get("jaw", 1.0)
    cheeks=appearance.get('cheeks',1.0)
    eye_spacing=appearance.get('eyeSpacing',1.0)
    nose_width=appearance.get('noseWidth',1.0)
    mouth_width=appearance.get('mouthWidth',1.0)
    lip_fullness=appearance.get('lipFullness',1.0)
    brow_slope=appearance.get('browSlope',0.0)
    chin=appearance.get('chin',1.0)
    part=appearance.get('part',.5)
    hairline=appearance.get("hairline", 0.0)
    center_part=appearance.get("hairStyle")=="center-part"
    profile=[(1.292,.010,.039,.026),(1.305,.039,.062,.043),(1.325,.060,.067,.059),
             (1.352,.075,.064,.072),(1.386,.081,.065,.083),(1.418,.081,.073,.087),
             (1.451,.078,.072,.088),(1.487,.074,.073,.084),(1.521,.064,.062,.072),
             (1.548,.044,.042,.050),(1.562,.004,.004,.005)]
    profile=[(y,rx*(1+(jaw-1)*math.exp(-((y-1.34)/.040)**2)+(cheeks-1)*.55*math.exp(-((y-1.40)/.034)**2)),fd,bd) for y,rx,fd,bd in profile]
    def skull(y):
        for k,(a,b) in enumerate(zip(profile,profile[1:])):
            if a[0]<=y<=b[0]:
                t=(y-a[0])/(b[0]-a[0])
                before=profile[max(0,k-1)];after=profile[min(len(profile)-1,k+2)]
                return [(2*t**3-3*t*t+1)*a[i]+(t**3-2*t*t+t)*(b[i]-before[i])/(b[0]-before[0])*(b[0]-a[0])
                        +(-2*t**3+3*t*t)*b[i]+(t**3-t*t)*(after[i]-a[i])/(after[0]-a[0])*(b[0]-a[0]) for i in (1,2,3)]
        return profile[0][1:] if y<profile[0][0] else profile[-1][1:]
    def g(x,y,cx,cy,sx,sy): return math.exp(-((x-cx)/sx)**2-((y-cy)/sy)**2)
    def relief(x,y):
        # Connected nasal bridge, tip, alae, chin, cheeks and recessed sockets.
        z=nose*(.018*g(x,y,0,1.426,.010*nose_width,.034)+.025*g(x,y,0,1.403,.014*nose_width,.014))
        z+=.009*chin*g(x,y,0,1.319,.030,.012)+.005*g(x,y,0,1.363,.024*mouth_width,.013)
        for side in (-1,1):
            z+=.009*g(x,y,side*.014*nose_width,1.398,.009*nose_width,.008)
            z+=.005*cheeks*g(x,y,side*.043,1.411,.022,.018)
            z-=(1-cheeks)*.014*g(x,y,side*.053,1.38,.02,.024)
            z-=age*.0025*g(x,y,side*.035,1.433,.025,.005)
            z-=age*.0015*g(x,y,side*.023,1.383,.004,.021)
            z-=.010*g(x,y,side*.032*eye_spacing,1.445,.021,.012)
            z+=.004*g(x,y,side*.033*eye_spacing,1.461,.026,.007)
            z-=.002*g(x,y,side*.026,1.378,.006,.019)
        return z
    def front(x,y):
        rx,fd,_=skull(y)
        return fd*max(0,1-(x/rx)**2)**.42+relief(x,y)
    def surface(name,verts,faces,material):
        mesh=bpy.data.meshes.new(name);mesh.from_pydata([(x,-z,y) for x,y,z in verts],[],faces);mesh.update()
        ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob)
        return finish(ob,name,material,head)
    sides=72;rows=61;verts=[];faces=[]
    for j in range(rows):
        y=profile[0][0]+(profile[-1][0]-profile[0][0])*j/(rows-1);rx,fd,bd=skull(y)
        for i in range(sides):
            a=i*math.tau/sides;c=math.cos(a);x=rx*math.sin(a)
            z=front(x,y) if c>=0 else c*bd
            verts.append((x,y,z))
    for j in range(rows-1):
        for i in range(sides):faces.append((j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i))
    face=surface('Continuous face',verts,faces,'Skin')
    # A continuous cylindrical chart places the seam behind the head. Keep it
    # through decimation and reserve atlas space for it in the character bake.
    uv=face.data.uv_layers.new(name='UVMap')
    for poly in face.data.polygons:
        columns=[face.data.loops[li].vertex_index%sides for li in poly.loop_indices]
        for li,col in zip(poly.loop_indices,columns):
            row=face.data.loops[li].vertex_index//sides
            # Geometry starts at the nose; shift the chart seam to the back.
            u=(col/sides+.5)%1
            values=[(c/sides+.5)%1 for c in columns]
            if max(values)-min(values)>.5 and u<.5:u+=1
            uv.data[li].uv=(u,row/(rows-1))
    # Small almond-shaped eyes seated inside the sockets, with skin rims.
    for side in (-1,1):
        cx=side*.032*eye_spacing;cy=1.444
        v=[];f=[]
        for row in range(5):
            t=row/4
            for i in range(17):
                u=-1+i/8;x=cx+u*.013
                low=-.0024*(1-u*u);high=.0031*(1-u*u)
                y=cy+low+(high-low)*t
                z=front(x,y)+.0035+.0006*(1-u*u)*math.sin(math.pi*t)
                v.append((x,y,z))
        for r in range(4):
            for i in range(16):
                a=r*17+i;f.append((a,a+1,a+18,a+17))
        surface('Eye white',v,f,'Eye white')
        v=[(cx,cy,front(cx,cy)+.0048)]
        for i in range(24):
            a=i*math.tau/24;x=cx+math.cos(a)*.0041;y=cy+math.sin(a)*.0023
            v.append((x,y,front(x,y)+.0048))
        surface('Iris',v,[(0,i+1,(i+1)%24+1) for i in range(24)],'Eye')
        for upper in (False,True):
            points=[]
            for i in range(13):
                u=-1+i/6;x=cx+u*.013;y=cy+(.0031 if upper else -.0024)*(1-u*u)
                points.append((x,y,front(x,y)+.0035))
            for a,b in zip(points,points[1:]):limb('Upper lid' if upper else 'Lower lid',a,b,.0010,.0010,'Skin',head)
        # Curved, tapered eyebrows, rather than a straight bar.
        for i in range(8):
            a=i/8;b=(i+1)/8
            def brow(t):
                x=side*(.032*eye_spacing-.019+t*.041);y=1.461+.0025*math.sin(t*math.pi)+(-.004+brow_slope)*t
                return (x,y,front(x,y)+.001)
            limb('Brow',brow(a),brow(b),.0017*(1-.6*a),.0017*(1-.6*b),'Hair',head)
        ellipsoid('Ear',(side*.082,1.412,-.003),(.013,.029,.017),'Skin',head,16,10)
        ellipsoid('Ear concha',(side*.090,1.412,.009),(.004,.017,.004),'Lip',head,12,8)
        # Narrow nostril opening underneath the continuous nasal wing.
        xx=side*.012*nose_width;yy=1.393
        ellipsoid('Nostril',(xx,yy,front(xx,yy)+.001),(.0035,.0016,.001),'Lip',head,12,6)
    # Restrained lips, with a shaped upper edge and a thin mouth seam.
    for upper in (True,False):
        v=[];f=[]
        for j in range(4):
            t=j/3
            for i in range(25):
                u=-1+i/12;x=.024*mouth_width*u
                line=1.367+.0012*math.cos(u*math.pi)
                edge=(.0032*(1-u*u)*(1-.35*math.exp(-(u/.2)**2))) if upper else (-.0038*(1-u*u))
                y=line+edge*t*lip_fullness;z=front(x,y)+.0008+.0018*math.sin(t*math.pi)*(1-u*u)
                v.append((x,y,z))
        for j in range(3):
            for i in range(24):
                a=j*25+i;f.append((a,a+1,a+26,a+25))
        surface('Upper lip' if upper else 'Lower lip',v,f if upper else [tuple(reversed(face)) for face in f],'Lip')
    # Scalp follows the same skull, with restrained swept ridges and a receding hairline.
    v=[];f=[];sides=80;rows=18
    for j in range(rows):
        t=j/(rows-1)
        for i in range(sides):
            a=i*math.tau/sides;c=math.cos(a);s=math.sin(a)
            low=(1.389 if center_part else 1.407)+(.099+hairline)*max(c,0)+.03*abs(s)*max(c,0)
            y=1.562+(low-1.562)*t;rx,fd,bd=skull(y)
            ridge=.0013*math.sin(a*23+t*10)*math.sin(math.pi*t)
            ridge-=.0015*math.exp(-((a-(0 if center_part else part))/.05)**2)*max(c,0)
            x=rx*s;z=front(x,y)+.0025+ridge if c>=0 else c*(bd+.0025+ridge)
            v.append((x+s*(.005 if center_part else .002),y+.002,z))
    for j in range(rows-1):
        for i in range(sides):f.append((j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i))
    surface('Swept hair',v,[tuple(reversed(face)) for face in f],'Hair')
    # Surface patches follow temples and taper toward the jaw: no cylinder sideburns.
    for side in (-1,1):
        v=[];f=[]
        for j in range(10):
            t=j/9;y=1.383+t*.092;rx,fd,bd=skull(y)
            for i in range(5):
                a=side*(1.03+i*.075+.09*(1-t));c=math.cos(a);x=rx*math.sin(a)
                v.append((x+side*.001,y,front(x,y)+.0015))
        for j in range(9):
            for i in range(4):
                a=j*5+i;f.append((a,a+1,a+6,a+5))
        surface('Sideburn',v,f if side>0 else [tuple(reversed(face)) for face in f],'Hair')
