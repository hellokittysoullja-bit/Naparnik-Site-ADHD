# Экспорт кота в PNG с прозрачным фоном (design/mascot/export/*.png).
# Запуск: python3 design/mascot/export.py  (numpy, Pillow, scipy)
# Исходник маленький (края пикселизованы «ступеньками»), поэтому альфа считается на
# увеличенной копии: Lanczos в premultiplied-пространстве, затем сглаживание маски и
# возврат чёткого края (smoothstep) — ступеньки превращаются в гладкую линию.
import os, numpy as np
from PIL import Image
from scipy import ndimage as ndi
HERE=os.path.dirname(os.path.abspath(__file__))
ns={'__file__':os.path.join(HERE,'cut.py')}
src=open(os.path.join(HERE,'cut.py')).read()
exec(compile(src[:src.index('def poly(')],'cut_head','exec'),ns)
alpha=ns['alpha'];rgb=ns['rgb']
ys,xs=np.nonzero(alpha>0.02); pad=12
x0,x1=max(xs.min()-pad,0),min(xs.max()+pad+1,alpha.shape[1]); y0,y1=max(ys.min()-pad,0),min(ys.max()+pad+1,alpha.shape[0])
a=np.clip(alpha[y0:y1,x0:x1],0,1).astype(np.float32); c=np.clip(rgb[y0:y1,x0:x1],0,255).astype(np.float32)
h,w=a.shape
OUT=os.path.join(HERE,'export'); os.makedirs(OUT,exist_ok=True)

def up(arr,k):
    return np.asarray(Image.fromarray(arr.astype(np.float32),'F').resize((w*k,h*k),Image.BICUBIC))

def render(k, ss=4):
    """готовит кадр размера k·(w,h) из сглаженной копии в ss-кратном размере"""
    S=ss
    pm=[up(c[...,i]*a,S) for i in range(3)]; A=np.clip(up(a,S),0,1)
    # сглаживаем край маски и возвращаем контраст: ступеньки → плавная линия
    A=ndi.gaussian_filter(A,1.1*S/2)
    A=np.clip((A-0.35)/0.30,0,1); A=A*A*(3-2*A)
    # цвет у кромки берём изнутри (premultiplied → un-premultiply на исходной маске), затем растягиваем наружу
    A0=np.clip(up(a,S),1e-3,1)
    col=np.stack([np.clip(p/A0,0,255) for p in pm],-1)
    solid=A0>0.6
    idx=ndi.distance_transform_edt(~solid,return_distances=False,return_indices=True)
    col=col[idx[0],idx[1]]
    # вниз до целевого размера (area), в premultiplied
    f=S/k
    def down(z):
        return np.asarray(Image.fromarray(z.astype(np.float32),'F').resize((w*k,h*k),Image.LANCZOS if f>1 else Image.BICUBIC))
    Ad=np.clip(down(A),0,1)
    cd=np.stack([down(col[...,i]*A) for i in range(3)],-1)
    cd=np.where(Ad[...,None]>1e-3,cd/np.maximum(Ad[...,None],1e-3),0)
    return Image.fromarray(np.dstack([np.clip(cd,0,255),Ad*255]).astype(np.uint8),'RGBA')

for k,name in ((1,'naparnik-cat.png'),(2,'naparnik-cat@2x.png'),(4,'naparnik-cat@4x.png')):
    im=render(k); im.save(os.path.join(OUT,name),optimize=True); print(name,im.size)
