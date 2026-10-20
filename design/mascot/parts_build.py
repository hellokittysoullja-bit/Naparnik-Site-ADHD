# Слои для скелетного рига из частей, нарисованных GPT-Image-2 (design/mascot/parts_gen/*.webp, промпты рядом).
# Модель рисует каждую часть отдельно на белом, с ДОРИСОВАННЫМИ скрытыми зонами (шея у тела, основание ушей и хвоста,
# круглая голова без ушей/глаз/рта, плечо лапы). Размер и место каждой части модель меняет, поэтому:
#   1) SIFT (+ЕСС по силуэту старого слоя) находит аффинное совмещение часть -> оригинал;
#   2) matte.py вырезает прозрачность с белого (без каймы);
#   3) часть переносится в пространство оригинала (x1.25) и режется по рамке: public/mascot/rig/<имя>.webp;
#   4) глаза делятся на левый/правый и на «глаз» + «зрачок с бликом»;
#   5) закрытый глаз (дуга) и рты получаются из ранее сгенерированных кадров как прозрачные штрихи.
# Запуск: python3 design/mascot/parts_build.py   (numpy, scipy, opencv, Pillow)
import json, os, sys
import numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from matte import cutout
SRC = os.path.join(HERE, 'parts_gen'); OUT = os.path.join(ROOT, 'public/mascot/rig'); os.makedirs(OUT, exist_ok=True)
REF = cv2.imread(os.path.join(ROOT, 'design/mascot/reference.png')); H, W = REF.shape[:2]
MOUTH_DX = 11.5                              # у новой головы нос стоит правее оригинального на столько px
SS = 1.25                                    # масштаб текстур относительно оригинала
OLD = os.path.join(ROOT, 'public/mascot')
OLD_BOX = {'tail': (780, 380), 'body': (380, 500), 'head': (250, 180), 'ear-l': (360, 110), 'ear-r': (630, 95), 'leg': (410, 600), 'paw': (430, 655)}
REF_MASK_OF = {'arm': ['leg', 'paw'], 'head': ['head'], 'ears': ['ear-l', 'ear-r'], 'tail': ['tail']}
GLOBAL = 1264 / 1531                          # размер выдачи модели -> оригинал

def old_alpha(names):
    a = np.zeros((H, W), np.float32)
    for n in names:
        im = np.asarray(Image.open(os.path.join(OLD, n + '.webp')).convert('RGBA'))[..., 3].astype(np.float32) / 255
        x, y = OLD_BOX[n]; h, w = im.shape; a[y:y + h, x:x + w] = np.maximum(a[y:y + h, x:x + w], im)
    return a

sift = cv2.SIFT_create(nfeatures=4000, contrastThreshold=0.02)
def sift_init(p):
    gp = cv2.cvtColor(p, cv2.COLOR_BGR2GRAY); gr = cv2.cvtColor(REF, cv2.COLOR_BGR2GRAY)
    mp = cv2.dilate(((p.min(2) < 235) * 255).astype(np.uint8), np.ones((9, 9), np.uint8))
    k1, d1 = sift.detectAndCompute(gp, mp); k2, d2 = sift.detectAndCompute(gr, None)
    m = cv2.BFMatcher().knnMatch(d1, d2, k=2); good = [a for a, b in m if a.distance < 0.8 * b.distance]
    if len(good) < 6: return None
    src = np.float32([k1[g.queryIdx].pt for g in good]); dst = np.float32([k2[g.trainIdx].pt for g in good])
    M, inl = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=4.0, maxIters=5000)
    return M

def ecc_refine(M, part_mask, ref_mask, blur=6):
    rb = cv2.GaussianBlur(ref_mask, (0, 0), blur)
    pb = cv2.GaussianBlur(part_mask, (0, 0), blur / max(0.3, float(np.hypot(M[0, 0], M[0, 1]))))
    Minv = cv2.invertAffineTransform(M).astype(np.float32)
    crit = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 400, 1e-6)
    cc, Wr = cv2.findTransformECC(rb, pb, Minv, cv2.MOTION_AFFINE, crit, None, 9)
    return cv2.invertAffineTransform(Wr)

def to_similarity(M, part_mask):
    """аффинное -> подобие (масштаб одинаков по осям, без сдвига формы): рисунок части не искажается"""
    A = M[:, :2]; U, S, Vt = np.linalg.svd(A); R = U @ Vt
    if np.linalg.det(R) < 0: U[:, -1] *= -1; R = U @ Vt
    s = float(S.mean()); A2 = s * R
    ys, xs = np.where(part_mask > 0.5); c = np.array([xs.mean(), ys.mean()])
    t2 = A @ c + M[:, 2] - A2 @ c                 # центр масс части остаётся там, куда его ставило аффинное
    return np.hstack([A2, t2[:, None]])

def register_similarity(part_mask, ref_mask, init=None, no_rotation=False):
    ys, xs = np.where(part_mask > 0.5); ry, rx = np.where(ref_mask > 0.5)
    s0 = np.sqrt(len(rx) / max(len(xs), 1))
    M = init if init is not None else np.array([[s0, 0, rx.mean() - s0 * xs.mean()], [0, s0, ry.mean() - s0 * ys.mean()]])
    try: M = ecc_refine(M, part_mask, ref_mask)
    except Exception as e: print('  ECC fallback', e)
    M = to_similarity(M, part_mask)
    if no_rotation:                                # рисунок не поворачивается: по силуэту круглой головы угол не определяется
        sc = float(np.hypot(M[0, 0], M[0, 1])); ys, xs = np.where(part_mask > 0.5); c = np.array([xs.mean(), ys.mean()])
        M2 = np.array([[sc, 0, 0], [0, sc, 0]]); M2[:, 2] = M[:, :2] @ c + M[:, 2] - M2[:, :2] @ c; M = M2
    try:                                           # добивка сдвигом
        pw = cv2.warpAffine(part_mask, M, (W, H)); rb = cv2.GaussianBlur(ref_mask, (0, 0), 4); pb = cv2.GaussianBlur(pw, (0, 0), 4)
        T = np.eye(2, 3, dtype=np.float32)
        cc, T = cv2.findTransformECC(rb, pb, T, cv2.MOTION_TRANSLATION, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6), None, 7)
        M = M.copy(); M[:, 2] -= T[:, 2]
    except Exception: pass
    return M

def orange_pts(bgr, region=None):
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV); m = (hsv[..., 0] >= 5) & (hsv[..., 0] <= 22) & (hsv[..., 1] > 110) & (hsv[..., 2] > 150)
    if region is not None: m &= region
    lab, k = ndi.label(ndi.binary_dilation(m, iterations=3)); out = []
    for i in range(1, k + 1):
        ys, xs = np.where((lab == i) & m)
        if len(xs) > 150: out.append((xs.mean(), ys.mean(), len(xs)))
    return out

def head_by_cheeks(p):
    """Голову ставим по ЛИЦУ, а не по силуэту: глаза и рот лежат на оригинальных местах, поэтому полоски на щеках
    новой головы должны лечь на полоски оригинала (масштаб — по расстоянию между щеками, сдвиг — по середине)."""
    reg = np.zeros(REF.shape[:2], bool); reg[400:540, 380:880] = True
    rp = orange_pts(REF, reg); pp = orange_pts(p)
    def pair(pts):
        pts = sorted(pts, key=lambda t: -t[2])[:6]; xs = [t[0] for t in pts]; mid = np.median(xs)
        L = [t for t in pts if t[0] < mid]; R = [t for t in pts if t[0] >= mid]
        cx = lambda g: (sum(t[0] * t[2] for t in g) / sum(t[2] for t in g), sum(t[1] * t[2] for t in g) / sum(t[2] for t in g))
        return np.array(cx(L)), np.array(cx(R))
    (rl, rr), (pl, pr) = pair(rp), pair(pp)
    sc = np.linalg.norm(rr - rl) / np.linalg.norm(pr - pl); t = (rl + rr) / 2 - sc * (pl + pr) / 2
    return np.array([[sc, 0, t[0]], [0, sc, t[1]]])

def solid_of(img):
    s = img.min(2) < 236
    s = ndi.binary_closing(s, iterations=2); s = ndi.binary_fill_holes(s); s = ndi.binary_opening(s, iterations=2)
    return s

def to_ref_space(rgba, M):
    prem = rgba.astype(np.float32).copy(); prem[..., :3] *= prem[..., 3:4] / 255
    Mss = M.astype(np.float64) * SS
    w = cv2.warpAffine(prem, Mss, (int(W * SS), int(H * SS)), flags=cv2.INTER_CUBIC)
    a = np.clip(w[..., 3:4], 0, 255)
    rgb = np.where(a > 0.5, w[..., :3] * 255 / np.maximum(a, 1), 0)
    return np.dstack([rgb, a]).clip(0, 255).astype(np.uint8)

def crop_save(name, img, comp_mask=None, margin=6):
    a = img[..., 3] if comp_mask is None else (img[..., 3] * comp_mask)
    ys, xs = np.where(a > 6)
    x0, x1, y0, y1 = max(0, xs.min() - margin), min(img.shape[1], xs.max() + 1 + margin), max(0, ys.min() - margin), min(img.shape[0], ys.max() + 1 + margin)
    c = img[y0:y1, x0:x1].copy()
    if comp_mask is not None: c[..., 3] = (c[..., 3] * comp_mask[y0:y1, x0:x1]).astype(np.uint8)
    Image.fromarray(c, 'RGBA').save(os.path.join(OUT, name + '.webp'), 'WEBP', lossless=True, quality=100, method=6)
    box = [x0 / SS, y0 / SS, x1 / SS, y1 / SS]
    print(name, [round(v, 1) for v in box], c.shape[1], 'x', c.shape[0]); return dict(name=name, box=box, tex=name + '.webp', px=[c.shape[1], c.shape[0]])

parts = {}
cut = {}
for n in ['body', 'arm', 'head', 'eyes', 'ears', 'tail']:
    p = cv2.imread(os.path.join(SRC, n + '.webp'))
    pm = (p.min(2) < 235).astype(np.float32)
    M = np.array([[GLOBAL, 0, 1.0], [0, GLOBAL, 0.0]])
    if n in REF_MASK_OF and n != 'ears':
        M0 = sift_init(p)
        M = register_similarity(pm, old_alpha(REF_MASK_OF[n]), to_similarity(M0, pm) if M0 is not None else None, no_rotation=(n in ('head', 'arm')))
        if n == 'head':
            M = head_by_cheeks(p); print('head по щекам M', np.round(M, 3).tolist())
        iou = ((cv2.warpAffine(pm, M, (W, H)) > 0.5) & (old_alpha(REF_MASK_OF[n]) > 0.5)).sum() / max(((cv2.warpAffine(pm, M, (W, H)) > 0.5) | (old_alpha(REF_MASK_OF[n]) > 0.5)).sum(), 1)
        print(n, 'IoU силуэта', round(float(iou), 3))
    elif n == 'eyes':
        green = lambda im: ((im[..., 1] > 150) & (im[..., 2] < 150) & (im[..., 0] < 215)).astype(np.float32)
        try: M = ecc_refine(M, green(p), green(REF), blur=4)
        except Exception as e: print(n, 'ECC fallback', e)
    if n == 'ears':
        lab, k = ndi.label(ndi.binary_dilation(pm > 0.5, iterations=6)); order = sorted(range(1, k + 1), key=lambda i: -(lab == i).sum())[:2]
        order.sort(key=lambda i: np.where(lab == i)[1].mean())
        ear_M = []
        for oi, nm in zip(order, ['ear-l', 'ear-r']):
            pmi = ((lab == oi) & (pm > 0.5)).astype(np.float32)
            ear_M.append(register_similarity(pmi, old_alpha([nm])))
            print(nm, 'M', np.round(ear_M[-1], 3).tolist())
        M = ear_M[0]
    rgb = cv2.cvtColor(p, cv2.COLOR_BGR2RGB)
    F, a = cutout(rgb, solid_of(rgb), keep_white=[(0, 0, 1, 1)], remove_paper=(n != 'eyes'))
    cut[n] = (np.dstack([F, a * 255]).clip(0, 255).astype(np.uint8), M if n != 'ears' else ear_M)
    print(n, 'M', np.round(M, 3).tolist())

def comps(img, k=2):
    lab, n = ndi.label(ndi.binary_dilation(img[..., 3] > 10, iterations=6))
    sizes = ndi.sum(np.ones_like(lab), lab, range(1, n + 1)); order = 1 + np.argsort(-np.asarray(sizes))[:k]
    ms = [(lab == o).astype(np.float32) for o in order]
    ms.sort(key=lambda m: np.where(m > 0)[1].mean()); return ms          # слева направо

layers = []
for n in ['body', 'arm', 'head', 'tail']:
    layers.append(crop_save(n, to_ref_space(*cut[n])))
(ea_img, (m_l, m_r)) = cut['ears']
lab, k = ndi.label(ndi.binary_dilation(ea_img[..., 3] > 10, iterations=6)); order = sorted(range(1, k + 1), key=lambda i: -(lab == i).sum())[:2]
order.sort(key=lambda i: np.where(lab == i)[1].mean())
for nm, oi, Mi in zip(['ear-l', 'ear-r'], order, [m_l, m_r]):
    one = ea_img.copy(); one[..., 3] = (one[..., 3] * (lab == oi)).astype(np.uint8)
    layers.append(crop_save(nm, to_ref_space(one, Mi)))
eyes = to_ref_space(*cut['eyes']); lm, rm = comps(eyes)
for side, m in (('l', lm), ('r', rm)):
    sub = eyes.copy(); sub[..., 3] = (sub[..., 3] * m).astype(np.uint8)
    ys, xs = np.where(sub[..., 3] > 10); cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    rx, ry = (xs.max() - xs.min()) / 2, (ys.max() - ys.min()) / 2
    yy, xx = np.mgrid[0:sub.shape[0], 0:sub.shape[1]]
    inner = ((xx - cx) / (rx - 10 * SS)) ** 2 + ((yy - cy) / (ry - 10 * SS)) ** 2 <= 1
    rgb3 = sub[..., :3]; lum = rgb3.mean(2)
    pup = inner & ((lum < 90) | ((rgb3.min(2) > 200) & (np.abs(xx - cx) < rx * 0.7)))
    pup = ndi.binary_dilation(pup, iterations=2)
    pa = cv2.GaussianBlur(pup.astype(np.float32), (0, 0), 1.2)
    pl = sub.copy(); pl[..., 3] = (pa * sub[..., 3]).clip(0, 255).astype(np.uint8)
    iris = cv2.inpaint(np.ascontiguousarray(rgb3), (pup * 255).astype(np.uint8), 6, cv2.INPAINT_TELEA)
    ey = sub.copy(); ey[..., :3] = np.where(pup[..., None], iris, rgb3)
    layers.append(crop_save('eye-' + side, ey)); layers.append(crop_save('pupil-' + side, pl))
# закрытый глаз и рты из ранее сгенерированных кадров: прозрачны там, где цвет совпадает с мехом
def stroke_layer(name, box, fur_ring=True, thr=14, span=34):
    im = np.asarray(Image.open(os.path.join(OLD, name + '.webp')).convert('RGBA')).astype(np.float32)
    h, w = im.shape[:2]; a0 = im[..., 3] / 255
    ring = (a0 > 0.9) & ~ndi.binary_erosion(a0 > 0.9, iterations=10)
    fur = np.median(im[..., :3][ring], axis=0) if ring.sum() > 50 else np.array([74, 77, 82.])
    d = np.linalg.norm(im[..., :3] - fur, axis=2)
    a = np.clip((d - thr) / span, 0, 1) * a0
    return im, a, box
for nm, old, box in [('mouth', 'mouth', (572, 466)), ('arc-l', 'eyeclosed-l', (405, 301)), ('arc-r', 'eyeclosed-r', (618, 301)), ('mouth-open', 'mouthopen', (539, 427)), ('mouth-o', 'moutho', (539, 427))]:
    im, a, _ = stroke_layer(old, box)
    out = np.dstack([im[..., :3], a * 255]).clip(0, 255).astype(np.uint8)
    up = cv2.resize(out, None, fx=SS, fy=SS, interpolation=cv2.INTER_CUBIC)
    canvas = np.zeros((int(H * SS), int(W * SS), 4), np.uint8)
    x, y = int(box[0] * SS), int(box[1] * SS); canvas[y:y + up.shape[0], x:x + up.shape[1]] = up
    L_ = crop_save(nm, canvas, margin=2)
    L_['box'] = [L_['box'][0] + MOUTH_DX, L_['box'][1], L_['box'][2] + MOUTH_DX, L_['box'][3]]   # рот — под носом НОВОЙ головы
    layers.append(L_)
json.dump({l['name']: l for l in layers}, open(os.path.join(OUT, 'parts.json'), 'w'), indent=1)
