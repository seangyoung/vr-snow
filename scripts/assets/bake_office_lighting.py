"""Cycles diffuse-light atlas and static reflection capture for Snow's office.
The GLB retains ordinary materials and vertex shading as a loading fallback.
"""
import bpy, math
from mathutils import Vector


def bake_office(materials, root, exterior):
    scene=bpy.context.scene
    scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=256
    scene.cycles.sample_clamp_indirect=3
    scene.cycles.max_bounces=5;scene.cycles.diffuse_bounces=4
    scene.render.bake.margin=8;scene.render.bake.use_clear=False
    scene.view_settings.view_transform='Standard'
    scene.view_settings.look='None';scene.view_settings.exposure=0;scene.view_settings.gamma=1
    scene.world.use_nodes=True
    scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.58,.67,.76,1)
    scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.25
    def area(name,position,target,power,size,color):
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
        ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob)
        ob.location=(position[0],-position[2],position[1])
        aim=Vector((target[0],-target[2],target[1]));ob.rotation_euler=(aim-ob.location).to_track_quat('-Z','Y').to_euler()
        return ob
    # One broad window source, restrained room bounce and cool exterior daylight.
    lights=[area('Baked window daylight',(3.35,2.35,-.3),(-1,1,0),260,2.0,(.88,.94,1)),
            area('Baked soft room fill',(0,3.05,.5),(0,0,0),55,3.8,(1,.88,.71)),
            area('Baked exterior daylight',(7,12,0),(12,0,0),2300,10,(.9,.95,1))]
    # More differentiated surface response; no texture dirt or extra geometry.
    for name,rough,metal in [('Brass',.3,.8),('Pewter',.38,.75),('Dark walnut',.43,0),
                             ('Oak',.66,0),('Green leather',.58,0),('Rug',.98,0),('Plaster',.96,0)]:
        bs=materials[name].node_tree.nodes.get('Principled BSDF')
        bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal
    interior=[o for o in scene.objects if o.type=='MESH' and o not in exterior]
    originals=[];copies=[];face_map={};face_id=0
    for ob in interior:
        layer=ob.data.uv_layers.new(name='Lightmap')
        original_render=ob.hide_render;ob.hide_render=True;originals.append((ob,original_render))
        cp=ob.copy();cp.data=ob.data.copy();scene.collection.objects.link(cp);cp.hide_render=False
        ids=cp.data.attributes.new('bake_face_id','INT','FACE')
        for poly in cp.data.polygons:
            ids.data[poly.index].value=face_id;face_map[face_id]=(ob,poly.index);face_id+=1
        copies.append(cp)
    bpy.ops.object.select_all(action='DESELECT')
    for cp in copies:cp.select_set(True)
    bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();target=copies[0];target.name='Temporary lightmap receiver'
    target.data.uv_layers.active_index=1
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.004,area_weight=1)
    bpy.ops.object.mode_set(mode='OBJECT')
    # Keep a small neutral patch outside the packed interior for outdoor meshes.
    for uv in target.data.uv_layers['Lightmap'].data:uv.uv=uv.uv*.94+Vector((.025,.025))
    atlas=bpy.data.images.new('Snow office diffuse light',width=2048,height=2048,alpha=False,float_buffer=True)
    atlas.colorspace_settings.name='Linear Rec.709'
    nodes=[]
    for mat in materials.values():
        node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=atlas;mat.node_tree.nodes.active=node;nodes.append((mat,node))
    # Diffuse irradiance excludes albedo; temporarily nonmetallic for a valid bake on metals.
    metal=[]
    for mat in materials.values():
        inp=mat.node_tree.nodes.get('Principled BSDF').inputs['Metallic'];metal.append((inp,inp.default_value));inp.default_value=0
    bpy.ops.object.bake(type='DIFFUSE',pass_filter={'DIRECT','INDIRECT'},uv_layer='Lightmap')
    for inp,value in metal:inp.default_value=value
    for poly in target.data.polygons:
        ob,pi=face_map[target.data.attributes['bake_face_id'].data[poly.index].value]
        for li,src in zip(ob.data.polygons[pi].loop_indices,poly.loop_indices):
            ob.data.uv_layers['Lightmap'].data[li].uv=target.data.uv_layers['Lightmap'].data[src].uv
    bpy.data.objects.remove(target,do_unlink=True)
    for ob,hidden in originals:
        ob.hide_render=hidden;ob.data.uv_layers.active_index=0;ob.data.uv_layers[0].active_render=True
    for ob in exterior:
        uv=ob.data.uv_layers.new(name='Lightmap')
        for item in uv.data:item.uv=(.99,.99)
        ob.data.uv_layers.active_index=0;ob.data.uv_layers[0].active_render=True
    # Normalize linear lighting into an ordinary sRGB PNG; restore scale at runtime.
    import numpy as np
    pixels=np.array(atlas.pixels[:],dtype=np.float32).reshape(2048,2048,4)
    peak=float(np.quantile(pixels[:,:,:3],.999))
    # Bake denoising is not supplied by Cycles' render denoiser. A small separable
    # filter suppresses remaining sampling grain; UV gutters exceed its 2 px radius.
    rgb=pixels[:,:,:3]
    for axis in [0,1]:
        rgb=sum(np.roll(rgb,shift,axis=axis)*weight for shift,weight in [(-2,1/16),(-1,4/16),(0,6/16),(1,4/16),(2,1/16)])
    pixels[:,:,:3]=rgb
    pixels[:,:,:3]=np.clip(pixels[:,:,:3]/4,0,1)
    pixels[2010:,:,:3]=.45/4;pixels[:,2010:,:3]=.45/4
    pixels[:,:,3]=1;atlas.pixels.foreach_set(pixels.ravel())
    path=root/'public/models/snow-office-lightmap.png'
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB';scene.render.image_settings.color_depth='8'
    atlas.save_render(str(path),scene=scene)
    for mat,node in nodes:mat.node_tree.nodes.remove(node)
    # Keep the atlas packed for editing, without embedding it twice in the GLB.
    atlas.filepath=str(path);atlas.pack()
    # Capture a static room environment for restrained view-dependent highlights.
    camera_data=bpy.data.cameras.new('Office reflection capture');camera_data.type='PANO';camera_data.panorama_type='EQUIRECTANGULAR'
    camera=bpy.data.objects.new('Office reflection capture',camera_data);scene.collection.objects.link(camera)
    camera.location=(0,.2,1.45);camera.rotation_euler=(math.pi/2,0,0);scene.camera=camera
    scene.render.resolution_x=1024;scene.render.resolution_y=512;scene.render.resolution_percentage=100
    scene.cycles.samples=32;scene.cycles.use_denoising=True
    scene.render.filepath=str(root/'public/models/snow-office-environment.png')
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(camera,do_unlink=True)
    # Lamps remain editable in .blend but are deliberately excluded from GLB export.
    return {'size':2048,'normalization':4,'diffusePeak999':round(peak,4),'environmentSize':[1024,512]}
