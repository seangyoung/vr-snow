"""Original Broad Street finish maps (Python + Pillow + NumPy).

Separate from the prototype texture library used by the other rooms. Patterns
are synthesized and deterministic; surface maps tile, while glass uses a full
pane composition. No source photographs are embedded.
"""
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/broad-street/finish-textures'
OUT.mkdir(parents=True, exist_ok=True)
N = 768
rng = np.random.default_rng(18540928)
yy, xx = np.mgrid[0:N, 0:N]


def noise(scale):
    # Resize a tiled field, taking the middle tile so filtering also wraps.
    seed = rng.random((scale, scale)).astype('float32')
    tiled = Image.fromarray(np.tile(seed, (3, 3)))
    return np.asarray(tiled.resize((N*3, N*3), Image.Resampling.BICUBIC))[N:2*N, N:2*N] - .5


def save(name, color, height=None, roughness=None):
    # Reserve resolution for masonry viewed at walking distance. Soft paint,
    # plaster and opaque reflections do not need another full-size texture set.
    size = 256 if name.endswith('glass') else 384 if name in ['paint', 'limewash', 'limestone'] else N
    def resized(a, resolution=size):
        return Image.fromarray(np.clip(a, 0, 255).astype('uint8')).resize((resolution, resolution), Image.Resampling.LANCZOS)
    resized(color).save(OUT / f'{name}.jpg', quality=92)
    if height is not None:
        dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * 1.7
        dy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * 1.7
        normal = np.stack((-dx, dy, np.ones_like(height)), 2)
        normal /= np.linalg.norm(normal, axis=2)[:, :, None]
        resized((normal+1)*127.5).save(OUT / f'{name}-normal.png')
    if roughness is not None:
        # glTF roughness is the green channel, metallic the blue (zero here).
        orm = np.stack((np.full_like(roughness, 255), roughness, np.zeros_like(roughness)), 2)
        resized(orm, 256).save(OUT / f'{name}-roughness.png')


def masonry(name, rows, cols, base, mortar, gap, radius=2, relief=.8, damp=False):
    cw, rh = N/cols, N/rows
    # Small edge distortions avoid laser-straight, factory-made paving.
    x, y = xx + noise(32)*3.5, yy + noise(32)*2.5
    row = np.floor(y/rh).astype(int)
    x = x + (row % 2)*cw/2
    col = np.floor(x/cw).astype(int)
    lx, ly = x % cw, y % rh
    qx, qy = np.abs(lx-cw/2)-(cw/2-gap-radius), np.abs(ly-rh/2)-(rh/2-gap-radius)
    distance = -(np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - radius)
    mask = np.clip(distance/1.25, 0, 1)
    variation = rng.normal(0, 5.5, (rows, cols))[row % rows, col % cols]
    grain = noise(192)*9 + noise(64)*11 + noise(16)*10
    bloom = np.maximum(noise(12)-.08, 0)*15
    stone = np.array(base) + (variation + grain + bloom)[:, :, None]
    joint = np.array(mortar) + (noise(96)*9)[:, :, None]
    color = joint*(1-mask[:, :, None]) + stone*mask[:, :, None]
    # Shallow worn edges, pitting and broad face undulation rather than deep grooves.
    height = np.clip(distance/3, 0, 1)*relief + noise(128)*.09 + noise(32)*.10*mask
    rough = None
    if damp:
        moisture = np.clip((noise(6)+.12)*1.8, 0, .6)
        color *= (1-moisture*.18)[:, :, None]
        rough = 232 - moisture*75 - (1-mask)*12
    save(name, color, height, rough)


masonry('stock-brick', 24, 8, (99, 89, 69), (79, 74, 63), 1.1, relief=.55)
masonry('red-brick', 24, 8, (103, 73, 57), (78, 69, 58), 1.1, relief=.55)
masonry('setts', 16, 12, (83, 82, 75), (59, 58, 52), 1.9, radius=7, damp=True)
masonry('flags', 4, 3, (120, 115, 99), (87, 83, 72), 1.2, radius=2, relief=.35, damp=True)
masonry('slate', 16, 8, (58, 65, 68), (45, 48, 47), .9, relief=.35)

# Fine longitudinal grain and aged paint; the color variations remain subordinate
# to the architectural profile, rather than reading as stripes at a distance.
grain = np.sin(xx/N*2*np.pi*56 + noise(8)*12)*2 + noise(128)*5 + noise(16)*9
save('wood', np.array((62, 53, 40))+grain[:, :, None], grain/130 + .5)
paint = noise(128)*3 + noise(16)*6 + np.sin(xx/N*2*np.pi*56)*.8
save('paint', np.array((40, 54, 46))+paint[:, :, None], paint/180+.5)
plaster = noise(192)*7 + noise(32)*10 + noise(8)*9
save('limewash', np.array((139, 135, 116))+plaster[:, :, None], plaster/150+.5)
stone = noise(128)*7 + noise(16)*9
save('limestone', np.array((131, 129, 112))+stone[:, :, None], stone/150+.5)

# One complete opaque pane per UV rectangle: cool sky reflection above a dark
# interior and shaded linen edges. No alpha layers, emissive windows or interior
# geometry. These are atmospheric suggestions, not a claim about furnishings.
u, v = xx/N, yy/N
edge = np.exp(-((u-.07)/.12)**2) + np.exp(-((u-.93)/.12)**2)
fold = .7 + .3*np.cos(u*92)
sky = np.clip(1-v, 0, 1)**2
opposite = (np.sin(u*18 + v*.6)>.05)*(np.clip(v-.3, 0, .7))
for name, base in [('cool-glass', (43, 50, 48)), ('warm-glass', (54, 49, 38))]:
    color = np.array(base) + sky[:, :, None]*np.array((34, 37, 38))
    color = color - opposite[:, :, None]*9 + (edge*fold)[:, :, None]*np.array((19, 17, 11))
    color += noise(96)[:, :, None]*2
    save(name, color)
print('Wrote original Broad Street finish maps; shared room textures and sky untouched.')
