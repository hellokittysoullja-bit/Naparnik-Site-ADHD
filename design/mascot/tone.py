# Тон слоёв для сайта: акварельный серый на тёмном фоне выглядел блёклым. Контраст по
# серым (мех) растёт вокруг среднего тона, цветные пиксели (глаза, огонь, подушечки)
# почти не трогаются; в светах чуть тепла от огня, в тенях чуть холода.
# Применяется при нарезке слоёв (cut.py, from_gen.py) — в рантайме это бесплатно.
# Экспортные PNG (export.py) остаются «как в оригинале».
import numpy as np

PIVOT = 86.0
GAIN = 1.34
WARM = 8.0

def punch(c):
    c = np.asarray(c, dtype=np.float32)
    sat = c.max(-1) - c.min(-1)
    w = (1.0 - np.clip((sat - 35.0) / 45.0, 0, 1))[..., None]  # серые → 1, цветные → 0
    out = PIVOT + (c - PIVOT) * GAIN
    lum = c.mean(-1, keepdims=True)
    t = np.clip((lum - PIVOT) / 70.0, -1, 1)
    t = np.where(t < 0, t * 0.4, t)  # холод в тенях слабее, чем тепло в светах
    out[..., 0:1] += WARM * t
    out[..., 2:3] -= WARM * 0.8 * t
    return np.clip(c * (1 - w) + out * w, 0, 255)

def punch_rgb_tuple(rgb):
    """для констант в mascot-geometry.ts: то же преобразование для одного цвета"""
    return tuple(int(round(v)) for v in punch(np.array([[rgb]], dtype=np.float32))[0, 0])
