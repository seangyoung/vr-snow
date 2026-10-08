"""Original interpretive seated Snow figure. See docs/presence-and-sound.md.
Uses the office as a lighting/occlusion reference; exports only the character.
"""
import bpy,math,json,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).resolve().parent))
from bake_scene_lighting import bake_lighting
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/snow-office/snow-office.blend'))
room=set(bpy.context.scene.objects);M={};parts={}
def mat(name,color,rough=.8):
 m=bpy.data.materials.new(name);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF')
 rgb=[int(color[i:i+2],16)/255 for i in (0,2,4)]
 bs.inputs['Base Color'].default_value=(*[((v+.055)/1.055)**2.4 if v>.04045 else v/12.92 for v in rgb],1)
 bs.inputs['Roughness'].default_value=rough;M[name]=m
for args in [('Coat','323431'),('Waistcoat','655d50'),('Shirt','d9d2be'),('Skin','bda08b'),('Hair','443b32'),('Eye','3a3630'),('Eye white','aea798'),('Lip','886d60'),('Boot','2d2823',.5),('Button','75644d',.48)]:mat(*args)
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
 bpy.ops.mesh.primitive_cone_add(vertices=16,radius1=ra,radius2=rb,depth=delta.length,location=(aa+bb)/2)
 ob=bpy.context.object;ob.rotation_euler=delta.to_track_quat('Z','Y').to_euler()
 return finish(ob,name,material,group)
def patch(name,points,material,group):
 mesh=bpy.data.meshes.new(name);mesh.from_pydata([(x,-z,y) for x,y,z in points],[],[tuple(range(len(points)))]);mesh.update()
 ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob);return finish(ob,name,material,group)
def rings(name,profile,material,group,sides=32):
 verts=[];faces=[]
 for y,rx,front,back in profile:
  for i in range(sides):
   a=i*math.tau/sides;c=math.cos(a);verts.append((rx*math.sin(a),-c*(front if c>0 else back),y))
 for row in range(len(profile)-1):
  for i in range(sides):faces.append((row*sides+i,row*sides+(i+1)%sides,(row+1)*sides+(i+1)%sides,(row+1)*sides+i))
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
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
 patch('Coat lapel',[(side*.16,1.145,.095),(side*.064,1.21,.053),(side*.038,1.085,.146),(side*.076,.94,.142),(side*.17,1.055,.123)],'Coat',upper)
 patch('Shirt collar',[(side*.051,1.233,.060),(0,1.228,.077),(side*.033,1.151,.137),(side*.074,1.185,.100)],'Shirt',upper)
for y in [.79,.86,.93,1.0,1.07]:ellipsoid('Waistcoat button',(0,y,.143),(.009,.009,.004),'Button',segments=8,rings=4)
ellipsoid('Cravat knot',(0,1.18,.112),(.024,.02,.014),'Coat')
for side in [-1,1]:ellipsoid('Cravat fold',(side*.027,1.177,.108),(.025,.015,.012),'Coat')
limb('Neck',(0,1.19,0),(0,1.30,0),.048,.046,'Skin')
# Forearms rest forward, with four subdued finger forms and a thumb per hand.
for side in [-1,1]:
 shoulder=(side*.213,1.12,0);elbow=(side*.25,.865,.16);wrist=(side*.20,.835,.40)
 ellipsoid('Coat shoulder',shoulder,(.080,.10,.083),'Coat')
 limb('Coat upper sleeve',shoulder,elbow,.078,.064,'Coat')
 ellipsoid('Coat elbow',elbow,(.065,.073,.065),'Coat')
 limb('Coat forearm',elbow,wrist,.061,.045,'Coat')
 limb('Shirt cuff',wrist,(side*.198,.831,.43),.045,.044,'Shirt')
 ellipsoid('Resting hand',(side*.197,.824,.468),(.044,.024,.052),'Skin')
 for finger in range(4):
  xx=side*.197+(finger-1.5)*.018
  ellipsoid('Resting finger',(xx,.817,.516-abs(finger-1.5)*.006),(.010,.013,.032),'Skin',segments=10,rings=6)
 ellipsoid('Thumb',(side*.153,.821,.466),(.014,.018,.037),'Skin',segments=10,rings=6)
# Sculpted head outline with a high forehead, tapered jaw and swept-back hair.
head_profile=[(1.285,.015,.035,.03),(1.30,.046,.060,.055),(1.33,.065,.066,.068),(1.38,.078,.064,.079),(1.44,.080,.060,.084),(1.49,.075,.065,.086),(1.54,.065,.062,.072),(1.575,.035,.036,.039),(1.585,.003,.004,.004)]
face=rings('Face',head_profile,'Skin',head)
for side in [-1,1]:
 ellipsoid('Ear',(side*.080,1.409,-.003),(.015,.031,.017),'Skin',head,12,8)
 ellipsoid('Sideburn',(side*.074,1.428,.008),(.010,.055,.031),'Hair',head,12,8)
 # Shallow eyelids avoid large exposed eyeballs at close range.
 ellipsoid('Eye socket',(side*.032,1.443,.056),(.019,.008,.009),'Skin',head,12,8)
 ellipsoid('Eye white',(side*.032,1.444,.065),(.012,.003,.004),'Eye white',head,12,8)
 ellipsoid('Iris',(side*.032,1.444,.068),(.0035,.0035,.0018),'Eye',head,12,6)
 limb('Brow',(side*.013,1.460,.066),(side*.050,1.459,.060),.002,.0025,'Hair',head)
# Nose joins bridge and rounded tip rather than a long cone.
ellipsoid('Nose bridge',(0,1.428,.069),(.010,.028,.013),'Skin',head,16,10)
ellipsoid('Nose tip',(0,1.406,.087),(.013,.011,.013),'Skin',head,16,10)
for side in [-1,1]:ellipsoid('Nose wing',(side*.012,1.400,.079),(.010,.009,.010),'Skin',head,12,8)
ellipsoid('Upper lip',(0,1.369,.065),(.025,.0035,.004),'Lip',head,16,6)
ellipsoid('Lower lip',(0,1.363,.065),(.022,.004,.005),'Skin',head,16,6)
# Hair cap follows the face surface and leaves the forehead exposed.
verts=[];faces=[];sides=40
# Interpolate the sculpted skull at each height for a smooth, receding hairline.
def skull_at(y):
 for a,b in zip(head_profile,head_profile[1:]):
  if a[0]<=y<=b[0]:
   t=(y-a[0])/(b[0]-a[0]);return [a[i]+t*(b[i]-a[i]) for i in [1,2,3]]
 return [.002,.002,.002]
for j in range(13):
 t=j/12
 for i in range(sides):
  angle=i*math.tau/sides;front=max(math.cos(angle),0)
  low=1.413+.11*front+.023*abs(math.sin(angle))*front
  y=1.584+(low-1.584)*t;rx,fd,bd=skull_at(y)
  c=math.cos(angle);verts.append(((rx+.002)*math.sin(angle),-c*((fd if c>0 else bd)+.003),y+.002))
for j in range(12):
 for i in range(sides):faces.append((j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i))
mesh=bpy.data.meshes.new('Hair');mesh.from_pydata(verts,[],faces);mesh.update()
ob=bpy.data.objects.new('Swept hair',mesh);bpy.context.collection.objects.link(ob);finish(ob,'Swept hair','Hair',head)
# Higher collar and shorter exposed neck keep a natural seated silhouette.
limb('Standing shirt collar',(0,1.205,0),(0,1.245,0),.051,.051,'Shirt')
head.location.z-=.025
# Give every part a base UV set; the bake provides a second independent set.
for ob in parts:
 if not ob.data.uv_layers:ob.data.uv_layers.new(name='UVMap')
root.location=(-.65,2.28,0);bpy.context.view_layer.update()
report=bake_lighting(M,ROOT,asset='snow-character',size=512,environment_width=256,
                    lights=[],exterior={o for o in parts if o.name.startswith(('Brow','Eye white','Iris','Upper lip','Waistcoat button'))},neutral_value=.6,occluders={o for o in room if o.type=='MESH'},probe=(-.65,1.35,-2.1))
# Batch within each animated part; preserve head and torso pivots.
for group in [root,upper,head]:
 for name,material in M.items():
  obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==group and o.data.materials[0]==material]
  if not obs:continue
  bpy.ops.object.select_all(action='DESELECT')
  for ob in obs:ob.select_set(True)
  bpy.context.view_layer.objects.active=obs[0]
  if len(obs)>1:bpy.ops.object.join()
  obs[0].name=f'{group.name}_{name}'
character=[o for o in bpy.context.scene.objects if o not in room and o.type in {'MESH','EMPTY'}]
asset=ROOT/'assets/snow-character';asset.mkdir(exist_ok=True)
bpy.context.preferences.filepaths.save_version=0;bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(asset/'snow-character.blend'))
bpy.ops.object.select_all(action='DESELECT')
for ob in character:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/snow-character.glb'),export_format='GLB',use_selection=True,export_yup=True,export_cameras=False,export_lights=False)
triangles=sum(len(p.vertices)-2 for o in character if o.type=='MESH' for p in o.data.polygons)
summary={'triangles':triangles,'materialBatches':sum(o.type=='MESH' for o in character),'bakedLighting':report,'interpretive':True,'reference':'https://epi-snow.ph.ucla.edu/Stream1_introduction_b.html'}
(asset/'build-report.json').write_text(json.dumps(summary,indent=2)+'\n');print('SNOW CHARACTER',summary)
