# Генератор Rive-проекта кота: слои рисунка владельца (design/mascot/rive/layers/*.png, полный размер)
# -> scene.rml (кости, меш-хвост, конечности на узлах, слои state machine) -> `rive . --once` -> .riv.
#   MASCOT_FULL=1 MASCOT_OUT=design/mascot/rive/layers python3 design/mascot/cut.py   # слои
#   python3 design/mascot/rive/build.py && rive design/mascot/rive --once
import base64, math, os, re, struct, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
sys.path.insert(0, HERE)
from rmlkit import El, Anim, node, nid  # noqa: E402

# ── геометрия: тот же источник правды, что у сайта (components/mascot-geometry.ts) ──
GEO = open(os.path.join(ROOT, "components/mascot-geometry.ts"), encoding="utf-8").read()
LAYERS = {}
for key, fn, a, b, c, d in re.findall(r'(\w+):\s*layer\("([\w-]+)",\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\)', GEO):
    LAYERS[key] = dict(file=fn, x=int(a), y=int(b), w=int(c) - int(a), h=int(d) - int(b))


def pt(name):
    m = re.search(rf"export const {name} = \{{ x: (\d+), y: (\d+) \}}", GEO)
    return int(m.group(1)), int(m.group(2))


GROUND, NECK, EAR_L, EAR_R, SHOULDER, PAW_C, EYE_L, EYE_R = (
    pt(n) for n in ("GROUND", "NECK", "EAR_L_PIVOT", "EAR_R_PIVOT", "SHOULDER", "PAW_C", "EYE_L", "EYE_R")
)
EYE_RX, EYE_RY = 57, 60
TAIL_J = [(825, 697), (900, 702), (975, 705), (1040, 690), (1085, 655), (1100, 600), (1095, 545), (1075, 490)]
ART_W = ART_H = 910
OFF = (-250, 85)  # координаты рисунка -> артборд (viewBox сайта "250 -85 910 910")

assets = {}


def asset(key):
    f = LAYERS[key]["file"]
    if f not in assets:
        assets[f] = El("ImageAsset", f.replace("-", "_"), file=f"layers/{f}.png")
    return assets[f]


class P:
    """Узел с известным мировым положением опоры (в координатах рисунка)."""

    def __init__(self, el, wx, wy):
        self.el, self.wx, self.wy = el, wx, wy

    def sub(self, name, wx, wy, **kw):
        n = node(name, wx - self.wx, wy - self.wy, **kw)
        self.el.add(n)
        return P(n, wx, wy)

    def img(self, key, name=None, **kw):
        l = LAYERS[key]
        im = El("Image", name or key, x=l["x"] - self.wx, y=l["y"] - self.wy, originX=0, originY=0,
                assetId=asset(key).id, **kw)
        self.el.add(im)
        return im


def build():
    art = El("Artboard", "Cat", width=ART_W, height=ART_H, defaultStateMachineId=None)
    art.id = "0:2"
    cat = P(node("Cat", *OFF), 0, 0)
    art.add(cat.el)
    return art, cat



# ── меш хвоста: сетка по альфе, веса по расстоянию вдоль цепочки костей ──
def varuint(n):
    out = bytearray()
    while True:
        b = n & 0x7F
        n >>= 7
        if n:
            out.append(b | 0x80)
        else:
            out.append(b)
            return bytes(out)


def mesh_for(key, step=20):
    """(вершины [(x,y,u,v)], треугольники) по альфе слоя; x,y — от левого верхнего угла картинки"""
    l = LAYERS[key]
    a = np.asarray(Image.open(os.path.join(HERE, "layers", l["file"] + ".png")).convert("RGBA"))[..., 3]
    w, h = l["w"], l["h"]
    xs = list(range(0, w, step)) + [w]
    ys = list(range(0, h, step)) + [h]
    cells = []
    for j in range(len(ys) - 1):
        for i in range(len(xs) - 1):
            if a[ys[j]:ys[j + 1], xs[i]:xs[i + 1]].max() > 6:
                cells.append((i, j))
    idx, verts, tris = {}, [], []

    def vi(i, j):
        if (i, j) not in idx:
            idx[(i, j)] = len(verts)
            verts.append((xs[i], ys[j], xs[i] / w, ys[j] / h))
        return idx[(i, j)]

    for i, j in cells:
        a0, b0, c0, d0 = vi(i, j), vi(i + 1, j), vi(i + 1, j + 1), vi(i, j + 1)
        tris += [(a0, b0, c0), (a0, c0, d0)]
    return verts, tris


def chain_weights(world_pts, joints):
    """веса вершин по цепочке: «шапочка» между серединами соседних костей, не более 2 костей"""
    seg = [(joints[i], joints[i + 1]) for i in range(len(joints) - 1)]
    lens = [math.dist(a, b) for a, b in seg]
    starts = np.concatenate([[0], np.cumsum(lens)])
    mids = [starts[i] + lens[i] / 2 for i in range(len(seg))]
    out = []
    for px, py in world_pts:
        best = (1e18, 0.0)
        for i, (a, b) in enumerate(seg):
            ax, ay = a
            dx, dy = b[0] - ax, b[1] - ay
            t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
            d = math.hypot(px - ax - dx * t, py - ay - dy * t)
            if d < best[0]:
                best = (d, starts[i] + lens[i] * t)
        s = best[1]
        if s <= mids[0]:
            out.append(((0, 1.0),))
        elif s >= mids[-1]:
            out.append(((len(seg) - 1, 1.0),))
        else:
            k = max(i for i in range(len(seg)) if mids[i] <= s)
            f = (s - mids[k]) / (mids[k + 1] - mids[k])
            f = f * f * (3 - 2 * f)
            out.append(((k, 1 - f), (k + 1, f)))
    return out


def pack_weight(infl):
    idxs, vals = 0, 0
    items = list(infl)
    tot = sum(v for _, v in items)
    q = [int(round(v / tot * 255)) for _, v in items]
    q[0] += 255 - sum(q)
    for slot, ((bi, _), qq) in enumerate(zip(items, q)):
        idxs |= (bi + 1) << (8 * slot)
        vals |= qq << (8 * slot)
    return vals, idxs


def skinned_image(parent: P, key, joints, bones, name=None):
    """картинка с мешем, привязанным к цепочке костей (bones: список (El кости, мировой угол))"""
    l = LAYERS[key]
    verts, tris = mesh_for(key)
    im = El("Image", name or key, x=l["x"] - parent.wx, y=l["y"] - parent.wy, originX=0, originY=0, assetId=asset(key).id)
    tri_bytes = b"".join(varuint(i) for t in tris for i in t)
    mesh = El("Mesh", "Mesh", triangleIndexBytes=base64.b64encode(tri_bytes).decode())
    wts = chain_weights([(l["x"] + vx, l["y"] + vy) for vx, vy, _, _ in verts], joints)
    for k, ((vx, vy, u, v), infl) in enumerate(zip(verts, wts)):
        vals, idxs = pack_weight(infl)
        mv = El("ContourMeshVertex", f"V{k}", x=vx, y=vy, u=round(u, 5), v=round(v, 5), _id=False)
        mv.add(El("Weight", None, values=vals, indices=idxs, _id=False))
        mesh.add(mv)
    skin = El("Skin", "Skin", tx=l["x"] + OFF[0], ty=l["y"] + OFF[1], _id=False)
    for (bone_el, ang), (jx, jy) in zip(bones, joints):
        c, s = math.cos(ang), math.sin(ang)
        skin.add(El("Tendon", "T", boneId=bone_el.id, xx=round(c, 6), xy=round(s, 6), yx=round(-s, 6), yy=round(c, 6),
                    tx=jx + OFF[0], ty=jy + OFF[1], _id=False))
    mesh.add(skin)
    im.add(mesh)
    parent.el.add(im)
    return im


def bone_chain(parent: P, joints, name):
    """цепочка костей по суставам; возвращает [(El кости, мировой угол)] и сам корень"""
    bones, cur, prev_ang = [], parent.el, 0.0
    for i in range(len(joints) - 1):
        (ax, ay), (bx, by) = joints[i], joints[i + 1]
        ang = math.atan2(by - ay, bx - ax)
        length = math.dist((ax, ay), (bx, by))
        if i == 0:
            b = El("RootBone", f"{name}{i}", x=ax - parent.wx, y=ay - parent.wy, length=round(length, 3), rotation=round(ang, 6))
        else:
            b = El("Bone", f"{name}{i}", length=round(length, 3), rotation=round(ang - prev_ang, 6))
        cur.add(b)
        cur, prev_ang = b, ang
        bones.append((b, ang))
    return bones


def write(art):
    root = El("Rive", None, version="1", kind="fragment", _id=False)
    root.add(*assets.values())
    root.add(art)
    with open(os.path.join(HERE, "scene.rml"), "w", encoding="utf-8") as f:
        f.write(root.render() + "\n")
    open(os.path.join(HERE, "rive.yaml"), "w").write("name: naparnik-cat\n")


def main():
    art, cat = build()
    tail = P(node("Tail", 0, 0), 0, 0)
    cat.el.add(tail.el)
    bones = bone_chain(tail, TAIL_J, "tail")
    skinned_image(tail, "tail", TAIL_J, bones)
    write(art)


if __name__ == "__main__":
    main()
