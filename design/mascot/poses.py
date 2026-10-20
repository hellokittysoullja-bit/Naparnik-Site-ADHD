# Патчи поз кота из картинок GPT-Image-2 (design/mascot/poses/*.webp, промпты рядом — prompt_*.txt).
# Модель получает reference.png и меняет ТОЛЬКО позу/лицо: всё остальное совпадает с оригиналом
# (проверено: после выравнивания сдвиг < 1 px). Здесь: выравнивание по оригиналу (ECC), прозрачность тем
# же matte.py, цветовая подгонка по кольцу вокруг области и вырезка патча в public/mascot/pose-*.webp.
# Запуск: python3 design/mascot/poses.py   (нужны numpy, scipy, opencv, Pillow)
import json, os, sys
import numpy as np, cv2
from scipy import ndimage as ndi
from PIL import Image, ImageDraw, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from matte import cutout
REF = cv2.cvtColor(cv2.imread(os.path.join(ROOT, 'design/mascot/reference.png')), cv2.COLOR_BGR2RGB)
MASK = cv2.imread(os.path.join(HERE, 'mask.png'), 0)
H, W = REF.shape[:2]

# Область, которую патч заменяет (координаты рисунка 1264x848). Лапа поднятая у щеки; под ней — грудь.
ARM_L = [(300, 410), (470, 410), (520, 560), (560, 700), (580, 800), (300, 800)]
ARM_R = [(700, 560), (775, 300), (905, 300), (905, 520), (868, 640), (830, 800), (700, 800)]   # правее — завиток хвоста и огонёк: они качаются сами
ARM_L_UP = [(262, 288), (470, 288), (520, 560), (560, 700), (580, 800), (262, 800)]   # радость: лапа поднята выше, до уровня ушей
EYES = [(405, 322), (820, 322), (820, 500), (405, 500)]
FACE = [(395, 318), (830, 318), (830, 545), (395, 545)]
POSES = {
    'happy-eyes': dict(src='happy-eyes', regions=[EYES], feather=5),
    'yawn':       dict(src='yawn',       regions=[FACE], feather=5),
    'wave-a':     dict(src='wave-a',     regions=[ARM_L], feather=6),
    'wave-b':     dict(src='wave-b',     regions=[ARM_L], feather=6),
    'cheer':      dict(src='cheer',      regions=[ARM_L_UP, ARM_R, FACE], feather=6),
}

def align(gen_rgb):
    g = cv2.resize(gen_rgb, (W, H), interpolation=cv2.INTER_AREA)
    rg = cv2.GaussianBlur(cv2.cvtColor(REF, cv2.COLOR_RGB2GRAY).astype(np.float32), (0, 0), 1.5)
    gg = cv2.GaussianBlur(cv2.cvtColor(g, cv2.COLOR_RGB2GRAY).astype(np.float32), (0, 0), 1.5)
    m = (cv2.erode(MASK, np.ones((15, 15), np.uint8)) > 0).astype(np.uint8)
    warp = np.eye(2, 3, dtype=np.float32)
    cc, warp = cv2.findTransformECC(rg, gg, warp, cv2.MOTION_AFFINE,
                                    (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 300, 1e-7), m, 5)
    out = cv2.warpAffine(g, warp, (W, H), flags=cv2.INTER_CUBIC + cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE)
    return out, warp, cc

def solid_of(img):
    """Силуэт позы: всё не-белое, замкнутое и с залитыми дырами (блики в глазах — внутри)."""
    nonwhite = img.min(2) < 236
    nonwhite = ndi.binary_closing(nonwhite, iterations=2)
    nonwhite = ndi.binary_fill_holes(nonwhite)
    nonwhite = ndi.binary_opening(nonwhite, iterations=2)
    lab, n = ndi.label(nonwhite)
    if n > 1:                                   # крошки бумаги и шум — прочь, остаётся кот
        sizes = ndi.sum(nonwhite, lab, range(1, n + 1)); keep = 1 + int(np.argmax(sizes))
        nonwhite = lab == keep
    return nonwhite

def region_mask(polys, feather):
    m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)
    for p in polys: d.polygon(p, fill=255)
    return np.asarray(m.filter(ImageFilter.GaussianBlur(feather))).astype(np.float32) / 255

PNG_DIR = os.path.join(HERE, 'png'); os.makedirs(PNG_DIR, exist_ok=True)
CROP = (slice(40, 810), slice(180, 1200))      # один и тот же кадр у всех поз — совмещение сохраняется
# мастер: кот из оригинала с чистой прозрачностью (без белой каймы)
F0, a0 = cutout(REF, MASK > 127)
Image.fromarray(np.dstack([F0, a0 * 255]).astype(np.uint8)[CROP], 'RGBA').save(os.path.join(PNG_DIR, 'idle.png'), optimize=True)
out = {}
for name, cfg in POSES.items():
    src = cv2.cvtColor(cv2.imread(os.path.join(HERE, 'poses', cfg['src'] + '.webp')), cv2.COLOR_BGR2RGB)
    img, warp, cc = align(src)
    F, a = cutout(img, solid_of(img))
    Image.fromarray(np.dstack([F, a * 255]).astype(np.uint8)[CROP], 'RGBA').save(os.path.join(PNG_DIR, name + '.png'), optimize=True)
    M = region_mask(cfg['regions'], cfg['feather'])
    # цвет: у позы мех чуть другого тона — сдвиг по кольцу вокруг области, где оба кадра — кот
    ring = (ndi.binary_dilation(M > 0.5, iterations=14) & ~ndi.binary_dilation(M > 0.5, iterations=3)) & (a > 0.95) & (MASK > 200)
    shift = np.median((REF[ring].astype(np.float32) - F[ring]), axis=0) if ring.sum() > 200 else np.zeros(3, np.float32)
    shift = np.clip(shift, -14, 14)
    F2 = np.clip(F + shift, 0, 255)
    alpha = np.clip(M * a, 0, 1)
    ys, xs = np.where(M > 0.02); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    arr = np.dstack([F2[y0:y1, x0:x1], alpha[y0:y1, x0:x1] * 255]).astype(np.uint8)
    Image.fromarray(arr, 'RGBA').save(os.path.join(ROOT, 'public/mascot', f'pose-{name}.webp'), 'WEBP', lossless=True, quality=100, method=6)
    out[name] = dict(x=int(x0), y=int(y0), w=int(x1 - x0), h=int(y1 - y0))
    print(name, 'ECC', round(float(cc), 3), 'shift px', np.round(warp[:, 2], 2), 'colour shift', np.round(shift, 1), out[name])
json.dump(out, open(os.path.join(HERE, 'poses.json'), 'w'), indent=1)
