"""Export portable-item bounds from the unjoined Blender sources.
Run with Blender --background --python scripts/assets/build_prop_manifest.py.
No rebake or model changes. Keep compound objects (handles, labels, bindings) together.
"""
import json, re
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]

def build(inventory):
    output = {}
    for asset, objects in inventory.items():
        groups = []
        def base(o): return re.sub(r'\.\d+$', '', o['name'])
        def select(*names): return [o for o in objects if base(o) in names]
        def add(label, parts):
            if parts: groups.append((label, parts))
        def one(label, *names): add(label, select(*names))
        def each(label, name, *attachments):
            bodies = select(name)
            parts = [[] for _ in bodies]
            for part in select(*attachments):
                # Attach to the closest body bounding box, including protruding trim.
                c = [(a+b)/2 for a,b in zip(part['min'],part['max'])]
                def distance(b): return sum(max(b['min'][i]-c[i],0,c[i]-b['max'][i])**2 for i in range(3))
                parts[min(range(len(bodies)),key=lambda i:distance(bodies[i]))].append(part)
            for body, extras in zip(bodies,parts): add(label,[body]+extras)
        if asset == 'snow-office':
            one('Wooden stethoscope','Wooden monaural stethoscope','Stethoscope pale collar')
            one('Medical case book','Medical case book','Case book paper','Case note ruling')
            one('Chloroform inhaler','Inhaler brass water jacket','Rolled canister seam','Inhaler cap','Cap knurl','Hose coupling','Cloth covered flexible hose','Hose winding','Hollow brass facepiece','Velvet facepiece edge','Facepiece inlet','Facepiece valve')
            one('Instrument case','Instrument case base','Instrument case lining','Instrument case open lid','Instrument case lid lining','Case hinge','Case clasp')
            each('Medicine bottle','Stoppered medicine bottle','Bottle neck','Bottle stopper','Bottle paper label')
            one('Clinical notes','Clinical observation sheet','Observation note lines')
            one('Open case ledger','Open ledger','Ledger lines')
            each('Correspondence','Correspondence')
            each('Medical volume','Bound volume','Spine band')
            each('Inkwell','Inkwell');each('Pen','Pen');each('Instrument cloth','Instrument cloth')
        elif asset == 'registrar-room':
            one('Returns ledger','Ledger binding','Ledger pages','Ruled row','Ledger column')
            each('Copied returns','Copied returns');each('Closed register','Closed register')
            each('Archive register','Register volume','Spine label')
            each('Tied returns','Tied return bundle','Bundle tie')
            bodies=select('Clerk open register')
            for i in range(0,len(bodies),2):add('Clerk’s register',bodies[i:i+2])
            each('Returns bundle','Clerk returns bundle')
            for prefix in ['', 'Clerk ']:
                each('Inkwell',prefix+'inkwell' if prefix else 'Inkwell');each('Pen',prefix+'pen' if prefix else 'Pen')
        elif asset.startswith('household'):
            one('Water jug','Water jug','Jug handle')
            for label,name in [('Drinking cup','Drinking cup'),('Folded cloth','Folded cloth'),('Storage jar','Mantel jar'),('Wash basin','Wash basin'),('Pillow','Pillow'),('Work cloth','Folded work cloth'),('Thread spool','Thread spool'),('Carrying jug','Carrying jug')]: each(label,name)
            one('Work parcel','Work parcel','Parcel string')
        elif asset == 'workhouse-courtyard':
            each('Water bucket','Bucket base','Bucket stave','Bucket hoop','Bucket handle')
        elif asset == 'brewery-room':
            one('Account book','Closed account book','Book pages')
            each('Drinking mug','Drinking mug','Mug handle')
        elif asset == 'manufactory-room':
            each('Stock box','Stock box');each('Work parcel','Work parcel');each('Wrapped stock','Paper-wrapped stock')
            each('Sorting tray','Sorting tray','Copper piece');one('Drinking cup','Drinking cup','Cup rim')
        elif asset == 'board-room':
            one('Street map','Map sheet','Map street')
            each('Board register','Register cover','Register pages');each('Meeting papers','Loose papers')
        if not groups: continue
        specs=[]
        for label,parts in groups:
            regions=[{'min':[round(v-.00003,5) for v in o['min']], 'max':[round(v+.00003,5) for v in o['max']]} for o in parts]
            specs.append({'name':label,'min':[min(r['min'][i] for r in regions) for i in range(3)],'max':[max(r['max'][i] for r in regions) for i in range(3)],'regions':regions})
        output[asset+'.glb']=specs
    (ROOT/'src/walkable/portable-props.json').write_text(json.dumps(output,separators=(',',':'))+'\n')
    print({a:len(p) for a,p in output.items()})

if __name__ == '__main__':
    import bpy
    from mathutils import Vector
    inventory={}
    for asset in ['snow-office','registrar-room','household-room','household-routines-room','household-away-room','workhouse-courtyard','brewery-room','board-room','manufactory-room']:
        bpy.ops.wm.open_mainfile(filepath=str(ROOT/f'assets/{asset}/{asset}.blend'))
        deps=bpy.context.evaluated_depsgraph_get();items=[]
        for obj in bpy.context.scene.objects:
            if obj.type!='MESH':continue
            evaluated=obj.evaluated_get(deps)
            vertices=[evaluated.matrix_world@Vector(c) for c in evaluated.bound_box]
            lo=[min(v[i] for v in vertices) for i in range(3)];hi=[max(v[i] for v in vertices) for i in range(3)]
            items.append({'name':obj.name,'min':[lo[0],lo[2],-hi[1]],'max':[hi[0],hi[2],-lo[1]]})
        inventory[asset]=items
    build(inventory)
