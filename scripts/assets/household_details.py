"""Distinct domestic furnishings and original PBR finishes; no downloaded imagery.
Used by build_household_room.py. Coordinates follow the app (Y up, Z forward).
"""
import bpy, math
import numpy as np
from pathlib import Path
from interior_finish import png

def add_details(key, layout, M, box, cylinder, vessel):
    def f(name): return next(f for f in layout['furniture'] if f['id']==name)
    def rod(name,a,b,r,mat):
        from mathutils import Vector
        a,b=Vector((a[0],-a[2],a[1])),Vector((b[0],-b[2],b[1]))
        bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=r,depth=(b-a).length,location=(a+b)/2)
        o=bpy.context.object;o.name=name;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();o.data.materials.append(M[mat]);return o
    def cloth(name,x,y,z,w,d,mat):
        # A rounded, irregular folded surface, not a perfectly flat rectangle.
        n,m=24,32;verts=[];faces=[]
        for j in range(m+1):
            v=j/m
            for i in range(n+1):
                u=i/n;edge=max(0,(abs(u-.5)-.44)/.06)
                yy=y+.009*math.sin(u*32+v*5)+.006*math.sin(v*27)-.035*edge
                verts.append((x+(u-.5)*w,-z-(v-.5)*d,yy))
        for j in range(m):
            for i in range(n):
                a=j*(n+1)+i;faces.append((a,a+n+1,a+n+2,a+1))
        me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);me.materials.append(M[mat])
        for p in me.polygons:p.use_smooth=True
        return o
    bed=f('bed');table=f('table');chest=f('chest');hearth=f('hearth');w=layout['width']
    # Replace rigid coverlets with draped cloth; the sickroom receives its occupied blanket separately.
    for o in list(bpy.context.scene.objects):
        if o.name.startswith(('Wool coverlet','Hanging coverlet','Coverlet seam')):bpy.data.objects.remove(o,do_unlink=True)
    if key!='household':cloth('Wool coverlet',bed['x'],.66,bed['z']+.26,1.23,1.52,'Blanket')
    # Actual depth outside an open window aperture: neighboring masonry and recessed panes.
    outside=w/2+2.8
    box('Courtyard opposite wall',outside,1.9,-1.62,.18,4.8,5.5,'Brick')
    for row in range(2):
        for col in range(3):
            zz=-3.2+col*1.65;yy=.9+row*2.0
            box('Opposite window recess',outside-.105,yy,zz,.025,1.35,.82,'Recess')
            for off in [-.44,.44]:box('Opposite sash',outside-.14,yy,zz+off,.05,1.44,.055,'Trim')
            for off in [-.7,0,.7]:box('Opposite sash rail',outside-.15,yy+off,zz,.05,.05,.93,'Trim')
            box('Opposite sill',outside-.22,yy-.74,zz,.28,.07,1.02,'Walnut')
    # A few objects remain at different stages of use; keep all additions within existing furniture footprints.
    x,z=hearth['x'],hearth['z']
    vessel('Chamber candle dish',x+.43,1.48,z,[(0,0),(.09,0),(.1,.015),(.09,.027),(0,.027)],'Pottery')
    cylinder('Candle stub',x+.43,1.55,z,.022,.12,'Linen')
    cylinder('Candle wick',x+.43,1.613,z,.002,.01,'Recess')
    # Brackets and rounded edges supply believable silhouettes at close inspection.
    if key=='household':
        tx,tz=table['x'],table['z']
        boat=vessel('Feeding boat',tx-.3,.79,tz+.25,[(0,0),(.07,0),(.115,.05),(.108,.06),(.06,.017),(0,.017)],'Pottery')
        for v in boat.data.vertices:v.co.y=-(tz+.25)+(v.co.y+(tz+.25))*1.45
        for i in range(3):box('Nursing linen',chest['x'],.63+i*.04,chest['z'],.53,.035,.55,'Linen',.015)
        box('Folded spare blanket',chest['x'],.79,chest['z']+.05,.53,.13,.6,'Blanket',.035)
        # Half-drawn hanging cloth softens the window without closing the circulation space.
        for j in range(12):box('Sickroom window curtain',w/2-.25,2.02,-2.23+j*.035,.04+.025*math.sin(j),1.48,.042,'Linen',.012)
    elif key=='household-routines':
        # Sewing workspace: shelf with rolled remnants; ironing equipment on the chest.
        box('Work shelf',-w/2+.18,1.55,-1.05,.34,.06,1.8,'Walnut',.012)
        for j in range(4):
            o=cylinder('Rolled cloth',-w/2+.15,1.69,-1.62+j*.36,.10,.28,'Blanket' if j%2 else 'Linen');o.rotation_euler.y=math.pi/2
        x,z=chest['x'],chest['z'];cloth('Pressing cloth',x,.615,z,.61,.85,'Linen')
        # Triangular solid smoothing iron, with arched grip and separate stand.
        coords=[(-.08,-.1),(.08,-.1),(.09,.025),(0,.13),(-.09,.025)];verts=[(x+xx,-z-zz,.64+y) for y in [0,.045] for xx,zz in coords]
        faces=[tuple(reversed(range(5))),tuple(range(5,10))]+[(i,(i+1)%5,(i+1)%5+5,i+5) for i in range(5)]
        me=bpy.data.meshes.new('Flat iron');me.from_pydata(verts,[],[tuple(reversed(f)) for f in faces]);me.update();o=bpy.data.objects.new('Flat iron',me);bpy.context.collection.objects.link(o);me.materials.append(M['Iron'])
        for dz in [-.065,.055]:rod('Iron handle support',(x,.68,z+dz),(x,.76,z+dz),.012,'Iron')
        rod('Iron grip',(x,.76,z-.065),(x,.76,z+.055),.018,'Iron')
        # Thread, scissors and a pin cushion on the table's clear front edge.
        tx,tz=table['x'],table['z'];box('Pin cushion',tx+.31,.815,tz+.27,.13,.06,.1,'Blanket',.025)
        for i in range(4):rod('Pin',(tx+.28+i*.02,.84,tz+.27),(tx+.28+i*.02,.865,tz+.27),.0015,'Iron')
        for dx in [-.025,.025]:
            bpy.ops.mesh.primitive_torus_add(major_segments=20,minor_segments=6,major_radius=.025,minor_radius=.004,location=(tx+dx,-tz-.29,.792));o=bpy.context.object;o.name='Scissors loop';o.data.materials.append(M['Iron'])
            rod('Scissors blade',(tx+dx,.792,tz+.27),(tx-dx*.3,.792,tz+.12),.004,'Iron')
        for j in range(8):box('Window blind slat',w/2-.20,2.72-j*.045,-1.62,.045,.035,1.22,'Walnut',.004)
    else:
        # A more settled room: restrained wall trim, hearth rug, tea things and travel belongings.
        for zz in [-layout['depth']/2+.04,layout['depth']/2-.04]:box('Picture rail',0,2.55,zz,w,.055,.06,'Trim',.004)
        cloth('Hearth rug',hearth['x'],.018,hearth['z']+1.15,1.55,.7,'Blanket')
        x,z=chest['x'],chest['z'];box('Travel case',x,.75,z,.56,.30,.8,'Walnut',.025)
        for dz in [-.24,.24]:box('Case strap',x,.907,z+dz,.55,.008,.04,'Iron')
        rod('Case handle',(x-.10,.76,z+.415),(x+.10,.76,z+.415),.015,'Iron')
        tx,tz=table['x'],table['z'];box('Tea caddy',tx-.36,.87,tz+.28,.18,.17,.16,'Walnut',.012);box('Caddy lid',tx-.36,.965,tz+.28,.19,.025,.17,'Walnut',.008)
        for dz in [-.66,.66]:
            for j in range(9):box('Window curtain',w/2-.25,1.97,-1.62+dz+(j-4)*.035,.05+.02*math.sin(j),1.65,.04,'Blanket',.01)
        # Cool metal pan resting on the chest, with the long handle extending along its top.
        vessel('Warming pan',x,.92,z-.23,[(0,0),(.125,0),(.15,.035),(.15,.055),(0,.055)],'Copper')
        rod('Warming pan handle',(x,.955,z-.08),(x,.955,z+.49),.018,'Walnut')
        for angle in range(0,360,45):
            a=math.radians(angle);cylinder('Pan lid vent',x+.08*math.cos(a),.977,z-.23+.08*math.sin(a),.004,.002,'Recess')

def finish_surfaces(key,M,root):
    """512px albedo/normal/roughness detail at physical UV scale; reusable local textures."""
    out=root/'assets/household-finish/textures';out.mkdir(parents=True,exist_ok=True)
    n=512;yy,xx=np.mgrid[0:n,0:n]/n;rng=np.random.default_rng(1854)
    for name in ['Plaster','Ceiling','Oak','Walnut','Linen','Blanket']:
        mat=M[name];bs=mat.node_tree.nodes.get('Principled BSDF');links=mat.node_tree.links
        base=np.array(bs.inputs['Base Color'].default_value[:3]);base=np.where(base<=.0031308,base*12.92,1.055*base**(1/2.4)-.055)*255
        coarse=sum(np.sin(2*math.pi*(xx*a+yy*b)+c) for a,b,c in [(3,2,.3),(7,-4,1.8),(11,9,2.4),(2,-3,.9)])/4
        fine=rng.normal(0,1,(n,n))
        timber=name in ['Oak','Walnut'];cloth=name in ['Linen','Blanket']
        if timber:
            warp=xx+.009*np.sin(2*math.pi*yy*3)+.004*np.sin(2*math.pi*(yy*7+xx*2))
            height=np.sin(warp*2*math.pi*65)*.18+coarse*.06+fine*.025
            tone=height*8+coarse*1.2
        elif cloth:
            height=.20*np.sin(xx*2*math.pi*110)+.20*np.sin(yy*2*math.pi*110)+fine*.03
            tone=height*5+coarse*2
        else:height=coarse*.08+fine*.05;tone=coarse*1.8+fine*.5
        rgb=np.clip(base+tone[:,:,None],0,255)
        if key=='household-away' and name=='Plaster':
            # Small, faded geometric printed-paper repeat; original design, not a claimed historic pattern.
            motif=(np.abs((xx*5)%1-.5)+np.abs((yy*5)%1-.5))<.15
            rgb[motif]*=.88
        stem=f'{key}-{name.lower()}';png(out/f'{stem}.png',rgb.astype('uint8'))
        dx,dy=np.gradient(height);normal=np.stack([-dy*1.8,-dx*1.8,np.ones_like(dx)],axis=2);normal/=np.linalg.norm(normal,axis=2)[:,:,None]
        normal=normal.reshape(n//2,2,n//2,2,3).mean(axis=(1,3))
        normal/=np.linalg.norm(normal,axis=2)[:,:,None]
        png(out/f'{stem}-normal.png',np.clip((normal*.5+.5)*255,0,255).astype('uint8'))
        rough=np.clip((.72 if timber else .94)+coarse*.035,0,1)
        png(out/f'{stem}-roughness.png',np.repeat((rough*255).astype('uint8')[:,:,None],3,axis=2))
        for link in list(bs.inputs['Base Color'].links):links.remove(link)
        for suffix,socket in [('', 'Base Color'),('-roughness','Roughness'),('-normal','Normal')]:
            tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(out/f'{stem}{suffix}.png'),check_existing=True)
            if suffix:tex.image.colorspace_settings.name='Non-Color'
            if suffix=='-normal':
                bump=mat.node_tree.nodes.new('ShaderNodeNormalMap');bump.inputs['Strength'].default_value=.15;links.new(tex.outputs['Color'],bump.inputs['Color']);links.new(bump.outputs['Normal'],bs.inputs[socket])
            else:links.new(tex.outputs['Color'],bs.inputs[socket])
