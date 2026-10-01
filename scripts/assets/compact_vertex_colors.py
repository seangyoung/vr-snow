"""Store bounded glTF weathering colors as normalized bytes instead of uint16.
Geometry, UVs, materials and embedded images remain unchanged; no runtime decoder.
"""
import json, struct


def compact_vertex_colors(path):
    raw=path.read_bytes();length=struct.unpack_from('<I',raw,12)[0]
    doc=json.loads(raw[20:20+length]);binary=raw[28+length:]
    color_ids={p['attributes']['COLOR_0'] for m in doc['meshes'] for p in m['primitives'] if 'COLOR_0' in p['attributes']}
    replacements={}
    for idx in color_ids:
        accessor=doc['accessors'][idx];view=doc['bufferViews'][accessor['bufferView']]
        assert accessor['componentType']==5123 and accessor.get('normalized')
        assert accessor.get('byteOffset',0)==0 and 'byteStride' not in view
        start=view.get('byteOffset',0);chunk=binary[start:start+view['byteLength']]
        values=struct.unpack('<'+'H'*(len(chunk)//2),chunk)
        replacements[accessor['bufferView']]=bytes(round(v/257) for v in values)
        accessor['componentType']=5121
    rebuilt=bytearray()
    for idx,view in enumerate(doc['bufferViews']):
        rebuilt.extend(b'\x00'*(-len(rebuilt)%4))
        start=view.get('byteOffset',0)
        data=replacements.get(idx,binary[start:start+view['byteLength']])
        view['byteOffset']=len(rebuilt);view['byteLength']=len(data);rebuilt.extend(data)
    rebuilt.extend(b'\x00'*(-len(rebuilt)%4));doc['buffers'][0]['byteLength']=len(rebuilt)
    encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4)
    header=struct.pack('<4sII',b'glTF',2,28+len(encoded)+len(rebuilt))
    path.write_bytes(header+struct.pack('<I4s',len(encoded),b'JSON')+encoded+struct.pack('<I4s',len(rebuilt),b'BIN\x00')+rebuilt)
