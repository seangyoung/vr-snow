"""Refit Whitehead's beard to the evaluated face, preserving his adult anatomy.
Authored interpretation of the later portrait; not an 1854 measured likeness.
"""
import bpy,math,random
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[2];path=ROOT/'assets/scene-people/whitehead.blend'
bpy.ops.wm.open_mainfile(filepath=str(path))
for o in list(bpy.data.objects):
 if o.name.startswith(('Whitehead beard','Whitehead moustache')):bpy.data.objects.remove(o,do_unlink=True)
body=bpy.data.objects['Snow anatomy'];deps=bpy.context.evaluated_depsgraph_get();evaluated=body.evaluated_get(deps)
tree=BVHTree.FromPolygons([evaluated.matrix_world@v.co for v in evaluated.data.vertices],[tuple(p.vertices) for p in evaluated.data.polygons])
mat=bpy.data.materials.get('Clerical beard');mat.node_tree.nodes.clear();nodes=mat.node_tree.nodes;out=nodes.new('ShaderNodeOutputMaterial');bs=nodes.new('ShaderNodeBsdfPrincipled');mat.node_tree.links.new(bs.outputs['BSDF'],out.inputs['Surface']);bs.inputs['Roughness'].default_value=.84
# Irregular, fine strands in an opaque surface: no striped curtain or alpha sorting.
rng=random.Random(185410);im=bpy.data.images.new('Whitehead natural beard fibres',width=512,height=512);pixels=[]
columns=[rng.uniform(.96,1.04) for _ in range(512)]
for y in range(512):
 for x in range(512):
  f=columns[(x+int(2*math.sin(y*.025+x*.006)))%512]*rng.uniform(.90,1.10)
  pixels.extend((.32*f,.22*f,.15*f,1))
im.pixels=pixels;im.pack();tex=nodes.new('ShaderNodeTexImage');tex.image=im;mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
def mesh(name,verts,faces):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob);me.materials.append(mat)
 for p in me.polygons:p.use_smooth=True
 return ob
# A continuous front surface covers the chin and wraps onto both jawlines.
# Every upper row is projected onto the posed skin, not a guessed neck cylinder.
verts=[];faces=[];steps=48
rows=[(1.568,.067,.044,-.163),(1.551,.067,.041,-.169),(1.526,.062,.024,-.168),(1.500,.057,.015,-.166),(1.474,.046,.010,-.158),(1.452,.028,.007,-.147),(1.450,.018,.003,-.140)]
for j,(z,width,rise,front) in enumerate(rows):
 for i in range(steps+1):
  u=-1+2*i/steps;x=width*u;pz=z+rise*abs(u)**1.7
  hit,_,_,_=tree.ray_cast(Vector((x,-1,pz)),Vector((0,1,0)),2)
  py=front+.045*abs(u)**2
  if j<3 and hit:py=hit.y-.007
  elif j==3 and hit:py=min(py,hit.y-.008)
  wave=.0018*math.sin(i*.9+j*.9)+.0006*math.sin(i*2.3+j*.7)
  verts.append((x,py-wave,pz))
for j in range(len(rows)-1):
 for i in range(steps):k=j*(steps+1)+i;faces.append((k,k+steps+1,k+steps+2,k+1))
beard=mesh('Whitehead beard',verts,faces)
# Front faces point toward -Y. Recalculate independently of any open-shell winding.
import bmesh
bm=bmesh.new();bm.from_mesh(beard.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.normal_update()
if sum(f.normal.y*f.calc_area() for f in bm.faces)>0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
bm.to_mesh(beard.data);bm.free()
uv=beard.data.uv_layers.new(name='UVMap')
for loop in beard.data.loops:i=loop.vertex_index;uv.data[loop.index].uv=(i%(steps+1)/steps,i//(steps+1)/(len(rows)-1))
beard.modifiers.new('Dense beard volume','SOLIDIFY').thickness=.007
sub=beard.modifiers.new('Soft beard contour','SUBSURF');sub.levels=1
bpy.context.view_layer.objects.active=beard
bpy.ops.object.modifier_apply(modifier=sub.name)
for v in beard.data.vertices:
 if v.co.z>1.515:
  hit,_,_,_=tree.ray_cast(Vector((v.co.x,-1,v.co.z)),Vector((0,1,0)),2)
  if hit:v.co.y=min(v.co.y,hit.y-.006)
# Fitted, tapered moustache ribbons above the upper lip, softly curving down at corners.
for side in [-1,1]:
 vs=[];fs=[];n=24
 for j in range(5):
  t=j/4
  for i in range(n+1):
   u=i/n;x=side*(.003+.033*u);z=1.592-.009*u-.009*t*(math.sin(math.pi*u)**.4)
   hit,_,_,_=tree.ray_cast(Vector((x,-1,z)),Vector((0,1,0)),2)
   y=(hit.y if hit else -.165)-.003-.002*math.sin(math.pi*t)
   vs.append((x,y,z))
 for j in range(4):
  for i in range(n):k=j*(n+1)+i;fs.append((k,k+n+1,k+n+2,k+1) if side>0 else (k+1,k+n+2,k+n+1,k))
 ob=mesh('Whitehead moustache '+str(side),vs,fs);uv=ob.data.uv_layers.new(name='UVMap')
 for l in ob.data.loops:i=l.vertex_index;uv.data[l.index].uv=(i%(n+1)/n,i//(n+1)/4)
 ob.modifiers.new('Soft moustache volume','SOLIDIFY').thickness=.003
 sub=ob.modifiers.new('Soft moustache edge','SUBSURF');sub.levels=1
# Restore visible brown hair detail instead of a nearly black scalp silhouette.
hair=bpy.data.materials['Hair'];mix=next((n for n in hair.node_tree.nodes if n.type=='MIX'),None)
if mix:mix.inputs[7].default_value=(.50,.36,.25,1)
# Slightly fuller crown and a swept side part; preserve fitted hairline and ears.
o=bpy.data.objects['Snow swept hair']
if not o.get('whitehead_crown_revision'):
 for v in o.data.vertices:
  f=max(0,min(1,(v.co.z-1.66)/.08));v.co.z+=.008*f;v.co.x+=.003*f
 o['whitehead_crown_revision']=1
beard['face_fitted_revision']=2
bpy.context.preferences.filepaths.save_version=0;bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(path))
