"""Build the first furnished office slice. Dimensions are interpretive, not a historical survey.
Run: blender --background --factory-startup --python scripts/assets/build_snow_office.py
All helper coordinates use Three.js X/Y-up/Z metres; Blender maps these to X/-Z/Y.
"""
import bpy, math, json, random
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
layout=json.loads((ROOT/'src/walkable/office-layout.json').read_text())
random.seed(1854)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
M={}
def linear(v):return ((v+.055)/1.055)**2.4 if v>.04045 else v/12.92
def material(name,color,wood=False,emission=False):
    m=bpy.data.materials.new(name);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    c=tuple(linear(int(color[i:i+2],16)/255) for i in (0,2,4))
    bs.inputs['Base Color'].default_value=(*c,1);bs.inputs['Roughness'].default_value=.84
    if wood:
        tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(ROOT/'assets/broad-street/textures/wood.jpg'),check_existing=True)
        m.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
    if emission:
        bs.inputs['Emission Color'].default_value=(*c,1);bs.inputs['Emission Strength'].default_value=.65
    M[name]=m
for name,color in [('Plaster','b2a58b'),('Ceiling','c7beaa'),('Oak','66523d'),('Dark walnut','49382b'),('Trim','c1b493'),('Recess','252a27'),('Green leather','3a4c40'),('Rug','705342'),('Paper','d9cda9'),('Brass','a9905b'),('Red binding','784f43'),('Green binding','53634e'),('Blue binding','515f66')]:
    material(name,color,wood=name=='Oak')
material('Daylight','d3dfd9',emission=True)
def box(name,x,y,z,w,h,d,mat,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y));o=bpy.context.object;o.name=name;o.dimensions=(w,d,h)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(M[mat])
    if bevel:
        mod=o.modifiers.new('Soft edges','BEVEL');mod.width=bevel;mod.segments=1
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    return o
def cylinder(name,x,y,z,r,h,mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=r,depth=h,location=(x,-z,y));o=bpy.context.object;o.name=name;o.data.materials.append(M[mat]);return o
w,d,h=layout['width'],layout['depth'],layout['height']
# Planked floor, shallow rug, paneled lower walls and plaster upper walls.
for i in range(24):
    x=-w/2+(i+.5)*w/24
    for j in range(4):box('Floorboard',x,-.035,-d/2+(j+.5)*d/4,w/24-.007,.06,d/4-.006,'Oak')
box('Desk rug',-.65,.005,-.95,3.15,.012,2.6,'Rug')
for z in [-1.2-1.02,-1.2+1.5]:box('Woven rug border',-.65,.012,z,3.0,.005,.05,'Trim')
box('Ceiling',0,h+.05,0,w+.2,.1,d+.2,'Ceiling')
box('North wall',0,h/2,-d/2-.05,w+.2,h,.1,'Plaster')
box('South wall',0,h/2,d/2+.05,w+.2,h,.1,'Plaster')
box('West wall',-w/2-.05,h/2,0,.1,h,d,'Plaster')
# East wall has a large window opening, preventing an opaque wall covering the glazing.
for z,l in [(-2.4,1.6),(2.4,1.6)]:box('Window side wall',w/2+.05,h/2,z,.1,h,l,'Plaster')
box('Below window',w/2+.05,.45,0,.1,.9,3.2,'Plaster')
box('Above window',w/2+.05,3.05,0,.1,.4,3.2,'Plaster')
box('Window light',w/2+.08,1.875,0,.03,1.95,3.18,'Daylight')
for z in [-1.6,-.8,0,.8,1.6]:box('Window mullion',w/2-.02,1.875,z,.12,2.04,.055,'Trim')
for y in [.87,1.52,2.17,2.89]:box('Window rail',w/2-.02,y,0,.12,.055,3.26,'Trim')
box('Window sill',w/2-.11,.87,0,.32,.10,3.4,'Trim',.02)
for x in [-w/2+.025,w/2-.025]:
    box('Skirting',x,.11,0,.07,.22,d,'Dark walnut')
    box('Cornice',x,h-.14,0,.13,.12,d,'Trim')
for z in [-d/2+.025,d/2-.025]:
    box('Skirting',0,.11,z,w,.22,.07,'Dark walnut')
    box('Cornice',0,h-.14,z,w,.12,.13,'Trim')
# A closed, modeled door gives an unambiguous travel threshold.
doorX=layout['door'][0]
box('Office exit',doorX,1.16,d/2-.065,1.05,2.32,.09,'Dark walnut',.018)
for x in [doorX-.59,doorX+.59]:box('Door jamb',x,1.2,d/2-.13,.12,2.4,.16,'Trim',.01)
box('Door lintel',doorX,2.44,d/2-.13,1.3,.13,.16,'Trim',.01)
for y in [.58,1.73]:
    for x in [doorX-.25,doorX+.25]:box('Door panel',x,y,d/2-.12,.40,.94,.055,'Oak',.015)
box('Door handle',doorX-.40,1.03,d/2-.2,.04,.18,.055,'Brass',.01)
# Desk: drawers, shaped legs, leather writing surface, open ledger and correspondence.
f=next(f for f in layout['furniture'] if f['id']=='desk');x,z=f['x'],f['z']
box('Desk top',x,.78,z,2.1,.08,1.05,'Dark walnut',.025)
for dx in [-.89,.89]:
    for dz in [-.4,.4]:box('Desk leg',x+dx,.37,z+dz,.10,.74,.10,'Dark walnut',.015)
for dx in [-.68,.68]:
    box('Drawer pedestal',x+dx,.59,z,.54,.34,.94,'Dark walnut',.018)
    for y in [.52,.67]:
        box('Drawer face',x+dx,y,z+.49,.49,.12,.035,'Oak',.008)
        box('Drawer pull',x+dx,y,z+.525,.10,.018,.025,'Brass',.006)
box('Writing pad',x,.827,z,.90,.012,.64,'Green leather',.015)
for dx in [-.16,.16]:box('Open ledger',x+dx,.85,z+.04,.30,.035,.42,'Paper',.008)
for dz in [i*.031 for i in range(-5,6)]:box('Ledger lines',x,.87,z+.04+dz,.55,.002,.003,'Oak')
for i in range(4):box('Correspondence',x+.74,.834+i*.005,z-.11,.32,.004,.40,'Paper')
cylinder('Inkwell',x-.72,.87,z-.14,.055,.09,'Recess')
box('Pen',x-.6,.89,z-.10,.25,.009,.012,'Dark walnut')
# Chair behind the desk.
f=next(f for f in layout['furniture'] if f['id']=='chair');x,z=f['x'],f['z']
box('Chair seat',x,.45,z,.60,.09,.58,'Green leather',.035)
box('Chair back',x,.86,z-.27,.59,.57,.075,'Dark walnut',.02)
box('Chair back cushion',x,.87,z-.215,.45,.40,.035,'Green leather',.03)
for dx in [-.24,.24]:
    for dz in [-.23,.23]:box('Chair leg',x+dx,.23,z+dz,.06,.46,.06,'Dark walnut')
# Rear bookcase and restrained bound volumes.
f=next(f for f in layout['furniture'] if f['id']=='bookcase');x,z=f['x'],f['z'];bw=f['width']
box('Bookcase back',x,1.325,z-.19,bw,2.65,.06,'Dark walnut')
for dx in [-bw/2,0,bw/2]:box('Bookcase upright',x+dx,1.325,z,.07,2.65,.45,'Dark walnut')
for y in [.13,.69,1.26,1.83,2.4,2.65]:box('Bookcase shelf',x,y,z,bw+.1,.055,.48,'Dark walnut',.006)
for shelf in [.16,.72,1.29,1.86]:
    for i in range(30):
        bx=x-bw/2+.1+i*.12;bh=random.uniform(.32,.46)
        mat=random.choice(['Red binding','Green binding','Blue binding','Oak'])
        box('Bound volume',bx,shelf+bh/2,z+.05,.09,bh,.26,mat,.004)
        for yy in [shelf+.055,shelf+bh-.05]:box('Spine band',bx,yy,z+.186,.091,.014,.007,'Brass')
# Fireplace on the west wall. Opaque hearth with subdued glow, no animated effects.
box('Fireplace recess',-2.82,.56,-.15,.10,1.12,1.40,'Recess')
for z in [-.91,.61]:box('Fireplace jamb',-2.65,.60,z,.5,1.2,.20,'Dark walnut',.015)
box('Mantel',-2.65,1.29,-.15,.55,.12,1.75,'Dark walnut',.025)
box('Hearth',-2.65,.025,-.15,.5,.05,1.65,'Recess')
for z in [-.47,-.21,.05,.30]:box('Grate bar',-2.38,.29,z,.025,.45,.025,'Recess')
# Cabinet and framed print: deliberately decorative, not additional action targets.
f=next(f for f in layout['furniture'] if f['id']=='cabinet');x,z=f['x'],f['z']
box('Cabinet',x,.66,z,f['width'],1.32,.5,'Dark walnut',.02)
for dx in [-.33,.33]:
    box('Cabinet panel',x+dx,.69,z-.27,.58,1.12,.035,'Oak',.01)
    box('Cabinet knob',x+dx*.35,.73,z-.30,.035,.035,.04,'Brass')
box('Print frame',-2.83,2.13,-.15,.08,.96,1.43,'Dark walnut',.015)
box('Print mount',-2.775,2.13,-.15,.02,.83,1.30,'Paper')
box('Print field',-2.758,2.13,-.15,.01,.62,1.08,'Green binding')
for i in range(8):box('Print engraving',-2.748,1.90+i*.05,-.15,.006,.012,.88-.06*(i%3),'Oak')
# Join by material for few draw calls; preserve descriptive pieces in the editable source first.
asset=ROOT/'assets/snow-office';asset.mkdir(exist_ok=True)
bpy.context.scene.unit_settings.system='METRIC';bpy.context.preferences.filepaths.save_version=0
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(asset/'snow-office.blend'))
for name,mat in M.items():
    obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials and o.data.materials[0]==mat]
    if not obs:continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:o.select_set(True)
    bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name=name
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/snow-office.glb'),export_format='GLB',export_yup=True,export_cameras=False,export_lights=False)
triangles=sum(len(p.vertices)-2 for o in bpy.context.scene.objects if o.type=='MESH' for p in o.data.polygons)
report={'triangles':triangles,'materialBatches':len([o for o in bpy.context.scene.objects if o.type=='MESH']),'layout':layout}
(asset/'build-report.json').write_text(json.dumps(report,indent=2)+'\n')
print('OFFICE BUILD',triangles,'triangles;',report['materialBatches'],'material batches')
