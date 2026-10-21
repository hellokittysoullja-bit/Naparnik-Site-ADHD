# Нарезка чистого кота (design/mascot/export/naparnik-cat*.png — вырезка без фона, matte.py)
# на слои куклы по схеме «копировать вверх → залатать низ», как в Photopea, но кодом:
#  — нахлёст 30–50 px под соседа (уши под голову, хвост и нога под тело/грудку);
#  — где часть лежит ПОВЕРХ (голова на теле) — край по пучкам меха, а не ровной линией;
#  — дыры латаются НАСТОЯЩЕЙ текстурой соседнего меха (нормированная свёртка по донорам —
#    аналог Clone Stamp), а не плоской кистью.
# Координаты разметки — в пикселях оригинала 1264×848; S — масштаб мастера (1 или 4).
# Выход: public/mascot/parts/<слой>.png|webp (обрезка + 4 px поля, прямая альфа) и
# public/mascot/rig.json (смещения, размеры, шарниры, z-порядок).
#   python3 design/mascot/parts.py [S] [EXPORT]   # EXPORT — масштаб экспорта относительно 1x
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
S = int(sys.argv[1]) if len(sys.argv) > 1 else 1
EXPORT = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
SRC = os.path.join(ROOT, 'design/mascot/export/naparnik-cat%s.png' % ('' if S == 1 else f'@{S}x'))
GEN = os.path.join(ROOT, 'design/mascot/rive/layers')  # кадры глаз/рта, сгенерированные по оригиналу (1x)
OUT = os.path.join(ROOT, 'public/mascot/parts/')
os.makedirs(OUT, exist_ok=True)

im = np.asarray(Image.open(SRC).convert('RGBA')).astype(np.float32)
H, W, _ = im.shape
rgb, alpha = im[..., :3], im[..., 3] / 255
lum = rgb.mean(2)
yy, xx = np.mgrid[0:H, 0:W]
sc = lambda v: v * S


def poly(pts, feather=0):
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).polygon([(sc(x), sc(y)) for x, y in pts], fill=255)
    if feather:
        m = m.filter(ImageFilter.GaussianBlur(feather * S))
    return np.asarray(m).astype(np.float32) / 255


def ell(cx, cy, rx, ry):
    return ((xx - sc(cx)) / sc(rx)) ** 2 + ((yy - sc(cy)) / sc(ry)) ** 2 <= 1


def soft(mask, r):
    return np.asarray(Image.fromarray((np.clip(mask, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r * S))).astype(np.float32) / 255


def boxblur(x, r):
    x = x.astype(np.float64); k = 2 * r + 1
    p = np.pad(x, ((r, r), (r, r)) + ((0, 0),) * (x.ndim - 2), mode='edge')
    c = np.cumsum(np.cumsum(p, 0), 1)
    c = np.pad(c, ((1, 0), (1, 0)) + ((0, 0),) * (x.ndim - 2))
    return (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)


TEXR = 9


def clone(img, hole, valid, tex=None, gain=0.9, flat=False):
    """«Clone Stamp»: низкие частоты — заливка от краёв внутрь по донорам (valid), зерно акварели —
    высокие частоты из донорского блока tex=(x0,y0,x1,y1) (1x), замощённого по дыре: без радиальных
    «лучей» от ближайшего пикселя и без «мыла». Меняется ТОЛЬКО дыра."""
    known = ((~hole) & valid).astype(np.float64)
    out = img.astype(np.float64).copy()
    r = 4 * S
    for _ in range(400):
        if known[hole].min() >= 1:
            break
        num = boxblur(out * known[..., None], r); den = boxblur(known, r)
        newly = (known < 1) & (den > 0.15)
        out = np.where(newly[..., None], num / np.maximum(den, 1e-6)[..., None], out)
        known = np.where(newly, 1.0, known)
    out = boxblur(out, TEXR * S)  # низкие частоты латки
    hf = img - boxblur(img, TEXR * S)  # мазки кисти + зерно (всё, что мельче TEXR px)
    if tex is None:
        idx = ndi.distance_transform_edt(~valid, return_distances=False, return_indices=True)
        grain = hf[idx[0], idx[1]]
    else:
        x0, y0, x1, y1 = (sc(v) for v in tex)
        block = hf[y0:y1, x0:x1]
        bh, bw = block.shape[:2]
        grain = block[(yy + 7 * S) % bh, (xx + 11 * S) % bw]
    if flat:  # ровная заливка медианой доноров (радужка): без светлого «призрака» зрачка
        out = np.broadcast_to(np.median(img[valid], axis=0), img.shape).astype(np.float64)
    out = np.where(hole[..., None], out + grain * gain, img)
    return np.clip(out, 0, 255).astype(np.float32)


FUR_OK = (alpha > 0.9) & (lum > 40) & (lum < 120) & (np.abs(rgb[..., 0] - rgb[..., 2]) < 22)  # мех без глаз/огня/подушечек

# ── разметка (1x) ──────────────────────────────────────────────────────────────
TAIL = poly([(925, 255), (1160, 255), (1160, 790), (800, 790), (800, 655), (860, 640), (935, 560), (915, 470)], 2)
FLAME = poly([(915, 262), (1030, 262), (1030, 410), (985, 422), (950, 418), (915, 395)], 2)
EAR_L = poly([(370, 140), (500, 120), (560, 215), (545, 240), (470, 262), (400, 268), (372, 230)], 5)
EAR_R = poly([(640, 215), (700, 150), (790, 100), (825, 150), (830, 265), (780, 268), (700, 250)], 5)
# основание уха на голове — круглая макушка после удаления уха
EAR_CUT = np.maximum(poly([(370, 140), (500, 120), (540, 190), (470, 215), (400, 225), (372, 200)], 5),
                     poly([(650, 190), (700, 150), (790, 100), (825, 150), (828, 215), (780, 222), (700, 205)], 5))
# голова: сверху/по бокам по контуру, снизу — зигзагом по пучкам щёк
HEAD = poly([(250, 90), (900, 90), (915, 470), (935, 560), (880, 600), (820, 588), (700, 598), (600, 602), (470, 596), (400, 590), (250, 590)], 10)
# машущая лапа (левая на экране) + нога: столбик вверх под грудку/щёку (нахлёст 50 px)
ARM = poly([(432, 556), (556, 556), (566, 700), (560, 770), (420, 770), (418, 700)], 3)
PAW_L = poly([(440, 676), (470, 662), (530, 662), (556, 680), (560, 725), (550, 760), (500, 768), (445, 760), (436, 725)], 2)
# правая на экране лапка — подушечки
PAW_R = poly([(688, 672), (720, 660), (778, 662), (800, 690), (798, 740), (780, 768), (730, 772), (696, 758), (684, 715)], 2)
# грудка: передний пух над лапами, поверх ноги и под головой
CHEST = poly([(430, 575), (470, 596), (600, 602), (700, 598), (820, 588), (840, 640), (815, 700), (760, 672), (700, 690), (640, 700), (590, 690), (560, 700), (540, 672), (470, 662), (438, 676), (414, 640)], 4)
BODY_ZONE = poly([(250, 520), (1000, 520), (1000, 800), (250, 800)], 10)
EYES = {'L': (505, 405), 'R': (718, 405)}
RX, RY = 64, 67
MOUTH_BOX = (572, 466, 658, 508)

layers = []  # (имя, rgb, alpha, z)


def add(name, rgbx, a, z):
    layers.append((name, rgbx, np.clip(a, 0, 1), z))


# 1-2. хвост (без огня, с нахлёстом под тело) и огонёк
add('tail', rgb, alpha * TAIL * (1 - FLAME), 0)
add('flame', rgb, alpha * FLAME, 1)
notail = 1 - TAIL
# 3-4. уши с круглым основанием, заходящим под голову
add('ear_L', rgb, alpha * EAR_L * notail, 2)
add('ear_R', rgb, alpha * EAR_R * notail, 3)

# 9. голова: без ушей, глаза и рот залатаны мехом (под дугой закрытого глаза — мех, не дыра)
eye_hole = np.zeros((H, W), bool)
eye_blend = np.zeros((H, W), np.float32)  # перо: латка плавно переходит в родной мех, границы не видно
for cx, cy in EYES.values():
    eye_hole |= ell(cx, cy, RX + 16, RY + 16)
    eye_blend = np.maximum(eye_blend, soft(ell(cx, cy, RX + 10, RY + 10), 3))
mouth_ink = np.zeros((H, W), bool)
mouth_ink[sc(MOUTH_BOX[1]):sc(MOUTH_BOX[3]), sc(MOUTH_BOX[0]):sc(MOUTH_BOX[2])] = True
mouth_ink &= lum < 48  # тушь (~22), не мех (~63)
mouth_hole = ndi.binary_dilation(mouth_ink, iterations=4 * S)
head_rgb = clone(rgb, eye_hole | mouth_hole, FUR_OK & ~eye_hole & ~mouth_hole, tex=(570, 250, 660, 340))  # зерно — мех лба
_w = np.clip(eye_blend, 0, 1)
head_rgb = np.where((eye_hole & ~mouth_hole)[..., None], head_rgb * _w[..., None] + rgb * (1 - _w[..., None]), head_rgb)
add('head', head_rgb, alpha * HEAD * notail * (1 - EAR_CUT), 9)

# 10-13. глаза по схеме Live2D: контур (толстая тушь) — отдельный слой-сетка, который движок
# сплющивает к нижней дуге (закрытый глаз = сам контур), заливка радужки целиком зелёная
# (под зрачком — цвет), зрачок без блика, блик отдельно; радужка/зрачок/блик режутся маской той же
# формы, что и контур. Век-«дисков» нет — нечему давать артефакты.
for k, (cx, cy) in EYES.items():
    inner = ell(cx, cy, RX - 9, RY - 9)
    pupil = inner & (lum < 90)
    shine = inner & (rgb.min(2) > 200) & ell(cx + 20, cy - 25, 22, 22)
    pupil_m = ndi.binary_dilation(pupil | shine, iterations=4 * S)  # с запасом: антиалиас края зрачка не остаётся «призраком»
    green = inner & ~pupil_m & (rgb[..., 1] > rgb[..., 0])
    # заливка под зрачком: построчная интерполяция между зелёным слева и справа —
    # вертикальный градиент радужки сохраняется, «призрака» зрачка нет
    fill_rgb = rgb.copy()
    hole = ell(cx, cy, RX - 3, RY - 3) & ~green
    ys_, xs_ = np.nonzero(hole)
    for yrow in np.unique(ys_):
        row_g = np.nonzero(green[yrow])[0]
        if len(row_g) < 2:
            continue
        xs_row = xs_[ys_ == yrow]
        for xcol in xs_row:
            left = row_g[row_g < xcol]; right = row_g[row_g > xcol]
            if len(left) and len(right):
                a_, b_ = left[-1], right[0]; t_ = (xcol - a_) / (b_ - a_)
                fill_rgb[yrow, xcol] = rgb[yrow, a_] * (1 - t_) + rgb[yrow, b_] * t_
            elif len(left):
                fill_rgb[yrow, xcol] = rgb[yrow, left[-1]]
            else:
                fill_rgb[yrow, xcol] = rgb[yrow, right[0]]
    # контур: тёмные пиксели кольца между внутренним краем радужки и мехом (+ антиалиас), без усов
    zone = ell(cx, cy, RX + 10, RY + 10) & ~ell(cx, cy, RX - 16, RY - 16)
    sat_ = rgb.max(2) - rgb.min(2)
    ink_px = zone & (lum < 120) & ~((sat_ > 60) & (rgb[..., 0] > rgb[..., 1] + 30))
    ring_a = soft(ndi.binary_dilation(ink_px, iterations=S), 0.6) * zone
    # зеленоватый антиалиас у внутреннего края — в цвет туши: при смыкании он не даёт зелёной кромки
    ink_c = np.percentile(rgb[ink_px & (lum < 60)], 30, axis=0)
    ring_rgb = np.where((((rgb[..., 1] > rgb[..., 0] + 15) | (lum > 95)) & zone)[..., None], ink_c, rgb)
    add('ring_' + k, ring_rgb, alpha * ring_a, 13)
    add('iris_' + k, fill_rgb, alpha * soft(ell(cx, cy, RX - 3, RY - 3), 0.7), 10)
    pupil_rgb = np.where(ndi.binary_dilation(shine, iterations=S)[..., None], rgb[pupil & ~shine].mean(0), rgb)
    add('pupil_' + k, pupil_rgb, soft(ndi.binary_dilation(pupil | shine, iterations=S) & inner, 0.8), 11)
    add('shine_' + k, rgb, soft(ndi.binary_dilation(shine, iterations=S), 0.5), 12)

# 14. закрытые глаза — кадры, сгенерированные по оригиналу (from_gen.py), не рисованные дуги
def gen_layer(key, box):
    p = os.path.join(GEN, key + '.png')
    g = np.asarray(Image.open(p).convert('RGBA')).astype(np.float32)
    full = np.zeros((H, W, 4), np.float32)
    x0, y0, x1, y1 = box
    if S != 1:
        g = np.asarray(Image.fromarray(g.astype(np.uint8), 'RGBA').resize((sc(x1 - x0), sc(y1 - y0)), Image.LANCZOS)).astype(np.float32)
    full[sc(y0):sc(y1), sc(x0):sc(x1)] = g
    return full[..., :3], full[..., 3] / 255
for k, key, box in (('L', 'eyeclosed-l', (405, 301, 605, 509)), ('R', 'eyeclosed-r', (618, 301, 818, 509))):
    r_, a_ = gen_layer(key, box); add('closed_' + k, r_, a_, 14)

# 15. рты: родное «ω», открытый и «о» — кадры по оригиналу; плоский и грустный — штрих тушью
mouth_a = soft(ndi.binary_dilation(mouth_ink, iterations=S), 0.7)
add('mouth_smile', rgb, mouth_a, 15)
for key, nm in (('mouthopen', 'mouth_open'), ('moutho', 'mouth_o')):
    r_, a_ = gen_layer(key, (539, 427, 691, 563)); add(nm, r_, a_, 15)
ink = np.percentile(rgb[mouth_ink], 20, axis=0)  # самая тёмная тушь
def stroke(draw_fn):
    m = Image.new('L', (W, H), 0); draw_fn(ImageDraw.Draw(m))
    a = soft(np.asarray(m).astype(np.float32) / 255, 0.6)
    return np.broadcast_to(ink, (H, W, 3)).astype(np.float32), a
mx, my = (MOUTH_BOX[0] + MOUTH_BOX[2]) / 2, 484
r_, a_ = stroke(lambda d: d.line([(sc(mx - 22), sc(my)), (sc(mx + 22), sc(my))], fill=255, width=int(4 * S))); add('mouth_flat', r_, a_, 15)
r_, a_ = stroke(lambda d: d.arc([sc(mx - 24), sc(my - 4), sc(mx + 24), sc(my + 28)], 200, 340, fill=255, width=int(4 * S))); add('mouth_sad', r_, a_, 15)

# 5-8. тело, лапы, нога, грудка
arm_hole = ARM > 0.5
pawR_hole = PAW_R > 0.5
body_rgb = clone(rgb, arm_hole | pawR_hole, FUR_OK & ~arm_hole & ~pawR_hole & (BODY_ZONE > 0.5), tex=(600, 600, 740, 740))  # зерно — мех живота
body_alpha = alpha.copy()
# Мех тела под поднятой лапой — не клон, а кадр, сгенерированный по оригиналу с поднятой лапой
# (gen_frames.py «wave-pose» → align_gen.py → upscale.py → matte.py): настоящий мех и настоящий
# край силуэта там, где в оригинале была лапа. Верх зоны (под грудкой) остаётся клоном.
WAVE = os.path.join(ROOT, 'design/mascot/export/wave-pose%s.png' % ('' if S == 1 else f'@{S}x'))
if os.path.exists(WAVE):
    wv = np.asarray(Image.open(WAVE).convert('RGBA')).astype(np.float32)
    zone_m = (ARM > 0.5) & (yy > sc(596))
    f = soft(zone_m, 3)[..., None]
    body_rgb = body_rgb * (1 - f) + wv[..., :3] * f
    body_alpha = alpha * (1 - f[..., 0]) + (wv[..., 3] / 255) * f[..., 0]
    print('body patch from generated wave pose')
add('body', body_rgb, body_alpha * notail * BODY_ZONE * (1 - PAW_R), 4)
add('paw_R', rgb, alpha * PAW_R, 5)
# нога: столбик над лапкой дорисован мехом тела (под грудкой), лапка — родная
leg_zone = ARM * (1 - PAW_L)
leg_hole = (leg_zone > 0.5) & (yy < sc(612))  # выше родной «ноги» — дорисовка
leg_rgb = rgb  # в оригинале над лапкой — мех тела: это и есть нога, когда она выезжает из-под грудки
leg_alpha = np.maximum(alpha * (yy >= sc(600)), soft(leg_hole, 1.5) * 0.98)
add('paw_L', leg_rgb, np.maximum(leg_alpha * leg_zone, alpha * PAW_L), 6)
add('chest', rgb, alpha * CHEST * notail * (1 - PAW_L) * (1 - PAW_R), 7)  # родные пиксели: поверх ноги и лап

# ── шарниры (1x), z-порядок, экспорт ─────────────────────────────────────────
PIVOTS = {
    'body': (600, 768), 'head': (610, 590), 'ear_L': (470, 255), 'ear_R': (735, 245),
    'paw_L': (495, 600), 'paw_R': (745, 690), 'tail': (825, 697), 'flame': (972, 415), 'chest': (600, 640),
    'iris_L': EYES['L'], 'iris_R': EYES['R'], 'pupil_L': EYES['L'], 'pupil_R': EYES['R'], 'shine_L': EYES['L'], 'shine_R': EYES['R'],
    'ring_L': EYES['L'], 'ring_R': EYES['R'], 'closed_L': EYES['L'], 'closed_R': EYES['R'],
    'mouth_smile': (615, 486), 'mouth_open': (615, 486), 'mouth_o': (615, 486), 'mouth_flat': (615, 486), 'mouth_sad': (615, 486),
}
TAIL_JOINTS = [(825, 697), (900, 702), (975, 705), (1040, 690), (1085, 655), (1100, 600), (1095, 545), (1075, 490)]
PAD = 4
rig = {'canvas': {'w': 1264, 'h': 848}, 'scale': EXPORT, 'parts': {}, 'tail_joints': TAIL_JOINTS,
       'eyes': {'L': {'c': EYES['L'], 'rx': RX - 3, 'ry': RY - 3, 'orx': RX + 10, 'ory': RY + 10}, 'R': {'c': EYES['R'], 'rx': RX - 3, 'ry': RY - 3, 'orx': RX + 10, 'ory': RY + 10}}}
composite = np.zeros((H, W, 4), np.float32)
for name, rgbx, a, z in sorted(layers, key=lambda t: t[3]):
    ys, xs = np.nonzero(a > 0.01)
    if len(xs) == 0:
        print('EMPTY', name); continue
    x0, y0, x1, y1 = max(0, xs.min() - PAD * S), max(0, ys.min() - PAD * S), min(W, xs.max() + PAD * S + 1), min(H, ys.max() + PAD * S + 1)
    # прозрачным пикселям — цвет ближайшего видимого (edge padding), прямая альфа
    vis = a > 0.01
    idx = ndi.distance_transform_edt(~vis, return_distances=False, return_indices=True)
    rgbp = np.where(vis[..., None], rgbx, rgbx[idx[0], idx[1]])
    arr = np.dstack([rgbp[y0:y1, x0:x1], a[y0:y1, x0:x1] * 255]).round().astype(np.uint8)
    img = Image.fromarray(arr, 'RGBA')
    k = EXPORT / S
    if k != 1:
        img = img.resize((max(1, round(img.width * k)), max(1, round(img.height * k))), Image.LANCZOS)
    img.save(OUT + name + '.png')
    img.save(OUT + name + '.webp', 'WEBP', quality=92, method=6, exact=True)
    px, py = PIVOTS[name]
    rig['parts'][name] = {'x': x0 / S, 'y': y0 / S, 'w': (x1 - x0) / S, 'h': (y1 - y0) / S, 'pivot': [px, py], 'z': z}
    # сборка для проверки
    ca = a[..., None]
    composite[..., :3] = composite[..., :3] * (1 - ca) + rgbx * ca
    composite[..., 3:] = composite[..., 3:] * (1 - ca) + ca
    print(name, img.size)
json.dump(rig, open(os.path.join(ROOT, 'public/mascot/rig.json'), 'w'), indent=1)

# проверка «Difference»: сборка всех слоёв против мастера (без лат — они под другими слоями)
hide = {'closed_L', 'closed_R', 'mouth_open', 'mouth_o', 'mouth_flat', 'mouth_sad'}
composite = np.zeros((H, W, 4), np.float32)
for name, rgbx, a, z in sorted(layers, key=lambda t: t[3]):
    if name in hide: continue
    ca = a[..., None]
    composite[..., :3] = composite[..., :3] * (1 - ca) + rgbx * ca
    composite[..., 3:] = composite[..., 3:] * (1 - ca) + ca
m = alpha > 0.5
diff = np.abs(composite[..., :3] - rgb).mean(2)
print('difference vs master: mean %.2f, px >24: %d of %d (%.3f%%)' % (diff[m].mean(), int((diff[m] > 24).sum()), int(m.sum()), 100 * (diff[m] > 24).mean()))
print('alpha coverage: master %d, assembled %d, missing %d' % (int(m.sum()), int((composite[..., 3] > 0.5).sum()), int((m & (composite[..., 3] < 0.5)).sum())))
bg = Image.new('RGBA', (W, H), (32, 34, 32, 255))
Image.alpha_composite(bg, Image.fromarray(np.clip(np.dstack([composite[..., :3], composite[..., 3] * 255]), 0, 255).astype(np.uint8), 'RGBA')).convert('RGB').save(os.path.join(ROOT, 'design/mascot/export/parts-assembled.png'))
Image.fromarray(np.clip(diff * 4, 0, 255).astype(np.uint8)).save(os.path.join(ROOT, 'design/mascot/export/parts-difference.png'))
