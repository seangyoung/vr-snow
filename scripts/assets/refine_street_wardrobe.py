"""Fit the new adult street residents' standing clothes; preserve editable anatomy.
Run after author_scene_people.py and pose_brewery_owners.py, once per new source.
"""
import bpy,bmesh,math,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
actor=sys.argv[sys.argv.index('--')+1]
path=ROOT/f'assets/scene-people/{actor}.blend';bpy.ops.wm.open_mainfile(filepath=str(path))
rig=bpy.data.objects['Snow authoring rig']
if rig.get('street_wardrobe_revision'):raise RuntimeError('This source already has its fitted street wardrobe.')
coat=bpy.data.objects['Snow tailored coat and trousers'];cloth=coat.data.materials[0]
shirt=bpy.data.materials['Shirt'];hair=bpy.data.materials['Hair']
def mesh(name,verts,faces,material):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob);me.materials.append(material)
 for f in me.polygons:f.use_smooth=True
 return ob
if actor in ['seamstress','laundress']:
 body=bpy.data.objects['Snow anatomy'];groups={g.index for g in body.vertex_groups if g.name.startswith(('thigh_','calf_','foot_','ball_')) or g.name=='pelvis'}
 vg=body.vertex_groups.new(name='Covered by long dress');vg.add([v.index for v in body.data.vertices if any(g.group in groups and g.weight>.01 for g in v.groups)],1,'REPLACE')
 mod=body.modifiers.new('Long dress coverage','MASK');mod.vertex_group=vg.name;mod.invert_vertex_group=True
 bun=bpy.data.objects['Snow hair bun']
 for v in bun.data.vertices:v.co.y-=.036
 mat=bun.data.materials[0].copy();mat.name='BunHair';bs=mat.node_tree.nodes.get('Principled BSDF')
 for link in list(bs.inputs['Alpha'].links):mat.node_tree.links.remove(link)
 bs.inputs['Alpha'].default_value=1
 if 'gltf_alpha_mode' in mat:del mat['gltf_alpha_mode']
 bun.data.materials.clear();bun.data.materials.append(mat)
 old=bpy.data.objects.get('Snow gathered skirt')
 if old:bpy.data.objects.remove(old,do_unlink=True)
 bm=bmesh.new();bm.from_mesh(coat.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000025)
 bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=(0,0,1.06),plane_no=(0,0,1))
 bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.calc_center_median().z<1.060001 and abs(f.calc_center_median().x)<.22],context='FACES')
 bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
 edges=[e for e in bm.edges if e.is_boundary and all(abs(v.co.z-1.06)<.0001 and abs(v.co.x)<.22 for v in e.verts)]
 ring=list({v for e in edges for v in e.verts});assert len(ring)>20,len(ring)
 ring.sort(key=lambda v:math.atan2(v.co.x,v.co.y+.045));angles=[math.atan2(v.co.x,v.co.y+.045) for v in ring];n=len(ring);uv=bm.loops.layers.uv.active
 for f in bm.faces:
  for l in f.loops:l[uv].uv.y=.52+.48*l[uv].uv.y
 previous=ring
 for j,(z,rx,ry,cy) in enumerate([(1.00,.175,.15,-.015),(.92,.207,.17,-.01),(.80,.232,.195,-.005),(.60,.267,.23,0),(.38,.300,.27,0),(.12,.323,.295,0),(.085,.323,.295,0)]):
  following=[]
  for a in angles:
   fold=.002+.006*j/6;f=fold*(math.sin(a*18)+.35*math.sin(a*11));following.append(bm.verts.new(((rx+f)*math.sin(a),cy+(ry+f)*math.cos(a),z)))
  for i in range(n):
   k=(i+1)%n;f=bm.faces.new((previous[i],following[i],following[k],previous[k]));f.material_index=0;f.smooth=True
   for l,(u,v) in zip(f.loops,[(i/n,j/7),(i/n,(j+1)/7),((i+1)/n,(j+1)/7),((i+1)/n,j/7)]):l[uv].uv=(u,.5*(1-v))
  previous=following
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.normal_update()
 if sum(f.calc_area()*f.normal.dot(Vector((f.calc_center_median().x,f.calc_center_median().y+.04,0))) for f in bm.faces)<0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
 bm.to_mesh(coat.data);bm.free();coat['continuous_standing_dress']=True
 if actor=='laundress':
  # Modest linen work apron follows the front of the standing skirt.
  verts=[];faces=[];profiles=[(1.06,.145,.145),(.91,.206,.18),(.60,.268,.243),(.27,.314,.288)]
  for j,(z,rx,ry) in enumerate(profiles):
   for i in range(25):a=-.77+1.54*i/24;verts.append((rx*math.sin(a),-.018-ry*math.cos(a)-.003*math.cos(a*19),z))
  for j in range(3):
   for i in range(24):k=j*25+i;faces.append((k,k+25,k+26,k+1))
  apron=mesh('Street apron',verts,faces,shirt);apron.modifiers.new('Linen thickness','SOLIDIFY').thickness=.003
 else:
  # A small shoulder shawl gives the seamstress a different upper silhouette.
  verts=[(-.20,-.065,1.45),(-.11,-.13,1.46),(0,-.15,1.28),(.11,-.13,1.46),(.20,-.065,1.45),(.21,.07,1.42),(0,.09,1.32),(-.21,.07,1.42)]
  shawl=mesh('Street shoulder shawl',verts,[(0,1,2),(2,3,4),(4,5,6),(6,7,0)],bpy.data.materials['Waistcoat']);shawl.modifiers.new('Wool thickness','SOLIDIFY').thickness=.005
else:
 # A soft work cap and a round taller cap distinguish the two men at street distance.
 head=rig.matrix_world@rig.pose.bones['head'].tail
 verts=[];faces=[];rings=[(head.z-.055,.080,.085),(head.z-.018,.085,.091),(head.z+.025,.065,.074),(head.z+.035,.008,.009)]
 if actor=='messenger':rings=[(head.z-.045,.077,.081),(head.z+.015,.075,.08),(head.z+.033,.065,.069),(head.z+.038,.008,.009)]
 for z,rx,ry in rings:
  for i in range(40):a=i*math.tau/40;verts.append((rx*math.cos(a),head.y+ry*math.sin(a),z))
 for j in range(3):
  for i in range(40):k=j*40+i;faces.append((k,j*40+(i+1)%40,(j+1)*40+(i+1)%40,k+40))
 cap=mesh('Street cap',verts,faces,cloth);cap.modifiers.new('Wool thickness','SOLIDIFY').thickness=.003
 # Short curved peak, using the existing dark leather material.
 verts=[]
 for r in [0,1]:
  for i in range(25):a=-1.05+2.10*i/24;verts.append((.079*math.sin(a),head.y-(.08+r*.025)*math.cos(a),head.z-.045-r*.006))
 mesh('Street cap peak',verts,[(i,i+25,i+26,i+1) for i in range(24)],cloth)
rig['street_wardrobe_revision']=1
bpy.context.preferences.filepaths.save_version=0;bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(path))
