"""Groom Whitehead's beard against the saved, evaluated adult face.

Original interpretive hair geometry and packed strand/normal maps. No portrait
pixels, runtime hair simulation, or blended transparency. Replaces facial hair
only; preserves the figure's face, clothing, pose and existing scalp hair.
Run before build_scene_characters.py -- street.
"""
import bpy, math, random
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[2]
path=ROOT/'assets/scene-people/whitehead.blend'
bpy.ops.wm.open_mainfile(filepath=str(path))
for ob in list(bpy.data.objects):
    if ob.name.startswith(('Whitehead beard','Whitehead moustache')):
        bpy.data.objects.remove(ob,do_unlink=True)
body=bpy.data.objects['Snow anatomy'].evaluated_get(bpy.context.evaluated_depsgraph_get())
tree=BVHTree.FromPolygons([body.matrix_world@v.co for v in body.data.vertices],
                         [tuple(p.vertices) for p in body.data.polygons])
rng=random.Random(185409)

# Fine irregular fibres, larger locks, and a broken growth edge. The same atlas
# serves cheeks, chin, moustache and tapered silhouette strands in one batch.
size=1024
v,u=np.mgrid[0:1:complex(size),0:1:complex(size)].astype(np.float32)
# Draw overlapping, individually varied curved fibres instead of periodic bars.
# This breaks up the hard, combed/wood-grain appearance of the previous texture.
nrng=np.random.default_rng(185409)
grain=nrng.random((size,size)).astype(np.float32)
shade=.63+grain*.12
height=grain*.04
for strand in range(5600):
    y0=int(nrng.integers(-350,size));length=int(nrng.integers(70,480))
    yy=np.arange(max(0,y0),min(size,y0+length))
    if not len(yy):continue
    t=(yy-y0)/length;phase=nrng.uniform(0,math.tau)
    xx=nrng.uniform(0,size)+nrng.uniform(-8,8)*t+nrng.uniform(1,4)*np.sin(phase+t*nrng.uniform(2,5))
    width=nrng.uniform(.45,1.2)*(np.sin(math.pi*t)**.35)
    tone=nrng.uniform(.48,1.28)
    for offset in [-2,-1,0,1,2]:
        xi=np.floor(xx).astype(int)+offset
        valid=(xi>=0)&(xi<size)
        x=xi[valid];y=yy[valid]
        weight=np.maximum(0,1-np.abs(x-xx[valid])/np.maximum(.1,width[valid]))*.75
        shade[y,x]=shade[y,x]*(1-weight)+tone*weight
        height[y,x]=np.maximum(height[y,x],weight*.3)
alpha_edge=.025+.023*(.5+.5*np.sin(u*231))+.013*(.5+.5*np.sin(u*541))
coverage=np.minimum((v-alpha_edge)/.075,(1-v-.018-.022*np.sin(u*283)**2)/.055)
coverage=np.minimum(coverage,np.minimum(u,1-u)/.030)
alpha=(np.clip(coverage,0,1)>(.22+grain*.50)).astype(np.float32)
pixels=np.ones((size,size,4),dtype=np.float32)
pixels[:,:,:3]=shade[:,:,None]*np.array([.36,.29,.225]);pixels[:,:,3]=alpha

def image(name,pixels,noncolor=False):
    old=bpy.data.images.get(name)
    if old:bpy.data.images.remove(old)
    im=bpy.data.images.new(name,width=size,height=size,alpha=True)
    if noncolor:im.colorspace_settings.name='Non-Color'
    im.pixels.foreach_set(pixels.ravel());im.pack();return im
albedo=image('Whitehead groomed beard fibres',pixels)
# Tangent-space microrelief survives GLB export, unlike procedural shader bumps.
dy,dx=np.gradient(height)
normal=np.stack((-dx*.85,-dy*.85,np.ones_like(dx)),axis=2)
normal/=np.linalg.norm(normal,axis=2)[:,:,None]
pixels=np.ones((size,size,4),dtype=np.float32);pixels[:,:,:3]=normal*.5+.5
normal_image=image('Whitehead beard strand normals',pixels,True)
mat=bpy.data.materials.get('Clerical beard');mat.use_nodes=True
nodes=mat.node_tree.nodes;nodes.clear();links=mat.node_tree.links
out=nodes.new('ShaderNodeOutputMaterial');bs=nodes.new('ShaderNodeBsdfPrincipled')
links.new(bs.outputs['BSDF'],out.inputs['Surface']);bs.inputs['Roughness'].default_value=.88
bs.inputs['Specular IOR Level'].default_value=.20
tex=nodes.new('ShaderNodeTexImage');tex.image=albedo;links.new(tex.outputs['Color'],bs.inputs['Base Color'])
cut=nodes.new('ShaderNodeMath');cut.operation='GREATER_THAN';cut.inputs[1].default_value=.45
links.new(tex.outputs['Alpha'],cut.inputs[0]);links.new(cut.outputs[0],bs.inputs['Alpha'])
mat.surface_render_method='DITHERED';mat['gltf_alpha_mode']='MASK';mat.alpha_threshold=.45
tex=nodes.new('ShaderNodeTexImage');tex.image=normal_image
nm=nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.45
links.new(tex.outputs['Color'],nm.inputs['Color']);links.new(nm.outputs['Normal'],bs.inputs['Normal'])

def mesh(name,verts,faces,coords):
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob);me.materials.append(mat)
    uv=me.uv_layers.new(name='UVMap')
    for loop in me.loops:uv.data[loop.index].uv=coords[loop.vertex_index]
    for poly in me.polygons:poly.use_smooth=True
    return ob

def surface(u,t):
    """Wrap from the left sideburn, around the chin, to the right sideburn."""
    angle=(u-.5)*2.56;a=abs(angle)/1.28
    top=1.553+.095*a**1.1
    bottom=1.489+.046*a**1.55
    z=top*(1-t)+bottom*t
    radial=Vector((math.sin(angle),-math.cos(angle),0))
    center=Vector((0,-.052,max(z,1.535)))
    hit,normal,_,_=tree.ray_cast(center+radial*.35,-radial,.5)
    radius=(hit-center).dot(radial) if hit else .075
    if z<1.535:
        blend=min(1,(1.535-z)/max(.001,1.535-bottom))
        radius=radius*(1-blend)+(.068-.014*a)*blend
    # Small volume follows the actual cheeks; fuller at the chin, never a curtain.
    radius+=.0015+(.006+.006*(1-a))*math.sin(math.pi*t)**1.3
    radius+=.0012*math.sin(angle*37+t*5)*math.sin(math.pi*t)
    point=Vector((0,-.052,z))+radial*radius
    return point,radial

verts=[];faces=[];coords=[];nx=64;ny=28
for j in range(ny+1):
    for i in range(nx+1):
        u=i/nx;t=j/ny;p,_=surface(u,t)
        verts.append(p);coords.append((u,t))
for j in range(ny):
    for i in range(nx):
        k=j*(nx+1)+i;faces.append((k,k+nx+1,k+nx+2,k+1))
beard=mesh('Whitehead beard',verts,faces,coords)
beard['face_fitted_revision']=3
beard['groom_notes']='Anatomical cheek/jaw shell; feathered growth edge; tapered strands; visible lips; rounded chin.'

# Individual narrow, tapered locks soften the silhouette and break the shell's
# smooth sheen. Static ribbons share the same masked material and head pivot.
vs=[];fs=[];uvs=[]
for index in range(850):
    u=rng.uniform(.015,.985)
    t=rng.uniform(.025,.97)
    if index<180:t=rng.uniform(.015,.10) # short hairs growing into cheeks
    if 180<=index<360:t=rng.uniform(.83,.98) # uneven, wispy lower edge
    length=rng.uniform(.055,.17)
    width=rng.uniform(.00010,.00030)
    first=len(vs);bend=rng.uniform(-.007,.007);phase=rng.uniform(0,math.tau)
    for j in range(5):
        f=j/4;tu=u+bend*f+.0015*math.sin(phase+f*3);tt=t+length*f
        p,n=surface(tu,min(tt,1))
        if tt>1:p.z-=(tt-1)*.070
        p+=n*(.0006+.0012*math.sin(math.pi*f))
        tangent=Vector((math.cos((tu-.5)*2.56),math.sin((tu-.5)*2.56),0))
        w=width*(1-f)**.7
        for sign in [-1,1]:
            vs.append(p+tangent*w*sign)
            uvs.append((u+sign*.0006,.15+.7*min(tt,1)))
    for j in range(4):
        k=first+j*2;fs.append((k,k+2,k+3,k+1))
mesh('Whitehead beard wisps',vs,fs,uvs)

# Moustache grows from the philtrum and follows the lip, becoming fuller at the
# corners. Each half overlaps the beard slightly, without covering the mouth.
for side in [-1,1]:
    def lip_surface(u,t):
        x=side*(.0005+.037*u)
        middle=1.586-.014*u**1.25
        half=.006*math.sin(math.pi*(.05+.9*u))**.45
        top=middle+half+.0006*math.sin(u*19)
        bottom=middle-half
        z=top*(1-t)+bottom*t
        hit,_,_,_=tree.ray_cast(Vector((x,-1,z)),Vector((0,1,0)),2)
        y=(hit.y if hit else -.145)-.0015-.002*math.sin(math.pi*t)
        return Vector((x,y,z))
    vs=[];fs=[];coords=[];nx=28;ny=8
    for j in range(ny+1):
        t=j/ny
        for i in range(nx+1):
            u=i/nx;vs.append(lip_surface(u,t));coords.append((.05+.9*t,.025+.95*u))
    for j in range(ny):
        for i in range(nx):
            k=j*(nx+1)+i;f=(k,k+nx+1,k+nx+2,k+1)
            fs.append(f if side>0 else tuple(reversed(f)))
    mesh('Whitehead moustache '+str(side),vs,fs,coords)
    vs=[];fs=[];coords=[]
    for strand in range(150):
        start=rng.uniform(.02,.90);level=rng.uniform(.02,.95)
        length=rng.uniform(.09,.25);width=rng.uniform(.00008,.00018)
        first=len(vs)
        for j in range(4):
            f=j/3;u=min(.999,start+f*length);t=min(1.08,level+.20*f)
            point=lip_surface(u,min(t,1));point.y-=.0007
            if t>1:point.z-=(t-1)*.012
            for sign in [-1,1]:
                vs.append(point+Vector((0,0,sign*width*(1-f))))
                coords.append((.15+level*.7+sign*.001,.12+.75*u))
        for j in range(3):
            k=first+j*2;face=(k,k+2,k+3,k+1)
            fs.append(face if side<0 else tuple(reversed(face)))
    mesh('Whitehead moustache fibres '+str(side),vs,fs,coords)


bpy.context.preferences.filepaths.save_version=0
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(path))
