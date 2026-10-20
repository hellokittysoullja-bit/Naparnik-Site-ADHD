# Чистая прозрачность для рисунка на БЕЛОМ фоне (reference.png и сгенерированные позы).
# Рисунок = a*F + (1-a)*255, поэтому по каждому пикселю у края: цвет F берём у ближайшей
# твёрдой внутренней точки (bleed), а прозрачность a — из того, насколько пиксель темнее белого
# вдоль направления F. Так на краю не остаётся белой каймы (старая нарезка резала по порогу
# белого и красила кромку в светлое). Нужны numpy, scipy, opencv, Pillow.
import numpy as np
from scipy import ndimage as ndi
import cv2

EYE_KEEP = [(505, 405, 70, 73), (718, 405, 70, 73)]   # блики в глазах — единственное белое ВНУТРИ кота


def cutout(rgb, solid_mask, band_px=5, keep_white=EYE_KEEP):
    """rgb: HxWx3 uint8 на белом фоне. solid_mask: HxW bool — заведомо внутри кота (не фон).
    Возвращает (F float32 HxWx3, alpha float32 HxW)."""
    im = rgb.astype(np.float32)
    H, W = im.shape[:2]
    # белые «карманы» между прядями шерсти маска считает котом (проверено на ушах: белые
    # зубцы на тёмном фоне) — это бумага: белое вне глаз выбрасываем из твёрдой области
    yy, xx = np.mgrid[0:H, 0:W]
    keep = np.zeros((H, W), bool)
    for cx, cy, rx, ry in keep_white:
        keep |= ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1
    paper = (rgb.min(2) > 222) & ~keep
    solid_mask = solid_mask & ~ndi.binary_dilation(paper, iterations=1)
    inner = ndi.binary_erosion(solid_mask, iterations=band_px)          # твёрдо внутри
    outer = ndi.binary_dilation(solid_mask, iterations=band_px)         # дальше — только бумага
    # F: цвет ближайшей внутренней точки (с небольшим размытием, чтобы не тянуть шум штриха)
    idx = ndi.distance_transform_edt(~inner, return_distances=False, return_indices=True)
    F = im[idx[0], idx[1]]
    F = cv2.GaussianBlur(F, (0, 0), 1.2)
    F = np.where(inner[..., None], im, F)
    d = 255.0 - F
    num = ((255.0 - im) * d).sum(2)
    den = np.maximum((d * d).sum(2), 1e-3)
    a = np.clip(num / den, 0, 1)
    # у очень светлого F (блики, белые усы) формула неустойчива — там доверяем маске
    light = d.mean(2) < 18
    a = np.where(light, solid_mask.astype(np.float32), a)
    a = np.where(inner, 1.0, np.where(outer, a, 0.0)).astype(np.float32)
    # внутри твёрдой области цвет — исходный; у кромки — F (без белой примеси)
    out = np.where(inner[..., None], im, F)
    return out.astype(np.float32), a
