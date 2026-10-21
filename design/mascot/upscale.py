# Честное увеличение рисунка кота ×4 (1264×848 → 5056×3392) супер-резолюшном Real-ESRGAN
# (веса x4plus_anime_6B — для рисованной графики), на CPU, без зависимостей basicsr/realesrgan:
# архитектура RRDBNet записана здесь целиком. Увеличивается ОРИГИНАЛ на белом, потом
# вырезка matte.py при S=4 — иначе SR размажет альфу и цвета кромки.
#   python3 design/mascot/upscale.py <RealESRGAN_x4plus_anime_6B.pth> → design/mascot/export/reference@4x.png
import os, sys, numpy as np, torch, torch.nn as nn, torch.nn.functional as F
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

class RDB(nn.Module):
    def __init__(self, nf=64, gc=32):
        super().__init__()
        self.conv1 = nn.Conv2d(nf, gc, 3, 1, 1); self.conv2 = nn.Conv2d(nf + gc, gc, 3, 1, 1)
        self.conv3 = nn.Conv2d(nf + 2 * gc, gc, 3, 1, 1); self.conv4 = nn.Conv2d(nf + 3 * gc, gc, 3, 1, 1)
        self.conv5 = nn.Conv2d(nf + 4 * gc, nf, 3, 1, 1); self.lrelu = nn.LeakyReLU(0.2, True)
    def forward(self, x):
        x1 = self.lrelu(self.conv1(x)); x2 = self.lrelu(self.conv2(torch.cat((x, x1), 1)))
        x3 = self.lrelu(self.conv3(torch.cat((x, x1, x2), 1))); x4 = self.lrelu(self.conv4(torch.cat((x, x1, x2, x3), 1)))
        return self.conv5(torch.cat((x, x1, x2, x3, x4), 1)) * 0.2 + x

class RRDB(nn.Module):
    def __init__(self, nf, gc):
        super().__init__(); self.rdb1 = RDB(nf, gc); self.rdb2 = RDB(nf, gc); self.rdb3 = RDB(nf, gc)
    def forward(self, x): return self.rdb3(self.rdb2(self.rdb1(x))) * 0.2 + x

class RRDBNet(nn.Module):
    def __init__(self, nf=64, nb=6, gc=32):
        super().__init__()
        self.conv_first = nn.Conv2d(3, nf, 3, 1, 1); self.body = nn.Sequential(*[RRDB(nf, gc) for _ in range(nb)])
        self.conv_body = nn.Conv2d(nf, nf, 3, 1, 1); self.conv_up1 = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_up2 = nn.Conv2d(nf, nf, 3, 1, 1); self.conv_hr = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_last = nn.Conv2d(nf, 3, 3, 1, 1); self.lrelu = nn.LeakyReLU(0.2, True)
    def forward(self, x):
        feat = self.conv_first(x); feat = self.conv_body(self.body(feat)) + feat
        feat = self.lrelu(self.conv_up1(F.interpolate(feat, scale_factor=2, mode='nearest')))
        feat = self.lrelu(self.conv_up2(F.interpolate(feat, scale_factor=2, mode='nearest')))
        return self.conv_last(self.lrelu(self.conv_hr(feat)))

sd = torch.load(sys.argv[1], map_location='cpu'); sd = sd.get('params_ema', sd.get('params', sd))
net = RRDBNet(); net.load_state_dict(sd, strict=True); net.eval()
im = np.asarray(Image.open(os.path.join(ROOT, 'design/mascot/reference.png')).convert('RGB')).astype(np.float32) / 255
H, W, _ = im.shape; T, P = 256, 16  # тайлы с нахлёстом, чтобы не съесть память
out = np.zeros((H * 4, W * 4, 3), np.float32)
x = torch.from_numpy(im).permute(2, 0, 1)[None]
with torch.no_grad():
    for y0 in range(0, H, T):
        for x0 in range(0, W, T):
            y1, x1 = min(H, y0 + T), min(W, x0 + T)
            py0, px0, py1, px1 = max(0, y0 - P), max(0, x0 - P), min(H, y1 + P), min(W, x1 + P)
            o = net(x[:, :, py0:py1, px0:px1])[0].permute(1, 2, 0).numpy()
            out[y0 * 4:y1 * 4, x0 * 4:x1 * 4] = o[(y0 - py0) * 4:(y1 - py0) * 4, (x0 - px0) * 4:(x1 - px0) * 4]
        print('row', y0, flush=True)
Image.fromarray((np.clip(out, 0, 1) * 255).round().astype(np.uint8)).save(os.path.join(ROOT, 'design/mascot/export/reference@4x.png'))
print('ok', out.shape)
