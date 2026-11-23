from PIL import Image, ImageDraw
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "public"
OUT.mkdir(exist_ok=True)

NAVY = (11, 37, 69)
NAVY_2 = (19, 49, 92)
RED = (215, 38, 61)
PAPER = (244, 240, 230)
WHITE = (255, 252, 246)


def smooth_path(points, steps=12):
    """Catmull-Rom interpolation for a smooth, connected calibration pulse."""
    result = []
    for index in range(len(points) - 1):
        p0 = points[max(0, index - 1)]
        p1 = points[index]
        p2 = points[index + 1]
        p3 = points[min(len(points) - 1, index + 2)]
        for step in range(steps):
            t = step / steps
            t2, t3 = t * t, t * t * t
            x = 0.5 * ((2*p1[0]) + (-p0[0]+p2[0])*t +
                       (2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2 +
                       (-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3)
            y = 0.5 * ((2*p1[1]) + (-p0[1]+p2[1])*t +
                       (2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2 +
                       (-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3)
            result.append((x, y))
    result.append(points[-1])
    return result


def draw_mark(draw, cx, cy, radius):
    """Draw the official multi-ring calibration mark and connected pulse."""
    width = max(2, int(radius * .028))
    rings = [
        (1.00, PAPER, width),
        (.84, RED, max(2, int(width * .85))),
        (.66, PAPER, max(2, int(width * 1.25))),
        (.51, PAPER, max(2, int(width * .65))),
    ]
    for ratio, color, stroke in rings:
        r = radius * ratio
        draw.ellipse((cx-r, cy-r, cx+r, cy+r), outline=color, width=stroke)

    tick = max(3, int(radius * .045))
    draw.line((cx, cy-radius*.99, cx, cy-radius*.78), fill=RED, width=tick)

    points = [
        (cx-radius*.68, cy+radius*.08),
        (cx-radius*.43, cy-radius*.17),
        (cx-radius*.25, cy-radius*.17),
        (cx-radius*.02, cy+radius*.15),
        (cx+radius*.20, cy-radius*.23),
        (cx+radius*.39, cy-radius*.23),
        (cx+radius*.66, cy+radius*.08),
    ]
    pulse = smooth_path(points, 14)
    draw.line(pulse, fill=PAPER, width=max(4, int(radius*.075)), joint="curve")
    draw.line((cx-radius*.66, cy+radius*.30, cx+radius*.66, cy+radius*.30),
              fill=PAPER, width=max(1, int(radius*.012)))
    dot = max(3, int(radius*.035))
    draw.ellipse((cx-dot, cy+radius*.30-dot, cx+dot, cy+radius*.30+dot), fill=RED)


def icon(size, path):
    scale = 4
    canvas = size * scale
    im = Image.new("RGB", (canvas, canvas), NAVY)
    draw = ImageDraw.Draw(im)
    pad = canvas * .045
    draw.rounded_rectangle((pad, pad, canvas-pad, canvas-pad),
                           radius=canvas*.17, fill=NAVY)
    draw_mark(draw, canvas/2, canvas/2, canvas*.405)
    im.resize((size, size), Image.Resampling.LANCZOS).save(path, optimize=True)


def social_card():
    width, height, scale = 1200, 630, 2
    im = Image.new("RGB", (width*scale, height*scale), PAPER)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((32*scale, 32*scale, (width-32)*scale, (height-32)*scale),
                        radius=28*scale, fill=NAVY)

    # Fine calibration grid and a restrained red registration line.
    for x in range(55, width-45, 32):
        d.line((x*scale, 42*scale, x*scale, (height-42)*scale), fill=NAVY_2, width=scale)
    for y in range(55, height-45, 32):
        d.line((42*scale, y*scale, (width-42)*scale, y*scale), fill=NAVY_2, width=scale)
    d.rounded_rectangle((110*scale, 305*scale, 260*scale, 314*scale),
                        radius=5*scale, fill=RED)
    d.rounded_rectangle((110*scale, 342*scale, 210*scale, 348*scale),
                        radius=3*scale, fill=PAPER)
    draw_mark(d, 900*scale, 315*scale, 190*scale)

    im.resize((width, height), Image.Resampling.LANCZOS).save(
        OUT / "og-social.png", optimize=True
    )


icon(192, OUT / "icon-192.png")
icon(512, OUT / "icon-512.png")
icon(180, OUT / "apple-touch-icon.png")
social_card()
print("Generated PMC identity v2 assets: concentric calibration rings, pulse mark, navy, paper and red.")
