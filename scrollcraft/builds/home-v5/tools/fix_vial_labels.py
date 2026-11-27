"""Make the blank label on the two vial photographs solid paper (see ASSETS.md).

The blank label on vial-calcium-blank and vial-vitc-blank let the glass behind it show through: the far wall's edges
and highlights read as faint vertical panels inside the label, and our printed label (multiplied onto it) showed
them too. A real label is opaque paper; the only shading on it is the smooth fall-off as it wraps round the glass.

For each photograph: find the label (the band of rows bright right across the middle of the glass), take its
brightness across the glass, column by column, fit a smooth curve to that (a polynomial: it keeps the fall-off at the
edges and loses the panels), and repaint the label with it in the label's own colour. The label's top and bottom
few rows are blended back in from the original, so its edges stay the photograph's. Alpha is left as it was.
Plain PIL and Python, no numpy.

usage: python tools/fix_vial_labels.py <in.webp> <out.webp>
"""
import sys
from statistics import median
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGBA")
W, H = im.size
px = im.load()
L = lambda p: 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]

# the label's rows: the longest run, below the shoulder, whose middle 70% is bright
def row_mean(y):
    xs = range(int(W * 0.15), int(W * 0.85))
    return sum(L(px[x, y]) for x in xs) / len(xs)
best, start, run = (0, 0), 0, 0
for y in range(H):
    if y > H * 0.25 and row_mean(y) > 222:
        if run == 0: start = y
        run += 1
        if run > best[1] - best[0]: best = (start, y + 1)
    else:
        run = 0
y0, y1 = best
# its columns: where the glass is opaque on the label's middle row
ym = (y0 + y1) // 2
xs = [x for x in range(W) if px[x, ym][3] > 200]
x0, x1 = xs[0], xs[-1] + 1
n = x1 - x0

# the shading across it, from the label's middle rows
b0, b1 = y0 + (y1 - y0) // 6, y1 - (y1 - y0) // 6
prof = [median(L(px[x, y]) for y in range(b0, b1, 2)) for x in range(x0, x1)]
t = [-1 + 2 * i / (n - 1) for i in range(n)]

def polyfit(ts, vs, deg):
    # least squares by the normal equations, solved by Gaussian elimination
    m = deg + 1
    A = [[sum(tt ** (i + j) for tt in ts) for j in range(m)] for i in range(m)]
    B = [sum(v * tt ** i for tt, v in zip(ts, vs)) for i in range(m)]
    for c in range(m):
        p = max(range(c, m), key=lambda r: abs(A[r][c]))
        A[c], A[p], B[c], B[p] = A[p], A[c], B[p], B[c]
        for r in range(c + 1, m):
            f = A[r][c] / A[c][c]
            A[r] = [a - f * b for a, b in zip(A[r], A[c])]; B[r] -= f * B[c]
    cf = [0.0] * m
    for r in range(m - 1, -1, -1):
        cf[r] = (B[r] - sum(A[r][k] * cf[k] for k in range(r + 1, m))) / A[r][r]
    return lambda tt: sum(c * tt ** i for i, c in enumerate(cf))

f = polyfit(t, prof, 6)
# fit again to the brighter points only, so the dark panel lines pull the curve down less
keep = [(tt, v) for tt, v in zip(t, prof) if v >= f(tt) - 2]
f = polyfit([k[0] for k in keep], [k[1] for k in keep], 6)
fit = [max(0.0, min(255.0, f(tt))) for tt in t]

# the label's own colour: the average tint of its brightest points
pts = sorted((px[x, y] for x in range(x0, x1, 2) for y in range(b0, b1, 4)), key=L)[-max(1, n * (b1 - b0) // 40):]
pr, pg, pb = (sum(p[i] for p in pts) / len(pts) for i in range(3))
pl = max(1.0, 0.3 * pr + 0.59 * pg + 0.11 * pb)
tint = (pr / pl, pg / pl, pb / pl)

# repaint: the fitted paper inside, blended back to the photograph at the label's top, bottom and far sides
E, S = 6, 3
for y in range(y0, y1):
    wy = min(1.0, (y - y0 + 1) / E, (y1 - y) / E)
    for i, x in enumerate(range(x0, x1)):
        w = wy * min(1.0, (i + 1) / S, (n - i) / S)
        r, g, b, a = px[x, y]
        v = fit[i]
        px[x, y] = (round(r * (1 - w) + v * tint[0] * w), round(g * (1 - w) + v * tint[1] * w), round(b * (1 - w) + v * tint[2] * w), a)
im.save(out, quality=92, method=6)
steps = lambda s: max(abs(s[i + 1] - s[i]) for i in range(len(s) - 1))
print(f"{src.split('/')[-1]}: label rows {y0}-{y1}, columns {x0}-{x1}; largest step across it {steps(prof):.1f} before, {steps(fit):.1f} after")
