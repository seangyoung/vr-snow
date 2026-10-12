"""Offline front, side and face checks, independent of furniture occlusion.
Called with --draft on the builders; no web assets are overwritten in draft mode.
"""
import bpy,math
from pathlib import Path
from mathutils import Vector

def review_anatomy(actors,key):
    scene=bpy.context.scene
    scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
    scene.view_settings.view_transform='AgX'
    scene.world.use_nodes=True
    scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.65,.7,.78,1)
    scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.45
    for ob in scene.objects:
        if ob.type in {'MESH','LIGHT'}:ob.hide_render=True
    camdata=bpy.data.cameras.new('Anatomy review');cam=bpy.data.objects.new('Anatomy review',camdata)
    scene.collection.objects.link(cam);scene.camera=cam
    out=Path('/private/tmp')/('character-anatomy-'+key);out.mkdir(exist_ok=True)
    for spec,root,upper,head,M,parts in actors:
        for ob in parts:ob.hide_render=False
        bpy.context.view_layer.update()
        points=[ob.matrix_world@Vector(corner) for ob in parts for corner in ob.bound_box]
        low=min(p.z for p in points);high=max(p.z for p in points);height=high-low
        def point(x,y,z):return root.matrix_world@Vector((x,-z,y))
        def aim(ob,pos,target):
            ob.location=pos;ob.rotation_euler=(target-pos).to_track_quat('-Z','Y').to_euler()
        lamps=[]
        for name,pos,power,size in [('Key',(-2,3,3),300,3),('Fill',(2,2,1),100,2)]:
            data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
            lamp=bpy.data.objects.new(name,data);scene.collection.objects.link(lamp);lamps.append(lamp)
            aim(lamp,point(*pos),point(0,1,0))
        head_points=[o.matrix_world@Vector(c) for o in parts if o.parent==head for c in o.bound_box]
        center=sum(head_points,Vector())/len(head_points)
        center.z=(min(p.z for p in head_points)+max(p.z for p in head_points))/2
        views=[('front',point(.22,height*.52,3.2),point(0,height*.50,.12),'ORTHO',height*1.13),
               ('side',point(3,height*.52,1),point(0,height*.5,.12),'ORTHO',height*1.13),
               ('face',center+(root.matrix_world.to_3x3()@Vector((.04,-1,0))),center,'ORTHO',.37)]
        for name,pos,target,kind,scale in views:
            camdata.type=kind;camdata.ortho_scale=scale;aim(cam,pos,target)
            scene.render.resolution_x=720;scene.render.resolution_y=720 if name=='face' else 1000
            scene.render.resolution_percentage=100
            scene.render.filepath=str(out/(spec['id']+'-'+name+'.png'))
            bpy.ops.render.render(write_still=True)
        for ob in parts:ob.hide_render=True
        for lamp in lamps:bpy.data.objects.remove(lamp,do_unlink=True)
