"""Composite ill adult resting in Household 1. Derived MakeHuman head, covered body.
No new testimony target: the seated householder speaks for the household.
"""
import bpy,bmesh,sys,math,json,hashlib
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(Path(__file__).resolve().parent))
from bake_scene_lighting import bake_lighting
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/household-room/household-room.blend'))
room=set(bpy.context.scene.objects)
source=ROOT/'assets/scene-people/registrar.blend'
with bpy.data.libraries.load(str(source),link=False) as (a,b):b.objects=a.objects
originals=[o for o in b.objects if o]
for o in originals:bpy.context.scene.collection.objects.link(o)
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();parts=[]
# Face upward, supported by the pillow; head extends toward the headboard.
transform=Matrix.Translation((-1.9,.60,.775))@Matrix.Rotation(-math.pi/2,4,'X')@Matrix.Diagonal((.95,.95,.94,1))
for original in originals:
 role=original.name.split('.')[0]
 if role not in ['Snow anatomy','Snow eyes','Snow swept hair','Snow eyebrows']:continue
 ev=original.evaluated_get(deps);mesh=bpy.data.meshes.new_from_object(ev,preserve_all_data_layers=True,depsgraph=deps);mesh.transform(ev.matrix_world)
 if role=='Snow anatomy':
  bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.calc_center_median().z<1.42],context='FACES');bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS');bm.to_mesh(mesh);bm.free()
 ob=bpy.data.objects.new('Resting patient '+role,mesh);bpy.context.scene.collection.objects.link(ob);mesh.transform(transform);parts.append(ob)
 for p in mesh.polygons:p.use_smooth=True
for o in originals:bpy.data.objects.remove(o,do_unlink=True)
def mat(name,color):
 m=bpy.data.materials.new(name);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=.97;return m
linen=mat('Patient linen',(.52,.49,.40));wool=mat('Patient wool',(.18,.13,.09))
# Rounded neckline and shoulders meet the anatomical neck; remaining body stays covered.
bpy.ops.mesh.primitive_uv_sphere_add(segments=28,ring_count=14,location=(-1.9,1.78,.78));shirt=bpy.context.object;shirt.name='Patient nightshirt';shirt.scale=(.25,.23,.09);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);shirt.data.materials.append(linen);parts.append(shirt)
for p in shirt.data.polygons:p.use_smooth=True
# Blanket volume communicates shoulders, bent knees and feet beneath woven cloth.
n,m=40,52;verts=[];faces=[]
for j in range(m+1):
 t=j/m;z=-1.86+t*1.60
 for i in range(n+1):
  u=(i/n-.5)*1.23;body=math.exp(-(u/.28)**4)
  raised=(.19+.025*math.sin(t*math.pi*3))*body*(1-.28*t)
  edge=max(0,(abs(u)-.52)/.095)
  y=.65+raised+.008*math.sin(u*41+t*5)+.005*math.sin(t*49)-.18*edge
  verts.append((-1.9+u,-z,y))
for j in range(m):
 for i in range(n):
  a=j*(n+1)+i;faces.append((a,a+n+1,a+n+2,a+1))
mesh=bpy.data.meshes.new('Occupied coverlet');mesh.from_pydata(verts,[],faces);mesh.update();blanket=bpy.data.objects.new('patient_breathing_coverlet',mesh);bpy.context.scene.collection.objects.link(blanket);mesh.materials.append(wool);parts.append(blanket)
for p in mesh.polygons:p.use_smooth=True
# Planar cloth UVs are independent of the lighting atlas.
for ob in [shirt,blanket]:
 uv=ob.data.uv_layers.active or ob.data.uv_layers.new(name='UVMap')
 for loop in ob.data.loops:
  v=ob.data.vertices[loop.vertex_index].co;uv.data[loop.index].uv=(v.x*2,v.y*2)
# A greying head distinguishes this older relative from the office witness source.
import numpy as np
seen=set()
for ob in parts:
 if not ob.name.endswith(('Snow swept hair','Snow eyebrows')):continue
 for mat in ob.data.materials:
  for node in mat.node_tree.nodes:
   if node.type=='TEX_IMAGE' and node.image and node.image not in seen:
    image=node.image;seen.add(image);a=np.array(image.pixels[:],dtype=np.float32).reshape(-1,4);a[:,:3]=np.clip(a[:,:3]*.65+.10,0,1);image.pixels.foreach_set(a.reshape(-1));image.pack()
    bs=mat.node_tree.nodes.get('Principled BSDF')
    for link in list(bs.inputs['Base Color'].links):mat.node_tree.links.remove(link)
    mat.node_tree.links.new(node.outputs['Color'],bs.inputs['Base Color'])
M={m.name:m for ob in parts for m in ob.data.materials}
for name in ['Patient linen','Patient wool']:
 material=M[name];bs=material.node_tree.nodes.get('Principled BSDF');tex=material.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(ROOT/'assets/household-finish/textures'/('household-linen.png' if name=='Patient linen' else 'household-blanket.png')));material.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
report=bake_lighting(M,ROOT,asset='household-patient',size=1024,environment_width=256,lights=[],occluders={o for o in room if o.type=='MESH'},probe=(-1.9,.95,-1.9))
# Keep the small facial surfaces lit consistently by sampling nearest skin UV.
from mathutils.bvhtree import BVHTree
face=next(o for o in parts if o.name.endswith('Snow anatomy'));tree=BVHTree.FromPolygons([v.co for v in face.data.vertices],[tuple(p.vertices) for p in face.data.polygons])
for ob in parts:
 if not ob.name.endswith('Snow eyes'):continue
 for poly in ob.data.polygons:
  _,_,pi,_=tree.find_nearest(poly.center+Vector((0,-.015,0)))
  fp=face.data.polygons[pi];sample=sum((face.data.uv_layers['Lightmap'].data[i].uv for i in fp.loop_indices),Vector((0,0)))/len(fp.loop_indices)
  for li in poly.loop_indices:ob.data.uv_layers['Lightmap'].data[li].uv=sample
for ob in parts:
 ob.data.uv_layers.active_index=0;ob.data.uv_layers[0].active_render=True
folder=ROOT/'assets/household-patient';folder.mkdir(exist_ok=True)
bpy.context.preferences.filepaths.save_version=0;bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(folder/'household-patient.blend'))
bpy.ops.object.select_all(action='DESELECT')
for ob in parts:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/household-patient.glb'),export_format='GLB',use_selection=True,export_yup=True,export_cameras=False,export_lights=False)
tri=sum(len(p.vertices)-2 for o in parts for p in o.data.polygons)
(folder/'build-report.json').write_text(json.dumps({'triangles':tri,'materialBatches':len(parts),'source':str(source.relative_to(ROOT)),'sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'bakedLighting':report,'interpretive':True,'patient':'An ill father, awake and resting; no claim about eventual recovery.'},indent=2)+'\n')
print('PATIENT',tri)
