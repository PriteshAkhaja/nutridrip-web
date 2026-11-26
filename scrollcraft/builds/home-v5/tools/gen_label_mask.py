"""The bag label's shape and edge shade, in the bag photo's own frame (577 x 1200):
  label-mask.png   where the label is printed: the design box (x 16.5-83.5%, y 19.5-79%), its sides drawn in to
                   follow the inner line of the bag's rolled edge (the outline inset by 6.5% of the width), so the
                   label hugs the waist instead of standing over the curve; rounded corners
  label-shade.png  the label turning away with the film near its sides: a soft shade inward from the edge and a
                   fine edge line
usage: python tools/gen_label_mask.py images
"""
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageChops

D = sys.argv[1].rstrip("/\\") + "/"
sil = Image.open(D + "bag-mask.png").getchannel("A")
W, H = sil.size
S = 3                                                     # drawn 3x and reduced, for clean edges
px = sil.load()
x0, x1, y0, y1, inset = 0.165, 0.835, 0.195, 0.79, 0.065

def edges(y):
    xs = [x for x in range(W) if px[x, y] > 128]
    return xs[0] / W, xs[-1] / W

pts_l, pts_r = [], []
for yy in range(int(y0 * H), int(y1 * H) + 1):
    L, R = edges(yy)
    pts_l.append((max(x0, L + inset) * W * S, yy * S))
    pts_r.append((min(x1, R - inset) * W * S, yy * S))
big = Image.new("L", (W * S, H * S), 0)
ImageDraw.Draw(big).polygon(pts_l + pts_r[::-1], fill=255)
# rounded corners: the shape meets a rounded box of the design's size
r = int(0.04 * W * S)
box = Image.new("L", (W * S, H * S), 0)
ImageDraw.Draw(box).rounded_rectangle([0, int(y0 * H * S), W * S, int(y1 * H * S)], radius=r, fill=255)
corner = Image.new("L", (W * S, H * S), 0)
cd = ImageDraw.Draw(corner)
# round the four corners of the actual outline (top and bottom rows), not of the page-wide box
tl, tr, bl, br = pts_l[0], pts_r[0], pts_l[-1], pts_r[-1]
cd.rectangle([0, 0, W * S, H * S], fill=255)
for (cx, cy, sx, sy) in ((tl[0], tl[1], 1, 1), (tr[0], tr[1], -1, 1), (bl[0], bl[1], 1, -1), (br[0], br[1], -1, -1)):
    # cut the square corner, then add back the quarter circle
    qx0, qx1 = sorted([cx, cx + sx * r]); qy0, qy1 = sorted([cy, cy + sy * r])
    cd.rectangle([qx0, qy0, qx1, qy1], fill=0)
    ccx, ccy = cx + sx * r, cy + sy * r
    cd.ellipse([ccx - r, ccy - r, ccx + r, ccy + r], fill=255)
shape = ImageChops.multiply(ImageChops.multiply(big, box), corner).resize((W, H), Image.LANCZOS)
mask = Image.new("RGBA", (W, H), (0, 0, 0, 0)); mask.putalpha(shape)
mask.save(D + "label-mask.png", optimize=True)

# the shade: strongest at the sides (where the film turns away), fading inward over 7% of the width
inner = shape.filter(ImageFilter.MinFilter(9)).filter(ImageFilter.GaussianBlur(int(0.045 * W)))
shade = ImageChops.subtract(shape, inner).point(lambda v: int(v * 0.30))
line = ImageChops.subtract(shape, shape.filter(ImageFilter.MinFilter(3))).point(lambda v: int(v * 0.22))
a = ImageChops.lighter(shade, line)
out = Image.new("RGBA", (W, H), (60, 66, 64, 0)); out.putalpha(ImageChops.multiply(a, shape))
out.save(D + "label-shade.png", optimize=True)
print("label-mask, label-shade", shape.getbbox())
