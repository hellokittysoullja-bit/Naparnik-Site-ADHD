# Объективный аудит записанного тура куклы (кадры из покадровой записи, см. docs/mascot.md):
#  — скачки: изолированные всплески межкадровой разницы (поп = разница без соседей; быстрые движения
#    вроде прыжка дают плавный горб, не всплеск);
#  — «никогда не замирает»: кадров с разницей < 0.05 быть не должно;
#  — щели между частями: замкнутые области фона 40..3000 px внутри силуэта (петля хвоста — больше);
#  — кромка: светло-серые пиксели в 2 px снаружи силуэта.
#   python3 design/mascot/audit.py /tmp/claude-0/cast4 [число_отладочных_кадров_в_конце]
import glob, sys
import numpy as np
from PIL import Image
from scipy.ndimage import label, binary_dilation

files = sorted(glob.glob(sys.argv[1] + "/f*.jpg"))
skip = int(sys.argv[2]) if len(sys.argv) > 2 else 0
files = files[: len(files) - skip]
prev = None; diffs = []; holes = []; fringe = []
for f in files:
    im = np.asarray(Image.open(f).convert("RGB")).astype(int); bg = im[3, 3]
    if prev is not None:
        diffs.append(float(np.abs(im - prev).mean()))
    prev = im
    isbg = np.abs(im - bg).sum(2) < 30
    lab, n = label(isbg)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    sizes = np.bincount(lab.ravel())
    holes.append(sum(int(sizes[k]) for k in range(1, n + 1) if k not in border and 40 <= sizes[k] < 3000))
    L = im.mean(2); s = im.max(2) - im.min(2)
    outer = np.isin(lab, list(border)); near = binary_dilation(outer, iterations=2) & ~outer
    fringe.append(int((near & (L > 120) & (s < 40)).sum()))
d = np.array(diffs)
spike = np.array([d[i] - 0.5 * (d[i - 1] + d[i + 1]) for i in range(1, len(d) - 1)])
print("frames", len(files))
print("frame diff: mean %.2f, p95 %.2f" % (d.mean(), np.percentile(d, 95)))
print("isolated pops (spike > 5):", [(int(i) + 2, round(float(spike[i]), 1)) for i in np.nonzero(spike > 5)[0]])
print("fully still frames (diff < 0.05):", int((d < 0.05).sum()))
print("small enclosed holes: max %d px, frames with any: %d" % (max(holes), sum(1 for h in holes if h > 0)))
print("silhouette fringe: mean %.1f px/frame, max %d" % (np.mean(fringe), max(fringe)))
