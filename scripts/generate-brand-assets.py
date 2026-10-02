from PIL import Image, ImageDraw
from pathlib import Path
import math

OUT = Path(__file__).resolve().parents[1] / 'public'
OUT.mkdir(exist_ok=True)
TEAL=(8,127,125); GOLD=(187,139,67); IVORY=(247,250,249); S=2

def heart(draw, cx, cy, size, fill):
    scale=size/64
    pts=[(32,51),(18,43),(11,34),(10,27),(12,20),(17,16),(23,16),(28,19),(32,24),(36,19),(41,16),(47,16),(52,20),(54,27),(53,34),(47,42)]
    draw.polygon([(cx+(x-32)*scale,cy+(y-32)*scale) for x,y in pts],fill=fill)

# Text-free, original abstract artwork; no licensed stock imagery is used.
W,H=1200*S,630*S
im=Image.new('RGB',(W,H),IVORY)
d=ImageDraw.Draw(im,'RGBA')
def ellipse(box,fill=None,outline=None,width=1):
    d.ellipse(tuple(int(v*S) for v in box),fill=fill,outline=outline,width=max(1,int(width*S)))
ellipse((700,-180,1320,510),(217,242,237,115))
ellipse((850,260,1300,730),(187,139,67,30))
ellipse((-180,280,360,800),(217,242,237,95))
for box,color,wid in [((660,42,1120,502),(8,127,125,48),3),((718,94,1060,436),(187,139,67,78),2),((770,145,1008,383),(8,127,125,26),2)]:
    ellipse(box,outline=color,width=wid)
for box,angle,color in [((690,110,1090,430),-32,(8,127,125,70)),((730,76,1050,466),35,(187,139,67,75))]:
    cx=(box[0]+box[2])/2; cy=(box[1]+box[3])/2; rx=(box[2]-box[0])/2; ry=(box[3]-box[1])/2; a=math.radians(angle)
    points=[]
    for i in range(181):
        t=2*math.pi*i/180; x=rx*math.cos(t); y=ry*math.sin(t)
        points.append(((cx+x*math.cos(a)-y*math.sin(a))*S,(cy+x*math.sin(a)+y*math.cos(a))*S))
    d.line(points,fill=color,width=2*S)
for cx,cy,r,color in [(785,220,48,(217,242,237,255)),(935,218,48,(242,232,212,255)),(860,345,58,(226,243,237,255))]:
    ellipse((cx-r,cy-r,cx+r,cy+r),fill=color,outline=(255,255,255,235),width=3)
    heart(d,cx*S,cy*S,r*.94*S,TEAL if cx!=935 else GOLD)
for cx,cy,r,col in [(690,200,10,GOLD),(1064,240,9,TEAL),(1016,402,8,GOLD),(748,393,7,TEAL),(935,96,7,GOLD)]:
    ellipse((cx-r,cy-r,cx+r,cy+r),fill=(*col,220))
im.resize((1200,630),Image.Resampling.LANCZOS).save(OUT/'og-social.png',optimize=True)

def icon(size,path):
    ss=4; c=Image.new('RGBA',(size*ss,size*ss),(225,244,239,255)); q=ImageDraw.Draw(c)
    pad=size*.08
    q.rounded_rectangle((pad*ss,pad*ss,(size-pad)*ss,(size-pad)*ss),radius=int(size*.28*ss),fill=(225,244,239,255))
    heart(q,size*ss/2,size*ss*.51,size*.69*ss,TEAL)
    def line(x1,y1,x2,y2,color,width): q.line((x1*ss,y1*ss,x2*ss,y2*ss),fill=color,width=max(1,int(width*ss)))
    cx,cy=size*.77,size*.25; r=size*.045
    line(cx-r,cy,cx+r,cy,GOLD,size*.018); line(cx,cy-r,cx,cy+r,GOLD,size*.018)
    cx,cy=size*.24,size*.30
    line(cx-r*.65,cy,cx+r*.65,cy,GOLD,size*.015); line(cx,cy-r*.65,cx,cy+r*.65,GOLD,size*.015)
    c.resize((size,size),Image.Resampling.LANCZOS).save(path,optimize=True)

icon(192,OUT/'icon-192.png')
icon(512,OUT/'icon-512.png')
icon(180,OUT/'apple-touch-icon.png')
print('Brand assets created:', ', '.join(p.name for p in sorted(OUT.glob('*.png'))))
