"""Original bottle-label atlas. Requires Pillow; no collection photographs are used."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parents[2]
FONT=Path('/System/Library/Fonts/Supplemental/Times New Roman.ttf')
# Set OFFICE_LABEL_FONT to a local serif font on other platforms.
import os
font_path=os.environ.get('OFFICE_LABEL_FONT',str(FONT))
image=Image.new('RGB',(768,512),'#ded1ae');draw=ImageDraw.Draw(image)
labels=[['SULPHURIC','ETHER'],['CHLOROFORM'],['NITRATE OF','OXIDE OF','ETHYLE'],['CHLORIC','ETHER'],['CASTOR','OIL']]
for i,lines in enumerate(labels):
    x=(i%3)*256;y=(i//3)*256
    draw.rectangle((x+10,y+10,x+245,y+245),outline='#504435',width=3)
    draw.rectangle((x+16,y+16,x+239,y+239),outline='#76634c',width=1)
    font=ImageFont.truetype(font_path,29 if i==1 else 31)
    for j,line in enumerate(lines):draw.text((x+128,y+128+(j-(len(lines)-1)/2)*39),line,font=font,fill='#302d27',anchor='mm')
    draw.line((x+85,y+207,x+171,y+207),fill='#76634c',width=2)
path=ROOT/'assets/snow-office/medicine-labels.png';image.save(path)
print(path)
