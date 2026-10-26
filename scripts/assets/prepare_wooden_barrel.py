"""Prepare MatteReal's CC BY 3.0 Wooden Barrels as a packed, reusable room asset.
blender --background --factory-startup --disable-autoexec --python scripts/assets/prepare_wooden_barrel.py -- SOURCE.blend
The prepared blend is tracked; room rebuilds do not require the user's download.
"""
import bpy,bmesh,sys,json,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
source=Path(sys.argv[sys.argv.index('--')+1])
output=ROOT/'assets/wooden-barrel';output.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False,use_scripts=False)
barrel=bpy.data.objects['Cylinder']
bpy.context.view_layer.objects.active=barrel
for mod in list(barrel.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
mod=barrel.modifiers.new('Quest cask simplification','DECIMATE');mod.ratio=.0125
bpy.ops.object.modifier_apply(modifier=mod.name)
# Normalize the editable master to the existing rack envelope: diameter .92m, length .80m.
points=[barrel.matrix_world@v.co for v in barrel.data.vertices]
lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)])
for v,p in zip(barrel.data.vertices,points):v.co=Vector([(p[i]-(lo[i]+hi[i])/2)/(hi[i]-lo[i])*[.92,.92,.80][i] for i in range(3)])
barrel.matrix_world.identity();barrel.name='Detailed cask master'
# Legacy hoop shells have inward-facing normals. Repair each connected shell so
# glTF backface culling keeps the outside visible without double-sided rendering.
mesh=bmesh.new();mesh.from_mesh(barrel.data)
bmesh.ops.recalc_face_normals(mesh,faces=list(mesh.faces))
mesh.to_mesh(barrel.data);mesh.free();barrel.data.update()
# Only the author's wood maps are reused. OpenFootage metal textures are replaced
# by our own restrained iron material, avoiding an unresolved secondary license.
wood=bpy.data.materials['Tonneau'];iron=bpy.data.materials['Arceau']
wood.name='Cask oak';iron.name='Cask iron'
for mat in [wood,iron]:
 mat.node_tree.nodes.clear();nodes=mat.node_tree.nodes;links=mat.node_tree.links
 bs=nodes.new('ShaderNodeBsdfPrincipled');bs.name='Principled BSDF';out=nodes.new('ShaderNodeOutputMaterial');links.new(bs.outputs['BSDF'],out.inputs['Surface'])
 bs.inputs['Roughness'].default_value=.78 if mat==wood else .67
 bs.inputs['Metallic'].default_value=0 if mat==wood else .45
 mat.use_backface_culling=True
 if mat==iron:bs.inputs['Base Color'].default_value=(.055,.045,.032,1)
 else:
  for original,name,kind in [('Texture_Tonneau_COLOR.png','cask-oak-color','color'),('Texture_Tonneau_NRM.jpg','cask-oak-normal','normal')]:
   source_image=bpy.data.images[original];source_image.scale(1024,1024)
   # A fresh image avoids repacking the original 2K byte stream from old blends.
   image=bpy.data.images.new(name,width=1024,height=1024,alpha=False)
   image.colorspace_settings.name='sRGB' if kind=='color' else 'Non-Color'
   image.pixels.foreach_set(source_image.pixels[:])
   image.filepath_raw=str(output/(name+('.jpg' if kind=='color' else '.png')));image.file_format='JPEG' if kind=='color' else 'PNG';image.save();image.pack()
   tex=nodes.new('ShaderNodeTexImage');tex.image=image
   if kind=='color':links.new(tex.outputs['Color'],bs.inputs['Base Color'])
   else:
    normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.65
    links.new(tex.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],bs.inputs['Normal'])
# Remove presentation stage, lamps, duplicate barrels, unused source textures.
for ob in list(bpy.data.objects):
 if ob!=barrel:bpy.data.objects.remove(ob,do_unlink=True)
for _ in range(3):bpy.data.orphans_purge(do_recursive=True)
barrel.data.calc_loop_triangles()
report={'sourceTitle':'Wooden Barrels','author':'MatteReal','license':'CC BY 3.0','sourceUrl':'https://www.blendswap.com/blends/view/68065','sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'triangles':len(barrel.data.loop_triangles),'materials':[m.name for m in barrel.data.materials],'dimensionsMetres':[.92,.92,.8],'textures':{'color':[1024,1024],'normal':[1024,1024]},'changes':'Simplified mesh; resized wood maps; replaced metal material; normalized rack dimensions. Original stage and OpenFootage textures excluded.'}
(output/'source.json').write_text(json.dumps(report,indent=2)+'\n')
bpy.context.scene.unit_settings.system='METRIC';bpy.context.preferences.filepaths.save_version=0
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(output/'wooden-barrel.blend'))
print('PREPARED BARREL',report)
