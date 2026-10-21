# Слои мимики из сгенерированных кадров (design/mascot/gen/*.png, см. gen_frames.py).
# Кадр выравнивается по оригиналу (масштаб + сдвиг по маске силуэта, корреляция через
# FFT), затем из него вырезаются области глаз и рта с мягкой маской -> public/mascot/*.webp.
# Запуск: python3 design/mascot/from_gen.py   (numpy + Pillow)
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tone import punch
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REF = os.path.join(ROOT, "design/mascot/reference.png")
GEN = os.path.join(ROOT, "design/mascot/gen")
OUT = os.environ.get("MASCOT_OUT") or os.path.join(ROOT, "public/mascot")

ref = Image.open(REF).convert("RGB")
W, H = ref.size


def mask(im, down=1):
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    m = (a.min(2) < 205).astype(np.float32)
    if down > 1:
        m = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).resize((m.shape[1] // down, m.shape[0] // down), Image.BILINEAR)).astype(np.float32) / 255
    return m


def best_shift(a, b):
    """сдвиг b относительно a (корреляция через FFT)"""
    h, w = a.shape
    pb = np.zeros_like(a)
    hh, ww = min(h, b.shape[0]), min(w, b.shape[1])
    pb[:hh, :ww] = b[:hh, :ww]
    c = np.fft.irfft2(np.fft.rfft2(a - a.mean()) * np.conj(np.fft.rfft2(pb - pb.mean())), s=a.shape)
    y, x = np.unravel_index(np.argmax(c), c.shape)
    if y > h // 2: y -= h
    if x > w // 2: x -= w
    return x, y, c.max()


def register(gen):
    d = 2
    ra = mask(ref, d)
    best = None
    for s in np.linspace(0.78, 0.88, 41):
        g = gen.resize((int(gen.width * s), int(gen.height * s)), Image.LANCZOS)
        gm = mask(g, d)
        x, y, sc = best_shift(ra, gm)
        if best is None or sc > best[0]:
            best = (sc, s, x * d, y * d)
    return best[1], best[2], best[3]


def to_ref_space(gen):
    s, dx, dy = register(gen)
    g = gen.resize((int(gen.width * s), int(gen.height * s)), Image.LANCZOS)
    canvas = Image.new("RGB", (W, H), (255, 255, 255))
    canvas.paste(g, (-dx, -dy))
    return canvas, (s, dx, dy)


def ell(cx, cy, rx, ry):
    yy, xx = np.mgrid[0:H, 0:W]
    return (((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1).astype(np.float32)


def soft(m, r):
    return np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255


def save(name, rgb, alpha, box):
    x0, y0, x1, y1 = box
    arr = np.dstack([punch(np.asarray(rgb)[y0:y1, x0:x1]), np.clip(alpha[y0:y1, x0:x1], 0, 1) * 255]).astype(np.uint8)
    im = Image.fromarray(arr, "RGBA")
    if os.environ.get("MASCOT_FULL"):
        im.save(os.path.join(OUT, name + ".png"))
        return
    im = im.resize(((x1 - x0) // 2, (y1 - y0) // 2), Image.LANCZOS)
    im.save(os.path.join(OUT, name + ".webp"), "WEBP", quality=90, method=6)
    print(name, box, im.size)


EYES = {"l": (505, 405), "r": (718, 405)}
MOUTH = (615, 495)
frames = {}
for n in ["eyes-closed", "eyes-half", "mouth-open", "mouth-o"]:
    p = os.path.join(GEN, n + ".png")
    if os.path.exists(p):
        frames[n], info = to_ref_space(Image.open(p).convert("RGB"))
        print("aligned", n, info)

for key, nm in [("eyes-closed", "eyeclosed"), ("eyes-half", "eyehalf")]:
    if key not in frames:
        continue
    for k, (cx, cy) in EYES.items():
        m = soft(ell(cx, cy, 84, 88), 7)
        save(f"{nm}-{k}", frames[key], m, (cx - 100, cy - 104, cx + 100, cy + 104))
for key, nm in [("mouth-open", "mouthopen"), ("mouth-o", "moutho")]:
    if key in frames:
        m = soft(ell(MOUTH[0], MOUTH[1], 60, 52), 6)
        save(nm, frames[key], m, (MOUTH[0] - 76, MOUTH[1] - 68, MOUTH[0] + 76, MOUTH[1] + 68))
