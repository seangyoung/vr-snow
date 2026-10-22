"""Fit work caps and clothing overlays to evaluated anatomy rather than nominal rig heights."""
import bpy,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[2]
for actor in ['seamstress','laundress','porter','messenger']:
 path=ROOT/f'assets/scene-people/{actor}.blend';bpy.ops.wm.open_mainfile(filepath=str(path));deps=bpy.context.evaluated_depsgraph_get()
 if actor in ['porter','messenger']:
  hair=bpy.data.objects['Snow swept hair'].evaluated_get(deps);top=max((hair.matrix_world@v.co).z for v in hair.data.vertices)
  cap=bpy.data.objects['Street cap'];peak=bpy.data.objects['Street cap peak'];bottom=min(v.co.z for v in cap.data.vertices);shift=top-.085-bottom
  peak.data.materials.clear();peak.data.materials.append(cap.data.materials[0])
  for ob in [cap,peak]:
   for v in ob.data.vertices:v.co.z+=shift
  # Forward part of the hair must lie beneath the cap, not jut out below its crown.
 else:
  coat=bpy.data.objects['Snow tailored coat and trousers'].evaluated_get(deps)
  tree=BVHTree.FromPolygons([coat.matrix_world@v.co for v in coat.data.vertices],[tuple(p.vertices) for p in coat.data.polygons])
  if actor=='laundress':
   apron=bpy.data.objects['Street apron']
   for v in apron.data.vertices:
    hit,_,_,_=tree.ray_cast(Vector((v.co.x,-1,v.co.z)),Vector((0,1,0)),2)
    if hit:v.co.y=hit.y-.022
  else:
   # Keep the seamstress's plain fitted bodice; avoid a second garment shell.
   old=bpy.data.objects.get('Street shoulder shawl')
   if old:bpy.data.objects.remove(old,do_unlink=True)
 bpy.context.preferences.filepaths.save_version=0;bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(path))
