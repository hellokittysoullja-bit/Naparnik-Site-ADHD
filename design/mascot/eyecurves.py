# Кейформы глаза как КРИВЫЕ (подход Live2D / интерполяции штрихов). Из каждого ключевого кадра
# (оригинал, lids-25, lids-50, eyes-half, eyes-closed, eyes-sad, eyes-happy — все совмещены с
# оригиналом) по колонкам поперёк глаза снимаются осевая линия и толщина штрихов:
#   up — верхний штрих (в открытом глазу — верх контура, в прищуре — линия века,
#        в закрытом/«^ ^» — единственная дуга), lo — нижний штрих контура (в закрытом — та же дуга).
# Рантайм интерполирует кривые между кейформами и рисует тушь лентой по кривой — никаких
# пиксельных морфов, сплющиваний текстуры и двоения.
#   python3 design/mascot/eyecurves.py  → public/mascot/eyes.json + /tmp/claude-0/shots/eyecurves.png
import json, os
import numpy as np, cv2
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GEN = os.path.join(ROOT, 'design/mascot/gen')
EYES = {'L': (505, 405), 'R': (718, 405)}
RX, RY = 64, 67
KEYS = {'open': None, 'lids25': 'lids-25', 'lids50': 'lids-50', 'half': 'eyes-half', 'closed': 'eyes-closed', 'sad': 'eyes-sad', 'happy': 'eyes-happy'}
ARC = {'closed', 'happy'}   # кадры без радужки: одна дуга
N = 48                      # колонок поперёк глаза
PAD = 12                    # запас по x за радиус радужки (контур шире радужки)
INK = 50                    # тушь: яркость ниже (мех ≈ 73–84, тушь ≈ 10; середина кромки ≈ 44)


def load(key):
    f = KEYS[key]
    p = os.path.join(ROOT, 'design/mascot/reference.png') if f is None else os.path.join(GEN, f + '-aligned.png')
    return np.asarray(Image.open(p).convert('RGB')).astype(np.float32)


def runs_of(col):
    out, y = [], 0
    while y < len(col):
        if col[y]:
            s = y
            while y < len(col) and col[y]:
                y += 1
            out.append((s, y))
        else:
            y += 1
    return out


def curves(img, cx, cy, arc, env=None):
    x0, x1, y0, y1 = cx - RX - 30, cx + RX + 30, cy - RY - 40, cy + RY + 40
    sub = img[y0:y1, x0:x1]
    lum = sub.mean(2)
    dark = lum < INK
    green = (sub[..., 1] > sub[..., 2] + 60) & (lum > 120)  # лайм: G заметно выше B
    green = ndi.binary_opening(green, structure=np.ones((3, 3)))
    gfill = ndi.binary_fill_holes(ndi.binary_closing(green, structure=np.ones((9, 9))))
    # дуга закрытого глаза — крупнейшая тёмная компонента бокса (усы оранжевые, нос вне бокса)
    lab, n = ndi.label(dark)
    sizes = np.bincount(lab.ravel()); sizes[0] = 0
    big = lab == int(np.argmax(sizes))
    # зрачок: тушь внутри выпуклой оболочки радужки (с отступом 4 px, чтобы не зацепить кромку штрихов)
    pupil = np.zeros_like(dark)
    pts = np.argwhere(green)
    if len(pts) > 50:
        hull = cv2.convexHull(pts[:, ::-1].astype(np.int32))
        hm = np.zeros(dark.shape, np.uint8); cv2.fillConvexPoly(hm, hull, 1)
        pupil = dark & ndi.binary_erosion(hm.astype(bool), iterations=4)
        pupil = ndi.binary_dilation(pupil, iterations=3)
    xs = np.linspace(cx - RX - PAD, cx + RX + PAD, N)
    up, lo, tu, tl = [], [], [], []
    for x in xs:
        xi = int(round(x)) - x0
        a = b = None
        if arc:
            rr = [r for r in runs_of(big[:, xi]) if r[1] - r[0] >= 2]
            if rr:
                a = b = min(rr, key=lambda r: abs((r[0] + r[1]) / 2 + y0 - cy))
        else:
            gcol = np.nonzero(gfill[:, xi])[0]
            if len(gcol):
                gt, gb = gcol[0], gcol[-1]
                # верхний штрих: от верха радужки вверх по туши (допуск 4 px на сглаживание кромки)
                y = gt
                while y > gt - 5 and not dark[y, xi]:
                    y -= 1
                pc = np.nonzero(pupil[:, xi])[0]
                if dark[y, xi] and not (len(pc) and pc[0] <= y + 4):   # зрачок упёрся в веко — колонка ненадёжна
                    t = y
                    while t > 0 and dark[t - 1, xi]:
                        t -= 1
                    a = (t, y + 1)
                y = gb
                while y < gb + 5 and not dark[y, xi]:
                    y += 1
                if dark[y, xi] and not (len(pc) and pc[-1] >= y - 4):
                    t = y
                    while t + 1 < dark.shape[0] and dark[t + 1, xi]:
                        t += 1
                    b = (y, t + 1)
        for src, dst, th in ((a, up, tu), (b, lo, tl)):
            if src is None:
                dst.append(None); th.append(None)
            else:
                dst.append((src[0] + src[1]) / 2 + y0); th.append(float(src[1] - src[0]))
    for dst, th in ((up, tu), (lo, tl)):
        mid = [t for t in th if t is not None]
        med = np.median(mid) if mid else 0
        for i in range(N):
            if th[i] is not None and th[i] > 2.2 * med + 2:
                dst[i] = th[i] = None
        if env is not None:   # контур не двигается между кадрами: за конверт открытого глаза не выходим
            eu, el = env
            for i in range(N):
                if dst[i] is not None and (dst[i] < eu[i] - 8 or dst[i] > el[i] + 8):
                    dst[i] = th[i] = None
        # крайние колонки: отбрасываем, если осевая прыгает от соседа больше чем на 12 px (крутые бока контура)
        valid = [i for i in range(N) if dst[i] is not None]
        while len(valid) > 2 and abs(dst[valid[0]] - dst[valid[1]]) > 12:
            dst[valid[0]] = th[valid[0]] = None; valid.pop(0)
        while len(valid) > 2 and abs(dst[valid[-1]] - dst[valid[-2]]) > 12:
            dst[valid[-1]] = th[valid[-1]] = None; valid.pop()
    return xs, up, lo, tu, tl


def fill_gaps(v):
    v = np.array([np.nan if x is None else x for x in v], dtype=np.float64)
    idx = np.arange(len(v)); ok = ~np.isnan(v)
    if ok.sum() < 2:
        return np.zeros(len(v)), ok
    return np.interp(idx, idx[ok], v[ok]), ok


out = {'N': N, 'eyes': {}}
vis = []
for k, (cx, cy) in EYES.items():
    out['eyes'][k] = {'c': [cx, cy], 'x0': cx - RX - PAD, 'x1': cx + RX + PAD, 'keys': {}}
    env = None
    for key in KEYS:
        img = load(key)
        xs, up, lo, tu, tl = curves(img, cx, cy, key in ARC, None if key in ARC else env)
        if key == 'open':
            env = (fill_gaps(up)[0] - 0, fill_gaps(lo)[0])
        U, oku = fill_gaps(up); L_, okl = fill_gaps(lo); TU, _ = fill_gaps(tu); TL, _ = fill_gaps(tl)
        sig = 0.5 if key == 'happy' else 1.0
        U = ndi.gaussian_filter1d(U, sig); L_ = ndi.gaussian_filter1d(L_, sig)
        TU = ndi.gaussian_filter1d(TU, 1.5); TL = ndi.gaussian_filter1d(TL, 1.5)
        vu = np.nonzero(oku)[0]; vl = np.nonzero(okl)[0]
        extu = [int(vu[0]), int(vu[-1])] if len(vu) else [0, N - 1]
        extl = [int(vl[0]), int(vl[-1])] if len(vl) else [0, N - 1]
        ycen = (U[N // 2] + U[N // 2 - 1]) / 2
        out['eyes'][k]['keys'][key] = {'up': [round(float(v), 2) for v in U], 'lo': [round(float(v), 2) for v in L_],
                                       'tu': [round(float(v), 2) for v in TU], 'tl': [round(float(v), 2) for v in TL],
                                       'extu': extu, 'extl': extl}
        im = Image.fromarray(img.astype(np.uint8)).crop((cx - RX - 40, cy - RY - 50, cx + RX + 40, cy + RY + 50))
        d = ImageDraw.Draw(im)
        ox, oy = cx - RX - 40, cy - RY - 50
        d.line([(x - ox, y - oy) for x, y in zip(xs[extu[0]:extu[1] + 1], U[extu[0]:extu[1] + 1])], fill=(255, 0, 0), width=1)
        d.line([(x - ox, y - oy) for x, y in zip(xs[extl[0]:extl[1] + 1], L_[extl[0]:extl[1] + 1])], fill=(0, 170, 255), width=1)
        vis.append(im.resize((im.width * 2, im.height * 2)))
        print(f'{k} {key:7s} up {U.min():.0f}..{U.max():.0f} (центр {ycen:.0f}) lo {L_.min():.0f}..{L_.max():.0f}  толщина up {np.median(TU):.1f} lo {np.median(TL):.1f}  ext up {extu} lo {extl}  колонок без up {N - oku.sum()}')
# постобработка: контур между кадрами не двигается — нижний штрих у прищуров/грусти берём из
# открытого глаза; толщина вне охвата штриха = 0 (лента сходит на нет); степень открытости ключа —
# по положению века в центре глаза относительно контура
for k in EYES:
    ks = out['eyes'][k]['keys']
    o = ks['open']
    for key, d in ks.items():
        if key not in ARC and key != 'open':
            d['lo'], d['tl'], d['extl'] = list(o['lo']), list(o['tl']), list(o['extl'])
        for arr, ext in ((d['tu'], d['extu']), (d['tl'], d['extl'])):
            for i in range(N):
                if i < ext[0] or i > ext[1]:
                    arr[i] = 0.0
        c = N // 2
        top0 = (o['up'][c] + o['up'][c - 1]) / 2; bot0 = (o['lo'][c] + o['lo'][c - 1]) / 2
        yc = (d['up'][c] + d['up'][c - 1]) / 2
        d['o'] = 0.0 if key in ARC else round(float((bot0 - yc) / (bot0 - top0)), 3)
        print(k, key, 'открытость', d['o'])
json.dump(out, open(os.path.join(ROOT, 'public/mascot/eyes.json'), 'w'))
W, H = vis[0].size; cols = len(KEYS)
sheet = Image.new('RGB', (cols * (W + 6), 2 * (H + 6)), (18, 18, 18))
for i, im in enumerate(vis):
    sheet.paste(im, ((i % cols) * (W + 6), (i // cols) * (H + 6)))
sheet.save('/tmp/claude-0/shots/eyecurves.png')
