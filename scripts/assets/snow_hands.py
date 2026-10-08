"""Low-poly resting hands with flattened palms and articulated, tapered digits."""
import bpy, math, bmesh


def build_hands(finish, upper):
    def tube(name, sections, material, sides=12):
        # Each section: x, height, forward position, half-width, half-thickness.
        verts=[];faces=[]
        for x,y,z,rx,ry in sections:
            for i in range(sides):
                a=i*math.tau/sides;c=math.cos(a);s=math.sin(a)
                # A softened rectangular section retains a broad back of the hand.
                verts.append((x+rx*math.copysign(abs(c)**.7,c),-z,y+ry*math.copysign(abs(s)**.7,s)))
        for j in range(len(sections)-1):
            for i in range(sides):faces.append((j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i))
        faces.extend([tuple(reversed(range(sides))),tuple((len(sections)-1)*sides+i for i in range(sides))])
        mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
        bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(mesh);bm.free()
        ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob)
        return finish(ob,name,material,upper)
    for side in (-1,1):
        cx=side*.20
        tube('Tailored shirt cuff',[(cx,.850,.505,.027,.020),(cx,.849,.530,.026,.018)],'Shirt')
        tube('Hand palm',[(cx,.849,.522,.021,.013),(cx,.846,.546,.025,.014),
                         (cx,.844,.571,.034,.013),(cx,.842,.591,.035,.012),
                         (cx,.840,.605,.032,.010)],'Skin',16)
        # Index to little finger, slightly separated and flexed onto the desk.
        for i,length in enumerate((.067,.076,.069,.053)):
            x=cx+side*(-.025+i*.017)
            z=.596-abs(i-1)*.003;w=(.0082,.0086,.0080,.0067)[i]
            spread=side*(i-1.3)*.003
            tube('Hand finger',[(x,.840,z,w,.009),(x+spread*.25,.838,z+length*.30,w*.96,.0085),
                               (x+spread*.55,.835,z+length*.60,w*.84,.0075),
                               (x+spread,.833,z+length*.86,w*.72,.006),
                               (x+spread,.832,z+length,w*.25,.003)],'Skin')
        # Thumb angles inward from the palm; its tip lies alongside the index.
        tube('Hand thumb',[(cx-side*.020,.843,.552,.013,.011),
                           (cx-side*.038,.838,.566,.012,.009),
                           (cx-side*.051,.834,.588,.009,.007),
                           (cx-side*.054,.832,.612,.006,.005),
                           (cx-side*.054,.832,.618,.002,.002)],'Skin')
