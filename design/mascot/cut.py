# Нарезка оригинального рисунка кота на слои cutout-рига (public/mascot/*.webp).
# Запуск: python3 design/mascot/cut.py (нужны numpy и Pillow). Координаты частей —
# в пикселях reference.png; те же координаты использует components/mascot-geometry.ts.
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import os
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC=os.path.join(ROOT,'design/mascot/reference.png')
OUT=os.path.join(ROOT,'public/mascot/')
im=np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32)
H,W=im.shape[:2]
mn=im.min(2)
# фон = почти белое, СВЯЗАННОЕ с краем (заливка от углов) — блики в глазах не трогаем
nw=Image.fromarray(((mn>205)*255).astype(np.uint8),'L').copy()  # copy: fromarray read-only, floodfill молча не работает
for c in [(0,0),(W-1,0),(0,H-1),(W-1,H-1)]: ImageDraw.floodfill(nw,c,128)
# карман между хвостом и телом не связан с краем — заливаем крупные белые пятна
for sy in range(0,H,12):
    for sx in range(0,W,12):
        if nw.getpixel((sx,sy))==255:
            before=np.asarray(nw).copy()
            ImageDraw.floodfill(nw,(sx,sy),60)
            area=(np.asarray(nw)==60).sum()
            if area>1500:
                arr=np.asarray(nw).copy(); arr[arr==60]=128; nw=Image.fromarray(arr,'L').copy()
            else:
                arr=np.asarray(nw).copy(); arr[arr==60]=200; nw=Image.fromarray(arr,'L').copy()
bg=np.asarray(nw)==128
near=np.asarray(Image.fromarray((bg*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9)))>0
soft=np.clip((248-mn)/38,0,1)
alpha=np.where(bg,0,np.where(near,soft,1.0)).astype(np.float32)
a3=alpha[...,None]
rgb=np.clip(np.where(a3>0.02,(im-(1-a3)*255)/np.maximum(a3,0.02),0),0,255)

def poly(pts, feather=0):
    m=Image.new('L',(W,H),0); ImageDraw.Draw(m).polygon(pts,fill=255)
    if feather: m=m.filter(ImageFilter.GaussianBlur(feather))
    return np.asarray(m).astype(np.float32)/255

def boxblur(x,r):
    x=x.astype(np.float64)
    k=2*r+1
    p=np.pad(x,((r,r),(r,r))+((0,0),)*(x.ndim-2),mode='edge')
    c=np.cumsum(np.cumsum(p,0),1)
    c=np.pad(c,((1,0),(1,0))+((0,0),)*(x.ndim-2))
    return (c[k:,k:]-c[:-k,k:]-c[k:,:-k]+c[:-k,:-k])/(k*k)

def inpaint(img, hole, iters=40, valid=None):
    """заливка дыры от краёв внутрь (нормированная свёртка): каждый проход
    заполняет кольцо у границы и расширяет «известную» область"""
    known=(~hole).astype(np.float64)
    if valid is not None: known=known*valid  # прозрачный фон не донор цвета
    out=img.astype(np.float64).copy()
    for _ in range(200):
        if known.min()>=1: break
        num=boxblur(out*known[...,None],4); den=boxblur(known,4)
        newly=(known<1)&(den>0.15)
        fill=num/np.maximum(den,1e-6)[...,None]
        out=np.where(newly[...,None],fill,out)
        known=np.where(newly,1.0,known)
    # сгладить латку, чтобы не было «волн» от колец
    sm=boxblur(out,3)
    out=np.where(hole[...,None],sm,out)
    return out.astype(np.float32)

def save(name, rgbx, a, box):
    x0,y0,x1,y1=box
    arr=np.dstack([rgbx[y0:y1,x0:x1],np.clip(a[y0:y1,x0:x1],0,1)*255]).astype(np.uint8)
    img=Image.fromarray(arr,'RGBA')
    img=img.resize(((x1-x0)//2,(y1-y0)//2),Image.LANCZOS)  # 50%: хватает для 2x DPR до ~300px
    img.save(OUT+name+'.webp','WEBP',quality=88,method=6)
    print(name, box, img.size)

# ── разметка частей (координаты исходника 1264×848) ──
TAIL=[(925,255),(1160,255),(1160,790),(800,790),(800,655),(860,640),(935,560),(915,470)]
tail=poly(TAIL,2)
FLAME=poly([(915,262),(1030,262),(1030,410),(985,422),(950,418),(915,395)],2)
CURL_SPLIT=poly([(880,240),(1160,240),(1160,575),(880,575)],14)  # верх хвоста: завиток
EAR_L=poly([(370,140),(500,120),(560,215),(545,240),(470,262),(400,268),(372,230)],5)
EAR_R=poly([(640,215),(700,150),(790,100),(825,150),(830,265),(780,268),(700,250)],5)
HEAD=poly([(250,90),(900,90),(915,470),(935,560),(880,600),(820,588),(700,598),(600,602),(470,596),(400,590),(250,590)],10)
ARM=poly([(428,612),(560,612),(566,700),(560,770),(420,770),(418,700)],3)
body_zone=poly([(250,520),(1000,520),(1000,800),(250,800)],10)

notail=1-tail
# хвост: основание и завиток с огоньком отдельно (завиток отстаёт, огонь пляшет)
save('tail-base', rgb, alpha*tail*(1-CURL_SPLIT), (780,430,1160,790))
save('tail-curl', rgb, alpha*tail*CURL_SPLIT*(1-FLAME), (880,250,1160,600))
save('flame', rgb, alpha*FLAME, (905,255,1040,430))

# уши
save('ear-l', rgb, alpha*EAR_L*notail, (360,110,570,280))
save('ear-r', rgb, alpha*EAR_R*notail, (630,95,840,280))

# глаза: радужка без зрачка + зрачок с бликом отдельно
yy,xx=np.mgrid[0:H,0:W]
def ell(cx,cy,rx,ry): return ((xx-cx)/rx)**2+((yy-cy)/ry)**2<=1
EYES={'l':(505,405,64,67),'r':(718,405,64,67)}
eye_rgb=rgb.copy()
for k,(cx,cy,rx,ry) in EYES.items():
    inner=ell(cx,cy,rx-9,ry-9)
    lum=im.mean(2)
    pupil=inner & (lum<90)
    hl=inner & (mn>200) & ell(cx+20,cy-25,22,22)
    pmask=Image.fromarray(((pupil|hl)*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1))
    pm=np.asarray(pmask).astype(np.float32)/255*inner
    save('pupil-'+k, rgb, pm, (cx-40,cy-60,cx+40,cy+60))
    hole=(np.asarray(pmask)>10)&inner
    eye_rgb=inpaint(eye_rgb, hole, 40)
headA=alpha*HEAD*notail*(1-np.maximum(EAR_L,EAR_R)*0.0)
# голова без ушей (уши — свои слои), с перекрытием у основания
ear_cut=np.maximum(poly([(370,140),(500,120),(540,190),(470,215),(400,225),(372,200)],5),
                   poly([(650,190),(700,150),(790,100),(825,150),(828,215),(780,222),(700,205)],5))
save('head', eye_rgb, alpha*HEAD*notail*(1-ear_cut), (250,180,920,610))

# тело: без хвоста, без головы сверху, без лапы (лапа — свой слой), дыра залатана мехом
arm_hole=ARM>0.5
body_rgb=inpaint(rgb, arm_hole, 40, valid=(alpha>0.6))
bodyA=alpha*notail*body_zone
save('body', body_rgb, bodyA, (380,500,860,790))
PAW=poly([(440,676),(470,662),(530,662),(556,680),(560,725),(550,760),(500,768),(445,760),(436,725)],2)
save('leg', rgb, alpha*ARM*(1-PAW), (410,600,575,700))
save('paw', rgb, alpha*PAW, (430,655,565,775))
fur=rgb[290:310,480:530].reshape(-1,3).mean(0); print('FUR', fur.round())


# ── мимика из пикселей самого рисунка ──
# веко = мех рисунка, которым залатан глаз; закрытый глаз = этот мех +
# родная нижняя дуга тушевой обводки глаза; улыбка = родной рот «ω»
lum=im.mean(2)
for k,(cx,cy,rx,ry) in EYES.items():
    big=ell(cx,cy,rx+8,ry+8)
    furfill=inpaint(rgb, big, 40, valid=(alpha>0.6)&~big)
    m=Image.fromarray((ell(cx,cy,rx+10,ry+10)*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))
    save('eyefur-'+k, furfill, np.asarray(m).astype(np.float32)/255, (cx-80,cy-80,cx+80,cy+80))
    ring=ell(cx,cy,rx+12,ry+12)&~ell(cx,cy,rx-14,ry-14)&(yy>cy+18)&(lum<90)
    rm=Image.fromarray((ring*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    save('eyearc-'+k, rgb, np.asarray(rm).astype(np.float32)/255, (cx-80,cy-80,cx+80,cy+80))
MB=(572,466,658,508)
mbox=np.zeros((H,W),bool); mbox[MB[1]:MB[3],MB[0]:MB[2]]=True
mline=mbox&(lum<95)
mm=Image.fromarray((mline*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
save('mouth', rgb, np.asarray(mm).astype(np.float32)/255, MB)
hole=np.asarray(Image.fromarray((mline*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9)))>0
mfur=inpaint(rgb, hole, 40, valid=(alpha>0.6)&~hole)
pm=np.zeros((H,W),np.float32); pm[MB[1]-6:MB[3]+6,MB[0]-8:MB[2]+8]=1
pm=np.asarray(Image.fromarray((pm*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4))).astype(np.float32)/255
save('mouthfur', mfur, pm, (MB[0]-16,MB[1]-14,MB[2]+16,MB[3]+14))
