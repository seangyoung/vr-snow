"""Add an interpretive full beard, white neckcloth and dark frock coat to Whitehead.
The familiar photographic reference is from 1884, not a likeness dated to 1854.
Run against the saved adult anatomical source; additions are replaced on reruns.
"""
import bpy, math, random
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/scene-people/whitehead.blend'))
for ob in list(bpy.data.objects):
 if ob.name.startswith(('Whitehead ', 'Snow cravat', 'Snow folded cravat')):bpy.data.objects.remove(ob,do_unlink=True)
def mat(name,color):
 m=bpy.data.materials.get(name) or bpy.data.materials.new(name);m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=.9
 return m
hair=mat('Clerical beard',(.032,.023,.016));
# Packed strand texture: quiet tonal variation, no transparency or extra geometry.
rng=random.Random(1854);image=bpy.data.images.new('Whitehead beard strands',width=256,height=256)
columns=[rng.uniform(.76,1.22) for _ in range(256)];pixels=[]
for y in range(256):
 for x in range(256):
  f=columns[x]*rng.uniform(.92,1.08);pixels.extend((.25*f,.19*f,.135*f,1))
image.pixels=pixels;image.pack();tex=hair.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
hair.node_tree.links.new(tex.outputs['Color'],hair.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
cloth=bpy.data.materials['Shirt'];coat=bpy.data.materials['Coat']
def mesh(name,vertices,faces,material):
 me=bpy.data.meshes.new(name);me.from_pydata(vertices,[],faces);me.update()
 ob=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(ob);me.materials.append(material)
 for p in me.polygons:p.use_smooth=True
 return ob
# A joined jaw-to-chest beard shell, broad along the jaw and softly tapered below.
# Fine longitudinal ripples read as locks without alpha cards or disconnected blobs.
from mathutils.bvhtree import BVHTree
body=bpy.data.objects['Snow anatomy'].evaluated_get(bpy.context.evaluated_depsgraph_get())
face=BVHTree.FromPolygons([body.matrix_world@v.co for v in body.data.vertices],[tuple(p.vertices) for p in body.data.polygons])
verts=[];faces=[];steps=40
rows=[(.061,.055,-.083,1.575),(.064,.067,-.080,1.535),(.060,.068,-.082,1.490),(.048,.058,-.090,1.450),(.031,.038,-.102,1.418),(.009,.015,-.117,1.404)]
for row,(w,d,cy,z) in enumerate(rows):
 for i in range(steps+1):
  a=-math.pi/2+math.pi*i/steps
  wave=(math.sin(a*19+row*.2)*.0018+math.cos(a*31)*.0007)*math.sin(math.pi*i/steps)
  x=w*math.sin(a);py=cy-(d+wave)*math.cos(a);pz=z+(.043 if row==0 else .012)*abs(math.sin(a))
  if row<3:
   hit,_,_,_=face.ray_cast(Vector((x,-1,pz)),Vector((0,1,0)),2)
   if hit:py=min(py,hit.y-.004-abs(wave))
  verts.append((x,py,pz))
for j in range(len(rows)-1):
 for i in range(steps):
  k=j*(steps+1)+i;faces.append((k+steps+1,k+steps+2,k+1,k))
beard=mesh('Whitehead beard',verts,faces,hair)
uv=beard.data.uv_layers.new(name='UVMap')
for loop in beard.data.loops:
 index=loop.vertex_index;uv.data[loop.index].uv=(index%(steps+1)/steps,index//(steps+1)/(len(rows)-1))
solid=beard.modifiers.new('Solid connected beard','SOLIDIFY');solid.thickness=.012
sub=beard.modifiers.new('Soft beard contours','SUBSURF');sub.levels=1
# Two moustache halves keep the mouth legible.
for side in [-1,1]:
 vs=[];fs=[]
 for j in range(9):
  t=j/8;cx=side*(.002+.035*t);cy=-.159+.026*t*t;cz=1.590-.009*t
  for i in range(8):
   a=i*math.tau/8;vs.append((cx,cy+math.cos(a)*.004*(1-.7*t),cz+math.sin(a)*.004*(1-.7*t)))
 for j in range(8):
  for i in range(8):k=j*8+i;fs.append((k,j*8+(i+1)%8,(j+1)*8+(i+1)%8,k+8))
 mesh('Whitehead moustache '+str(side),vs,fs,hair)
# White stock at the neck; paired falling linen bands, rather than a modern tab collar.
vs=[];fs=[]
for z,rx,ry in [(1.486,.059,.064),(1.522,.054,.059)]:
 for i in range(40):
  a=i*math.tau/40;vs.append((rx*math.cos(a),-.030+ry*math.sin(a),z))
for i in range(40):fs.append((i,(i+1)%40,(i+1)%40+40,i+40))
neck=mesh('Whitehead neckcloth',vs,fs,cloth);neck.modifiers.new('Linen thickness','SOLIDIFY').thickness=.004
for side in [-1,1]:
 ob=mesh('Whitehead linen band '+str(side),[(side*.008,-.111,1.486),(side*.031,-.105,1.486),(side*.050,-.157,1.381),(side*.019,-.160,1.382)],[(0,1,2,3)],cloth)
 ob.modifiers.new('Linen thickness','SOLIDIFY').thickness=.002
# Coat skirts wrap the hips and fall to mid-thigh, with an open front.
vs=[];fs=[]
for z,rx,ry,cy in [(1.12,.167,.112,-.008),(.98,.184,.132,.005),(.78,.203,.149,.016)]:
 for i in range(33):
  a=-math.pi/2+.33+(math.tau-.66)*i/32;vs.append((rx*math.cos(a),cy+ry*math.sin(a),z))
for j in range(2):
 for i in range(32):k=j*33+i;fs.append((k+33,k+34,k+1,k))
ob=mesh('Whitehead frock coat skirts',vs,fs,coat);ob.modifiers.new('Wool thickness','SOLIDIFY').thickness=.007
bpy.context.preferences.filepaths.save_version=0
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/scene-people/whitehead.blend'))
