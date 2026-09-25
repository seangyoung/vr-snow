"""Original, deterministic material maps; no reference photographs are embedded."""
from pathlib import Path
import random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/broad-street/textures'
OUT.mkdir(parents=True, exist_ok=True)
N = 768
rng = np.random.default_rng(1854)
random.seed(1854)

def noise(scale):
    a = rng.random((scale, scale)).astype('float32')
    return np.asarray(Image.fromarray(a).resize((N,N),Image.Resampling.BICUBIC)) - .5

def save(name, color, height):
    a = np.asarray(color).astype(float)
    grain = noise(192)*8 + noise(48)*7 + noise(10)*12
    a = np.clip(a + grain[:,:,None],0,255).astype('uint8')
    Image.fromarray(a).save(OUT/f'{name}.jpg', quality=90)
    h = np.asarray(height.filter(ImageFilter.GaussianBlur(1.5))).astype(float)/255 + noise(96)*.025
    dx=(np.roll(h,-1,1)-np.roll(h,1,1))*2.5
    dy=(np.roll(h,-1,0)-np.roll(h,1,0))*2.5
    v=np.stack((-dx,dy,np.ones_like(h)),2)
    v/=np.linalg.norm(v,axis=2)[:,:,None]
    Image.fromarray(((v+1)*127.5).astype('uint8')).save(OUT/f'{name}-normal.png')

def masonry(name, rows, cols, base, mortar, joint, rounded=False):
    col=Image.new('RGB',(N,N),mortar); height=Image.new('L',(N,N),50)
    d=ImageDraw.Draw(col); h=ImageDraw.Draw(height)
    rh=N/rows; cw=N/cols
    for r in range(rows):
        for c in range(-1,cols+1):
            x=c*cw + (cw/2 if r%2 else 0); y=r*rh
            v=random.randint(-13,13)
            fill=tuple(max(0,min(255,b+v+random.randint(-4,4))) for b in base)
            rect=(x+joint,y+joint,x+cw-joint,y+rh-joint)
            radius=5 if rounded else 1
            d.rounded_rectangle(rect,radius,fill=fill)
            h.rounded_rectangle(rect,radius,fill=random.randint(175,225))
            d.line((x+joint+1,y+joint+1,x+cw-joint-1,y+joint+1),fill=tuple(min(255,b+14) for b in fill),width=2)
    save(name,col,height)

# Physical repeat sizes are assigned by Blender, independent of texture resolution.
masonry('stock-brick',24,8,(104,94,74),(76,74,64),2)
masonry('red-brick',24,8,(111,74,57),(79,74,63),2)
masonry('setts',16,8,(92,96,92),(48,49,45),4,True)
masonry('flags',4,4,(126,124,111),(70,70,63),2,True)
masonry('slate',16,8,(67,75,79),(39,43,43),1)
col=np.zeros((N,N,3)); n=noise(128)*12 + noise(12)*20
for x in range(N):
    stripe=8*np.sin(x*.7)+4*np.sin(x*1.83)
    for channel,base in enumerate((65,59,44)):
        col[:,x,channel]=base+stripe+n[:,x]
save('wood',Image.fromarray(np.clip(col,0,255).astype('uint8')),Image.fromarray(np.clip(n+140,0,255).astype('uint8')))
# Tileable in longitude, with restrained cloudy contrast and a pale horizon.
w,h=1536,768
cloud=np.zeros((h,w))
for scale,weight in [(8,1),(16,.5),(32,.25),(64,.12),(128,.05)]:
    a=rng.random((scale,scale*2)).astype('float32'); a[:,-1]=a[:,0]
    cloud+=np.asarray(Image.fromarray(a).resize((w,h),Image.Resampling.BICUBIC))*weight
cloud=(cloud-cloud.min())/(cloud.max()-cloud.min())
y=np.linspace(0,1,h)[:,None]
base=135+34*np.exp(-((y-.5)/.2)**2)
a=np.stack([base+cloud*36,base+cloud*36+3,base+cloud*36+4],2)
Image.fromarray(np.clip(a,0,255).astype('uint8')).save(ROOT/'public/textures/broad-street/overcast.jpg',quality=88)
print('Wrote six material pairs and an original overcast sky.')

# Opaque, mottled glazing: inexpensive suggestions of dusty panes and shaded curtains.
for name, base in [('cool-glass',(43,51,51)),('warm-glass',(68,60,40))]:
    yy,xx=np.mgrid[0:N,0:N]/N
    curtain=np.exp(-((xx-.10)/.085)**2)+np.exp(-((xx-.9)/.085)**2)
    reflection=13*np.exp(-((yy-.78)/.25)**2) + 4*np.sin(xx*45)*curtain
    a=np.stack([b+reflection+curtain*9+noise(48)*3 for b in base],2)
    Image.fromarray(np.clip(a,0,255).astype('uint8')).save(OUT/f'{name}.jpg',quality=88)
