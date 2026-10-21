# Честное увеличение рисунка кота ×4 (1264×848 → 5056×3392) супер-резолюшном Real-ESRGAN
# (модель x4plus_anime_6B — для рисованной графики), на CPU. Увеличивается ОРИГИНАЛ на белом,
# потом вырезка matte.py при S=4 — иначе SR размажет альфу и цвета кромки.
#   python3 design/mascot/upscale.py <веса.pth> → design/mascot/export/reference@4x.png
import os, sys, numpy as np
from PIL import Image
import torch
from basicsr.archs.rrdbnet_arch import RRDBNet
from realesrgan import RealESRGANer
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
model=RRDBNet(num_in_ch=3,num_out_ch=3,num_feat=64,num_block=6,num_grow_ch=32,scale=4)
up=RealESRGANer(scale=4,model_path=sys.argv[1],model=model,tile=256,tile_pad=16,pre_pad=0,half=False,device=torch.device('cpu'))
im=np.asarray(Image.open(os.path.join(ROOT,'design/mascot/reference.png')).convert('RGB'))[...,::-1]  # BGR, как ждёт RealESRGANer
out,_=up.enhance(im,outscale=4)
Image.fromarray(out[...,::-1]).save(os.path.join(ROOT,'design/mascot/export/reference@4x.png'))
print('ok',out.shape)
