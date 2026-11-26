"""Assets for the hero's "light through the drip" (written for this build, no third-party code):
  caustic.webp      tileable caustic light, white lines on black (warped cellular edges, two layers)
  bag-shadow.webp   the filled bag's soft shadow on the wall: dark rim and seams, lighter body (from the photo's alpha)
  liquid-mask.png   where light passes through the liquid: the silhouette inside its seams, soft
  tex-plaster-m.webp  the wall for phones (1280 wide)
usage: python gen_light.py <images dir>
"""
import sys, math, random
from PIL import Image, ImageFilter, ImageChops

D = sys.argv[1].rstrip("/\\") + "/"

# ---------------------------------------------------------------- caustic
S = 512
def layer(n, seed, warp, width):
    rnd = random.Random(seed)
    pts = [[(rnd.random(), rnd.random()) for _ in range(n)] for _ in range(n)]
    # periodic warp (integer frequencies keep the tile seamless)
    ph = [rnd.random() * 6.283 for _ in range(4)]
    out = [0.0] * (S * S)
    for y in range(S):
        v0 = y / S
        for x in range(S):
            u0 = x / S
            u = u0 + warp * (math.sin(6.283 * (2 * v0) + ph[0]) * 0.6 + math.sin(6.283 * (3 * v0 + u0) + ph[1]) * 0.4)
            v = v0 + warp * (math.sin(6.283 * (2 * u0) + ph[2]) * 0.6 + math.sin(6.283 * (3 * u0 - v0) + ph[3]) * 0.4)
            gx, gy = u * n, v * n
            cx, cy = math.floor(gx), math.floor(gy)
            f1 = f2 = 9.0
            for j in (-1, 0, 1):
                for i in (-1, 0, 1):
                    qx, qy = cx + i, cy + j
                    px, py = pts[qy % n][qx % n]
                    dx, dy = qx + px - gx, qy + py - gy
                    d = math.sqrt(dx * dx + dy * dy)
                    if d < f1: f1, f2 = d, f1
                    elif d < f2: f2 = d
            e = f2 - f1
            out[y * S + x] = math.exp(-(e / width) ** 2) * (0.55 + 0.45 * min(1.0, f1 * 1.6))
    return out

a = layer(5, 11, 0.07, 0.10)
b = layer(7, 29, 0.06, 0.12)
img = Image.new("L", (S, S))
img.putdata([max(0, min(255, int(255 * (min(1.0, a[k] * 0.9 + b[k] * 0.38) ** 1.35)))) for k in range(S * S)])
img = img.filter(ImageFilter.GaussianBlur(3.2))
img.save(D + "caustic.webp", quality=88)
print("caustic", img.size, img.getextrema())

# ---------------------------------------------------------------- the bag's shadow
empty = Image.open(D + "bag-empty.webp").convert("RGBA")
mask = Image.open(D + "bag-mask.png").getchannel("A")
W, H = empty.size
# A clear bag's shadow is mostly light: what darkens it is where the plastic bends light away, its outline, seams
# and creases. Those are the photo's fine detail (the photo against its own blur), not its opacity: the welded
# margins are nearly opaque in the photo but clear in life.
grey = Image.new("RGBA", (W, H), (128, 128, 128, 255)); grey.alpha_composite(empty)
L = grey.convert("L")
detail = ImageChops.difference(L, L.filter(ImageFilter.GaussianBlur(5))).point(lambda v: min(255, int(v * 4.5)))
detail = ImageChops.multiply(detail, mask).point(lambda v: int(v * 0.42)).filter(ImageFilter.GaussianBlur(2.6))
outline = ImageChops.subtract(mask, mask.filter(ImageFilter.MinFilter(7))).point(lambda v: int(v * 0.30)).filter(ImageFilter.GaussianBlur(2.5))
pen = mask.point(lambda v: int(v * 0.09)).filter(ImageFilter.GaussianBlur(14))       # light passes the clear body: a faint, soft shade
sh = ImageChops.lighter(ImageChops.lighter(detail, outline), pen)
shadow = Image.new("RGBA", (W, H), (34, 30, 26, 0)); shadow.putalpha(sh)
shadow.save(D + "bag-shadow.webp", quality=90)
print("shadow", shadow.size, sh.getextrema())

# ---------------------------------------------------------------- where the light passes through the liquid
inner = mask.filter(ImageFilter.MinFilter(15))                                       # inside the seams
grad = Image.new("L", (W, H))
gp = []
for y in range(H):
    f = y / H
    t = 0 if f < 0.11 else (f - 0.11) / 0.07 if f < 0.18 else 1 if f < 0.80 else max(0, 1 - (f - 0.80) / 0.05)
    gp.extend([int(255 * t)] * W)
grad.putdata(gp)
liq = ImageChops.multiply(inner, grad).filter(ImageFilter.GaussianBlur(13))
lm = Image.new("RGBA", (W, H), (0, 0, 0, 0)); lm.putalpha(liq)
lm.save(D + "liquid-mask.png", optimize=True)
print("liquid", liq.getextrema())

# ---------------------------------------------------------------- the wall, for phones
wall = Image.open(D + "tex-plaster.webp").convert("RGB")
wall.resize((1280, round(1280 * wall.height / wall.width)), Image.LANCZOS).save(D + "tex-plaster-m.webp", quality=82)
print("wall-m ok")
