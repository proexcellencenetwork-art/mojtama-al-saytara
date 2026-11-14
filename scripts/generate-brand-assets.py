from PIL import Image, ImageDraw
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "public"
OUT.mkdir(exist_ok=True)

NAVY = (11, 37, 69)
RED = (215, 38, 61)
PAPER = (244, 240, 230)

def draw_mark(draw, cx, cy, radius):
    width = max(1, int(radius * .035))
    draw.ellipse((cx-radius, cy-radius, cx+radius, cy+radius), outline=PAPER, width=width)
    inner = radius * .69
    draw.ellipse((cx-inner, cy-inner, cx+inner, cy+inner), outline=PAPER, width=max(1, int(width*.55)))
    tick = max(2, int(radius*.055))
    draw.line((cx, cy-radius, cx, cy-radius*.72), fill=RED, width=tick)
    draw.line((cx, cy+radius*.72, cx, cy+radius), fill=PAPER, width=width)
    draw.line((cx-radius, cy, cx-radius*.72, cy), fill=PAPER, width=width)
    draw.line((cx+radius*.72, cy, cx+radius, cy), fill=PAPER, width=width)
    dot = max(2, int(radius*.06))
    draw.ellipse((cx-dot, cy-dot, cx+dot, cy+dot), fill=RED)

def icon(size, path):
    scale = 3
    im = Image.new("RGB", (size*scale, size*scale), NAVY)
    draw_mark(ImageDraw.Draw(im), size*scale/2, size*scale/2, size*scale*.42)
    im.resize((size,size), Image.Resampling.LANCZOS).save(path, optimize=True)

def social_card():
    w,h,scale = 1200,630,2
    im = Image.new("RGB",(w*scale,h*scale),PAPER)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((34*scale,34*scale,(w-34)*scale,(h-34)*scale), radius=8*scale, fill=NAVY)
    for x in range(55,w-45,32):
        d.line((x*scale,42*scale,x*scale,(h-42)*scale),fill=(19,55,93),width=scale)
    for y in range(55,h-45,32):
        d.line((42*scale,y*scale,(w-42)*scale,y*scale),fill=(19,55,93),width=scale)
    draw_mark(d, 900*scale, 315*scale, 190*scale)
    d.line((110*scale,445*scale,450*scale,445*scale),fill=RED,width=5*scale)
    d.rectangle((110*scale,465*scale,260*scale,471*scale),fill=PAPER)
    im.resize((w,h),Image.Resampling.LANCZOS).save(OUT/"og-social.png", optimize=True)

icon(192, OUT/"icon-192.png")
icon(512, OUT/"icon-512.png")
icon(180, OUT/"apple-touch-icon.png")
social_card()
print("Generated PMC official navy, paper and red brand assets.")
