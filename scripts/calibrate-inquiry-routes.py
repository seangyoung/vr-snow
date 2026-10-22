"""Verify the saved six-anchor affine calibration; no packages or network required.

Coordinates and sources are preserved in src/simulation/route-data.json.
This checks map registration, not the historical accuracy of a traced route.
"""
import json, math
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / 'src/simulation/route-data.json').read_text())
def solve(matrix, rhs):
    rows = [row[:] + [v] for row, v in zip(matrix, rhs)]
    for i in range(3):
        pivot = max(range(i, 3), key=lambda j: abs(rows[j][i]))
        rows[i], rows[pivot] = rows[pivot], rows[i]
        scale = rows[i][i]
        rows[i] = [v / scale for v in rows[i]]
        for j in range(3):
            if j != i:
                scale = rows[j][i]
                rows[j] = [a - scale*b for a, b in zip(rows[j], rows[i])]
    return [row[-1] for row in rows]
anchors = data['anchors']
x = [[*a['mapPercent'], 1] for a in anchors]
a = [[sum(row[i]*row[j] for row in x) for j in range(3)] for i in range(3)]
coeff = {k: solve(a, [sum(row[i]*p[k] for row,p in zip(x, anchors)) for i in range(3)]) for k in ('easting','northing')}
for key, values in coeff.items():
    assert all(abs(v-w)<1e-6 for v,w in zip(values, data['affine'][key])), key
errors = [math.hypot(*(sum(c*v for c,v in zip(coeff[k], row))-p[k] for k in coeff)) for row,p in zip(x, anchors)]
rms = math.sqrt(sum(e*e for e in errors)/len(errors))
assert abs(rms-data['anchorRmsMetres'])<1e-6
print(f'Pump-anchor registration RMS: {rms:.3f} metres (not route uncertainty).')
for route in data['journeys']:
    pts = [[sum(c*v for c,v in zip(coeff[k], [*p,1])) for k in coeff] for p in route['polyline']]
    length = sum(math.dist(a,b) for a,b in zip(pts,pts[1:]))
    metres = math.floor(length/5+.5)*5
    seconds = math.floor(metres/data['walkingMetresPerSecond']+.5)
    print(f"{route['id']}: approximately {metres} m, {seconds} s at 1.2 m/s")
