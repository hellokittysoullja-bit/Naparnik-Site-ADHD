# Скелет, сетки и веса кота -> public/mascot/rig/rig.json (читает components/rig/*).
# Части — слои из parts_build.py (нарисованы GPT-Image-2 со скрытыми зонами). Здесь:
#   * кости: root > hip > chest > head > уши; chest > плечо > запястье; hip > хвост (цепь из 11) > огонёк;
#   * треугольная сетка по прозрачности текстуры (клетка 10-14 px рисунка);
#   * веса автоматически по положению вершины (как закраска весов в Spine/Live2D, только правилами):
#     тело — hip/chest по высоте; голова — head, у подбородка плавно chest; ухо — у основания head, к кончику своя кость;
#     лапа — плечо/запястье с мягким стыком с грудью; хвост — по ближайшей точке осевой линии, соседние кости смешиваются
#     (хвост гнётся непрерывно, а не ломается на шарнирах).
# Запуск: python3 design/mascot/rig_build.py   (numpy, Pillow)
import json, os
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
RIG = os.path.join(ROOT, 'public/mascot/rig'); P = json.load(open(os.path.join(RIG, 'parts.json'))); SS = 1.25

def sm(x): x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)

# ---------- кости (координаты оригинала 1264x848; опора кости = точка в покое) ----------
TAIL_IMG = [(25, 350), (95, 365), (170, 368), (240, 358), (300, 338), (350, 302), (385, 258), (402, 205), (398, 148), (372, 95), (325, 55)]
tb = P['tail']['box']
TAIL_J = [(tb[0] + x / SS, tb[1] + y / SS) for x, y in TAIL_IMG]
bones = []
def bone(name, parent, pivot):
    bones.append(dict(name=name, parent=parent, pivot=[round(pivot[0], 1), round(pivot[1], 1)])); return len(bones) - 1
root = bone('root', -1, (617, 772)); hip = bone('hip', root, (617, 738)); chest = bone('chest', hip, (617, 650))
head = bone('head', chest, (623, 596))
ear_l = bone('ear-l', head, (478, 262)); ear_r = bone('ear-r', head, (730, 268))
arm_u = bone('arm', chest, (498, 604)); arm_l = bone('paw', arm_u, (498, 692))
tail = []
for i, j in enumerate(TAIL_J): tail.append(bone(f'tail{i}', hip if i == 0 else tail[-1], j))
flame_seat = (1012.0, 421.0)
flame = bone('flame', tail[-1], flame_seat)
BI = {b['name']: i for i, b in enumerate(bones)}

# ---------- правила весов ----------
def tail_weights(pts):
    J = np.array(TAIL_J); n = len(J); out = []
    segs = [(J[i], J[i + 1]) for i in range(n - 1)]
    for p in pts:
        best = None
        for i, (a, b) in enumerate(segs):
            ab = b - a; f = float(np.clip(np.dot(p - a, ab) / np.dot(ab, ab), 0, 1)); d = np.linalg.norm(p - (a + f * ab))
            if best is None or d < best[0]: best = (d, i, f)
        d, i, f = best
        t = i + f
        if i == n - 2 and f >= 0.999: t = n - 1
        # вершины левее первого сустава (корень под телом) — за hip
        if np.dot(p - J[0], J[1] - J[0]) < 0: t = 0.0
        low = int(np.floor(t)); fr = float(sm(t - low)); w = {}
        if low >= n - 1: w[tail[n - 1]] = 1.0
        else: w[tail[low]] = 1 - fr; w[tail[low + 1]] = fr
        root_w = 1 - float(sm(t / 0.9))
        w = {k: v * (1 - root_w) for k, v in w.items()}; w[hip] = root_w
        out.append(w)
    return out

def weights_for(name, pts, box):
    N = len(pts); y = pts[:, 1]; x = pts[:, 0]; W = []
    if name == 'tail': return tail_weights(pts)
    for k in range(N):
        yy, xx = y[k], x[k]
        if name == 'body':
            c = float(sm((738 - yy) / 98)); W.append({hip: 1 - c, chest: c})
        elif name == 'head':
            hw = 1 - 0.8 * float(sm((yy - 560) / 110)); W.append({head: hw, chest: 1 - hw})
        elif name in ('ear-l', 'ear-r'):
            b = ear_l if name == 'ear-l' else ear_r; pv = np.array(bones[b]['pivot'])
            e = float(sm((np.hypot(xx - pv[0], yy - pv[1]) - 30) / 70)); W.append({head: 1 - e, b: e})
        elif name == 'arm':
            cw = 1 - float(sm((yy - 580) / 44)); ww = float(sm((yy - 674) / 36))
            W.append({chest: cw, arm_u: (1 - cw) * (1 - ww), arm_l: (1 - cw) * ww})
        elif name == 'flame': W.append({flame: 1.0})
        else: W.append({head: 1.0})
    return W

# ---------- сетки ----------
ORDER = ['tail', 'flame', 'body', 'ear-l', 'ear-r', 'head', 'eye-l', 'eye-r', 'pupil-l', 'pupil-r', 'mouth', 'mouth-open', 'mouth-o', 'arc-l', 'arc-r', 'arm']
CELL = dict(tail=12, body=12, head=14, arm=9, flame=8)
PARTS = dict(P)
flame_img = np.asarray(Image.open(os.path.join(RIG, 'flame.webp')).convert('RGBA'))
fw, fh = flame_img.shape[1], flame_img.shape[0]
# огонёк: старый слой (905,255)-(1040,430), основание у (972,428) -> на новое место кривой хвоста
PARTS['flame'] = dict(name='flame', tex='flame.webp', box=[905 + flame_seat[0] - 972, 255 + flame_seat[1] - 428, 1040 + flame_seat[0] - 972, 430 + flame_seat[1] - 428], px=[fw, fh])

def build(name):
    part = PARTS[name]; box = part['box']; tex = np.asarray(Image.open(os.path.join(RIG, part['tex'])).convert('RGBA'))[..., 3]
    th, tw = tex.shape; cell = CELL.get(name, 12 if part['px'][0] > 120 else 8)
    nx = max(1, int(np.ceil((box[2] - box[0]) / cell))); ny = max(1, int(np.ceil((box[3] - box[1]) / cell)))
    xs = np.linspace(box[0], box[2], nx + 1); ys = np.linspace(box[1], box[3], ny + 1)
    keep = np.zeros((ny, nx), bool)
    for j in range(ny):
        for i in range(nx):
            u0, u1 = int((xs[i] - box[0]) / (box[2] - box[0]) * tw), int(np.ceil((xs[i + 1] - box[0]) / (box[2] - box[0]) * tw))
            v0, v1 = int((ys[j] - box[1]) / (box[3] - box[1]) * th), int(np.ceil((ys[j + 1] - box[1]) / (box[3] - box[1]) * th))
            keep[j, i] = tex[v0:max(v1, v0 + 1), u0:max(u1, u0 + 1)].max() > 8
    from scipy import ndimage as ndi
    keep = ndi.binary_dilation(keep, iterations=1)
    vid = -np.ones((ny + 1, nx + 1), int); verts = []
    def V(i, j):
        if vid[j, i] < 0: vid[j, i] = len(verts); verts.append((xs[i], ys[j]))
        return vid[j, i]
    idx = []
    for j in range(ny):
        for i in range(nx):
            if keep[j, i]:
                a, b, c, d = (int(t) for t in (V(i, j), V(i + 1, j), V(i + 1, j + 1), V(i, j + 1))); idx += [a, b, c, a, c, d]
    pts = np.array(verts); W = weights_for(name, pts, box)
    flat = []
    for k, (p, w) in enumerate(zip(pts, W)):
        items = sorted(((b, v) for b, v in w.items() if v > 1e-4), key=lambda t: -t[1])[:4]; s = sum(v for _, v in items)
        items = [(b, v / s) for b, v in items] + [(0, 0.0)] * (4 - len(items))
        u = (p[0] - box[0]) / (box[2] - box[0]); v = (p[1] - box[1]) / (box[3] - box[1])
        flat += [round(float(p[0]), 1), round(float(p[1]), 1), round(float(u), 4), round(float(v), 4)] + [int(b) for b, _ in items] + [round(float(w_), 3) for _, w_ in items]
    return dict(name=name, tex=part['tex'], box=[round(v, 1) for v in box], verts=flat, idx=idx)

parts = [build(n) for n in ORDER]
for p in parts: print(p['name'], len(p['verts']) // 12, 'вершин', len(p['idx']) // 3, 'треугольников')
out = dict(scale=SS, bones=bones, parts=parts, view=[250, -85, 910, 910])
json.dump(out, open(os.path.join(RIG, 'rig.json'), 'w'), separators=(',', ':'))
print('rig.json', round(os.path.getsize(os.path.join(RIG, 'rig.json')) / 1024), 'КБ; костей', len(bones))
