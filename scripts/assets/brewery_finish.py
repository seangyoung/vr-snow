"""Original, seeded close-range material maps; no third-party image assets."""
import bpy
import numpy as np


def apply_finishes(materials, root):
    output=root/'assets/brewery-room/finish-textures';output.mkdir(parents=True,exist_ok=True)
    size=512;rng=np.random.default_rng(1854)
    yy,xx=np.mgrid[0:size,0:size]/size
    def save(name,rgb,linear=False):
        image=bpy.data.images.new(name,width=size,height=size,alpha=False,float_buffer=False)
        image.colorspace_settings.name='Non-Color' if linear else 'sRGB'
        rgba=np.ones((size,size,4),dtype=np.float32);rgba[:,:,:3]=np.clip(rgb,0,1)
        image.pixels.foreach_set(rgba.ravel());image.filepath_raw=str(output/f'{name}.png');image.file_format='PNG';image.save();image.pack()
        return image
    def bind(name,color,rough):
        mat=materials[name];nodes=mat.node_tree.nodes;links=mat.node_tree.links;bs=nodes.get('Principled BSDF')
        for inp in ['Base Color','Roughness']:
            for link in list(bs.inputs[inp].links):links.remove(link)
        for label,rgb,linear,socket in [('color',color,False,'Base Color'),('roughness',np.repeat(rough[:,:,None],3,axis=2),True,'Roughness')]:
            node=nodes.new('ShaderNodeTexImage');node.image=save('brewery-'+name.lower()+'-'+label,rgb,linear)
            links.new(node.outputs['Color'],bs.inputs[socket])
    # The grain runs along V; box projection below aligns V with the longest axis.
    warp=.008*np.sin(yy*17+np.sin(yy*5))+.002*np.sin(yy*49)
    grain=np.sin((xx+warp)*math_tau*48)*.007+np.sin((xx+warp)*math_tau*113)*.003
    broad=.010*np.sin((xx+warp)*math_tau*6)+.006*np.sin(yy*11+xx*13)
    pores=rng.normal(0,.004,(size,size))
    wood=np.array([.34,.265,.185])[None,None,:]+(grain+broad+pores)[:,:,None]
    bind('Timber',wood,np.clip(.68+grain*2+pores,.52,.85))
    # Rolled-sheet variation and restrained darker seams, with no green corrosion.
    hammer=.008*np.sin(xx*191+np.sin(yy*57))*np.sin(yy*177)+rng.normal(0,.004,(size,size))
    patina=.026*np.sin(xx*math_tau*3+.7*np.sin(yy*math_tau*2))+.017*np.sin(yy*math_tau*4)
    copper=np.array([.61,.365,.205])[None,None,:]+(patina+hammer)[:,:,None]
    bind('Copper',copper,np.clip(.39+patina*2+hammer*2,.28,.56))
    weave=.011*np.sin(xx*math_tau*64)+.009*np.sin(yy*math_tau*62)+rng.normal(0,.004,(size,size))
    bind('Sacking',np.array([.57,.49,.35])[None,None,:]+weave[:,:,None],np.full((size,size),.96))

math_tau=6.283185307179586
