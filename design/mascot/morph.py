# Морф глаза между нарисованными ключевыми кадрами (подход Live2D-кейформов, но кадры — от модели):
# для каждой пары соседних кадров считается плотный оптический поток (OpenCV DIS) в области глаза,
# промежуточный кадр = оба кадра, деформированные к середине по потоку, с кроссфейдом
# («warp-then-fade»; чистый кроссфейд даёт двоение линий). Поток хранится как сетка векторов —
# её же использует рантайм (сетка Pixi, две текстуры, альфа = t).
#   python3 design/mascot/morph.py check   — офлайн-проверка: полоска open→closed и метрика
#   python3 design/mascot/morph.py export  — public/mascot/eyes/<ключ>_<L|R>.png + flow.json
import json, os, sys
import numpy as np, cv2
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GEN = os.path.join(ROOT, 'design/mascot/gen')
EXP = os.path.join(ROOT, 'design/mascot/export')
EYES = {'L': (505, 405), 'R': (718, 405)}
BOX = 110  # полубокс области глаза, 1x
# цепочки кейформов: имя → файл (выровненный по оригиналу; None = сам оригинал)
KEYS = {
    'open': None, 'lids25': 'lids-25', 'lids50': 'lids-50', 'half': 'eyes-half', 'closed': 'eyes-closed',
    'sad': 'eyes-sad', 'happy': 'eyes-happy',
}
CHAINS = {'blink': ['open', 'lids25', 'lids50', 'half', 'closed'], 'sad': ['open', 'sad'], 'happy': ['open', 'happy']}


def load(key, S=1):
    f = KEYS[key]
    if f is None:
        p = os.path.join(ROOT, 'design/mascot/reference.png') if S == 1 else os.path.join(EXP, 'reference@4x.png')
    else:
        p = os.path.join(GEN, f + '-aligned.png') if S == 1 else os.path.join(GEN, f + '-aligned@4x.png')
    return np.asarray(Image.open(p).convert('RGB'))


def crop(img, k, S=1):
    cx, cy = EYES[k]
    return img[(cy - BOX) * S:(cy + BOX) * S, (cx - BOX) * S:(cx + BOX) * S]


def flow(a, b):
    """поток a→b (пиксели), DIS в режиме качества + сглаживание"""
    ga, gb = cv2.cvtColor(a, cv2.COLOR_RGB2GRAY), cv2.cvtColor(b, cv2.COLOR_RGB2GRAY)
    dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    dis.setFinestScale(0); dis.setPatchSize(8); dis.setPatchStride(3); dis.setGradientDescentIterations(25); dis.setVariationalRefinementIterations(10)
    f = dis.calc(ga, gb, None)
    return cv2.GaussianBlur(f, (0, 0), 2.0)


def warp(img, fl, t):
    """сдвинуть img на t·fl (обратное отображение: сэмплируем из img в точке p − t·fl(p))"""
    h, w = fl.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    mx = xx - t * fl[..., 0]; my = yy - t * fl[..., 1]
    return cv2.remap(img, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


def morph(a, b, fab, fba, t):
    """промежуточный кадр: a сдвинут вперёд на t, b — назад на (1−t), кроссфейд"""
    wa = warp(a, -fab, t)      # a к положению t
    wb = warp(b, -fba, 1 - t)  # b к положению t
    return (wa.astype(np.float32) * (1 - t) + wb.astype(np.float32) * t).astype(np.uint8)


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'check'
    if mode == 'check':
        strips = []
        for k in 'LR':
            seq = CHAINS['blink']
            ims = [crop(load(s), k) for s in seq]
            row = [ims[0]]
            for i in range(len(seq) - 1):
                a, b = ims[i], ims[i + 1]
                fab, fba = flow(a, b), flow(b, a)
                for t in (0.33, 0.66):
                    row.append(morph(a, b, fab, fba, t))
                row.append(b)
            strips.append(np.concatenate(row, axis=1))
            # метрика: морф open→lids50 в t=0.5 против настоящего lids25
            a, b, mid = crop(load('open'), k), crop(load('lids50'), k), crop(load('lids25'), k)
            m = morph(a, b, flow(a, b), flow(b, a), 0.5)
            xf = (a.astype(np.float32) * 0.5 + b.astype(np.float32) * 0.5).astype(np.uint8)
            print(f'eye {k}: |morph(open,lids50,.5) − lids25| = {np.abs(m.astype(int) - mid.astype(int)).mean():.2f}; чистый кроссфейд = {np.abs(xf.astype(int) - mid.astype(int)).mean():.2f}')
        Image.fromarray(np.concatenate(strips, axis=0)).save('/tmp/claude-0/shots/morph_check.png')
        print('strip saved')
