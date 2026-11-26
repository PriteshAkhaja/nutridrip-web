"""The physician act's preview assets (see ASSETS.md):
  doc-stamp.webp      the rubber stamp, cut out (alpha), cropped to itself
  doc-stamp-sh.webp   its soft shadow (same box), for the desk
  ink-grain.png       a speckled mask for stamped ink: mostly solid, with the small gaps a rubber stamp leaves
usage: python tools/gen_doc_assets.py stamp-cut.png <images dir>
"""
import sys, random
from PIL import Image, ImageFilter

src, out = sys.argv[1], sys.argv[2].rstrip("/\\") + "/"
im = Image.open(src).convert("RGBA")
bb = im.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox()
pad = 12
im = im.crop((bb[0] - pad, bb[1] - pad, bb[2] + pad, bb[3] + pad))
k = 640 / im.width
im = im.resize((640, round(im.height * k)), Image.LANCZOS)
im.save(out + "doc-stamp.webp", quality=90)
a = im.getchannel("A").filter(ImageFilter.GaussianBlur(16))
sh = Image.new("RGBA", im.size, (18, 26, 23, 0)); sh.putalpha(a.point(lambda v: int(v * .55)))
sh.save(out + "doc-stamp-sh.webp", quality=80)
print("doc-stamp.webp", im.size, "ratio", round(im.width / im.height, 4))

# ink grain: white = ink stays, black = ink missing. Mostly solid; clusters of small gaps, a little coarser in places.
random.seed(7)
S = 320
g = Image.new("L", (S, S), 255); px = g.load()
for _ in range(2600):
    x, y, r = random.randrange(S), random.randrange(S), random.choice((1, 1, 1, 2))
    for dx in range(-r, r + 1):
        for dy in range(-r, r + 1):
            if dx * dx + dy * dy <= r * r: px[(x + dx) % S, (y + dy) % S] = 0
blot = Image.effect_noise((S, S), 60).filter(ImageFilter.GaussianBlur(6)).point(lambda v: 255 if v > 118 else 150)
g = Image.composite(g, Image.new("L", (S, S), 0), blot.point(lambda v: v)).filter(ImageFilter.GaussianBlur(0.6))
ink = Image.new("RGBA", (S, S), (0, 0, 0, 0)); ink.putalpha(g)
ink.save(out + "ink-grain.png")
print("ink-grain.png", S)
