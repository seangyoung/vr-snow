"""Shared original figure construction, including the repaired torso and hands.
Snow and scene figures share fitted clothing, shaped faces and consistent baked detail lighting.
"""
import bpy,bmesh,math
from mathutils import Vector
from mathutils.noise import noise_vector

def create_geometry(appearance=None,pose='desk'):
 appearance=appearance or {}
 M={};parts={}
 def mat(name,color,rough=.8):
  m=bpy.data.materials.new(name);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF')
  rgb=[int(color[i:i+2],16)/255 for i in (0,2,4)]
  bs.inputs['Base Color'].default_value=(*[((v+.055)/1.055)**2.4 if v>.04045 else v/12.92 for v in rgb],1)
  bs.inputs['Roughness'].default_value=rough;M[name]=m
 for args in [('Coat','343633'),('Waistcoat','837969'),('Shirt','d9d2be'),('Skin','c3a38e'),('Hair','514338'),('Eye','3a3630'),('Eye white','ded6c9'),('Lip','99796b'),('Boot','2d2823',.5),('Button','75644d',.48)]:mat(*args)
 def empty(name,position):
  ob=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(ob);ob.location=(position[0],-position[2],position[1]);return ob
 root=empty('Snow_character',(0,0,0));upper=empty('Snow_upper',(0,.69,0));head=empty('Snow_head',(0,1.32,0))
 upper.parent=root;head.parent=root
 # Author parts in world coordinates, then retain them while parenting.
 def finish(ob,name,material,group):
  ob.name=name;ob.data.materials.append(M[material])
  for p in ob.data.polygons:p.use_smooth=True
  bpy.context.view_layer.update()
  world=ob.matrix_world.copy();ob.parent=group;ob.matrix_world=world
  parts[ob]=group;return ob
 def ellipsoid(name,pos,scale,material,group=upper,segments=16,rings=8):
  bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,radius=1,location=(pos[0],-pos[2],pos[1]))
  ob=bpy.context.object;ob.scale=(scale[0],scale[2],scale[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
  return finish(ob,name,material,group)
 def limb(name,a,b,ra,rb,material,group=upper):
  aa=Vector((a[0],-a[2],a[1]));bb=Vector((b[0],-b[2],b[1]));delta=bb-aa
  # Tiny eyelid/brow cross-sections need fewer sides than full sleeves.
  bpy.ops.mesh.primitive_cone_add(vertices=8 if max(ra,rb)<.003 else 16,radius1=ra,radius2=rb,depth=delta.length,location=(aa+bb)/2)
  ob=bpy.context.object;ob.rotation_euler=delta.to_track_quat('Z','Y').to_euler()
  return finish(ob,name,material,group)
 def patch(name,points,material,group):
  coords=[Vector((x,-z,y)) for x,y,z in points]
  order=list(range(len(coords)))
  # Choose outward winding before creating the mesh; both mirrored lapels must
  # face forward. Relying on not-yet-evaluated polygon normals left one inverted.
  if (coords[1]-coords[0]).cross(coords[2]-coords[0]).y>0:order.reverse()
  mesh=bpy.data.meshes.new(name);mesh.from_pydata(coords,[],[order]);mesh.update()
  ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob)
  finish(ob,name,material,group)
  for poly in mesh.polygons:poly.use_smooth=False
  return ob
 def rings(name,profile,material,group,sides=32):
  verts=[];faces=[]
  for y,rx,front,back in profile:
   for i in range(sides):
    a=i*math.tau/sides;c=math.cos(a);verts.append((rx*math.sin(a),-c*(front if c>0 else back),y))
  for row in range(len(profile)-1):
   for i in range(sides):faces.append((row*sides+i,row*sides+(i+1)%sides,(row+1)*sides+(i+1)%sides,(row+1)*sides+i))
  # A closed volume is essential: voxel remeshing an open shell deletes its torso.
  faces.extend([tuple(reversed(range(sides))),tuple((len(profile)-1)*sides+i for i in range(sides))])
  mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
  bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(mesh);bm.free()
  ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob);return finish(ob,name,material,group)
 def blend_shell(obs,name,group,voxel=.009,ratio=.20):
  bpy.ops.object.select_all(action='DESELECT')
  for ob in obs:ob.select_set(True);parts.pop(ob)
  bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();ob=obs[0];ob.name=name
  bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
  remesh=ob.modifiers.new('Continuous cloth surface','REMESH');remesh.mode='VOXEL';remesh.voxel_size=voxel
  bpy.ops.object.modifier_apply(modifier=remesh.name)
  smooth=ob.modifiers.new('Relax cloth transitions','SMOOTH');smooth.factor=.8;smooth.iterations=5
  bpy.ops.object.modifier_apply(modifier=smooth.name)
  decimate=ob.modifiers.new('Mobile cloth mesh','DECIMATE');decimate.ratio=ratio
  bpy.ops.object.modifier_apply(modifier=decimate.name)
  for poly in ob.data.polygons:poly.use_smooth=True
  parts[ob]=group;return ob
 # A joined pelvis and overlapping knee volumes make one continuous lower
 # body. The upper coat overlaps its waist even during the tiny breathing motion.
 standing=pose=='standing'
 ellipsoid('Trouser pelvis',(0,.865 if standing else .565,-.015),(.182,.15 if standing else .13,.135),'Coat',root,24,12)
 for side in [-1,1]:
  x=side*.105
  hip=(x,.93 if standing else .565,0)
  knee=(side*.108,.475 if standing else .495,.018 if standing else .29)
  ankle=(side*.115,.125,.04 if standing else .34)
  limb('Trouser thigh',hip,knee,.080 if standing else .108,.079,'Coat',root)
  if standing:ellipsoid('Trouser upper thigh',(x,.76,.005),(.098,.18,.098),'Coat',root,20,12)
  ellipsoid('Trouser knee',knee,(.080,.085,.079),'Coat',root)
  limb('Trouser shin',knee,ankle,.078,.058,'Coat',root)
  ellipsoid('Leather boot',(ankle[0],.075,ankle[2]+.065),(.074,.065,.15),'Boot',root)
  ellipsoid('Boot sole',(ankle[0],.024,ankle[2]+.065),(.076,.018,.152),'Boot',root)
 blend_shell([ob for ob in parts if ob.name.startswith('Trouser')],'Trouser continuous pelvis and legs',root,.008,.07)
 # Shaped torso and front waistcoat, with separate folded lapels.
 hem=[(.43,.215,.15,.15),(.60,.205,.14,.15),(.72,.18,.125,.14)] if standing else [(.56,.18,.125,.14),(.65,.18,.125,.14)]
 rings('Frock coat torso',hem+[(.81,.155,.12,.12),(1.03,.19,.125,.14),(1.13,.225,.095,.12),(1.18,.15,.075,.085),(1.22,.065,.048,.052)],'Coat',upper)
 # A fitted panel follows the chest rather than a projecting oval belly.
 vest=rings('Waistcoat front',[(.705,.123,.132,.060),(.78,.139,.137,.060),(.91,.153,.147,.060),(1.045,.157,.148,.060),(1.145,.094,.111,.050)],'Waistcoat',upper)
 # Coat seams, waistcoat pocket welts and a narrow button placket.
 for side in (-1,1):
  limb('Waistcoat pocket welt',(side*.038,.83,.14),(side*.112,.835,.125),.0025,.0025,'Waistcoat')
 for side in [-1,1]:
  patch('Coat lapel',[(side*.142,1.145,.100),(side*.062,1.205,.073),(side*.052,1.133,.137),(side*.093,1.10,.144),(side*.07,.985,.155),(side*.148,1.064,.122)],'Coat',upper)
  patch('Shirt collar',[(side*.047,1.228,.060),(side*.012,1.223,.074),(side*.031,1.187,.113),(side*.053,1.204,.09)],'Shirt',upper)
 for y in [.76,.825,.89,.955,1.02]:ellipsoid('Waistcoat button',(0,y,.139+.013*min(1,(y-.76)/.2)),(.0055,.0055,.003),'Button',segments=8,rings=4)
 ellipsoid('Cravat knot',(0,1.18,.112),(.024,.02,.014),'Coat')
 for side in [-1,1]:ellipsoid('Cravat fold',(side*.027,1.177,.108),(.025,.015,.012),'Coat')
 limb('Neck',(0,1.19,0),(0,1.30,0),.048,.046,'Skin')
 # Forearms rest forward, with four subdued finger forms and a thumb per hand.
 wrists={}
 for side in [-1,1]:
  shoulder=(side*.185,1.10,0)
  if standing:elbow=(side*.255,.86,.008);wrist=(side*.275,.615,.040)
  elif pose=='lap':elbow=(side*.245,.845,.08);wrist=(side*.20,.645,.245)
  elif pose=='table':elbow=(side*.235,.815,.16);wrist=(side*.20,.750,.515)
  else:elbow=(side*.235,.865,.16);wrist=(side*.20,.850,.515)
  wrists[side]=wrist
  ellipsoid('Coat shoulder',shoulder,(.070,.085,.075),'Coat')
  limb('Coat upper sleeve',shoulder,elbow,.067,.061,'Coat')
  ellipsoid('Coat elbow',elbow,(.065,.073,.065),'Coat')
  limb('Coat forearm',elbow,wrist,.056,.030,'Coat')
 from snow_hands import build_hands
 build_hands(finish,upper,pose,wrists)
 # A continuous sculpted face replaces the separate primitive nose and jaw.
 from snow_face import build_face
 build_face(M,head,finish,ellipsoid,limb,appearance)
 # Blend the torso and sleeves into one continuous cloth shell, preserving lapels.
 obs=[o for o in parts if o.parent==upper and o.name.startswith(('Frock coat torso','Coat shoulder','Coat upper sleeve','Coat elbow','Coat forearm'))]
 blend_shell(obs,'Frock coat torso',upper)
 # Lapels have real thickness and finished edges rather than paper-like triangles.
 for ob in list(parts):
  if ob.name.startswith(('Coat lapel','Shirt collar')):
   bpy.context.view_layer.objects.active=ob
   solid=ob.modifiers.new('Fold thickness','SOLIDIFY');solid.thickness=.0025
   bpy.ops.object.modifier_apply(modifier=solid.name)
   bevel=ob.modifiers.new('Soft folded edge','BEVEL');bevel.width=.0015;bevel.segments=2
   bpy.ops.object.modifier_apply(modifier=bevel.name)
 # Shallow compression folds at elbows, cuff and shoulder interrupt smooth tubes.
 for ob in parts:
  if ob.name.startswith('Frock coat torso'):
   bpy.context.view_layer.update();matrix=ob.matrix_world.copy();inv=matrix.inverted()
   for v in ob.data.vertices:
    p=matrix@v.co;x,y,z=p.x,p.z,-p.y
    sleeve=max(0,min(1,(abs(x)-.17)/.045))
    fold=sleeve*(.0028*math.sin((y+z*.35)*120)*math.exp(-((y-.88)/.055)**2))
    p.x+=math.copysign(fold,x);p.y-=fold*.45;v.co=inv@p
 # Higher collar and shorter exposed neck keep a natural seated silhouette.
 limb('Standing shirt collar',(0,1.205,0),(0,1.245,0),.051,.051,'Shirt')
 head.location.z-=.045
 if standing:
  upper.location.z+=.25;head.location.z+=.25
 return dict(M=M,parts=parts,root=root,upper=upper,head=head,finish=finish,ellipsoid=ellipsoid,limb=limb,rings=rings,patch=patch)

def paint_albedo(M,parts):
 # Original vertex albedo adds restrained skin, hair and fabric variation without
 # large downloaded textures or runtime procedural shaders. No lighting is painted in.
 bpy.context.view_layer.update()
 for ob in parts:
  material=ob.data.materials[0];bs=material.node_tree.nodes.get('Principled BSDF')
  base=tuple(bs.inputs['Base Color'].default_value[:3])
  color=ob.data.color_attributes.new(name='Albedo',type='FLOAT_COLOR',domain='POINT')
  for vertex,item in zip(ob.data.vertices,color.data):
   p=ob.matrix_world@vertex.co;x,y,z=p.x,p.z,-p.y
   grain=noise_vector(p*95)[0]
   factor=1+grain*.025;rgb=[v*factor for v in base]
   if material==M['Skin']:
    # Gentle warmth at cheeks, nose, ears and hands; slight coolness under eyes.
    warm=math.exp(-((abs(x)-.045)/.027)**2-((y-1.389)/.023)**2) if z>0 else 0
    warm+=.3*math.exp(-(x/.025)**2-((y-1.38)/.025)**2)
    rgb=[base[0]*(factor+.035*warm),base[1]*(factor-.06*warm),base[2]*(factor-.065*warm)]
   elif material==M['Hair']:
    strand=.075*math.sin(x*620+y*150+z*280)
    rgb=[v*(factor+strand) for v in base]
   elif material in (M['Coat'],M['Waistcoat']):
    fold=.025*math.sin(y*110+x*25)*math.sin(z*35)
    seam=.12*math.exp(-(x/.004)**2) if material==M['Waistcoat'] and z>.10 else 0
    rgb=[v*(factor+fold-seam) for v in base]
   item.color=(*[max(0,min(1,v)) for v in rgb],1)
 for material in M.values():
  ns=material.node_tree.nodes;bs=ns.get('Principled BSDF')
  attr=ns.new('ShaderNodeVertexColor');attr.layer_name='Albedo'
  material.node_tree.links.new(attr.outputs['Color'],bs.inputs['Base Color'])


def facial_details(parts):
 return [ob for ob in parts if ob.name.startswith(('Eye white','Iris','Pupil','Upper lid','Lower lid','Upper lip','Lower lip','Nostril','Brow','Mouth seam','Eye crease'))]


def stabilize_head_lighting(head):
 """Inherit face irradiance at triangle interiors, away from atlas gutters.
 Tiny overlays and hair caps otherwise expose dark bake seams at their edges.
 Run after material batching; preserve the existing atlas and texture budget.
 """
 from mathutils.kdtree import KDTree
 skin=next((o for o in head.children if o.type=='MESH' and o.name.endswith('_Skin')),None)
 if skin is None:return
 uv=skin.data.uv_layers.get('Lightmap')
 if uv is None:return
 bpy.context.view_layer.update()
 # Identify the continuous face independently of current UVs, making this
 # correction safe to repeat on already exported sources. Lids are separate
 # small components; ears keep their own bake.
 neighbors=[set() for _ in skin.data.vertices]
 for edge in skin.data.edges:
  a,b=edge.vertices;neighbors[a].add(b);neighbors[b].add(a)
 unseen=set(range(len(neighbors)));components=[]
 while unseen:
  pending=[unseen.pop()];component=set(pending)
  while pending:
   for vertex in neighbors[pending.pop()]&unseen:
    unseen.remove(vertex);component.add(vertex);pending.append(vertex)
  components.append(component)
 face_vertices=max(components,key=len)
 overlay_vertices=set().union(*(component for component in components if len(component)<80))
 samples=[]
 damaged=set()
 for poly in skin.data.polygons:
  if poly.vertices[0] not in face_vertices:continue
  indices=list(poly.loop_indices)
  values=[uv.data[i].uv for i in indices]
  if any(max(v)>=.98 for v in values) or any((a-b).length>.06 for a in values for b in values):
   damaged.add(poly.index);continue
  center=sum((skin.matrix_world@skin.data.vertices[skin.data.loops[i].vertex_index].co for i in indices),Vector())/len(indices)
  sample=sum((v.copy() for v in values),Vector((0,0)))/len(values)
  samples.append((center,sample))
 tree=KDTree(len(samples))
 for i,(center,_) in enumerate(samples):tree.insert(center,i)
 tree.balance()
 # The scalp is shadowed by its cap in the bake. Hair inherits nearby exposed
 # face lighting instead of those occluded texels; keep the color in its albedo.
 inv=head.matrix_world.inverted()
 local=[inv@center for center,_ in samples]
 low=min(p.z for p in local);span=max(p.z for p in local)-low
 exposed=[i for i,p in enumerate(local) if low+span*.75<p.z<low+span*.82 and p.y<-.045 and abs(p.x)<.020]
 hairtree=KDTree(len(exposed))
 for i in exposed:hairtree.insert(samples[i][0],i)
 hairtree.balance()
 for ob in head.children:
  if ob.type!='MESH' or not ob.name.endswith(('_Skin','_Hair','_Eye','_Eye white','_Lip')):continue
  target=ob.data.uv_layers.get('Lightmap')
  if target is None:continue
  for poly in ob.data.polygons:
   indices=list(poly.loop_indices)
   # Keep the continuous face bake; replace only neutral-patch skin overlays.
   if ob==skin and poly.vertices[0] not in overlay_vertices and poly.index not in damaged:continue
   center=sum((ob.matrix_world@ob.data.vertices[ob.data.loops[i].vertex_index].co for i in indices),Vector())/len(indices)
   # Temple texels sit under sideburns. Never inherit those self-shadows onto
   # the visible hair or ear concha: they create checkerboard-black patches.
   central=ob.name.endswith('_Hair') or (ob.name.endswith('_Lip') and abs((inv@center).x)>.065)
   search=hairtree if central and exposed else tree
   # One exposed forehead sample gives the hair a coherent incident-light
   # level; color/strand variation stays in albedo. Per-triangle nearest-face
   # sampling otherwise changes abruptly across nose and sideburn shadows.
   _,nearest,_=search.find(head.matrix_world@Vector((0,-.08,low+span*.79)) if central and exposed else center)
   # Keep each polygon within one atlas island. Independently chosen corner
   # samples interpolate across unrelated islands and produce black streaks.
   for i in indices:target.data[i].uv=samples[nearest][1]
