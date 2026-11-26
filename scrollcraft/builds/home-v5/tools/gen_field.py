"""The sterile field's images (see ASSETS.md), from generated photos:
  drape.png       a surgical drape, top-down, filling the frame (upscaled)
  knoll-cut.png   the instruments, laid out apart, background removed (alpha)
  pouch-cut.png   the sealed sterile pouch, background removed (alpha)
Writes into the images folder:
  field-drape.webp, field-drape-m.webp       the drape (desktop, phones)
  field-<item>.webp, field-<item>-sh.webp    each item cut out, and its soft shadow (same box)
and prints each item's aspect ratio (width / height) for app.js.
usage: python tools/gen_field.py drape.png knoll-cut.png pouch-cut.png <images dir>
"""
import sys
from PIL import Image, ImageFilter

drape, knoll, pouch, out = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4].rstrip("/\\") + "/"
d = Image.open(drape).convert("RGB")
d.resize((2000, round(2000 * d.height / d.width)), Image.LANCZOS).save(out + "field-drape.webp", quality=84)
d.resize((1100, round(1100 * d.height / d.width)), Image.LANCZOS).save(out + "field-drape-m.webp", quality=80)

def save_item(name, rgba, maxd=720):
    a = rgba.getchannel("A")
    bb = a.point(lambda v: 255 if v > 24 else 0).getbbox()
    pad = int(max(bb[2] - bb[0], bb[3] - bb[1]) * .08)
    bb = (max(0, bb[0] - pad), max(0, bb[1] - pad), min(rgba.width, bb[2] + pad), min(rgba.height, bb[3] + pad))
    it = rgba.crop(bb)
    k = min(1, maxd / max(it.size)); it = it.resize((round(it.width * k), round(it.height * k)), Image.LANCZOS)
    it.save(out + "field-%s.webp" % name, quality=90)
    # its shadow on the drape: the shape, soft, darker in the middle
    s = it.getchannel("A").filter(ImageFilter.GaussianBlur(max(3, it.width * .025)))
    sh = Image.new("RGBA", it.size, (18, 40, 40, 0)); sh.putalpha(s.point(lambda v: int(v * .5)))
    sh.save(out + "field-%s-sh.webp" % name, quality=80)
    print("%-12s %.4f  %dx%d" % (name, it.width / it.height, it.width, it.height))

# the instruments: each connected shape in the cut-out, named by where it lies in the photograph
k = Image.open(knoll).convert("RGBA"); W, H = k.size
alpha = k.getchannel("A").point(lambda v: 255 if v > 40 else 0)
small = alpha.resize((W // 4, H // 4), Image.NEAREST)
sw, sh_ = small.size; px = small.load(); seen = set(); comps = []
for y in range(sh_):
    for x in range(sw):
        if px[x, y] and (x, y) not in seen:
            st = [(x, y)]; seen.add((x, y)); pts = []
            while st:
                cx, cy = st.pop(); pts.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1), (cx + 1, cy + 1), (cx - 1, cy - 1), (cx + 1, cy - 1), (cx - 1, cy + 1)):
                    if 0 <= nx < sw and 0 <= ny < sh_ and px[nx, ny] and (nx, ny) not in seen:
                        seen.add((nx, ny)); st.append((nx, ny))
            if len(pts) > 30: comps.append(pts)
NAMES = {"gloves": (.39, .24), "cuff": (.63, .29), "tourniquet": (.34, .48), "monitor": (.47, .49), "gauze": (.58, .53),
         "tape": (.67, .53), "syringe": (.48, .63), "case": (.47, .78), "sharps": (.65, .77)}
found = {}
for pts in comps:
    cx = sum(p[0] for p in pts) / len(pts) / sw; cy = sum(p[1] for p in pts) / len(pts) / sh_
    name = min(NAMES, key=lambda n: (NAMES[n][0] - cx) ** 2 + (NAMES[n][1] - cy) ** 2)
    found.setdefault(name, []).extend(pts)
for name, pts in sorted(found.items()):
    m = Image.new("L", (sw, sh_), 0); mp = m.load()
    for p in pts: mp[p] = 255
    m = m.resize((W, H), Image.NEAREST).filter(ImageFilter.MaxFilter(9))
    piece = k.copy(); piece.putalpha(Image.composite(k.getchannel("A"), Image.new("L", (W, H), 0), m))
    save_item(name, piece)
missing = set(NAMES) - set(found)
if missing: print("MISSING", missing)
save_item("pouch", Image.open(pouch).convert("RGBA"), maxd=900)
