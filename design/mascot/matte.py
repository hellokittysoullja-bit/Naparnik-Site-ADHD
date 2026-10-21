# Вырезка кота из рисунка владельца (reference.png) без белой каймы — профессиональный
# подход для чернил на белой бумаге, а не нейросетевая «генерация»:
#  1. бумага = все белые компоненты, кроме бликов в глазах (единственный законный белый);
#  2. Remove White Matte: пиксель кромки = a*цвет + (1-a)*белый; a считается от самого тёмного
#     цвета рядом (ядро 7 px), цвет распремножается от белого — бледность бумаги уходит в alpha;
#  3. попиксельно: всё, что у кромки осталось светло-серым (бумага между волосками), получает
#     цвет ближайшего плотного меха — форма края не меняется, белого не остаётся;
#  4. edge padding: прозрачные пиксели красятся в цвет ближайшего видимого, чтобы билинейная
#     выборка (Rive/WebGL/масштабирование) никогда не подмешивала белый;
#  5. контроль цифрами: полупрозрачных белых/светло-серых пикселей — 0, блики глаз на месте.
# Запуск: python3 design/mascot/matte.py → design/mascot/export/naparnik-cat.png (+ -on-dark.png)
import numpy as np, sys
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
import os
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC=sys.argv[1] if len(sys.argv)>1 else os.path.join(ROOT,'design/mascot/reference.png')
OUT=os.path.join(ROOT,'design/mascot/export/')
NAME=sys.argv[2] if len(sys.argv)>2 else 'naparnik-cat'
S=int(sys.argv[3]) if len(sys.argv)>3 else 1  # масштаб относительно оригинала 1264×848
im=np.asarray(Image.open(SRC).convert('RGB')).astype(np.float64)/255
H,W,_=im.shape; lum=im.mean(2); sat=im.max(2)-im.min(2)
EYES=[(505*S,405*S),(718*S,405*S)]; RX,RY=57*S,60*S
yy,xx=np.mgrid[0:H,0:W]
in_eye=np.zeros((H,W),bool)
for cx,cy in EYES: in_eye|=((xx-cx)/RX)**2+((yy-cy)/RY)**2<=1
# 1. бумага: ВСЕ белые компоненты, кроме бликов в глазах (единственный законный белый)
white=lum>0.965
lab,n=ndi.label(white)
paper=np.zeros((H,W),bool)
for i in range(1,n+1):
    comp=lab==i
    if not in_eye[comp].mean()>0.5: paper|=comp
obj=~paper
print('paper components',n,'eye highlights kept',int(sum(1 for i in range(1,n+1) if in_eye[lab==i].mean()>0.5)))
# 2. Remove White Matte: пиксель = a*fg + (1-a)*белый. fg у кромки — самый тёмный цвет рядом (ядро 7px)
near=ndi.binary_dilation(paper,iterations=5*S)&obj
localdark=ndi.minimum_filter(lum,size=7*S)
localdark=np.clip(localdark,0.08,0.92)
a_edge=np.clip((1-lum)/(1-localdark),0,1)
alpha=np.where(paper,0.0,np.where(near,a_edge,1.0))
# блики и цветные пиксели у кромки (огонь) — не прозрачные: цвет, а не паперная бледность
colored=(sat>0.18)&near
alpha[colored]=np.maximum(alpha[colored],np.clip((1-lum[colored])*2.5,0,1))
a3=np.maximum(alpha,1e-3)[...,None]
fg=np.clip((im-(1-a3)*1.0)/a3,0,1)              # распремножение от белого
fg=np.where(alpha[...,None]>0.02,fg,im)
# 3. попиксельно: всё, что у кромки осталось светло-серым (бумага между волосками) → ближайший плотный мех
edge=ndi.distance_transform_edt(alpha>0.1)<=14*S
lg=((fg.mean(2)>0.45)&(sat<0.15)&edge&(alpha>0.02))&~in_eye
donor=(alpha>0.95)&(fg.mean(2)<0.5)&(fg.mean(2)>0.12)&(sat<0.2)&~ndi.binary_dilation(lg,iterations=2*S)
idx=ndi.distance_transform_edt(~donor,return_distances=False,return_indices=True)
fg[lg]=fg[idx[0][lg],idx[1][lg]]
# 4. edge padding: прозрачным пикселям — цвет ближайшего видимого, чтобы билинейная выборка не тянула белый
vis=alpha>0.02
idx2=ndi.distance_transform_edt(~vis,return_distances=False,return_indices=True)
fg=np.where(vis[...,None],fg,fg[idx2[0],idx2[1]])
# 5. лёгкое сглаживание альфы только в полосе кромки (без размытия контуров внутри)
a_s=np.asarray(Image.fromarray((alpha*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6*S)))/255
alpha=np.where(near|paper,a_s,alpha)
# 5б. отдельные карандашные точки у края, не связанные с котом (острова альфы < 60 px при 1x):
# не часть силуэта — убираем, иначе они читаются как светлая кайма
_lab,_n=ndi.label(alpha>0.02); _sz=np.bincount(_lab.ravel()); _keep=np.zeros(_n+1,bool); _keep[_sz>=60*S*S]=True; _keep[0]=False
_island=(alpha>0.02)&~_keep[_lab]
alpha=np.where(_island,0.0,alpha); print('isolated specks removed:',int(_island.sum()))
rgba=np.dstack([fg*255,alpha*255]).round().astype(np.uint8)
Image.fromarray(rgba,'RGBA').save(OUT+NAME+'.png')
# ── контроль ──
semi=(alpha>0.05)&(alpha<0.95); c=fg[semi]; cs=c.max(1)-c.min(1)
print('semi px',int(semi.sum()),'near-white',int((c.min(1)>0.85).sum()),'light grey',int(((c.mean(1)>0.6)&(cs<0.15)).sum()))
tr=fg[alpha<0.02]; print('transparent px RGB mean',(tr.mean(0)*255).round(1),'max lum',round(float(tr.mean(1).max()*255),1))
hl=(lum>0.965)&in_eye; print('eye highlight px before',int(hl.sum()),'after (alpha=1 & white)',int(((alpha>0.99)&(fg.min(2)>0.9)&in_eye).sum()))
def comp(arr,bg=(32,34,32)):
    b=Image.new('RGBA',(W,H),bg+(255,)); return Image.alpha_composite(b,Image.fromarray(arr,'RGBA')).convert('RGB')
ci=comp(rgba); ci.save(OUT+NAME+'-on-dark.png')
imc=np.asarray(ci).astype(int); bgc=imc[5,5]; isbg=np.abs(imc-bgc).sum(2)<10
lb,_=ndi.label(isbg); bd=set(np.unique(np.concatenate([lb[0],lb[-1],lb[:,0],lb[:,-1]])))-{0}; outer=np.isin(lb,list(bd))
din=ndi.distance_transform_edt(~outer); L=imc.mean(2); s=imc.max(2)-imc.min(2); band=(din>0)&(din<=3); light=band&(L>110)&(s<40)
print('band px',int(band.sum()),'light grey in 3px band',int(light.sum()),'ratio %.4f'%(light.sum()/band.sum()))
