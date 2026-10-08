"""Continuous, portrait-informed head surfaces for the original seated Snow model.
Dimensions are interpretive rather than a scan or verified reconstruction.
"""
import bpy, math

def build_face(M, head, finish, ellipsoid, limb):
    profile=[(1.292,.010,.039,.026),(1.305,.039,.062,.043),(1.325,.060,.067,.059),
             (1.352,.075,.064,.072),(1.386,.081,.065,.083),(1.418,.081,.073,.087),
             (1.451,.078,.072,.088),(1.487,.074,.073,.084),(1.521,.064,.062,.072),
             (1.548,.044,.042,.050),(1.562,.004,.004,.005)]
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
        z=.021*g(x,y,0,1.426,.010,.034)+.030*g(x,y,0,1.403,.014,.014)
        z+=.009*g(x,y,0,1.319,.030,.012)+.005*g(x,y,0,1.363,.024,.013)
        for side in (-1,1):
            z+=.009*g(x,y,side*.014,1.398,.009,.008)
            z+=.007*g(x,y,side*.043,1.411,.022,.014)
            z-=.010*g(x,y,side*.032,1.445,.021,.012)
            z+=.004*g(x,y,side*.033,1.461,.026,.007)
            z-=.002*g(x,y,side*.026,1.378,.006,.019)
        return z
    def front(x,y):
        rx,fd,_=skull(y)
        return fd*max(0,1-(x/rx)**2)**.42+relief(x,y)
    def surface(name,verts,faces,material):
        mesh=bpy.data.meshes.new(name);mesh.from_pydata([(x,-z,y) for x,y,z in verts],[],faces);mesh.update()
        ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob)
        return finish(ob,name,material,head)
    sides=80;rows=65;verts=[];faces=[]
    for j in range(rows):
        y=profile[0][0]+(profile[-1][0]-profile[0][0])*j/(rows-1);rx,fd,bd=skull(y)
        for i in range(sides):
            a=i*math.tau/sides;c=math.cos(a);x=rx*math.sin(a)
            z=front(x,y) if c>=0 else c*bd
            verts.append((x,y,z))
    for j in range(rows-1):
        for i in range(sides):faces.append((j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i))
    surface('Continuous face',verts,faces,'Skin')
    # Small almond-shaped eyes seated inside the sockets, with skin rims.
    for side in (-1,1):
        cx=side*.032;cy=1.444
        v=[];f=[]
        for row in range(5):
            t=row/4
            for i in range(17):
                u=-1+i/8;x=cx+u*.013
                low=-.0030*(1-u*u);high=.0036*(1-u*u)
                y=cy+low+(high-low)*t
                z=front(x,y)+.003+.001*(1-u*u)*math.sin(math.pi*t)
                v.append((x,y,z))
        for r in range(4):
            for i in range(16):
                a=r*17+i;f.append((a,a+1,a+18,a+17))
        surface('Eye white',v,f,'Eye white')
        v=[(cx,cy,front(cx,cy)+.0048)]
        for i in range(24):
            a=i*math.tau/24;x=cx+math.cos(a)*.0048;y=cy+math.sin(a)*.0029
            v.append((x,y,front(x,y)+.0048))
        surface('Iris',v,[(0,i+1,(i+1)%24+1) for i in range(24)],'Eye')
        for upper in (False,True):
            points=[]
            for i in range(13):
                u=-1+i/6;x=cx+u*.013;y=cy+(.0036 if upper else -.0030)*(1-u*u)
                points.append((x,y,front(x,y)+.003))
            for a,b in zip(points,points[1:]):limb('Upper lid' if upper else 'Lower lid',a,b,.00125,.00125,'Skin',head)
        # Curved, tapered eyebrows, rather than a straight bar.
        for i in range(8):
            a=i/8;b=(i+1)/8
            def brow(t):
                x=side*(.013+t*.041);y=1.461+.0025*math.sin(t*math.pi)-.004*t
                return (x,y,front(x,y)+.001)
            limb('Brow',brow(a),brow(b),.0017*(1-.6*a),.0017*(1-.6*b),'Hair',head)
        ellipsoid('Ear',(side*.082,1.412,-.003),(.013,.029,.017),'Skin',head,16,10)
        ellipsoid('Ear concha',(side*.090,1.412,.009),(.004,.017,.004),'Lip',head,12,8)
        # Narrow nostril opening underneath the continuous nasal wing.
        xx=side*.012;yy=1.393
        ellipsoid('Nostril',(xx,yy,front(xx,yy)+.001),(.0035,.0016,.001),'Lip',head,12,6)
    # Restrained lips, with a shaped upper edge and a thin mouth seam.
    for upper in (True,False):
        v=[];f=[]
        for j in range(4):
            t=j/3
            for i in range(25):
                u=-1+i/12;x=.024*u
                line=1.367+.0012*math.cos(u*math.pi)
                edge=(.0032*(1-u*u)*(1-.35*math.exp(-(u/.2)**2))) if upper else (-.0038*(1-u*u))
                y=line+edge*t;z=front(x,y)+.0008+.0018*math.sin(t*math.pi)*(1-u*u)
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
            low=1.407+.113*max(c,0)+.022*abs(s)*max(c,0)
            y=1.562+(low-1.562)*t;rx,fd,bd=skull(y)
            ridge=.0008*math.sin(a*19+t*9)*math.sin(math.pi*t)
            x=rx*s;z=front(x,y)+.003+ridge if c>=0 else c*(bd+.003+ridge)
            v.append((x+s*.002,y+.0015,z))
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
