"""Refine saved anatomical sources, preserving their authored faces and textures.
Usage: blender -b --factory-startup --python refine_character_poses.py -- ACTOR INPUT OUTPUT
Normal exports do not run this authoring step. INPUT must be a pre-refinement copy.
"""
import bpy,bmesh,math,sys
from pathlib import Path
from mathutils import Vector,Matrix
actor,source,dest=sys.argv[sys.argv.index('--')+1:][:3]
bpy.ops.wm.open_mainfile(filepath=str(Path(source).resolve()))
rig=bpy.data.objects['Snow authoring rig']
if rig.get('resting_pose_revision'):raise RuntimeError('Use a pre-refinement source, not an already refined pose.')
standing=actor in ['registrar','resident-west','resident-east']
brewery=actor in ['edward','john']
if brewery:rig.location.y=-.08
if actor=='snow':rig.location.y=-.10
# Reset only arms; the existing faces, seated hips, legs and wardrobe remain authored.
for p in rig.pose.bones:
 if p.name.startswith(('upperarm_','lowerarm_','hand_','thumb_','index_','middle_','ring_','pinky_')):p.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
def aim(name,direction):
 p=rig.pose.bones[name];bpy.context.view_layer.update()
 q=(p.tail-p.head).normalized().rotation_difference(Vector(direction).normalized())
 mat=q.to_matrix().to_4x4()@p.matrix;mat.translation=p.head;p.matrix=mat;bpy.context.view_layer.update()
def reach(suffix,target,side):
 # Analytic two-bone IK with a low elbow, not independently guessed arm angles.
 upper=rig.pose.bones['upperarm_'+suffix];lower=rig.pose.bones['lowerarm_'+suffix]
 shoulder=upper.head.copy();wrist=rig.matrix_world.inverted()@Vector(target)
 delta=wrist-shoulder;distance=min(delta.length,upper.length+lower.length-.006)
 axis=delta.normalized();along=(upper.length**2-lower.length**2+distance**2)/(2*distance)
 bend=Vector((side*.22,.15,-1));bend=(bend-axis*bend.dot(axis)).normalized()
 elbow=shoulder+axis*along+bend*math.sqrt(max(0,upper.length**2-along**2))
 aim('upperarm_'+suffix,elbow-shoulder)
 aim('lowerarm_'+suffix,shoulder+axis*distance-rig.pose.bones['lowerarm_'+suffix].head)
 return rig.matrix_world@rig.pose.bones['hand_'+suffix].head
for side,suffix in [(1,'l'),(-1,'r')]:
 table=(actor=='snow') or (brewery and ((actor=='edward' and side==1) or (actor=='john' and side==-1)))
 if standing:
  target=(side*(.29 if actor=='registrar' else .285),-.018 if side==1 else -.035,.90 if side==1 else .915)
  forward=Vector((side*.06,-.05,-1));across=Vector((0,-1,.05))
 elif table:
  target=(side*.19,-.525 if actor=='snow' else -.49,.849 if actor=='snow' else .775)
  forward=Vector((-side*.32 if actor=='snow' else -side*.16,-1,-.015));across=Vector((-side,.1,0))
 else:
  lap_height={'board-chair':(.669,.676),'board-tradesman':(.689,.696),'board-guardian':(.679,.686),'steward':(.669,.676),'edward':(.692,.691),'john':(.692,.691),'survivor':(.663,.660)}[actor][0 if side==1 else 1]
  target=(side*.14,-.23+rig.location.y,lap_height)
  # Hands follow the slope of the thighs. A little asymmetry avoids a paired gesture.
  if side==-1:target=(side*.15,target[1]-.025,target[2])
  forward=Vector((-side*.20,-1,-.37 if actor=='survivor' else -.15));across=Vector((-side,.12,0))
 wrist=reach(suffix,target,side)
 p=rig.pose.bones['hand_'+suffix];rest=p.bone.matrix_local.to_3x3()
 long=rig.data.bones['middle_01_'+suffix].head_local-p.bone.head_local
 wide=rig.data.bones['index_01_'+suffix].head_local-rig.data.bones['pinky_01_'+suffix].head_local
 oy=long.normalized();ox=(wide-oy*wide.dot(oy)).normalized();oz=ox.cross(oy).normalized()
 ny=forward.normalized();nx=(across-ny*across.dot(ny)).normalized();nz=nx.cross(ny).normalized()
 mat=(Matrix((nx,ny,nz)).transposed()@Matrix((ox,oy,oz))@rest).to_4x4()
 mat.translation=p.head;p.matrix=mat;bpy.context.view_layer.update()
 for i,finger in enumerate(['index','middle','ring','pinky']):
  for segment,curl in [(1,.025),(2,.11),(3,.25)]:
   flex=Vector((-side,0,0)) if standing else Vector((0,0,-1))
   direction=ny+nx*((i-1.5)*.022)+flex*curl*(.35 if table else 1)
   aim(f'{finger}_{segment:02d}_{suffix}',direction)
 for segment in ([1,2,3] if table else [2,3]):
  thumb=rig.pose.bones[f'thumb_{segment:02d}_{suffix}']
  direction=Vector((-side*(.7 if segment==1 else .4),-.85,0)) if table else (thumb.tail-thumb.head).normalized().lerp(ny,.15)
  aim(f'thumb_{segment:02d}_{suffix}',direction)
 print('RESTING WRIST',actor,suffix,tuple(round(x,4) for x in wrist),'table',table)

if actor=='survivor':
 body=bpy.data.objects['Snow anatomy']
 leggroups={g.index for g in body.vertex_groups if g.name.startswith(('thigh_','calf_','foot_','ball_')) or g.name=='pelvis'}
 covered=body.vertex_groups.new(name='Covered by long dress')
 covered.add([v.index for v in body.data.vertices if any(g.group in leggroups and g.weight>.01 for g in v.groups)],1,'REPLACE')
 mask=body.modifiers.new('Long dress leg coverage','MASK');mask.vertex_group=covered.name;mask.invert_vertex_group=True
 # A solid bun overlaps the back of the fitted scalp; transparent hair-card
 # cutouts are appropriate for the cap, but not for this closed volume.
 bun=bpy.data.objects['Snow hair bun']
 for v in bun.data.vertices:v.co.y-=.036
 solidhair=bun.data.materials[0].copy();solidhair.name='BunHair'
 bs=solidhair.node_tree.nodes.get('Principled BSDF')
 for link in list(bs.inputs['Alpha'].links):solidhair.node_tree.links.remove(link)
 bs.inputs['Alpha'].default_value=1
 if 'gltf_alpha_mode' in solidhair:del solidhair['gltf_alpha_mode']
 bun.data.materials.clear();bun.data.materials.append(solidhair)
 bun['solid_attached_bun']=True
 # Replace the independent shell with cloth sharing the bodice's actual waist
 # vertices. The generated skirt is unweighted below the waist, so seated cloth
 # keeps its drape while the armature continues to pose the sleeves normally.
 old=bpy.data.objects.get('Snow gathered skirt')
 if old:bpy.data.objects.remove(old,do_unlink=True)
 coat=bpy.data.objects['Snow tailored coat and trousers']
 bm=bmesh.new();bm.from_mesh(coat.data)
 bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000025)
 bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=(0,0,1.06),plane_no=(0,0,1),clear_inner=False,clear_outer=False)
 bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.calc_center_median().z<1.060001 and abs(f.calc_center_median().x)<.21],context='FACES')
 bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
 boundary=[e for e in bm.edges if e.is_boundary and all(abs(v.co.z-1.06)<.0001 and abs(v.co.x)<.21 for v in e.verts)]
 ring=list({v for e in boundary for v in e.verts});assert len(ring)>20,len(ring)
 ring.sort(key=lambda v:math.atan2(v.co.x,v.co.y+.045))
 angles=[math.atan2(v.co.x,v.co.y+.045) for v in ring];n=len(ring)
 uv=bm.loops.layers.uv.active
 for f in bm.faces:
  for loop in f.loops:loop[uv].uv.y=.52+.48*loop[uv].uv.y
 # Profiles progress from the waist, over the thighs and knees, down to the hem.
 # z values include the author's -.36 m seated rig translation.
 profiles=[(1.00,.18,.20,-.065,.01),(.94,.215,.28,-.12,.025),(.89,.24,.32,-.155,.035),(.83,.25,.33,-.165,.025),(.72,.252,.33,-.165,.015),(.58,.258,.335,-.165,.009),(.43,.267,.345,-.165,0),(.405,.267,.345,-.165,0)]
 previous=ring
 for j,(z,rx,ry,cy,frontlift) in enumerate(profiles):
  following=[]
  for angle in angles:
   fold=(.002+.006*j/(len(profiles)-1))*math.sin(angle*12)
   x=(rx+fold)*math.sin(angle);y=cy+(ry+fold)*math.cos(angle)
   v=bm.verts.new((x,y,z+frontlift*max(0,-math.cos(angle))));following.append(v)
  for i in range(n):
   k=(i+1)%n
   f=bm.faces.new((previous[i],following[i],following[k],previous[k]));f.material_index=0;f.smooth=True
   for loop,(u,vv) in zip(f.loops,[(i/n,j/len(profiles)),(i/n,(j+1)/len(profiles)),((i+1)/n,(j+1)/len(profiles)),((i+1)/n,j/len(profiles))]):loop[uv].uv=(u,.50*(1-vv))
  previous=following
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
 # An open hem can make the normal solver select the inside of the entire
 # connected dress. Explicitly orient the large skirt panels outward.
 bm.normal_update()
 if sum(f.calc_area()*f.normal.dot(Vector((f.calc_center_median().x,f.calc_center_median().y+.08,0))) for f in bm.faces)<0:
  bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
 bm.verts.index_update()
 bm.to_mesh(coat.data);bm.free()
 # New vertices have no armature weights: their coordinates already describe
 # the final seated cloth in rig space. The boundary retains the bodice weights.
 coat['continuous_seated_dress']=True
 print('JOINED DRESS',n,'waist vertices',len(profiles),'drape rings')
rig['resting_pose_revision']=1
bpy.context.preferences.filepaths.save_version=0;bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(Path(dest).resolve()))
