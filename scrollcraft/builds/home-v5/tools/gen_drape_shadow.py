"""The folded drape's shadow on the table (see ASSETS.md): a soft-edged rectangle, transparent around it.
The rectangle fills the box less a margin (40 of 512 across, 24 of 256 down), which styles.css (.sf__wsh) matches by
making the box that much larger than the folded drape. It is stretched to the drape's shape, so it is drawn plain.
usage: python tools/gen_drape_shadow.py <images dir>
"""
import sys
from PIL import Image, ImageDraw, ImageFilter

out = sys.argv[1].rstrip("/\\") + "/"
W, H, MX, MY = 512, 256, 40, 24
a = Image.new("L", (W, H), 0)
ImageDraw.Draw(a).rectangle((MX, MY, W - MX, H - MY), fill=150)
a = a.filter(ImageFilter.GaussianBlur(13))
im = Image.new("RGBA", (W, H), (10, 30, 30, 0)); im.putalpha(a)
im.save(out + "drape-sh.webp", quality=90)
print("drape-sh.webp", W, H, "edge alpha", a.getpixel((MX, H // 2)), "centre", a.getpixel((W // 2, H // 2)))
