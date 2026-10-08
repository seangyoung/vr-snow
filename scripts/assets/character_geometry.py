"""Shared original figure construction, including the repaired torso and hands.
Snow uses the unmodified base; scene figures apply explicit interpretive variations.
"""
import bpy,bmesh,math
from mathutils import Vector
from mathutils.noise import noise_vector

def create_geometry():
 M={};parts={}
 def mat(name,color,rough=.8):
  m=bpy.data.materials.new(name);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF')
  rgb=[int(color[i:i+2],16)/255 for i in (0,2,4)]
  bs.inputs['Base Color'].default_value=(*[((v+.055)/1.055)**2.4 if v>.04045 else v/12.92 for v in rgb],1)
  bs.inputs['Roughness'].default_value=rough;M[name]=m
 for args in [('Coat','343633'),('Waistcoat','837969'),('Shirt','d9d2be'),('Skin','c3a38e'),('Hair','514338'),('Eye','3a3630'),('Eye white','b6ada0'),('Lip','99796b'),('Boot','2d2823',.5),('Button','75644d',.48)]:mat(*args)
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
 # Bent knees and low boots sit inside the chair/desk collision envelope.
 for side in [-1,1]:
  x=side*.115
  ellipsoid('Coat seated skirt',(x,.55,-.015),(.135,.105,.21),'Coat',root)
  limb('Trouser thigh',(x,.55,.015),(x,.51,.30),.10,.085,'Coat',root)
  ellipsoid('Trouser knee',(x,.49,.30),(.085,.09,.08),'Coat',root)
  limb('Trouser shin',(x,.48,.30),(x,.13,.34),.08,.061,'Coat',root)
  ellipsoid('Leather boot',(x,.075,.405),(.074,.065,.15),'Boot',root)
  ellipsoid('Boot sole',(x,.024,.405),(.076,.018,.152),'Boot',root)
 # Shaped torso and front waistcoat, with separate folded lapels.
 rings('Frock coat torso',[(.56,.16,.12,.12),(.65,.18,.125,.14),(.81,.155,.12,.12),(1.03,.19,.125,.14),(1.13,.225,.095,.12),(1.18,.15,.075,.085),(1.22,.065,.048,.052)],'Coat',upper)
 ellipsoid('Waistcoat front',(0,.925,.115),(.132,.24,.025),'Waistcoat')
 for side in [-1,1]:
  patch('Coat lapel',[(side*.16,1.145,.118),(side*.064,1.21,.076),(side*.038,1.085,.171),(side*.076,.94,.170),(side*.17,1.055,.148)],'Coat',upper)
  patch('Shirt collar',[(side*.051,1.233,.060),(0,1.228,.077),(side*.029,1.183,.121),(side*.060,1.202,.096)],'Shirt',upper)
 for y in [.79,.86,.93,1.0,1.07]:ellipsoid('Waistcoat button',(0,y,.143),(.009,.009,.004),'Button',segments=8,rings=4)
 ellipsoid('Cravat knot',(0,1.18,.112),(.024,.02,.014),'Coat')
 for side in [-1,1]:ellipsoid('Cravat fold',(side*.027,1.177,.108),(.025,.015,.012),'Coat')
 limb('Neck',(0,1.19,0),(0,1.30,0),.048,.046,'Skin')
 # Forearms rest forward, with four subdued finger forms and a thumb per hand.
 for side in [-1,1]:
  shoulder=(side*.185,1.10,0);elbow=(side*.235,.865,.16);wrist=(side*.20,.850,.515)
  ellipsoid('Coat shoulder',shoulder,(.070,.085,.075),'Coat')
  limb('Coat upper sleeve',shoulder,elbow,.067,.061,'Coat')
  ellipsoid('Coat elbow',elbow,(.065,.073,.065),'Coat')
  limb('Coat forearm',elbow,wrist,.056,.030,'Coat')
 from snow_hands import build_hands
 build_hands(finish,upper)
 # A continuous sculpted face replaces the separate primitive nose and jaw.
 from snow_face import build_face
 build_face(M,head,finish,ellipsoid,limb)
 # Blend the torso and sleeves into one continuous cloth shell, preserving lapels.
 obs=[o for o in parts if o.parent==upper and o.name.startswith(('Frock coat torso','Coat shoulder','Coat upper sleeve','Coat elbow','Coat forearm'))]
 bpy.ops.object.select_all(action='DESELECT')
 for ob in obs:ob.select_set(True);parts.pop(ob)
 bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();ob=obs[0]
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 remesh=ob.modifiers.new('Continuous coat silhouette','REMESH');remesh.mode='VOXEL';remesh.voxel_size=.009
 bpy.ops.object.modifier_apply(modifier=remesh.name)
 smooth=ob.modifiers.new('Relax cloth transitions','SMOOTH');smooth.factor=.8;smooth.iterations=5
 bpy.ops.object.modifier_apply(modifier=smooth.name)
 decimate=ob.modifiers.new('Mobile cloth mesh','DECIMATE');decimate.ratio=.20
 bpy.ops.object.modifier_apply(modifier=decimate.name)
 for poly in ob.data.polygons:poly.use_smooth=True
 parts[ob]=upper
 # Lapels have real thickness and finished edges rather than paper-like triangles.
 for ob in list(parts):
  if ob.name.startswith(('Coat lapel','Shirt collar')):
   bpy.context.view_layer.objects.active=ob
   solid=ob.modifiers.new('Fold thickness','SOLIDIFY');solid.thickness=.0025
   bpy.ops.object.modifier_apply(modifier=solid.name)
   bevel=ob.modifiers.new('Soft folded edge','BEVEL');bevel.width=.0015;bevel.segments=2
   bpy.ops.object.modifier_apply(modifier=bevel.name)
 # Higher collar and shorter exposed neck keep a natural seated silhouette.
 limb('Standing shirt collar',(0,1.205,0),(0,1.245,0),.051,.051,'Shirt')
 head.location.z-=.045
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
    rgb=[v*(factor+fold) for v in base]
   item.color=(*[max(0,min(1,v)) for v in rgb],1)
 for material in M.values():
  ns=material.node_tree.nodes;bs=ns.get('Principled BSDF')
  attr=ns.new('ShaderNodeVertexColor');attr.layer_name='Albedo'
  material.node_tree.links.new(attr.outputs['Color'],bs.inputs['Base Color'])
