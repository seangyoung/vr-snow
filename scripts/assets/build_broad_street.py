"""Blender 5.x: original modular reconstruction. See docs/broad-street-reconstruction.md.
Run from any directory: blender --background --python scripts/assets/build_broad_street.py
Coordinates below are Three.js metres: X east, Y up, Z south (street-relative, not survey bearings).
"""
import bpy, math, random, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
TEX=ROOT/'assets/broad-street/finish-textures'
random.seed(1854)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
M={}; BUFF={}; footprints=[]
def linear(v): return ((v+.055)/1.055)**2.4 if v>.04045 else v/12.92

def material(name,color,texture=None,repeat=1,rough=.9,metal=0):
    m=bpy.data.materials.new(name); m.use_nodes=True; m.use_backface_culling=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*[linear(int(color[i:i+2],16)/255) for i in (0,2,4)],1)
    bs.inputs['Roughness'].default_value=rough; bs.inputs['Metallic'].default_value=metal
    if texture:
        im=m.node_tree.nodes.new('ShaderNodeTexImage'); im.image=bpy.data.images.load(str(TEX/f'{texture}.jpg'))
        m.node_tree.links.new(im.outputs['Color'],bs.inputs['Base Color'])
        normal_path=TEX/f'{texture}-normal.png'
        if normal_path.exists():
            nm=m.node_tree.nodes.new('ShaderNodeTexImage'); nm.image=bpy.data.images.load(str(normal_path)); nm.image.colorspace_settings.name='Non-Color'
            normal=m.node_tree.nodes.new('ShaderNodeNormalMap'); normal.inputs['Strength'].default_value=.5
            m.node_tree.links.new(nm.outputs['Color'],normal.inputs['Color']); m.node_tree.links.new(normal.outputs['Normal'],bs.inputs['Normal'])
        roughness_path=TEX/f'{texture}-roughness.png'
        if roughness_path.exists():
            rm=m.node_tree.nodes.new('ShaderNodeTexImage'); rm.image=bpy.data.images.load(str(roughness_path)); rm.image.colorspace_settings.name='Non-Color'
            channels=m.node_tree.nodes.new('ShaderNodeSeparateColor')
            m.node_tree.links.new(rm.outputs['Color'],channels.inputs['Color'])
            m.node_tree.links.new(channels.outputs['Green'],bs.inputs['Roughness'])
    M[name]=(m,repeat)
    BUFF[name]=[[],[],[],[]]

material('London stock brick','756950','stock-brick',1.92)
material('Weathered red brick','775141','red-brick',1.92)
material('Granite setts','777771','setts',2.4,rough=.84)
material('Yorkstone paving','a5a18b','flags',2.4)
material('Welsh slate','555c60','slate',2.4)
material('Old timber','514632','wood',1.5)
material('Limestone','838170','limestone',1.5)
material('Sooty render','8b8774','limewash',2)
material('Window frame','8c8976')
material('Painted shopfront','28362e','paint',1.5)
material('Ironwork','262b28',rough=.63,metal=.45)
material('Terracotta','79543e')
material('Recess','1a201f')
material('Window glass','3a4547','cool-glass',2,rough=.37,metal=0)
material('Warm glass','635c43','warm-glass',2,rough=.37,metal=0)
material('Lettering','bdb59a')

origin=(0,0,0); angle=0; facade_height=10

def transform(p):
    x,y,z=p; c=math.cos(angle);s=math.sin(angle)
    return (origin[0]+c*x+s*z, origin[1]+y, origin[2]-s*x+c*z)

def face(points,mat,shade=1):
    verts,faces,uvs,colors=BUFF[mat]; start=len(verts)
    world=[transform(p) for p in points]
    verts.extend((x,-z,y) for x,y,z in world); faces.append(tuple(range(start,start+len(points))))
    # Metric planar coordinates maintain brick size between differently sized modules.
    a,b,c=[Vector(p) for p in points[:3]]; norm=(b-a).cross(c-a)
    axis=max(range(3),key=lambda i:abs(norm[i])); axes=[i for i in range(3) if i!=axis]
    if axis==2: axes=[0,1]
    if axis==0: axes=[2,1]
    repeat=M[mat][1]
    if mat in ['Window glass','Warm glass']:
        # Each pane gets a complete reflection/curtain composition, not a repeat
        # accidentally shared with neighboring masonry. Glass has no wood normal.
        low=[min(p[i] for p in points) for i in axes]
        span=[max(p[i] for p in points)-low[j] or 1 for j,i in enumerate(axes)]
        uvs.extend(tuple((p[i]-low[j])/span[j] for j,i in enumerate(axes)) for p in points)
    else:
        uvs.extend((p[axes[0]]/repeat,p[axes[1]]/repeat) for p in points)
    for x,y,z in world:
        weather=1
        if mat in ['London stock brick','Weathered red brick','Sooty render','Limestone','Painted shopfront'] and y>.08:
            # Baked broad-scale weathering, independent of the geometry RNG.
            weather=(.91+.05*math.sin(origin[0]*1.7+origin[2]*.9))
            weather*=1-.18*math.exp(-max(y,0)/.9)
            weather*=1-.10*math.exp(-abs(y-facade_height)/.5)
        if mat in ['Yorkstone paving','Granite setts'] and y<=.02:
            # Vertex contact shading avoids shadow maps and transparent overlays.
            distance=min(math.hypot(max(r['minX']-x,0,x-r['maxX']),max(r['minZ']-z,0,z-r['maxZ'])) for r in footprints)
            weather=(.66+.34*min(distance/1.5,1))
            weather*=.95+.035*math.sin(x*.57+math.sin(z*.71))*math.cos(z*.49)
        v=shade*weather
        colors.append((v,v,v,1))

def box(x,y,z,w,h,d,mat,shade=1,top_grid=None):
    a=x-w/2;b=x+w/2;c=y-h/2;e=y+h/2;f=z-d/2;g=z+d/2
    p=[(a,c,f),(b,c,f),(b,e,f),(a,e,f),(a,c,g),(b,c,g),(b,e,g),(a,e,g)]
    for ids,ao in [((0,3,2,1),.88),((5,6,7,4),.9),((4,7,3,0),.85),((1,2,6,5),.94),((3,7,6,2),1),((4,0,1,5),.6)]:
        if ids==(3,7,6,2) and top_grid:
            # Sparse tessellation carries contact shading; surfaces stay flat and
            # do not alter collision, movement height or the curb footprint.
            nx=math.ceil(w/top_grid);nz=math.ceil(d/top_grid)
            for ix in range(nx):
                for iz in range(nz):
                    x0=a+w*ix/nx;x1=a+w*(ix+1)/nx;z0=f+d*iz/nz;z1=f+d*(iz+1)/nz
                    face([(x0,e,z0),(x0,e,z1),(x1,e,z1),(x1,e,z0)],mat,shade*ao)
        else:face([p[i] for i in ids],mat,shade*ao)

def tube(points,r,mat,sides=8):
    rings=[]
    for i,p in enumerate(points):
        tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
        tangent.normalize(); ref=Vector((0,1,0)) if abs(tangent.y)<.9 else Vector((1,0,0))
        u=tangent.cross(ref).normalized();v=tangent.cross(u).normalized()
        rings.append([tuple(Vector(p)+r*(u*math.cos(j*math.tau/sides)+v*math.sin(j*math.tau/sides))) for j in range(sides)])
    for a,b in zip(rings,rings[1:]):
        for j in range(sides): face([a[j],a[(j+1)%sides],b[(j+1)%sides],b[j]],mat)
    face(list(reversed(rings[0])),mat);face(rings[-1],mat)

def sash(x,y,z,w=1.03,h=1.68):
    box(x,y,z+.18,w+.12,h+.12,.08,'Recess',.75)
    glass='Warm glass' if random.random()<.18 else 'Window glass'
    box(x,y,z+.125,w-.10,h-.10,.035,glass,.9)
    for sx in [-1,1]: box(x+sx*w/2,y,z+.015,.075,h+.1,.15,'Window frame',.86)
    for sy in [-1,1]: box(x,y+sy*h/2,z+.015,w+.1,.07,.15,'Window frame',.9)
    box(x,y,z-.015,w,.06,.16,'Window frame')
    for dx in [-w/6,w/6]: box(x+dx,y,z+.04,.025,h,.06,'Window frame',.9)
    for dy in [-h/3,h/3]: box(x,y+dy,z+.04,w,.026,.06,'Window frame',.9)
    box(x,y-h/2-.10,z-.07,w+.28,.13,.32,'Limestone')
    box(x,y+h/2+.13,z+.01,w+.24,.16,.25,'Weathered red brick',.8)


def lettering(text,x,y,z,size,rot=0):
    # Text is flattened to geometry and merged into one material batch before export.
    cu=bpy.data.curves.new('Period lettering','FONT');cu.body=text;cu.size=size;cu.align_x='CENTER';cu.extrude=0
    ob=bpy.data.objects.new(text,cu);bpy.context.collection.objects.link(ob)
    wx,wy,wz=transform((x,y,z));ob.location=(wx,-wz,wy)
    ob.rotation_euler=(math.pi/2,0,angle+math.pi+rot)
    ob.data.materials.append(M['Lettering'][0])
    bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.convert(target='MESH');ob.select_set(False)


def rail(x,z,w):
    for dx in [i*.18-w/2 for i in range(int(w/.18)+1)]:
        box(x+dx,.55,z,.023,1.05,.023,'Ironwork')
        # Small spear heads have a tangible silhouette at eye level.
        face([(x+dx-.045,1.02,z),(x+dx,1.15,z),(x+dx+.045,1.02,z)],'Ironwork')
    for y in [.22,.88]:box(x,y,z,w,.035,.035,'Ironwork')


def facade(width,height,brick,shop=False,number=None):
    floors=3 if height<10.2 else 4
    fh=(height-.4)/floors
    bays=3; gap=width/bays; ww=1.05
    for level in range(floors):
        y0=level*fh; wh=1.65 if level else 1.9; wy=y0+(1.66 if level else 1.58)
        if level==floors-1:wh=1.35;wy=y0+1.4
        if shop and level==0:
            box(0,1.48,.1,width,2.96,.2,'Painted shopfront')
            for j in range(3):
                x=(j-1)*gap
                box(x,1.65,-.035,gap-.3,1.85,.065,'Recess')
                box(x,1.7,-.076,gap-.44,1.5,.025,'Warm glass',.83)
                for dx in [-gap/2+.1,0,gap/2-.1]:box(x+dx,1.5,-.14,.06,2.55,.11,'Painted shopfront')
                for y in [.35,.78,1.3,2.47]:box(x,y,-.15,gap-.1,.055,.12,'Painted shopfront')
                box(x,.5,-.12,gap-.3,.4,.05,'Old timber',.65)
            # Narrow glazed shop door in the right-hand bay.
            for dx in [-.55,.55]:box(gap+dx,1.42,-.20,.07,2.65,.13,'Painted shopfront')
            tube([(gap+.4,1.1,-.2),(gap+.4,1.1,-.26)],.035,'Ironwork')
            box(0,2.9,-.12,width,.42,.24,'Painted shopfront')
            box(0,3.15,-.18,width+.12,.13,.4,'Old timber')
            box(0,2.67,-.17,width,.055,.29,'Old timber',.72)
            box(0,3.04,-.21,width+.05,.045,.32,'Painted shopfront',1.06)
            # Simple recessed stall risers and molded pilaster capitals.
            for j in (range(3) if math.hypot(origin[0],origin[2])<26 else []):
                x=(j-1)*gap
                for y in [.29,.69]:box(x,y,-.18,gap-.36,.032,.07,'Painted shopfront',.8)
                for dx in [-gap/2+.12,gap/2-.12]:
                    box(x+dx,2.57,-.19,.16,.10,.21,'Painted shopfront')
                    box(x+dx,.19,-.19,.15,.17,.21,'Painted shopfront',.72)
            continue
        if level==0:
            for j in range(3):
                x=(j-1)*gap; door=j==2
                pane_h=2.45 if door else 1.9; pane_y=1.325 if door else 1.58
                lo=pane_y-pane_h/2;hi=pane_y+pane_h/2
                box(x,lo/2,.13,gap,lo,.26,'Sooty render',.82)
                box(x,(hi+fh)/2,.13,gap,fh-hi,.26,'Sooty render')
                for sign in [-1,1]:box(x+sign*(gap+ww+.12)/4,pane_y,.13,(gap-ww-.12)/2,pane_h,.26,'Sooty render')
                if not door:sash(x,pane_y,0,ww,pane_h)
                else:
                    box(x,1.28,.18,ww,2.42,.12,'Recess')
                    box(x,1.16,.10,.94,2.12,.08,'Old timber',.63)
                    for sign in [-1,1]:box(x+sign*.57,1.3,-.035,.12,2.6,.2,'Limestone')
                    box(x,2.56,-.035,1.28,.15,.2,'Limestone')
                    box(x,2.32,.08,.9,.32,.08,'Window glass')
                    for y in [.5,1.35]:
                        box(x,y,.038,.66,.59,.035,'Painted shopfront')
                        for sign in [-1,1]:box(x+sign*.35,y,.01,.035,.67,.05,'Old timber')
                    tube([(x+.34,1.04,.01),(x+.34,1.04,-.055)],.036,'Ironwork')
                    box(x,.035,-.19,1.32,.07,.4,'Limestone')
            continue
        # Walls are divided around the openings, leaving true depth in the reveals.
        wallmat='Sooty render' if level==0 and not shop else brick
        lo=wy-wh/2; hi=wy+wh/2
        box(0,(y0+lo)/2,.13,width,lo-y0,.26,wallmat,.83 if level==0 else 1)
        box(0,(hi+y0+fh)/2,.13,width,y0+fh-hi,.26,wallmat)
        edges=[-width/2]+[v for j in range(3) for v in ((j-1)*gap-ww/2-.06,(j-1)*gap+ww/2+.06)]+[width/2]
        for j in range(0,len(edges)-1,2):box((edges[j]+edges[j+1])/2,wy,.13,edges[j+1]-edges[j],wh,.26,wallmat)
        for j in range(3):sash((j-1)*gap,wy,0,ww,wh)
    box(0,.17,-.07,width,.34,.25,'Limestone',.75)
    for y,w,d,h in [(height-.32,width+.14,.35,.1),(height-.13,width+.27,.48,.15),(height+.06,width+.12,.3,.24)]:box(0,y,-.04,w,h,d,'Limestone',.9)
    tube([(-width/2+.11,.2,-.17),(-width/2+.11,height-.45,-.17),(-width/2+.25,height-.25,-.17)],.047,'Ironwork')
    if number:lettering(str(number),.01,2.42,-.22,.15)


def house(x,z,width=6,height=9.6,rot=0,shop=False,number=None,side=False):
    global origin,angle,facade_height
    facade_height=height
    origin=(x,0,z);angle=rot
    brick='Weathered red brick' if random.random()<.25 else 'London stock brick'
    depth=8
    box(0,height/2,depth/2+.3,width-.6,height,depth-.4,brick,.82)
    for sx in [-1,1]:
        if (side=="left" and sx==-1) or (side is True and sx==1):continue
        box(sx*(width/2-.15),height/2,depth/2+.3,.3,height,depth-.4,brick,.82)
    facade(width,height,brick,shop,number)
    # Pitched slate roof behind a parapet, with individual attic dormers.
    ridge=height+2.35
    face([(-width/2,ridge,4),(width/2,ridge,4),(width/2,height,.1),(-width/2,height,.1)],'Welsh slate')
    face([(-width/2,height,8),(width/2,height,8),(width/2,ridge,4),(-width/2,ridge,4)],'Welsh slate',.8)
    for sx in [-1,1]:
        points=[(sx*width/2,height,.1),(sx*width/2,ridge,4),(sx*width/2,height,8)]
        face(points if sx==1 else list(reversed(points)),brick)
    for dx in [-width*.24,width*.24]:
        box(dx,height+.63,1.25,1.2,1.16,1.2,'Old timber')
        # Dormer glass in front of dormer body; dark cheeks hide the roof intersection.
        sash(dx,height+.63,.62,.8,.87)
        face([(dx-.72,height+1.5,1.65),(dx+.72,height+1.5,1.65),(dx+.72,height+1.2,.52),(dx-.72,height+1.2,.52)],'Welsh slate')
    # Party wall chimney stacks and ceramic pots, varied in height.
    ch=height+2.7+random.random()*.6
    box(-width/2+.3,ch-.7,4,.9,1.4,1.35,brick,.8)
    box(-width/2+.3,ch+.025,4,1.03,.13,1.5,'Limestone',.7)
    for dz in [-.45,0,.45]:
        tube([(-width/2+.3,ch,4+dz),(-width/2+.3,ch+.55,4+dz)],.115,'Terracotta',10)
        tube([(-width/2+.3,ch+.49,4+dz),(-width/2+.3,ch+.62,4+dz)],.14,'Terracotta',10)
        face([(-width/2+.3+math.cos(a*math.tau/10)*.095,ch+.625,4+dz+math.sin(a*math.tau/10)*.095) for a in range(10)],'Recess')
    if not shop:
        for dx in [-width/3,0]:rail(dx,-.62,width/3-.12)
    if side:
        # Return frontage at the Cambridge corner, omitting the later curved Victorian pub.
        origin=transform(((-1 if side=="left" else 1)*width/2,0,depth/2));angle=rot+(math.pi/2 if side=="left" else -math.pi/2)
        facade(depth,height,brick,True)
    # Simple rectangular collision envelope, plus railing clearance on north terrace.
    c=math.cos(rot);s=math.sin(rot)
    corners=[(x+c*a+s*b,z-s*a+c*b) for a in [-width/2,width/2] for b in [0,depth+.1]]
    footprints.append({'minX':min(p[0] for p in corners),'maxX':max(p[0] for p in corners),'minZ':min(p[1] for p in corners),'maxZ':max(p[1] for p in corners)})

# Continuous north terrace between the offset Dufour's Place and Poland Street.
for j in range(7):house(-21+6*j,-9,6,[11.3,10.8,9.5,9.6,9.1,9.4,9.5][j],math.pi,j in [2,3,5],21-j)
# Dufour's Place is west of Cambridge, never directly across from it.
for x in [-51,-45,-39,-33]:house(x,-9,6,10.0+random.random(),math.pi,True)
for x in [29,35,41,47,53]:house(x,-9,6,10.1,math.pi,False)
# South side: corner at Cambridge, then the terrace westward and eastward.
house(-3.2,3,6.4,10.4,0,True,side=True)
for j in range(6):house(-9.4-j*6,3,6,9.6+random.random(),0,j%3==0)
for j in range(7):house(11.4+6*j,3,6,9.7+random.random(),0,j%2==0,side="left" if j==0 else False)
# Cambridge Street recedes to the south, with both sides modeled.
for j in range(6):
    house(0,15+6*j,6,9.6+random.random(),-math.pi/2,j%3==0)
    house(8.4,15+6*j,6,10+random.random(),math.pi/2,j%3==1)
# An offset background end block, beyond the walkable slice.
for x in [-6,0,6,12,18]:house(x,53,6,10,0,True)
# Distant cross-street facades close the horizon; simplified lane returns are outside movement.
for z in [-9,-3,3]:
    house(-58,z,6,11.4,-math.pi/2,False)
    house(61,z,6,11.4,math.pi/2,False)
for x in [-27,22]:
    house(x,-34,6,10.2,math.pi,False)
origin=(0,0,0);angle=0
for x,w in [(-31.5,3),(-22.5,3),(16.5,3),(27.5,3)]:
    box(x,4.8,-24,w,9.6,15,'London stock brick',.8)
origin=(0,0,0);angle=0
# Single ground plus raised paving. Ground remains at a uniform locomotion height.
box(4,-.19,8,116,.12,110,'Granite setts',top_grid=2)
# A shallow curb gives readable depth without a step-height locomotion system.
for x,z,w,d in [(-42,-8.25,24,1.5),(-3,-8.25,42,1.5),(42,-8.25,32,1.5),(-25.2,2.2,53.6,1.6),(32.4,2.2,51.2,1.6),(.8,28,1.6,50),(7.6,28,1.6,50)]:
    box(x,-.07,z,w,.14,d,'Yorkstone paving',top_grid=1)
# Separate kerbstones and gutter strips; no visible barriers at movement limits.
for z,segments in [(-7.46,[(-54,-30),(-24,18),(26,58)]),(1.38,[(-54,1.6),(6.8,58)])]:
    for start,end in segments:
        x=start
        while x<end:
            width=min(1,end-x)
            box(x+width/2,-.065,z,width-.018,.17,.23,'Limestone',.74)
            x+=width
for x in [1.62,6.78]:
    for i in range(52):box(x,-.065,1.5+i+.5,.23,.17,.98,'Limestone',.74)
# Street-name plates are plausible markers, not copied modern signs.
origin=(-3.2,0,3);angle=0
box(1.8,5.5,-.055,1.63,.36,.08,'Limestone')
# Use dark lettering for these via material reassignment below.
lettering('BROAD STREET',1.8,5.41,-.102,.16)
origin=(0,0,7);angle=math.pi/2
box(0,5.5,-.055,2.1,.36,.08,'Limestone');lettering('CAMBRIDGE STREET',0,5.41,-.102,.16)
origin=(0,0,0);angle=0
# Drain grilles provide scale near the pump without introducing extra interaction targets.
for x,z in [(-5,1.12),(-1,1.12),(8,-7.25)]:
    box(x,-.113,z,.55,.022,.32,'Recess')
    for j in range(7):box(x-.24+j*.08,-.096,z,.025,.027,.3,'Ironwork')

for name,(verts,faces,uvs,colors) in BUFF.items():
    if not verts:continue
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    uv=mesh.uv_layers.new(name='UVMap');co=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
    for loop in mesh.loops:
        uv.data[loop.index].uv=uvs[loop.vertex_index];co.data[loop.index].color=colors[loop.vertex_index]
    ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob);mesh.materials.append(M[name][0])
# Converted text receives vertex colors too, to preserve the material color multiplier.
for ob in bpy.context.scene.objects:
    if ob.type=='MESH' and 'Color' not in ob.data.color_attributes:
        co=ob.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
        for e in co.data:e.color=(1,1,1,1)
        if 'STREET' in ob.name:ob.data.materials[0]=M['Recess'][0]
# Batch by material. This is the export draw-call budget, not one mesh per brick/window.
for name,(mat,_) in M.items():
    obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials and o.data.materials[0]==mat]
    if not obs:continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:o.select_set(True)
    bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name=name
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from bake_scene_lighting import bake_lighting
# A bake-only silhouette grounds the separately rendered interactive pump.
# Its material and transform follow PumpCourtyard; it never becomes a second pump.
bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=.165,depth=2.27,location=(-3.8,-1.3,1.135))
pump_occluder=bpy.context.object;pump_occluder.name='Bake-only pump occluder'
pump_occluder.data.materials.append(M['Ironwork'][0])
# Reserve atlas detail for continuous architecture and paving. Small repeated
# trim, glazing and ironwork retain weathering and use the neutral atlas patch.
receivers={'London stock brick','Weathered red brick','Granite setts','Yorkstone paving',
           'Welsh slate','Sooty render','Painted shopfront'}
neutral_meshes={o for o in bpy.context.scene.objects if o.type=='MESH' and o.name not in receivers}
lighting_report=bake_lighting({name:pair[0] for name,pair in M.items()},ROOT,asset='broad-street',
    lights=[],world_strength=3,sun=(2,.22),probe=(1.6,1.65,-2),exterior=neutral_meshes,
    weld=True,island_margin=.001,neutral_value=.6)
bpy.data.objects.remove(pump_occluder,do_unlink=True)
# Keep the edit source packed and portable; GLB embeds the same texture maps.
bpy.ops.file.pack_all()
bpy.context.scene.unit_settings.system='METRIC'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/broad-street/broad-street.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/broad-street.glb'),export_format='GLB',export_yup=True,export_cameras=False,export_lights=False,export_attributes=False,export_vertex_color='NAME',export_vertex_color_name='Color',export_all_vertex_colors=False)
from compact_vertex_colors import compact_vertex_colors
compact_vertex_colors(ROOT/'public/models/broad-street.glb')
triangles=sum(len(p.vertices)-2 for o in bpy.context.scene.objects if o.type=='MESH' for p in o.data.polygons)
report={'bakedLighting':lighting_report,'seed':1854,'triangles':triangles,'materialBatches':len([o for o in bpy.context.scene.objects if o.type=='MESH']),'footprints':footprints}
(ROOT/'assets/broad-street/build-report.json').write_text(json.dumps(report,indent=2)+'\n')
print('STREET BUILD',triangles,'triangles;',report['materialBatches'],'material batches')
