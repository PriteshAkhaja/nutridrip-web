"""The route map's figure (see ASSETS.md): the generated line plate's paper made transparent, the ink kept as one
dark colour with its own alpha, so the drawing sits on whatever ground the page has.
usage: python tools/gen_rt_body.py body.png images/rt-body.webp"""
import sys
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("L")
# paper is 212 to 245 (measured), ink under 200: anything at 215 or lighter is paper; the darker, the more opaque
a = im.point(lambda v: max(0, min(255, int((215 - v) * 255 / 95))))
ink = Image.new("RGBA", im.size, (38, 47, 44, 0)); ink.putalpha(a)
bb = a.point(lambda v: 255 if v > 60 else 0).getbbox(); pad = 24
ink = ink.crop((bb[0] - pad, bb[1] - pad, bb[2] + pad, bb[3] + pad))
ink.save(out, quality=90)
print(out, ink.size, "crop", bb)
