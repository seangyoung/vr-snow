"""Original, deterministic interior finishes and offline vertex occlusion.

Used by the three furnished-room builders. Textures are generated from numeric
patterns, not photographs. All shading is exported in the GLB; no runtime bake,
shadow maps or transparent contact-shadow planes are required.
"""
import bpy, math, hashlib, struct, zlib
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/interior-finish/textures'


def png(path, rgb):
    h, w, _ = rgb.shape
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)
    data = b''.join(b'\0' + row.tobytes() for row in rgb)
    path.write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
                    + chunk(b'IDAT', zlib.compress(data, 9)) + chunk(b'IEND', b''))


def srgb(v):
    return 12.92*v if v <= .0031308 else 1.055*v**(1/2.4)-.055


def texture(kind, base):
    color = np.array([srgb(c)*255 for c in base])
    key = kind + '-' + ''.join(f'{round(c):02x}' for c in color)
    path = OUT / f'{key}.png'
    n = 512 if kind == 'rug' else 256
    y, x = np.mgrid[0:n, 0:n] / n
    rng = np.random.default_rng(1854)
    broad = sum(np.sin(2*math.pi*(x*rng.integers(1,10) + y*rng.integers(-9,10)) + rng.uniform(0,2*math.pi)) for _ in range(24)) / 5
    grain = rng.normal(0, 1, (n,n))
    variation = broad*1.5 + grain*.8
    if kind == 'wood':
        warp = x + .008*np.sin(2*math.pi*y*2) + .004*np.sin(2*math.pi*y*5)
        variation = np.sin(2*math.pi*warp*38)*2.0 + np.sin(2*math.pi*warp*91)*.6 + broad*2.4 + grain*.7
    elif kind == 'plaster':
        variation = broad*1.4 + np.sin(2*math.pi*(x*13+y*11))*.7 + grain*1.1
    elif kind in ('cloth','rug'):
        variation = (np.sin(2*math.pi*x*64)*np.sin(2*math.pi*y*64))*1.6 + broad + grain*.6
    elif kind == 'leather':
        variation = grain*1.1 + broad*.8
    rgb = color + variation[:,:,None]
    if kind == 'rug':
        # Faded geometric woven decoration, an interpretive furnishing.
        edge = np.minimum.reduce([x,y,1-x,1-y])
        border = ((edge>.045)&(edge<.070)) | ((edge>.105)&(edge<.117))
        rgb[border] = np.array([151,129,91]) + variation[border,None]
        diamonds = np.abs((x*5)%1-.5) + np.abs((y*4)%1-.5)
        motif = (diamonds<.20)&(edge>.145)
        inner = (diamonds<.105)&(edge>.145)
        rgb[motif] = np.array([133,111,76]) + variation[motif,None]
        rgb[inner] = np.array([65,73,59]) + variation[inner,None]
    png(path,np.clip(rgb,0,255).astype('uint8'))
    return bpy.data.images.load(str(path),check_existing=True)


def finish_room(materials, layout):
    OUT.mkdir(parents=True,exist_ok=True)
    kinds = {'Plaster':'plaster','Ceiling':'plaster','Oak':'wood','Walnut':'wood','Dark walnut':'wood',
             'Trim':'wood','Paint':'wood','Green leather':'leather','Rug':'rug','Paper':'paper',
             'Linen':'cloth','Blanket':'cloth'}
    for name, mat in materials.items():
        bs = mat.node_tree.nodes.get('Principled BSDF')
        if name in kinds:
            for link in list(bs.inputs['Base Color'].links): mat.node_tree.links.remove(link)
            tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
            tex.image = texture(kinds[name],bs.inputs['Base Color'].default_value[:3])
            mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
        if name == 'Brass':
            bs.inputs['Metallic'].default_value = .35
            bs.inputs['Roughness'].default_value = .48
        if name in ('Walnut','Dark walnut','Green leather'): bs.inputs['Roughness'].default_value=.68
        if name == 'Pottery': bs.inputs['Roughness'].default_value=.62

    objects = [o for o in bpy.context.scene.objects if o.type=='MESH']
    bpy.context.view_layer.update()
    vertices, polygons = [], []
    for obj in objects:
        start=len(vertices)
        vertices.extend(obj.matrix_world @ v.co for v in obj.data.vertices)
        polygons.extend(tuple(start+i for i in p.vertices) for p in obj.data.polygons)
    bvh=BVHTree.FromPolygons(vertices,polygons)
    golden=math.pi*(3-math.sqrt(5))
    rays=[]
    for i in range(16):
        z=math.sqrt((i+.5)/16);r=math.sqrt(1-z*z)
        rays.append(Vector((r*math.cos(i*golden),r*math.sin(i*golden),z)))

    for obj in objects:
        mesh=obj.data
        name=obj.data.materials[0].name
        kind=kinds.get(name)
        uv=mesh.uv_layers.active or mesh.uv_layers.new(name='UVMap')
        colors=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
        mesh.color_attributes.active_color=colors
        mesh.color_attributes.render_color_index=mesh.color_attributes.find('Color')
        bounds=[(min(v.co[a] for v in mesh.vertices),max(v.co[a] for v in mesh.vertices)) for a in range(3)]
        seed=int(hashlib.sha256(obj.name.encode()).hexdigest()[:8],16)
        timber_variation=.96+(seed%100)/2500 if kind=='wood' else 1
        cache={}
        for poly in mesh.polygons:
            normal=(obj.matrix_world.to_3x3() @ poly.normal).normalized()
            axis=max(range(3),key=lambda a:abs(poly.normal[a]))
            axes=[a for a in range(3) if a!=axis]
            # Grain follows the longest dimension of each timber piece.
            if kind=='wood': axes.sort(key=lambda a:bounds[a][1]-bounds[a][0])
            tangent=normal.cross(Vector((0,0,1)) if abs(normal.z)<.9 else Vector((0,1,0))).normalized()
            bitangent=normal.cross(tangent)
            for li in poly.loop_indices:
                v=mesh.vertices[mesh.loops[li].vertex_index].co
                world=obj.matrix_world @ v
                if kind:
                    if kind=='rug':
                        uv.data[li].uv=tuple((v[a]-bounds[a][0])/max(.001,bounds[a][1]-bounds[a][0]) for a in axes)
                    else:
                        repeat=.65 if kind=='plaster' else 1.6 if kind=='wood' else 2.0
                        uv.data[li].uv=tuple(world[a]*repeat for a in axes)
                if name=='Daylight':
                    colors.data[li].color=(1,1,1,1);continue
                key=tuple(round(c,4) for c in (*world,*normal))
                if key not in cache:
                    occlusion=0
                    for ray in rays:
                        direction=tangent*ray.x+bitangent*ray.y+normal*ray.z
                        hit=bvh.ray_cast(world+normal*.012,direction,1.05)
                        if hit[0] is not None: occlusion+=max(0,1-hit[3]/1.05)
                    shade=(1-.48*occlusion/len(rays))*timber_variation
                    # Gentle wall-foot darkening, avoiding dirty/noisy plaster.
                    if kind=='plaster': shade*=.93+.07*min(1,max(0,world.z)/1.1)
                    cache[key]=shade
                shade=cache[key]
                colors.data[li].color=(shade,shade,shade,1)
    print('INTERIOR FINISH:',len(objects),'pieces, offline vertex shading, original surface textures')
