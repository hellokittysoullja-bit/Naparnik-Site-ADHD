"""Кукла кота для сайта из ЭТАЛОННОГО PNG (тот же принцип, что у куклы героя в видео, DoodleExplainer doll_rig):
один рисунок -> слои -> движения кодом. Никаких перерисованных частей: всё вырезано из design/mascot/png/neutral.png.

Слои (public/mascot/doll/*.webp) и риг (public/mascot/doll/rig.json, формат lib/rig/types.ts):
  tail    — хвост без огонька (за телом), кости по осевой хвоста;
  flame   — огонёк на кончике хвоста;
  body    — кот без хвоста и без глаз: мех под глазами дорисован LaMa; голова, уши и дыхание — веса костей;
  eye-*   — радужка с обводкой без зрачка и блика, pupil-* — зрачок, hl-* — блик (стоит на месте), lid-* — штрих века;
  happy   — рот с язычком (из design/mascot/png/happy-tongue.png), sleep — дуги закрытых глаз (из sleep-arcs.png).

Запуск: LAMA_ONNX=/путь/lama_fp32.onnx python3 design/mascot/doll_build.py   (модель Carve/LaMa-ONNX, Apache-2.0)
Нужны numpy, scipy, opencv, Pillow, onnxruntime. CPU, бесплатно, один раз."""
import json
import os

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "design/mascot/png")
OUT = os.path.join(ROOT, "public/mascot/doll")
TEX_SCALE = 0.6                       # текстуры: 0.6 от рисунка — на сайте кот не шире ~600 px на ретине
GRID = {"body": 16, "tail": 14}      # шаг сетки, px рисунка
FLOOR = 965                           # низ лап

# опоры костей (px рисунка neutral.png)
NECK = (545, 705)
EAR_L = dict(base=(318, 255), tip=(215, 95), r=135)
EAR_R = dict(base=(690, 220), tip=(805, 25), r=150)
TAIL = [(850, 862), (1000, 896), (1150, 880), (1262, 800), (1300, 690), (1262, 585), (1180, 525), (1088, 492)]
FLAME_BASE = (1085, 475)
NOSE = (545, 526)
MOUTH = (545, 576)
CHEEK_ROI = ((215, 495, 335, 590), (755, 495, 875, 590))


def smooth(x):
    x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)


def load(name):
    return np.asarray(Image.open(os.path.join(SRC, name)).convert("RGBA")).astype(np.float32)


# ------------------------------------------------------------------ глаза
def find_eyes(rgba):
    rgb = rgba[..., :3]
    g = ((rgb[..., 1] > 150) & (rgb[..., 1] - rgb[..., 2] > 60) & (rgba[..., 3] > 200)).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(g)
    idx = sorted(range(1, n), key=lambda i: -st[i, 4])[:2]
    eyes = []
    for i in idx:
        cs, _ = cv2.findContours((lab == i).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        (cx, cy), (w, h), _a = cv2.fitEllipse(max(cs, key=len))
        r = (w + h) / 4
        eyes.append((cx, cy, r, r))
    return sorted(eyes)


def lama_fill(rgb, mask, model, box):
    import onnxruntime as ort
    sess = ort.InferenceSession(model)
    x0, y0, x1, y1 = box; s = x1 - x0
    ci = cv2.resize(rgb[y0:y1, x0:x1], (512, 512), interpolation=cv2.INTER_AREA) / 255
    cm = cv2.resize(mask[y0:y1, x0:x1].astype(np.uint8), (512, 512), interpolation=cv2.INTER_NEAREST) > 0
    cm = ndi.binary_dilation(cm, iterations=3)
    ci = (ci * (1 - cm[..., None])).astype(np.float32)
    o = sess.run(None, {"image": ci.transpose(2, 0, 1)[None], "mask": cm.astype(np.float32)[None, None]})[0][0].transpose(1, 2, 0)
    if o.max() <= 1.5: o = o * 255
    patch = cv2.resize(np.clip(o, 0, 255).astype(np.float32), (s, y1 - y0), interpolation=cv2.INTER_CUBIC)
    out = rgb.copy(); sub = mask[y0:y1, x0:x1]
    out[y0:y1, x0:x1][sub] = patch[sub]
    return out


def eye_parts(rgba, eyes, H, W):
    """Радужка без зрачка (средний зелёный + акварельный шум), зрачок, блик — каждая часть в своём слое."""
    YY, XX = np.mgrid[0:H, 0:W]
    hsv = cv2.cvtColor(rgba[..., :3].astype(np.uint8), cv2.COLOR_RGB2HSV).astype(int)
    s, v = hsv[..., 1], hsv[..., 2]
    rng = np.random.default_rng(1)
    parts = []
    for (cx, cy, rx, ry) in eyes:
        ell = ((XX - cx) / rx) ** 2 + ((YY - cy) / ry) ** 2
        iris = ell <= 1.0
        whole = ell <= ((rx + 13) / rx) ** 2
        core = ell <= 0.62 ** 2
        dark = iris & (v < 110)
        lab, n = ndi.label(ndi.binary_closing(dark, iterations=2))
        pupil = np.isin(lab, [i for i in range(1, n + 1) if (core & (lab == i)).any()])
        hl = iris & (s < 60) & (v > 200)
        lab, n = ndi.label(hl)
        hl = np.isin(lab, [i for i in range(1, n + 1) if (core & (lab == i)).any()])
        hl_d = ndi.binary_dilation(hl, iterations=2)
        pupil_full = ndi.binary_fill_holes(pupil | hl_d) & iris
        # радужка: зрачок и блик закрашены средним зелёным с акварельной неровностью
        gmed = np.median(rgba[..., :3][iris & ~ndi.binary_dilation(pupil_full, iterations=4)], axis=0)
        noise = ndi.gaussian_filter(rng.normal(0, 1, (H, W)), 6)[..., None] * 22
        fill = np.clip(gmed + noise, 0, 255)
        irimg = rgba.copy()
        pm = ndi.binary_dilation(pupil_full, iterations=7) & iris
        irimg[..., :3][pm] = fill[pm]
        # зрачок — спрайт: чёрный + его край; блик — белый
        soft = lambda m, r=1.2: ndi.gaussian_filter(m.astype(np.float32), r)
        pup = np.zeros_like(rgba); pa = soft(pupil | (ndi.binary_closing(pupil, iterations=6) & ~hl)) * iris
        pup[..., :3] = np.array([12, 12, 14]); pup[..., 3] = pa * 255
        hli = np.zeros_like(rgba); hli[..., :3] = 252; hli[..., 3] = soft(hl, 0.9) * 255
        eye = np.zeros_like(rgba); eye[..., :3] = irimg[..., :3]; eye[..., 3] = soft(whole, 0.8) * 255
        parts.append(dict(c=(cx, cy), r=(rx, ry), whole=whole, eye=eye, pupil=pup, hl=hli))
    return parts


def lid_stroke(H, W, cx, cy, rx, ry, width):
    """Штрих закрытого века (как у куклы героя): гладкая дуга вниз на всю ширину глаза."""
    k = 4
    img = np.zeros((H * 0 + int(ry * 3) * k, int(rx * 3) * k), np.uint8)
    ox, oy = cx - rx * 1.5, cy - ry * 1.5
    us = np.linspace(-.94, .94, 60)
    l0 = cy + ry * .24
    pts = np.stack([cx + us * rx * .98, (l0 - ry * .12) + ry * .37 * (1 - us * us) ** .55], 1)
    p = np.round((pts - [ox, oy]) * k * 16).astype(np.int32)
    cv2.polylines(img, [p], False, 255, int(width * k), cv2.LINE_AA, shift=4)
    small = cv2.resize(img, (img.shape[1] // k, img.shape[0] // k), interpolation=cv2.INTER_AREA).astype(np.float32)
    out = np.zeros((H, W, 4), np.float32)
    x0, y0 = int(round(ox)), int(round(oy))
    h, w = small.shape
    out[y0:y0 + h, x0:x0 + w, :3] = (24, 22, 24); out[y0:y0 + h, x0:x0 + w, 3] = small
    return out


# ------------------------------------------------------------------ лица (заплатки из эталонов)
def on_white(a):
    al = a[..., 3:4] / 255
    return (a[..., :3] * al + 255 * (1 - al)).astype(np.uint8)


def green_centers(rgb):
    f = rgb.astype(np.int32)
    m = ((f[..., 1] > 150) & (f[..., 1] - f[..., 2] > 60)).astype(np.uint8)
    n, lab, st, cen = cv2.connectedComponentsWithStats(cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)))
    idx = sorted(range(1, n), key=lambda i: -st[i, 4])[:2]
    return sorted([tuple(cen[i]) for i in idx])


def sim_from_pairs(g, h):
    s = (h[1][0] - h[0][0]) / (g[1][0] - g[0][0])
    tx = (h[0][0] + h[1][0]) / 2 - s * (g[0][0] + g[1][0]) / 2
    ty = (h[0][1] + h[1][1]) / 2 - s * (g[0][1] + g[1][1]) / 2
    return np.array([[s, 0, tx], [0, s, ty]], np.float32)


def sift_sim(gen, ref):
    sift = cv2.SIFT_create(4000)
    k0, d0 = sift.detectAndCompute(cv2.cvtColor(ref, cv2.COLOR_RGB2GRAY), None)
    k1, d1 = sift.detectAndCompute(cv2.cvtColor(gen, cv2.COLOR_RGB2GRAY), None)
    good = [m for m, n in cv2.BFMatcher().knnMatch(d1, d0, k=2) if m.distance < .7 * n.distance]
    M, _ = cv2.estimateAffinePartial2D(np.float32([k1[m.queryIdx].pt for m in good]), np.float32([k0[m.trainIdx].pt for m in good]),
                                       method=cv2.RANSAC, ransacReprojThreshold=2.0)
    return M.astype(np.float32)


def orange_center(rgb, roi):
    x0, y0, x1, y1 = [int(v) for v in roi]
    f = rgb[max(0, y0):y1, max(0, x0):x1].astype(np.int32)
    m = (f[..., 0] > 190) & (f[..., 1] > 90) & (f[..., 1] < 175) & (f[..., 2] < 100) & (f[..., 0] - f[..., 1] > 50)
    ys, xs = np.nonzero(m)
    return (xs.mean() + max(0, x0), ys.mean() + max(0, y0))


def nose_center(rgb, roi):
    x0, y0, x1, y1 = [int(v) for v in roi]
    f = rgb[y0:y1, x0:x1].astype(np.int32); r, g, b = f[..., 0], f[..., 1], f[..., 2]
    m = (r > 120) & (r - g > 25) & (r - b > 20) & (g > 70) & (r < 245)
    ys, xs = np.nonzero(m)
    return (xs.mean() + x0, ys.mean() + y0)


def ellipse_alpha(H, W, cx, cy, rx, ry, feather):
    YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt(((XX - cx) / rx) ** 2 + ((YY - cy) / ry) ** 2)
    return smooth((1 - d) * max(rx, ry) / feather)


def happy_patch(neutral, eyes, H, W):
    """Рот с язычком из happy-tongue.png: совмещение по зелёным глазам (они в эталонах те же), тон меха по кольцу."""
    hp = load("happy-tongue.png"); g = on_white(hp)
    M = sim_from_pairs(green_centers(g), [(e[0], e[1]) for e in eyes])
    w = cv2.warpAffine(g, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE).astype(np.float32)
    m = ellipse_alpha(H, W, MOUTH[0], MOUTH[1] + 4, 74, 56, 16) * (1 - ellipse_alpha(H, W, NOSE[0], NOSE[1], 30, 20, 6))
    ref = neutral[..., :3]
    ring = (m < .02) & (ndi.binary_dilation(m > .02, iterations=20))
    w = np.clip(w + (ref[ring] - w[ring]).mean(0), 0, 255)
    out = np.zeros((H, W, 4), np.float32); out[..., :3] = w; out[..., 3] = m * 255
    return out


def sleep_patch(neutral, eyes, H, W):
    """Дуги закрытых глаз из sleep-arcs.png — только чернила (покрытие тёмного против меха), две самые большие дуги."""
    sp = load("sleep-arcs.png"); g = on_white(sp); ref = on_white(neutral)
    M0 = sift_sim(g, ref); Mi = cv2.invertAffineTransform(M0)
    def to_gen(p): return (Mi[0, 0] * p[0] + Mi[0, 1] * p[1] + Mi[0, 2], Mi[1, 0] * p[0] + Mi[1, 1] * p[1] + Mi[1, 2])
    k = 1 / M0[0, 0]
    hc = [orange_center(ref, r) for r in CHEEK_ROI]
    gc = []
    for r in CHEEK_ROI:
        c = to_gen(((r[0] + r[2]) / 2, (r[1] + r[3]) / 2)); hw, hh = (r[2] - r[0]) * k * .8, (r[3] - r[1]) * k * .8
        gc.append(orange_center(g, (c[0] - hw, c[1] - hh, c[0] + hw, c[1] + hh)))
    s = sim_from_pairs(gc, hc)[0, 0]
    gn = to_gen(NOSE); gnc = nose_center(g, (gn[0] - 50 * k, gn[1] - 50 * k, gn[0] + 50 * k, gn[1] + 50 * k))
    hn = nose_center(ref, (NOSE[0] - 40, NOSE[1] - 30, NOSE[0] + 40, NOSE[1] + 30))
    M = np.array([[s, 0, hn[0] - s * gnc[0]], [0, s, hn[1] - s * gnc[1]]], np.float32)
    lum = cv2.cvtColor(g, cv2.COLOR_RGB2GRAY).astype(np.float32)
    fur = cv2.medianBlur(lum.astype(np.uint8), 51).astype(np.float32)
    cov = np.clip((fur - lum) / np.maximum(fur - 18, 1), 0, 1)
    cov = np.clip((np.where(cov > .12, cov, 0) - .12) / .6, 0, 1)
    ink = cv2.warpAffine(cov, M, (W, H), flags=cv2.INTER_CUBIC, borderValue=0)
    rgbw = cv2.warpAffine(g, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE).astype(np.float32)
    m = np.zeros((H, W), np.float32)
    for (cx, cy, rx, ry) in eyes: m = np.maximum(m, ellipse_alpha(H, W, cx, cy, rx + 20, ry + 22, 2))
    a = ink * (m > 0)
    lab, n = ndi.label(a > .2, structure=np.ones((3, 3)))
    sizes = ndi.sum(a > .2, lab, range(1, n + 1)); keep = 1 + np.argsort(-np.asarray(sizes))[:2]
    a = a * cv2.dilate(np.isin(lab, keep).astype(np.uint8), np.ones((5, 5), np.uint8))
    # дуги — на уровне глаз: середина рамки дуг по высоте = центр глаза
    ys, _ = np.nonzero(a > .3)
    dy = int(round(np.mean([e[1] for e in eyes]) - (ys.min() + ys.max()) / 2))
    a = np.roll(a, dy, axis=0); rgbw = np.roll(rgbw, dy, axis=0)
    out = np.zeros((H, W, 4), np.float32); out[..., :3] = rgbw; out[..., 3] = a * 255
    return out, dy


# ------------------------------------------------------------------ хвост / огонёк / тело
def split_tail(rgba, H, W):
    """Хвост — связная плотная область справа от основания (не прямоугольник: усы заканчиваются в просвете между
    головой и хвостом, и прямоугольник отдавал их кончики хвосту — при качании хвоста усы рвались). Плотная маска
    сжимается на 3 px (тонкие усы отрываются), берётся компонента хвоста и наращивается обратно на 5 px по рисунку.
    Огонёк — верх этой компоненты."""
    YY, XX = np.mgrid[0:H, 0:W]
    al = rgba[..., 3] > 0
    solid = rgba[..., 3] > 200
    cut = (XX >= 850) & (XX <= 853) & (YY >= 760)
    er = ndi.binary_erosion(solid & ~cut, iterations=3)
    lab, _ = ndi.label(er)
    T = lab == lab[TAIL[2][1], TAIL[2][0]]
    T = ndi.binary_dilation(T, iterations=5) & al & ~((XX < 852) & (YY > 760))
    flame = T & (YY < 482)
    return T & ~flame, flame


def grid_mesh(alpha, step, weights_fn, box_pad=4):
    H, W = alpha.shape
    ys, xs = np.nonzero(alpha > 2)
    x0, y0, x1, y1 = max(xs.min() - box_pad, 0), max(ys.min() - box_pad, 0), min(xs.max() + box_pad + 1, W), min(ys.max() + box_pad + 1, H)
    gx = np.arange(x0, x1 + step, step); gy = np.arange(y0, y1 + step, step)
    occ = ndi.binary_dilation(alpha > 2, iterations=step)
    vid = -np.ones((len(gy), len(gx)), int); verts = []; idx = []
    def v(i, j):
        if vid[i, j] < 0:
            x, y = float(gx[j]), float(gy[i]); vid[i, j] = len(verts); verts.append((x, y))
        return vid[i, j]
    for i in range(len(gy) - 1):
        for j in range(len(gx) - 1):
            cy0, cy1, cx0, cx1 = gy[i], min(gy[i + 1], H), gx[j], min(gx[j + 1], W)
            if cy0 >= H or cx0 >= W or not occ[cy0:cy1, cx0:cx1].any(): continue
            a, b, c, d = v(i, j), v(i, j + 1), v(i + 1, j), v(i + 1, j + 1)
            idx += [a, b, c, b, d, c]
    out = []
    for (x, y) in verts:
        bw = weights_fn(x, y)
        bw = sorted(bw.items(), key=lambda t: -t[1])[:4]
        s = sum(w for _, w in bw) or 1
        bi = [b for b, _ in bw] + [0] * (4 - len(bw)); ww = [w / s for _, w in bw] + [0] * (4 - len(bw))
        out += [round(x, 1), round(y, 1), 0, 0, *bi, *[round(w, 4) for w in ww]]
    return out, idx


def square_view(cat):
    """Квадратное окно, как viewBox прежнего MascotSvg: кот по центру, лапы у низа, сверху место под звёздочки и Z."""
    side = max(cat[2] - cat[0] + 120, cat[3] - cat[1] + 260)
    cx = (cat[0] + cat[2]) / 2
    return [round(cx - side / 2), round(cat[3] + 40 - side), side, side]


def main():
    model = os.environ.get("LAMA_ONNX")
    if not model or not os.path.exists(model):
        raise SystemExit("нужна LAMA_ONNX=путь к lama_fp32.onnx (Carve/LaMa-ONNX)")
    N = load("neutral.png"); H, W = N.shape[:2]
    os.makedirs(OUT, exist_ok=True)
    eyes = find_eyes(N)
    ep = eye_parts(N, eyes, H, W)
    # мех без глаз: LaMa по кропу вокруг обоих глаз
    hide = np.zeros((H, W), bool)
    for e in ep: hide |= ndi.binary_dilation(e["whole"], iterations=6)
    ys, xs = np.nonzero(hide); cx, cy = (xs.min() + xs.max()) // 2, (ys.min() + ys.max()) // 2
    side = int(max(xs.max() - xs.min(), ys.max() - ys.min()) + 160)
    box = (cx - side // 2, cy - side // 2, cx - side // 2 + side, cy - side // 2 + side)
    fur = lama_fill(N[..., :3], hide, model, box)
    body = N.copy(); body[..., :3] = fur
    tail_m, flame_m = split_tail(N, H, W)
    tail = N.copy(); tail[..., 3] *= tail_m
    flame = N.copy(); flame[..., 3] *= flame_m
    body[..., 3] = np.where(tail_m | flame_m, 0, body[..., 3])

    hp = happy_patch(N, eyes, H, W)
    sp, dy = sleep_patch(N, eyes, H, W)
    print("eyes", [tuple(round(v, 1) for v in e) for e in eyes], "дуги сна сдвинуты на", dy)

    # ---------------- кости
    bones = [("root", -1, (NECK[0], FLOOR)), ("chest", 0, (NECK[0], FLOOR)), ("head", 1, NECK),
             ("ear-l", 2, EAR_L["base"]), ("ear-r", 2, EAR_R["base"])]
    t0 = len(bones)
    for i, p in enumerate(TAIL):
        bones.append((f"tail{i}", 1 if i == 0 else t0 + i - 1, p))
    bones.append(("flame", len(bones) - 1, FLAME_BASE))
    B = {n: i for i, (n, _, _) in enumerate(bones)}

    def ear_w(x, y, E):
        bx, by = E["base"]; tx, ty = E["tip"]; vx, vy = tx - bx, ty - by
        t = ((x - bx) * vx + (y - by) * vy) / (vx * vx + vy * vy)
        d = np.hypot(x - (bx + tx) / 2, y - (by + ty) / 2)
        return float(smooth(t * 1.4)) * float(smooth((E["r"] - d) / 40))

    def body_w(x, y):
        h = float(smooth((NECK[1] + 25 - y) / 70))          # голова выше шеи, плавно к груди
        el, er = ear_w(x, y, EAR_L), ear_w(x, y, EAR_R)
        w = {B["chest"]: 1 - h}
        rest = h * (1 - el - er)
        if el > 0: w[B["ear-l"]] = h * el
        if er > 0: w[B["ear-r"]] = h * er
        if rest > 0: w[B["head"]] = rest
        return w

    P = np.array(TAIL, np.float32)
    seg = np.cumsum([0] + [float(np.hypot(*(P[i + 1] - P[i]))) for i in range(len(P) - 1)])
    def tail_w(x, y):
        best = None
        for i in range(len(P) - 1):
            a, b = P[i], P[i + 1]; ab = b - a; t = float(np.clip(((x - a[0]) * ab[0] + (y - a[1]) * ab[1]) / (ab @ ab), 0, 1))
            d = np.hypot(x - (a[0] + t * ab[0]), y - (a[1] + t * ab[1]))
            if best is None or d < best[0]: best = (d, i, t)
        _, i, t = best
        s = (seg[i] + t * (seg[i + 1] - seg[i])) / seg[-1]       # доля длины хвоста
        if s < .04: return {B["chest"]: 1.0}
        k = min(i, len(P) - 2)
        return {B[f"tail{k}"]: 1 - t * .5, B[f"tail{k + 1}"]: t * .5}

    def head_w(x, y): return {B["head"]: 1.0}
    def flame_w(x, y): return {B["flame"]: 1.0}

    parts = []
    def add(name, img, weights, step=None, part_box=None):
        a = img[..., 3]
        if step is None:          # маленькая часть: прямоугольник (два треугольника) по рамке, кость одна
            ys, xs = np.nonzero(a > 1)
            x0, y0, x1, y1 = part_box or (int(xs.min()) - 2, int(ys.min()) - 2, int(xs.max()) + 3, int(ys.max()) + 3)
            bw = weights(0, 0); bi = list(bw.keys())[:1] + [0, 0, 0]; ww = [1.0, 0, 0, 0]
            verts = []
            for (x, y) in ((x0, y0), (x1, y0), (x0, y1), (x1, y1)): verts += [x, y, 0, 0, *bi, *ww]
            idx = [0, 1, 2, 1, 3, 2]
        else:
            verts, idx = grid_mesh(a, step, weights)
            ys, xs = np.nonzero(a > 2)
            x0, y0, x1, y1 = int(xs.min()) - 4, int(ys.min()) - 4, int(xs.max()) + 5, int(ys.max()) + 5
            x0, y0 = max(x0, 0), max(y0, 0); x1, y1 = min(x1, W), min(y1, H)
            # сетка может выйти за кадр текстуры — uv считаем от рамки сетки
            vx = verts[0::12]; vy = verts[1::12]
            x0, y0, x1, y1 = int(min(vx)), int(min(vy)), int(np.ceil(max(vx))), int(np.ceil(max(vy)))
        crop = np.zeros((y1 - y0, x1 - x0, 4), np.float32)
        sx0, sy0, sx1, sy1 = max(x0, 0), max(y0, 0), min(x1, W), min(y1, H)
        crop[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0] = img[sy0:sy1, sx0:sx1]
        for k in range(0, len(verts), 12):
            verts[k + 2] = round((verts[k] - x0) / (x1 - x0), 5); verts[k + 3] = round((verts[k + 1] - y0) / (y1 - y0), 5)
        tw_, th_ = max(1, int(round((x1 - x0) * TEX_SCALE))), max(1, int(round((y1 - y0) * TEX_SCALE)))
        # премультиплицированная выборка при уменьшении, затем обратно (без ореола на краях)
        pm = crop.copy(); pm[..., :3] *= pm[..., 3:4] / 255
        small = cv2.resize(pm, (tw_, th_), interpolation=cv2.INTER_AREA)
        a2 = small[..., 3:4]; rgb = np.where(a2 > 0, small[..., :3] / np.maximum(a2 / 255, 1e-3), 0)
        im = Image.fromarray(np.dstack([np.clip(rgb, 0, 255), np.clip(a2, 0, 255)]).astype(np.uint8), "RGBA")
        im.save(os.path.join(OUT, name + ".webp"), lossless=True, quality=100, method=6)
        parts.append(dict(name=name, tex=name + ".webp", box=[x0, y0, x1, y1], verts=verts, idx=idx))

    add("tail", tail, tail_w, GRID["tail"])
    add("flame", flame, flame_w)
    add("body", body, body_w, GRID["body"])
    for side, e in zip(("l", "r"), ep):
        cx, cy = e["c"]; rx, ry = e["r"]
        eb = (int(cx - rx - 22), int(cy - ry - 22), int(cx + rx + 23), int(cy + ry + 23))   # общая рамка частей глаза
        add(f"eye-{side}", e["eye"], head_w, None, eb)
        add(f"pupil-{side}", e["pupil"], head_w, None, eb)
        add(f"hl-{side}", e["hl"], head_w, None, eb)
        add(f"lid-{side}", lid_stroke(H, W, cx, cy, rx, ry, 11), head_w, None, eb)
    add("happy", hp, head_w)
    add("sleep", sp, head_w)

    ys, xs = np.nonzero(N[..., 3] > 8)
    cat = [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]
    rig = dict(scale=1, bones=[dict(name=n, parent=p, pivot=[float(a), float(b)]) for n, p, (a, b) in bones], parts=parts,
               view=square_view(cat),
               eyes=[[round(float(v), 1) for v in e] for e in eyes], cat=cat)
    json.dump(rig, open(os.path.join(OUT, "rig.json"), "w"), separators=(",", ":"), default=lambda o: o.item() if hasattr(o, "item") else o)
    print("частей", len(parts), "вершин", sum(len(p["verts"]) // 12 for p in parts), "kb json",
          os.path.getsize(os.path.join(OUT, "rig.json")) // 1024)


if __name__ == "__main__":
    main()
