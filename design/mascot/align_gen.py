# Выравнивание сгенерированного кадра по оригиналу (масштаб + сдвиг по силуэту, FFT-корреляция)
# → design/mascot/gen/<имя>-aligned.png (1264×848 на белом). Дальше upscale.py ×4 и parts.py
# берут из него то, чего в оригинале нет (например, мех тела под поднятой лапой).
#   python3 design/mascot/align_gen.py wave-pose
import os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REF = os.path.join(ROOT, "design/mascot/reference.png")
GEN = os.path.join(ROOT, "design/mascot/gen")
ref = Image.open(REF).convert("RGB")
W, H = ref.size


def mask(im, down=1):
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    m = (a.min(2) < 205).astype(np.float32)
    if down > 1:
        m = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).resize((m.shape[1] // down, m.shape[0] // down), Image.BILINEAR)).astype(np.float32) / 255
    return m


def best_shift(a, b):
    h, w = a.shape
    pb = np.zeros_like(a)
    hh, ww = min(h, b.shape[0]), min(w, b.shape[1])
    pb[:hh, :ww] = b[:hh, :ww]
    c = np.fft.irfft2(np.fft.rfft2(a - a.mean()) * np.conj(np.fft.rfft2(pb - pb.mean())), s=a.shape)
    y, x = np.unravel_index(np.argmax(c), c.shape)
    if y > h // 2: y -= h
    if x > w // 2: x -= w
    return x, y, c.max()


def register(gen, head_only=True):
    """совмещение по голове (глаза, нос, уши): тело в кадре может отличаться (поза)"""
    d = 2
    ra = mask(ref, d)
    if head_only:
        ra[int(600 / d):, :] = 0
    best = None
    for s in np.linspace(0.76, 0.9, 57):
        g = gen.resize((int(gen.width * s), int(gen.height * s)), Image.LANCZOS)
        gm = mask(g, d)
        x, y, sc = best_shift(ra, gm)
        if best is None or sc > best[0]:
            best = (sc, s, x * d, y * d)
    return best[1], best[2], best[3]


name = sys.argv[1]
gen = Image.open(os.path.join(GEN, name + ".png")).convert("RGB")
s, dx, dy = register(gen)
g = gen.resize((int(gen.width * s), int(gen.height * s)), Image.LANCZOS)
canvas = Image.new("RGB", (W, H), (255, 255, 255))
canvas.paste(g, (-dx, -dy))
canvas.save(os.path.join(GEN, name + "-aligned.png"))
a = np.asarray(ref).astype(int); b = np.asarray(canvas).astype(int)
box = (430, 330, 800, 520)
print("scale %.3f shift (%d,%d) face diff %.1f" % (s, dx, dy, np.abs(a[box[1]:box[3], box[0]:box[2]] - b[box[1]:box[3], box[0]:box[2]]).mean()))
# контроль глазами: оригинал | выровненный кадр | разница
diff = Image.fromarray(np.clip(np.abs(a - b).mean(2) * 3, 0, 255).astype(np.uint8)).convert("RGB")
sheet = Image.new("RGB", (W * 3 // 2 + 20, H // 2), (255, 255, 255))
for i, im in enumerate((ref, canvas, diff)):
    sheet.paste(im.resize((W // 2, H // 2)), (i * (W // 2 + 10), 0))
sheet.save("/tmp/claude-0/shots/align_" + name + ".png")
