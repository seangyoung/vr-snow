"""One-time pose edit of the approved steward, retaining face and packed textures.
Usage: blender -b --python pose_workhouse_steward.py -- INPUT.blend OUTPUT.blend
Normal exports read the saved output and never run this authoring step.
"""
import bpy,math,sys
from pathlib import Path
from mathutils import Vector,Matrix
source,dest=sys.argv[sys.argv.index('--')+1:][:2]
bpy.ops.wm.open_mainfile(filepath=str(Path(source).resolve()))
rig=bpy.data.objects['Snow authoring rig']
for p in rig.pose.bones:p.matrix_basis=Matrix.Identity(4)
rig.location=(0,0,0)
# A small difference in the leg angles gives a settled standing stance.
rig.pose.bones['thigh_r'].rotation_mode='XYZ'
rig.pose.bones['thigh_r'].rotation_euler.y=.025
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
 bend=Vector((.55,.6,-1)) if side==1 else Vector((side*.22,.15,-1));bend=(bend-axis*bend.dot(axis)).normalized()
 elbow=shoulder+axis*along+bend*math.sqrt(max(0,upper.length**2-along**2))
 aim('upperarm_'+suffix,elbow-shoulder)
 aim('lowerarm_'+suffix,shoulder+axis*distance-rig.pose.bones['lowerarm_'+suffix].head)
 return rig.matrix_world@rig.pose.bones['hand_'+suffix].head

for side,suffix in [(1,'l'),(-1,'r')]:
    holding=side==1
    target=(.245,.025,.985) if holding else (-.29,-.025,.91)
    reach(suffix,target,side)
    forward=Vector((-.3,-1,0)) if holding else Vector((-.05,-.05,-1))
    across=Vector((1,0,0)) if holding else Vector((0,-1,0))
    p=rig.pose.bones['hand_'+suffix];rest=p.bone.matrix_local.to_3x3()
    long=rig.data.bones['middle_01_'+suffix].head_local-p.bone.head_local
    wide=rig.data.bones['index_01_'+suffix].head_local-rig.data.bones['pinky_01_'+suffix].head_local
    oy=long.normalized();ox=(wide-oy*wide.dot(oy)).normalized();oz=ox.cross(oy).normalized()
    ny=forward.normalized();nx=(across-ny*across.dot(ny)).normalized();nz=nx.cross(ny).normalized()
    mat=(Matrix((nx,ny,nz)).transposed()@Matrix((ox,oy,oz))@rest).to_4x4();mat.translation=p.head;p.matrix=mat
    bpy.context.view_layer.update()
    for i,finger in enumerate(['index','middle','ring','pinky']):
        for segment,curl in [(1,.05 if holding else .025),(2,.25 if holding else .10),(3,.45 if holding else .20)]:
            flex=Vector((-.2,.4,.6)) if holding else Vector((1,0,0))
            aim(f'{finger}_{segment:02d}_{suffix}',ny+nx*((i-1.5)*.018)+flex*curl)
    for segment in [2,3]:
        thumb=rig.pose.bones[f'thumb_{segment:02d}_{suffix}']
        aim(thumb.name,(thumb.tail-thumb.head).normalized().lerp(ny,.15))
# A closed ledger is tucked between the left upper arm and the ribs.
# Its covers face sideways; the hand rests under the lower edge.
# Reuse upper-body brown, linen and metal materials to retain the draw-call limit.
for ob in list(bpy.data.objects):
    if ob.name.startswith('Steward ledger'):bpy.data.objects.remove(ob,do_unlink=True)
def block(name,center,size,material):
    bpy.ops.mesh.primitive_cube_add(size=1,location=center);ob=bpy.context.object;ob.name='Steward ledger '+name
    ob.dimensions=size;bpy.ops.object.transform_apply(location=True,rotation=False,scale=True)
    ob.data.materials.append(bpy.data.materials[material])
    bevel=ob.modifiers.new('Soft book corners','BEVEL');bevel.width=.003;bevel.segments=1
    bpy.context.view_layer.objects.active=ob;bpy.ops.object.modifier_apply(modifier=bevel.name)
block('page block',(.200,-.015,1.16),(.045,.224,.274),'Shirt')
for x in [.169,.231]:block('leather cover',(x,-.015,1.16),(.012,.25,.30),'Waistcoat')
block('spine',(.200,-.138,1.16),(.074,.014,.30),'Waistcoat')
for z in [1.05,1.26]:block('spine band',(.200,-.147,z),(.078,.008,.016),'Buttons')
rig['pose_note']='Standing in the courtyard, ledger tucked under the left arm, right arm relaxed.'
rig['workhouse_doorway_revision']=2
bpy.context.preferences.filepaths.save_version=0;bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(Path(dest).resolve()))
