"""The statement act's sterile pouch, from generated photos of one framing (see ASSETS.md):
  closed     the sealed pouch with the IV set inside (the plate)
  empty      the same pouch opened and empty (an edit of closed)
  setalone   the IV set alone on the surface, same place (an edit of closed)
  setcut     setalone with its background removed (alpha)
All upscaled 2x except setcut, whose alpha is resized to match. Writes into the images folder:
  pouch-plate.webp, pouch-plate-m.webp   the plate, desktop 2400 wide and phones 1280 wide
  pouch-open.webp    the empty pouch's window, colour-matched to the plate, alpha (what the peeled film uncovers)
  pouch-set.webp     the IV set, alpha (it lifts out)
  pouch-shade.webp   its contact shadow, alpha (stays on the paper as it lifts)
and prints each layer's box as a percentage of the plate, for styles.css.
usage: python tools/gen_pouch.py closed.png empty.png setalone.png setcut.png <images dir>
"""
import sys
from PIL import Image, ImageChops, ImageFilter, ImageStat, ImageDraw

closed = Image.open(sys.argv[1]).convert("RGB")
W, H = closed.size
empty = Image.open(sys.argv[2]).convert("RGB").resize((W, H), Image.LANCZOS)
setalone = Image.open(sys.argv[3]).convert("RGB").resize((W, H), Image.LANCZOS)
cut = Image.open(sys.argv[4]).convert("RGBA").getchannel("A").resize((W, H), Image.LANCZOS)
out = sys.argv[5].rstrip("/\\") + "/"
pct = lambda b: "left %.3f%%; top %.3f%%; width %.3f%%; height %.3f%%" % (b[0] / W * 100, b[1] / H * 100, (b[2] - b[0]) / W * 100, (b[3] - b[1]) / H * 100)

# the pouch: the bright paper on the right of the empty version
lum = empty.convert("L")
paper = lum.point(lambda v: 255 if v > 236 else 0).filter(ImageFilter.MedianFilter(5))
bb = paper.crop((W // 2, 0, W, H)).getbbox()
x0, y0, x1, y1 = bb[0] + W // 2, bb[1], bb[2] + W // 2, bb[3]
pw, ph = x1 - x0, y1 - y0
# the window inside its seal border (the film's extent): inset 4.5% at the sides, 11.5% at the top (the notch), 3% below
win = Image.new("L", (W, H), 0)
wb = (int(x0 + pw * .045), int(y0 + ph * .115), int(x1 - pw * .045), int(y1 - ph * .03))
ImageDraw.Draw(win).rounded_rectangle(wb, radius=int(pw * .03), fill=255)
win = win.filter(ImageFilter.GaussianBlur(4))

# colour-match the edits to the plate, per channel, over the plain surface around the pouch
around = Image.new("L", (W, H), 0); ImageDraw.Draw(around).rectangle([x0 - pw * .4, y0, x0 - pw * .05, y1], fill=255)
def match(img):
    a, b = ImageStat.Stat(closed, around).mean, ImageStat.Stat(img, around).mean
    g = [p / max(1, q) for p, q in zip(a, b)]
    return Image.merge("RGB", [ch.point(lambda v, g=g: min(255, int(v * g + .5))) for ch, g in zip(img.split(), g)]), g
empty_m, g1 = match(empty); set_m, g2 = match(setalone)
print("gains", [round(v, 3) for v in g1], [round(v, 3) for v in g2])

closed.resize((2400, round(2400 * H / W)), Image.LANCZOS).save(out + "pouch-plate.webp", quality=88)
closed.resize((1280, round(1280 * H / W)), Image.LANCZOS).save(out + "pouch-plate-m.webp", quality=84)
ob = wb
op = empty_m.convert("RGBA"); op.putalpha(win); op.crop(ob).save(out + "pouch-open.webp", quality=90)
sb = cut.point(lambda v: 255 if v > 8 else 0).getbbox()
pad = int(W * .01); sb = (sb[0] - pad, sb[1] - pad, sb[2] + pad, sb[3] + pad)
# the clear tubing carried the beige table seen through it; on the white paper it must read as clear plastic again:
# most of its colour taken out, a touch brighter
from PIL import ImageEnhance
set_n = ImageEnhance.Brightness(ImageEnhance.Color(set_m).enhance(0.22)).enhance(1.035)
st = set_n.convert("RGBA"); st.putalpha(cut); st.crop(sb).save(out + "pouch-set.webp", quality=92)
sh = Image.new("RGBA", (W, H), (70, 58, 42, 0)); sh.putalpha(cut.filter(ImageFilter.GaussianBlur(10)).point(lambda v: int(v * .32)))
sh.crop(sb).save(out + "pouch-shade.webp", quality=90)
print("pouch  ", pct((x0, y0, x1, y1)))
print("window ", pct(ob))
print("set    ", pct(sb))
