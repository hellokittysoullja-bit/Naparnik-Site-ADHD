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


def clone(img, hole, valid, tex=None, gain=0.9, flat=False, texr=None):
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
    r_tex = (texr or TEXR) * S
    out = boxblur(out, r_tex)  # низкие частоты латки
    hf = img - boxblur(img, r_tex)  # мазки кисти + зерно (всё, что мельче r_tex px)
    if tex is None:
        idx = ndi.distance_transform_edt(~valid, return_distances=False, return_indices=True)
        grain = hf[idx[0], idx[1]]
    else:
        x0, y0, x1, y1 = (sc(v) for v in tex)
        block = hf[y0:y1, x0:x1]
        bh, bw = block.shape[:2]
        # зеркальное замощение: на стыках блоков нет разрывов текстуры (прямое замощение давало швы)
        def refl(i, n):
            m = i % (2 * n)
            return np.where(m < n, m, 2 * n - 1 - m)
        grain = np.clip(block[refl(yy + 7 * S, bh), refl(xx + 11 * S, bw)], -26, 26)  # мех ±20; точки туши (±60) не размножаются
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
    eye_hole |= ell(cx, cy, RX + 24, RY + 24)
    # перо 72 → 88 px от центра: латка переходит в родной мех градиентом, а не кольцом; внутри
    # r ≤ 72 — только латка (в оригинале до r ≈ 70 тёмная тень вокруг контура, её не подмешиваем)
    eye_blend = np.maximum(eye_blend, soft(ell(cx, cy, RX + 16, RY + 16), 4))
mouth_ink = np.zeros((H, W), bool)
mouth_ink[sc(MOUTH_BOX[1]):sc(MOUTH_BOX[3]), sc(MOUTH_BOX[0]):sc(MOUTH_BOX[2])] = True
mouth_ink &= lum < 48  # тушь (~22), не мех (~63)
mouth_soft = mouth_ink | (np.zeros((H, W), bool))
mouth_hole = ndi.binary_dilation(mouth_ink, iterations=7 * S)  # с запасом: антиалиас «ω» (lum 48..90) не просвечивает
head_rgb = clone(rgb, eye_hole | mouth_hole, FUR_OK & ~eye_hole & ~mouth_hole, tex=(572, 236, 658, 326), texr=12)  # мазки и зерно — чистый мех лба (без туши)
# Мех под глазами — из кадра «глаза закрыты», сгенерированного по оригиналу (gen_frames.py →
# align_gen.py → upscale.py → matte.py): там под глазами настоящий мех этого же рисунка. Тонкие дуги
# закрытых глаз в нём латаются клоном (узкие — клон идеален), а не весь глаз.
SFX = '' if S == 1 else f'@{S}x'
NOEYES = os.path.join(ROOT, 'design/mascot/export/no-eyes%s.png' % SFX)   # кадр «без глаз»: чистый мех, клон не нужен
EYESC = NOEYES if os.path.exists(NOEYES) else os.path.join(ROOT, 'design/mascot/export/eyes-closed%s.png' % SFX)
if os.path.exists(EYESC):
    ec = np.asarray(Image.open(EYESC).convert('RGBA')).astype(np.float32)
    ec_rgb, ec_lum = ec[..., :3], ec[..., :3].mean(2)
    ec_fur = (ec[..., 3] > 240) & (ec_lum > 40) & (ec_lum < 120) & (np.abs(ec_rgb[..., 0] - ec_rgb[..., 2]) < 22)
    if EYESC != NOEYES:
        arcs = eye_hole & (ec_lum < 42)                     # тушь дуг (~25); мех ~60 не трогаем
        arcs = ndi.binary_dilation(arcs, iterations=6 * S)
        ec_rgb = clone(ec_rgb, arcs, ec_fur & ~arcs, tex=None, texr=6)
    print('eye fur source:', os.path.basename(EYESC))
    # тон сгенерированного кадра чуть отличается от оригинала: выравниваем по кольцу меха вокруг глаза
    # (среднее по каналам), чтобы латка не читалась диском
    for cx, cy in EYES.values():
        ring_z = ell(cx, cy, RX + 44, RY + 44) & ~ell(cx, cy, RX + 18, RY + 18) & FUR_OK & ec_fur
        if ring_z.sum() > 50:
            off = rgb[ring_z].mean(0) - ec_rgb[ring_z].mean(0)
            zone_e = ell(cx, cy, RX + 20, RY + 20)
            ec_rgb = np.where(zone_e[..., None], np.clip(ec_rgb + off, 0, 255), ec_rgb)
    # смешивание по частотам: низкие (тон/освещение) — из свёрточной латки, которая по построению
    # непрерывна с окружающим мехом; высокие (мазки, зерно) — из кадра модели. Ни шва, ни диска.
    RB = 10 * S
    low_head = boxblur(head_rgb, RB)
    hi_ec = ec_rgb - boxblur(ec_rgb, RB)
    f = soft(ndi.binary_erosion(eye_hole, iterations=1 * S), 7)[..., None]  # широкое перо: без скачка текстуры
    # зерно: у кадра модели мех под глазами почти гладкий (std ≈ 1,6 против 4,8 у родного меха вокруг),
    # а в ×4-мастере зерно бумаги сглажено апскейлом — берём настоящее зерно из 1x-мастера (блок меха лба
    # без штрихов, зеркальное замощение, апсемплинг до рабочего масштаба) ровно столько, чтобы std
    # совпал с родным мехом вокруг глаз
    _m1 = np.asarray(Image.open(os.path.join(ROOT, 'design/mascot/export/naparnik-cat.png')).convert('RGBA')).astype(np.float32)
    _hf1 = np.clip(_m1[..., :3] - boxblur(_m1[..., :3], 3), -8, 8)   # только зерно бумаги (< 3 px, ±8): ни штрихов, ни отметин
    _l1 = _m1[..., :3].mean(2)
    _H1, _W1 = _l1.shape
    _ok1 = (_m1[..., 3] > 250) & (_l1 > 50) & (_l1 < 100) & (np.abs(_m1[..., 0] - _m1[..., 2]) < 18)
    _ok1 = ndi.binary_erosion(_ok1, iterations=3)
    # донор — только мех ГОЛОВЫ (лоб, щёки): на груди и животе рисунок с завитками «ɔ», у глаз их нет
    _hm = Image.new('L', (_W1, _H1), 0)
    ImageDraw.Draw(_hm).polygon([(250, 90), (900, 90), (915, 470), (935, 560), (880, 600), (820, 588), (700, 598), (600, 602), (470, 596), (400, 590), (250, 590)], fill=255)
    _ok1 &= ndi.binary_erosion(np.asarray(_hm) > 127, iterations=20)   # без кромки с пучками-«зигзагами» и ушей
    # донор — кольцо меха ВОКРУГ глаз (80–160 px от центра): латка статистически = тому, что её окружает
    _yy1, _xx1 = np.mgrid[0:_H1, 0:_W1]
    _near = np.zeros((_H1, _W1), bool)
    for _cx, _cy in EYES.values():
        _rr = np.hypot((_xx1 - _cx) / RX, (_yy1 - _cy) / RY) * RX
        _near |= (_rr > 80) & (_rr < 220)
    _ok1 &= _near & (np.arange(_H1)[:, None] > 250)
    # мозаика случайных блоков 72×72 родного меха с окном Ханна (шаг 36, перекрытие): зерно без
    # повторов и зеркальной симметрии — замощение одного блока читалось узором при усилении контраста
    _rng = np.random.default_rng(7)
    _B, _ST = 48, 24   # блоки: в латке остаются и крупные мазки (8–20 px), не только мелкое зерно
    _win = np.hanning(_B + 2)[1:-1]; _win = np.outer(_win, _win)[..., None]
    _acc = np.zeros((_H1 + _B, _W1 + _B, 3), np.float64); _wsum = np.zeros((_H1 + _B, _W1 + _B, 1), np.float64)
    _cand = np.argwhere(_ok1[:-_B:4, :-_B:4]) * 4
    _cand = _cand[_ok1[_cand[:, 0] + _B - 1, _cand[:, 1] + _B - 1] & _ok1[_cand[:, 0], _cand[:, 1] + _B - 1] & _ok1[_cand[:, 0] + _B - 1, _cand[:, 1]]]
    # только блоки чистого зерна: без тёмных отметин (минимум зерна по блоку > −6) — иначе один и тот же
    # блок с «лапкой» у усов повторяется по всей латке
    _l1hf = _hf1.mean(2)
    _cand = np.array([c for c in _cand if _l1hf[c[0]:c[0] + _B, c[1]:c[1] + _B].min() > -6 and _l1hf[c[0]:c[0] + _B, c[1]:c[1] + _B].max() < 8])
    print('eye grain donor blocks:', len(_cand))
    for _y in range(0, _H1, _ST):
        for _x in range(0, _W1, _ST):
            _sy, _sx = _cand[_rng.integers(len(_cand))]
            _acc[_y:_y + _B, _x:_x + _B] += _hf1[_sy:_sy + _B, _sx:_sx + _B] * _win
            _wsum[_y:_y + _B, _x:_x + _B] += _win
    _g1 = (_acc / np.maximum(_wsum, 1e-6))[:_H1, :_W1].astype(np.float32)
    grain_clone = ndi.zoom(_g1, (S, S, 1), order=1)[:H, :W] if S != 1 else _g1
    _ann = np.zeros((H, W), bool); _inn = np.zeros((H, W), bool)
    for cx, cy in EYES.values():
        _ann |= ell(cx, cy, RX + 46, RY + 46) & ~ell(cx, cy, RX + 20, RY + 20)
        _inn |= ell(cx, cy, RX - 4, RY - 4)
    _ann &= FUR_OK
    hf_ref = rgb - boxblur(rgb, RB)
    target = hf_ref[_ann].std(); s_ec = hi_ec[_inn].std(); s_cl = grain_clone[_inn].std()
    g = float(np.sqrt(max(target ** 2 - s_ec ** 2, 0.0)) / max(s_cl, 1e-6))
    print('eye grain: родной мех std %.2f, кадр модели %.2f, зерно 1x-мастера %.2f → вес %.2f' % (target, s_ec, s_cl, g))
    # основа латки — мех кадра модели (нарисован именно под глазами, без отметин и завитков, но
    # слишком гладкий); мелкое зерно бумаги (1–3 px) добирается мозаикой меха вокруг глаз
    patch = low_head + hi_ec + grain_clone * g
    # выравнивание по полосам частот: в латке энергия каждой полосы (1–3, 3–8, 8–20 px) делается
    # равной энергии той же полосы в родном мехе вокруг глаза — по построению, независимо от источников;
    # освещение (> 40 px) — ровно тон кольца меха (под глазом нет ни тени, ни блика)
    # считается на вырезке вокруг каждого глаза (пирамиды гауссианов на полном ×4-кадре съедали 13 ГБ)
    _scales = (1, 3, 8, 20, 40)
    for cx, cy in EYES.values():
        bx0, by0, bx1, by1 = sc(cx - RX - 70), sc(cy - RY - 70), sc(cx + RX + 70), sc(cy + RY + 70)
        crop = (slice(by0, by1), slice(bx0, bx1))
        pc, gc, rc = patch[crop].astype(np.float32), grain_clone[crop].astype(np.float32), rgb[crop].astype(np.float32)
        gs = lambda x, sg: ndi.gaussian_filter(x, (sg * S, sg * S, 0))
        pyr_p = [gs(pc, sg) for sg in _scales]
        pyr_c = [gs(gc, sg) for sg in _scales]
        ec_c = (low_head + hi_ec)[crop].astype(np.float32)
        pyr_e = [gs(ec_c, sg) for sg in _scales]
        pyr_r = [gs(rc, sg) for sg in _scales]
        # мазки 8–20 px: радиальное зеркало родного меха вокруг глаза — точка на радиусе r берёт мех с
        # радиуса 2·R0 − r (непрерывно на границе, масштаб мазков родной, без замощения); где за
        # зеркалом не мех (ухо, усы) — мозаика. Полоса 20–40 px (пятна акварели) берётся из мозаики
        # вполсилы: у зеркала на этом масштабе выходят концентрические «завихрения», у лба — тёмные
        # отметины; ровнее — лучше, чем узор
        R0 = RX + 10
        yy_c, xx_c = np.mgrid[by0:by1, bx0:bx1].astype(np.float64)
        dx_, dy_ = (xx_c - sc(cx)) / (RX * S), (yy_c - sc(cy)) / (RY * S)
        rn = np.sqrt(dx_ ** 2 + dy_ ** 2) * RX + 1e-6
        rm = 2 * R0 - rn
        ys_ = sc(cy) + dy_ / rn * rm * (RY * S)
        xs_ = sc(cx) + dx_ / rn * rm * (RX * S)
        ok_src = ndi.map_coordinates(FUR_OK.astype(np.float32), [ys_, xs_], order=0, mode='nearest') > 0.5
        mir = np.stack([ndi.map_coordinates(rgb[..., ch], [ys_, xs_], order=1, mode='nearest') for ch in range(3)], -1).astype(np.float32)
        mir = np.where((ok_src & (rn < R0 + 4))[..., None], mir, gc + rc.mean())
        pyr_s = [gs(mir, sg) for sg in _scales]
        _a = (ell(cx, cy, RX + 36, RY + 36) & ~ell(cx, cy, RX + 12, RY + 12) & FUR_OK)[crop]   # ближнее кольцо: с тенью глазницы
        _i = ell(cx, cy, RX - 2, RY - 2)[crop]
        zone_f = soft(ell(cx, cy, RX + 20, RY + 20), 5)[crop][..., None]   # вся латка до пера eye_blend
        fixed = np.broadcast_to(rc[_a].mean(0), pc.shape).astype(np.float32)
        gains = []
        for j in range(len(_scales) - 1):
            # 1–3 px: кадр модели + мозаика (зерно бумаги); крупнее — только кадр модели
            # (мозаика на этих масштабах приносит чужие отметины: завитки, пучки, «гусиные лапки» усов)
            bp = (pyr_p[j] - pyr_p[j + 1]) if j == 0 else (pyr_e[j] - pyr_e[j + 1])
            # кадр модели рисует под глазами мелкие тёмные отметины-«лапки» (штрихи 2–3 px); зерно
            # бумаги симметрично, отметины — только тёмные: тёмные выбросы срезаем, светлые оставляем
            bp = np.clip(bp, -3.0, 6.0)
            br = pyr_r[j] - pyr_r[j + 1]
            gn = float(br[_a].mean(1).std() / max(bp[_i].mean(1).std(), 1e-6))
            gn = min(gn, (3.0, 1.5, 1.0, 1.0)[j])
            gains.append(gn)
            fixed = fixed + bp * gn
        fixed = fixed + (pc - pyr_p[0])  # всё мельче 1 px — как есть
        patch[crop] = pc * (1 - zone_f) + fixed * zone_f
        if os.environ.get('DBG') and cx == EYES['L'][0]:
            def _dump(name, arr):
                a_ = arr.mean(2) if arr.ndim == 3 else arr
                Image.fromarray(np.clip((a_ - a_.mean()) * 6 + 128, 0, 255).astype(np.uint8)).save('/tmp/claude-0/shots/dbg_%s.png' % name)
            _dump('low_head', low_head[crop]); _dump('hi_ec', hi_ec[crop]); _dump('grain', gc); _dump('pc', pc); _dump('fixed', fixed); _dump('ec_rgb', ec_rgb[crop]); _dump('rgb', rgb[crop])
        del pyr_p, pyr_c, pyr_r, pyr_s, pyr_e, mir
        print('eye patch bands (1-3, 3-8, 8-20, 20-40 px) gains:', ' '.join('%.2f' % v for v in gains))
    # тон: среднее латки = среднее кольца родного меха вокруг (без «светлого/тёмного диска»)
    for cx, cy in EYES.values():
        _a = ell(cx, cy, RX + 46, RY + 46) & ~ell(cx, cy, RX + 20, RY + 20) & FUR_OK
        _i = ell(cx, cy, RX - 4, RY - 4)
        off2 = rgb[_a].mean(0) - patch[_i].mean(0)
        zone2 = soft(ell(cx, cy, RX + 16, RY + 16), 8)[..., None]
        patch = patch + off2 * zone2
    head_rgb = head_rgb * (1 - f) + np.clip(patch, 0, 255) * f
# рот: вместо свёрточной латки — Clone Stamp со сдвигом: мех подбородка на 44 px ниже (настоящие
# мазки, без «мыла»), мягкий край
_src = ec_rgb if os.path.exists(EYESC) else rgb  # источник — кадр «без глаз»: над носом там нет колец глаз
chin = np.roll(_src, 74 * S, axis=0)  # мех между глазами выше носа — ровный, без носа и теней
fm = soft(mouth_hole, 5)[..., None]
head_rgb = head_rgb * (1 - fm) + np.clip(boxblur(head_rgb, 10 * S) + (chin - boxblur(chin, 10 * S)), 0, 255) * fm
# объективная проверка латок: тон (среднее латки − кольцо меха вокруг) и шов (градиент на границе / градиент меха)
def patch_metrics(name, hole_mask, img):
    inner = ndi.binary_erosion(hole_mask, iterations=4 * S)
    ring = ndi.binary_dilation(hole_mask, iterations=14 * S) & ~ndi.binary_dilation(hole_mask, iterations=4 * S) & FUR_OK
    tone = np.abs(img[inner].mean(0) - img[ring].mean(0)).mean()
    gy, gx = np.gradient(img.mean(2))
    g = np.hypot(gx, gy)
    edge = ndi.binary_dilation(hole_mask, iterations=2 * S) & ~ndi.binary_erosion(hole_mask, iterations=2 * S)
    seam = g[edge].mean() / max(g[ring].mean(), 1e-6)
    # та же полоса на ОРИГИНАЛЕ (без латки): естественный градиент меха у глаз выше, чем в кольце,
    # поэтому честная мера шва — отношение к оригиналу, а не к кольцу
    gy0, gx0 = np.gradient(rgb.mean(2)); g0 = np.hypot(gx0, gy0)
    base = g0[edge].mean() / max(g0[ring].mean(), 1e-6)
    print('patch %-6s tone diff %.2f/255 (цель <2)  seam/original %.2f (цель <=1.15; абс. %.2f, оригинал %.2f)' % (name, tone, seam / base, seam, base))
for _k, (_cx, _cy) in EYES.items():
    patch_metrics('eye' + _k, ell(_cx, _cy, RX + 16, RY + 16), head_rgb)
patch_metrics('mouth', mouth_hole, head_rgb)
_w = np.clip(eye_blend, 0, 1)
# усы заходят в зону латки (дыра 88 px от центра глаза): оранжевые штрихи с их обводкой защищаем —
# там остаётся оригинал (иначе корни усов размываются и теряют чёрную обводку)
_or = (rgb[..., 0] > 150) & (rgb[..., 0] > rgb[..., 2] + 60) & (alpha > 0.5)
_prot = ndi.binary_dilation(_or, iterations=4 * S)
for _cx, _cy in EYES.values():
    _prot &= ~ell(_cx, _cy, RX + 6, RY + 6)
_w = _w * (1 - soft(_prot, 2)[..., ])
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

# 14. закрытые глаза и «^ ^» — не слои: движок рисует их лентами по кривым кейформов
#     (design/mascot/eyecurves.py → public/mascot/eyes.json); gen_layer нужен для ртов
def gen_layer(key, box):
    p = os.path.join(GEN, key + '.png')
    g = np.asarray(Image.open(p).convert('RGBA')).astype(np.float32)
    full = np.zeros((H, W, 4), np.float32)
    x0, y0, x1, y1 = box
    if S != 1:
        g = np.asarray(Image.fromarray(g.astype(np.uint8), 'RGBA').resize((sc(x1 - x0), sc(y1 - y0)), Image.LANCZOS)).astype(np.float32)
    full[sc(y0):sc(y1), sc(x0):sc(x1)] = g
    return full[..., :3], full[..., 3] / 255

# 15. рты: родное «ω», открытый и «о» — кадры по оригиналу; плоский и грустный — штрих тушью
mouth_a = soft(ndi.binary_dilation(mouth_ink, iterations=S), 0.7)
add('mouth_smile', rgb, mouth_a, 15)
for key, nm in (('mouthopen', 'mouth_open'), ('moutho', 'mouth_o')):
    r_, a_ = gen_layer(key, (539, 427, 691, 563)); add(nm, r_, a_, 15)
ink = np.percentile(rgb[mouth_ink], 20, axis=0)  # самая тёмная тушь
# зерно туши: высокие частоты родного штриха «ω», замощённые по новому штриху, + чуть
# рваный край (альфа модулируется тем же зерном) — рисованные рты, а не векторные линии
_mb = mouth_ink
_ink_hf = (rgb - np.asarray(Image.fromarray(rgb.astype(np.uint8)).filter(ImageFilter.GaussianBlur(2 * S)))).astype(np.float32)
_ys, _xs = np.nonzero(_mb); _bx = (_xs.min(), _ys.min(), _xs.max() + 1, _ys.max() + 1)
_blk = _ink_hf[_bx[1]:_bx[3], _bx[0]:_bx[2]]
def stroke(draw_fn):
    m = Image.new('L', (W, H), 0); draw_fn(ImageDraw.Draw(m))
    a = soft(np.asarray(m).astype(np.float32) / 255, 0.6)
    grain = _blk[(yy + 3 * S) % _blk.shape[0], (xx + 5 * S) % _blk.shape[1]]
    # тёмное зерно — в полную силу, светлое — приглушённо: штрих остаётся тушью, но не «ровной»
    g = np.minimum(grain, 0) * 0.8 + np.maximum(grain, 0) * 0.25
    col = np.clip(np.broadcast_to(ink, (H, W, 3)) + g, 0, 255).astype(np.float32)
    a = np.clip(a * (1 + np.minimum(grain.mean(2), 0) / 90.0), 0, 1)
    return col, a
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
    # тон кадра модели — к меху тела вокруг зоны (иначе латка читается светлым пятном под лапой)
    _ring_b = ndi.binary_dilation(zone_m, iterations=30 * S) & ~ndi.binary_dilation(zone_m, iterations=6 * S) & FUR_OK & (BODY_ZONE > 0.5)
    _wv_fur = zone_m & (wv[..., 3] > 240) & (wv[..., :3].mean(2) > 40) & (wv[..., :3].mean(2) < 120)
    if _ring_b.sum() > 50 and _wv_fur.sum() > 50:
        _off_b = rgb[_ring_b].mean(0) - wv[..., :3][_wv_fur].mean(0)
        wv = wv.copy(); wv[..., :3] = np.clip(wv[..., :3] + _off_b, 0, 255)
        print('body patch tone offset %.1f' % np.abs(_off_b).mean())
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
    'ring_L': EYES['L'], 'ring_R': EYES['R'],
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
hide = {'mouth_open', 'mouth_o', 'mouth_flat', 'mouth_sad'}
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
