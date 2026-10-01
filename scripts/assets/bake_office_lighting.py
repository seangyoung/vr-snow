"""Snow's office configuration for the shared static lighting baker."""
from bake_scene_lighting import bake_lighting


def bake_office(materials, root, exterior):
    return bake_lighting(materials, root, asset='snow-office', exterior=exterior,
        environment_width=1024, probe=(0,1.45,-.2), lights=[
        ('Baked window daylight',(3.35,2.35,-.3),(-1,1,0),260,2.0,(.88,.94,1)),
        ('Baked soft room fill',(0,3.05,.5),(0,0,0),55,3.8,(1,.88,.71)),
        ('Baked exterior daylight',(7,12,0),(12,0,0),2300,10,(.9,.95,1))])
