# Риг кота для Rive: иерархия узлов/костей, анимации и слоистая state machine
# (как у Duolingo: idle / моргание / взгляд / эмоция / рот / действие / реакции — параллельные слои).
# Запуск: python3 design/mascot/rive/cat.py && rive design/mascot/rive --once
import math, os, random, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build as B  # noqa: E402
from rmlkit import El, Anim, node, nid  # noqa: E402

rad = math.radians
K = 4.55
random.seed(7)

# ───────────────────────── иерархия ─────────────────────────
art, cat = B.build()
G, NK = B.GROUND, B.NECK

root_pos = cat.sub("RootPos", *G)
root = root_pos.sub("Root", *G)  # прыжок / сжатие / вздох (x,y ключуются от нуля)
# тень — отдельно от Root: у земли, повторяет прыжок через свои ключи

# (порядок: первый ребёнок — сверху)
front_breathe = root.sub("BreatheFront", *G)
arm = front_breathe.sub("Arm", *B.SHOULDER)
paw_rot = arm.sub("Paw", *B.PAW_C)
paw = paw_rot.sub("PawBob", *B.PAW_C)  # y ключуется от нуля
paw.img("paw")
arm.img("leg")

ride = root.sub("Ride", *G)
neck_pos = ride.sub("NeckPos", *NK)
neck = neck_pos.sub("Neck", *NK)  # поворот/сдвиг за взглядом: ключи от нуля
dip = neck.sub("Dip", *NK)  # проседание головы при моргании


def eye_side(side):
    ex, ey = B.EYE_L if side == "l" else B.EYE_R
    k = side
    # порядок сверху вниз: закрытые (моргание), закрытые (сон), полуприкрытые, глаз внутри маски
    n = {}
    n["blink_closed"] = dip.img(f"eyeClosed{k.upper()}", f"BlinkClosed{k.upper()}", opacity=0)
    n["sleep_closed"] = dip.img(f"eyeClosed{k.upper()}", f"SleepClosed{k.upper()}", opacity=0)
    n["blink_half"] = dip.img(f"eyeHalf{k.upper()}", f"BlinkHalf{k.upper()}", opacity=0)
    n["yawn_half"] = dip.img(f"eyeHalf{k.upper()}", f"YawnHalf{k.upper()}", opacity=0)
    clip_node = dip.sub(f"EyeClip{k.upper()}", ex, ey)
    n["clip"] = clip_node
    # узел для ширины Mask: эллипс радужки (без заливки — только геометрия клипа)
    mask = El("Shape", f"EyeMask{k.upper()}", x=ex - dip.wx, y=ey - dip.wy)
    mask.add(El("Ellipse", "P", width=B.EYE_RX * 2, height=B.EYE_RY * 2, _id=False))
    dip.el.add(mask)
    clip_node.el.add(El("ClippingShape", "Clip", sourceId=mask.id))
    lid = clip_node.sub(f"Lid{k.upper()}", ex, ey - B.EYE_RY - 6, scaleY=0)
    lid.img(f"eyeFur{k.upper()}")
    n["lid"] = lid.el
    pupil_pos = clip_node.sub(f"PupilPos{k.upper()}", ex, ey)
    pupil_blink = pupil_pos.sub(f"PupilBlink{k.upper()}", ex, ey)
    pupil_emo = pupil_blink.sub(f"PupilEmo{k.upper()}", ex, ey)
    pupil_emo.img(f"pupil{k.upper()}")
    n["pupil_pos"], n["pupil_blink"], n["pupil_emo"] = pupil_pos.el, pupil_blink.el, pupil_emo.el
    return n


# рот: сверху вниз открытый, «о», улыбка, плоский, мех-латка; родное «ω» — часть головы
mouth = {}
mouth["open"] = dip.img("mouthOpen", "MouthOpen", opacity=0)
mouth["o"] = dip.img("mouthO", "MouthO", opacity=0)
ms = dip.sub("MouthSmile", 615, 470, scaleX=1.32, scaleY=1.55, opacity=0)
ms.img("mouth")
mf = dip.sub("MouthFlat", 615, 470, scaleX=0.8, scaleY=0.55, opacity=0)
mf.img("mouth")
mouth["smile"], mouth["flat"] = ms.el, mf.el
mouth["fur"] = dip.img("mouthFur", "MouthFur", opacity=0)

eyes = {"l": eye_side("l"), "r": eye_side("r")}

head_img = dip.img("head")
ear_r_tw = dip.sub("EarRTwitch", *B.EAR_R)
ear_r_pose = ear_r_tw.sub("EarRPose", *B.EAR_R)
ear_r_pose.img("earR")
ear_l_tw = dip.sub("EarLTwitch", *B.EAR_L)
ear_l_pose = ear_l_tw.sub("EarLPose", *B.EAR_L)
ear_l_pose.img("earL")

body_breathe = root.sub("BreatheBody", *G)
body_breathe.img("body")

tail_p = root.sub("TailRig", 0, 0)
tail_bones = B.bone_chain(tail_p, B.TAIL_J, "tail")
B.skinned_image(tail_p, "tail", B.TAIL_J, tail_bones)

# огонёк — на кончике последней кости
last_el, last_ang = tail_bones[-1]
jx, jy = B.TAIL_J[-1]
fx, fy = B.TAIL_J[-2]
fl = B.LAYERS["flame"]
FL_PIV = (972, 415)
dx, dy = FL_PIV[0] - fx, FL_PIV[1] - fy  # опора огонька в системе кости (начало — сустав fx,fy)
ca, sa = math.cos(-last_ang), math.sin(-last_ang)
flame_node = node("Flame", dx * ca - dy * sa, dx * sa + dy * ca, rotation=round(-last_ang, 6))
flame_img = El("Image", "flame", x=fl["x"] - FL_PIV[0], y=fl["y"] - FL_PIV[1], originX=0, originY=0, assetId=B.asset("flame").id)
flame_node.add(flame_img)
last_el.add(flame_node)

# тень: три слоя + пятна контакта, мягкость — Feather
sh = node("Shadow", 640, 774)
sh_parts = []
for cx, cy, rx, ry, op, blur in [(650, 780, 390, 40, 0.30, 22), (900, 778, 210, 15, 0.34, 9), (625, 774, 270, 17, 0.50, 9),
                                 (500, 770, 78, 9, 0.62, 3.2), (712, 770, 78, 9, 0.62, 3.2)]:
    s = El("Shape", "S", x=cx - 640, y=cy - 774)
    s.add(El("Ellipse", "P", width=rx * 2, height=ry * 2, _id=False))
    f = El("Fill", "F", _id=False)
    f.add(El("SolidColor", "C", colorValue="FF08080C", _id=False))
    f.add(El("Feather", "Blur", strength=round(blur * 2, 2), _id=False))
    s.add(f)
    s.kw["opacity"] = op
    sh.add(s)
cat.el.add(sh)

# ───────────────────────── анимации ─────────────────────────
anims = []


def A(name, secs, loop="oneShot"):
    a = Anim(name, secs, loop)
    anims.append(a)
    return a


def sine_track(a, obj, prop, amp, period, phase=0.0, base=0.0, n=24):
    fr = []
    for i in range(n + 1):
        t = period * i / n
        fr.append((t, round(base + amp * math.sin(2 * math.pi * (i / n) - phase), 5), "lin"))
    a.key(obj, prop, fr)


# — дыхание: вдох короче выдоха, удержание на пике; голова отстаёт (follow-through)
T = 4.6
a = A("idle_breathe", T, "loop")
a.key(body_breathe.el, "scaleX", [(0, 1, "soft"), (T * 0.40, 1.008, None), (T * 0.50, 1.008, "soft"), (T, 1, None)])
a.key(body_breathe.el, "scaleY", [(0, 1, "soft"), (T * 0.40, 1.026, None), (T * 0.50, 1.026, "soft"), (T, 1, None)])
a.key(front_breathe.el, "scaleX", [(0, 1, "soft"), (T * 0.40, 1.008, None), (T * 0.50, 1.008, "soft"), (T, 1, None)])
a.key(front_breathe.el, "scaleY", [(0, 1, "soft"), (T * 0.40, 1.026, None), (T * 0.50, 1.026, "soft"), (T, 1, None)])
d = 0.14
a.key(ride.el, "y", [(0, 0, "soft"), (T * 0.42 + d, -7, None), (T * 0.52 + d, -7, "soft"), (T, 0, None)])

# — хвост: волна по цепочке, период не кратен дыханию (7.4 против 4.6)
TT = 7.4
a = A("tail_sway", TT, "loop")
for i, (b_el, _) in enumerate(tail_bones[1:], start=1):
    sine_track(a, b_el, "rotation", rad(1.5 + i * 0.55), TT, phase=i * 0.42 * 2 * math.pi / TT * 1.0, base=b_el.kw["rotation"], n=28)
a = A("tail_excited", 1.2, "loop")
for i, (b_el, _) in enumerate(tail_bones[1:], start=1):
    sine_track(a, b_el, "rotation", rad(3.2 + i * 1.1), 1.2, phase=i * 0.6, base=b_el.kw["rotation"], n=16)

# — моргание: полуприкрыт → закрыт → полуприкрыт → открыт (кадры сгенерированы по рисунку)
def blink_keys(a, t0=0.0, slow=False):
    if slow:
        steps = [(0.0, 0, 0), (0.09, 1, 0), (0.18, 0, 1), (0.50, 0, 1), (0.60, 1, 0), (0.75, 0, 0)]
    else:
        steps = [(0.0, 0, 0), (0.030, 1, 0), (0.060, 0, 1), (0.115, 0, 1), (0.150, 1, 0), (0.200, 0, 0)]
    return [(t0 + t, h, c) for t, h, c in steps]


def make_blink(name, kind):
    if kind == "slow":
        seq, dur = blink_keys(None, 0, True), 0.9
    elif kind == "double":
        s1 = blink_keys(None, 0)
        s2 = blink_keys(None, 0.33)
        seq, dur = s1 + s2, 0.6
    else:
        seq, dur = blink_keys(None, 0), 0.3
    a = A(name, dur)
    ease = "lin"
    for side in "lr":
        e = eyes[side]
        a.key(e["blink_half"], "opacity", [(t, h, ease) for t, h, c in seq] + [(dur, 0, None)])
        a.key(e["blink_closed"], "opacity", [(t, c, ease) for t, h, c in seq] + [(dur, 0, None)])
        # после смыкания зрачок расширился — открывается шире и сужается с перелётом
        end = seq[-1][0]
        a.key(e["pupil_blink"], "scaleX", [(0, 1, "lin"), (end, 1.1, "out"), (end + 0.14, 0.96, "out"), (end + 0.32, 1, None)])
        a.key(e["pupil_blink"], "scaleY", [(0, 1, "lin"), (end, 1.1, "out"), (end + 0.14, 0.96, "out"), (end + 0.32, 1, None)])
    # лицо тоже моргает: голова чуть проседает
    depth = 2 * K
    a.key(dip.el, "y", [(0, 0, "out"), (0.07 if kind != "slow" else 0.2, depth, "io"), (0.2 if kind != "slow" else 0.62, 0, None)])
    a.key(dip.el, "scaleY", [(0, 1, "out"), (0.07 if kind != "slow" else 0.2, 0.992, "io"), (0.2 if kind != "slow" else 0.62, 1, None)])
    return a


blink_n = make_blink("blink", "normal")
blink_s = make_blink("blink_slow", "slow")
blink_d = make_blink("blink_double", "double")
for nm, secs in (("blink_open_a", 2.3), ("blink_open_b", 3.4), ("blink_open_c", 4.8), ("blink_open_d", 6.5)):
    A(nm, secs)  # паузы между морганиями: без ключей, только длительность


# — взгляд: зрачки (1D-блеск по оси) + голова чуть едет за глазами
def gaze_axis(prefix, axis, amp, head_amp=0.0):
    out = []
    for nm, f in ((f"{prefix}_neg", -1), (f"{prefix}_0", 0), (f"{prefix}_pos", 1)):
        a = A(nm, 0.1, "loop")
        for side in "lr":
            a.key(eyes[side]["pupil_pos"], axis, [(0, f * amp, None)])
        if head_amp:
            a.key(neck.el, axis, [(0, f * head_amp, None)])
        out.append(a)
    return out


gaze_x = gaze_axis("gaze_x", "x", 5 * K, 4.0)
gaze_y = gaze_axis("gaze_y", "y", 4 * K, 0.0)
tilts = []
for nm, f in (("tilt_neg", -1), ("tilt_0", 0), ("tilt_pos", 1)):
    a = A(nm, 0.1, "loop")
    a.key(neck.el, "rotation", [(0, rad(10) * f, None)])
    tilts.append(a)

# — эмоции: каждая анимация держит ВЕСЬ свой набор свойств (иначе прошлое выражение «залипнет»)
EMO = {
    "calm": dict(lid=0, el=0, er=0, ps=1, sleep=0),
    "happy": dict(lid=0, el=0, er=0, ps=1.06, sleep=0),
    "focused": dict(lid=0.34, el=0, er=0, ps=1, sleep=0),
    "sleepy": dict(lid=0, el=-8, er=8, ps=1, sleep=1),
    "excited": dict(lid=0, el=0, er=0, ps=1.18, sleep=0),
    "listening": dict(lid=0, el=4, er=-4, ps=1, sleep=1),
}
emo_anims = []
for nm, v in EMO.items():
    a = A(f"emo_{nm}", 0.5, "loop")
    for side in "lr":
        e = eyes[side]
        a.key(e["lid"], "scaleY", [(0, v["lid"], None)])
        a.key(e["pupil_emo"], "scaleX", [(0, v["ps"], None)])
        a.key(e["pupil_emo"], "scaleY", [(0, v["ps"], None)])
        a.key(e["sleep_closed"], "opacity", [(0, v["sleep"], None)])
    a.key(ear_l_pose.el, "rotation", [(0, rad(v["el"]), None)])
    a.key(ear_r_pose.el, "rotation", [(0, rad(v["er"]), None)])
    emo_anims.append(a)

# — рот
MOUTHS = {  # opacity: open, o, smile, flat, fur
    "w": (0, 0, 0, 0, 0), "smile": (0, 0, 1, 0, 1), "flat": (0, 0, 0, 1, 1), "open": (1, 0, 0, 0, 0), "o": (0, 1, 0, 0, 0),
}
mouth_anims = []
for nm, vals in MOUTHS.items():
    a = A(f"mouth_{nm}", 0.5, "loop")
    for key, v in zip(("open", "o", "smile", "flat", "fur"), vals):
        a.key(mouth[key], "opacity", [(0, v, None)])
    mouth_anims.append(a)

# — ухо дёргается то левое, то правое (асимметрия живее синхрона)
ear_tw_l = A("ear_twitch_l", 0.5)
ear_tw_l.key(ear_l_tw.el, "rotation", [(0, 0, "out"), (0.125, rad(-13), "out"), (0.3, rad(3), "out"), (0.5, 0, None)])
ear_tw_r = A("ear_twitch_r", 0.5)
ear_tw_r.key(ear_r_tw.el, "rotation", [(0, 0, "out"), (0.125, rad(13), "out"), (0.3, rad(-3), "out"), (0.5, 0, None)])
ear_rest = A("ear_rest", 0.2, "loop")
ear_rest.key(ear_l_tw.el, "rotation", [(0, 0, None)])
ear_rest.key(ear_r_tw.el, "rotation", [(0, 0, None)])
for nm, secs in (("ear_wait_a", 7.0), ("ear_wait_b", 10.5), ("ear_wait_c", 14.0)):
    A(nm, secs)

# — действия
WAVE_T = [0, 0.09, 0.27, 0.39, 0.51, 0.63, 0.75, 0.86, 1]
WAVE_ARM = [0, -7, 124, 110, 128, 110, 126, 116, 0]
WAVE_PAW = [0, 6, -136, -104, -144, -104, -140, -122, 0]
WAVE_EASE = ["out", "over", "io", "io", "io", "io", "io", "io"]
WD = 2.8


def wave_track(a, scale_t=1.0, t0=0.0):
    a.key(arm.el, "rotation", [(t0 + t * WD, rad(v), (WAVE_EASE[i] if i < len(WAVE_EASE) else None)) for i, (t, v) in enumerate(zip(WAVE_T, WAVE_ARM))])
    a.key(paw_rot.el, "rotation", [(t0 + t * WD, rad(v), (WAVE_EASE[i] if i < len(WAVE_EASE) else None)) for i, (t, v) in enumerate(zip(WAVE_T, WAVE_PAW))])
    a.key(paw.el, "y", [(t0, 0, None)])


act_idle = A("act_idle", 0.5, "loop")
act_idle.key(arm.el, "rotation", [(0, 0, None)])
act_idle.key(paw_rot.el, "rotation", [(0, 0, None)])
act_idle.key(paw.el, "y", [(0, 0, None)])
act_idle.key(root.el, "y", [(0, 0, None)])
act_idle.key(root.el, "scaleX", [(0, 1, None)])
act_idle.key(root.el, "scaleY", [(0, 1, None)])

act_wave = A("act_wave", WD)
wave_track(act_wave)

# пишет: рука качается от плеча, кисть подрагивает вверх-вниз (почерк)
WN, WRITE_D, WEND = 44, 3.6, 0.64
wt, warm, wpaw = [], [], []
for i in range(WN):
    u = i / (WN - 1)
    ease = 2 * u * u if u < 0.5 else 1 - (-2 * u + 2) ** 2 / 2
    theta = 11 - 20 * ease
    wy = -1.7 * K * math.sin(u * math.pi * 2 * 5.5) * (0.7 + 0.3 * math.sin(u * 9))
    wt.append(u * WEND); warm.append(theta); wpaw.append(wy)
wt += [0.72, 0.82, 0.88, 1]; warm += [4, 11, 11, 11]; wpaw += [-5 * K, -4 * K, 0, 0]
act_write = A("act_write", WRITE_D, "loop")
act_write.key(arm.el, "rotation", [(t * WRITE_D, rad(v), "lin") for t, v in zip(wt, warm)])
act_write.key(paw.el, "y", [(t * WRITE_D, v, "lin") for t, v in zip(wt, wpaw)])
act_write.key(paw_rot.el, "rotation", [(0, 0, None)])

act_think = A("act_think", 0.5, "loop")
act_think.key(arm.el, "rotation", [(0, 0, None)])

# радуется: присел → прыжок с вытяжкой → приземление со сжатием → settle (два прыжка)
act_cel = A("act_celebrate", 2.55)
J_T = [0, 0.16, 0.42, 0.62, 0.8, 1]
J_Y = [0, 2.5 * K, -20 * K, 0, -7 * K, 0]
J_SY = [1, 0.88, 1.08, 0.9, 1.03, 1]
J_SX = [1, 1.08, 0.95, 1.08, 0.99, 1]
for prop, vals in (("y", J_Y), ("scaleY", J_SY), ("scaleX", J_SX)):
    fr = []
    for rep, t0 in enumerate((0.0, 1.4)):
        for i, (t, v) in enumerate(zip(J_T, vals)):
            if rep == 1 and i == 0:
                continue
            fr.append((t0 + t * 1.15, v, "out"))
    fr[-1] = (fr[-1][0], fr[-1][1], None)
    act_cel.key(root.el, prop, fr)
wave_track(act_cel)
# тень повторяет прыжок: выше кот — меньше, светлее, мягче
sh_t, sh_s, sh_o = [], [], []
for rep, t0 in enumerate((0.0, 1.4)):
    for i, (t, y) in enumerate(zip(J_T, J_Y)):
        if rep == 1 and i == 0:
            continue
        k = max(0.7, min(1.06, 1 + y / (K * 67)))
        sh_t.append(t0 + t * 1.15); sh_s.append(k); sh_o.append(max(0.5, min(1, 1 + y / (K * 45))))
act_cel.key(sh, "scaleX", [(t, v, "out") for t, v in zip(sh_t, sh_s)])
act_cel.key(sh, "scaleY", [(t, v, "out") for t, v in zip(sh_t, sh_s)])
act_cel.key(sh, "opacity", [(t, v, "out") for t, v in zip(sh_t, sh_o)])
act_shadow_rest = None

# вздох: редкое большое дыхание на фоне ровных
sigh = A("sigh", 2.2)
sigh.key(root.el, "scaleY", [(0, 1, "io"), (0.77, 1.045, "io"), (1.1, 1.045, "io"), (2.2, 1, None)])
sigh.key(root.el, "scaleX", [(0, 1, "io"), (0.77, 1.015, "io"), (1.1, 1.015, "io"), (2.2, 1, None)])
for nm, secs in (("sigh_wait_a", 21.0), ("sigh_wait_b", 25.0), ("sigh_wait_c", 30.0)):
    A(nm, secs)
sigh_rest = A("sigh_rest", 0.2, "loop")  # ничего не держит: root под контролем действий

# зевок: рот, прищур, уши вниз
yawn = A("yawn", 1.7)
for side in "lr":
    yawn.key(eyes[side]["yawn_half"], "opacity", [(0, 0, "io"), (0.3, 1, "io"), (1.3, 1, "io"), (1.7, 0, None)])
yawn.key(mouth["open"], "opacity", [(0, 0, "io"), (0.3, 1, "io"), (1.3, 1, "io"), (1.7, 0, None)])
yawn.key(ear_l_pose.el, "rotation", [(0, 0, "io"), (0.5, rad(-10), "io"), (1.1, rad(-10), "io"), (1.7, 0, None)])
yawn.key(ear_r_pose.el, "rotation", [(0, 0, "io"), (0.5, rad(10), "io"), (1.1, rad(10), "io"), (1.7, 0, None)])
yawn_rest = A("yawn_rest", 0.2, "loop")

# реакции на тап (мешок: порядок случаен, но без «засухи»)
def squash_keys(a):
    a.key(root.el, "y", [(0, 0, "out"), (0.1, 1.5 * K, "out"), (0.28, -5 * K, "out"), (0.46, 0, None)])
    a.key(root.el, "scaleY", [(0, 1, "out"), (0.1, 0.9, "out"), (0.28, 1.05, "out"), (0.46, 1, None)])
    a.key(root.el, "scaleX", [(0, 1, "out"), (0.1, 1.07, "out"), (0.28, 0.97, "out"), (0.46, 1, None)])


def ears_keys(a):
    a.key(ear_l_tw.el, "rotation", [(0, 0, "out"), (0.1, rad(-12), "out"), (0.25, rad(2), "out"), (0.42, 0, None)])
    a.key(ear_r_tw.el, "rotation", [(0, 0, "out"), (0.04, 0, "out"), (0.14, rad(12), "out"), (0.28, rad(-2), "out"), (0.46, 0, None)])


def squint_keys(a):
    for side in "lr":
        a.key(eyes[side]["sleep_closed"], "opacity", [(0, 0, "lin"), (0.04, 1, "lin"), (0.34, 1, "lin"), (0.4, 0, None)])


tap_squash = A("tap_squash", 0.46); squash_keys(tap_squash); ears_keys(tap_squash); squint_keys(tap_squash)
tap_ears = A("tap_ears", 0.46); ears_keys(tap_ears); squint_keys(tap_ears)
tap_wave = A("tap_wave", WD); squash_keys(tap_wave); ears_keys(tap_wave); wave_track(tap_wave); squint_keys(tap_wave)
tap_slow = A("tap_slowblink", 0.9); ears_keys(tap_slow)
for side in "lr":
    e = eyes[side]
    tap_slow.key(e["blink_half"], "opacity", [(0, 0, "lin"), (0.09, 1, "lin"), (0.18, 0, "lin"), (0.5, 0, "lin"), (0.6, 1, "lin"), (0.75, 0, None)])
    tap_slow.key(e["blink_closed"], "opacity", [(0, 0, "lin"), (0.09, 0, "lin"), (0.18, 1, "lin"), (0.5, 1, "lin"), (0.6, 0, None)])
tap_rest = A("tap_rest", 0.2, "loop")

# ───────────────────────── state machine ─────────────────────────
sm = El("StateMachine", "Cat")
inputs = {}


def inp(kind, name):
    e = El({"num": "StateMachineNumber", "bool": "StateMachineBool", "trig": "StateMachineTrigger"}[kind], name)
    inputs[name] = e
    sm.add(e)
    return e


for n in ("gazeX", "gazeY", "tilt", "expression", "action", "mouth"):
    inp("num", n)
for n in ("blink", "blinkSlow", "blinkDouble", "tap", "yawn", "sigh", "earL", "earR"):
    inp("trig", n)


def cond_num(name, op, val):
    return El("TransitionNumberCondition", None, inputId=inputs[name].id, opValue=op, value=val, _id=False)


def cond_trig(name):
    return El("TransitionTriggerCondition", None, inputId=inputs[name].id, _id=False)


class Lay:
    def __init__(self, name):
        self.el = El("StateMachineLayer", name)
        self.entry = El("EntryState", None, _id=False)
        self.states = []
        self.el.add(El("AnyState", None, x=0, y=100, _id=False), El("ExitState", None, x=0, y=200, _id=False), self.entry)
        sm.add(self.el)
        self.pos = 0

    def st(self, anim, random_=False, speed=1.0, reset=False):
        a = anim if isinstance(anim, Anim) else anim
        s = El("AnimationState", None, animationId=a.id, x=160 + 180 * (self.pos % 5), y=60 + 90 * (self.pos // 5),
               speed=None if speed == 1.0 else speed, random=True if random_ else None, reset=True if reset else None)
        self.pos += 1
        self.el.add(s)
        self.states.append(s)
        if len(self.states) == 1:
            self.entry.add(El("StateTransition", None, stateToId=s.id, _id=False))
        return s

    def blend(self, inputname, anims, vals):
        s = El("BlendState1DInput", None, inputId=inputs[inputname].id, x=160 + 180 * (self.pos % 5), y=60 + 90 * (self.pos // 5))
        self.pos += 1
        for a, v in zip(anims, vals):
            s.add(El("BlendAnimation1D", None, animationId=a.id, value=v, _id=False))
        self.el.add(s)
        self.states.append(s)
        if len(self.states) == 1:
            self.entry.add(El("StateTransition", None, stateToId=s.id, _id=False))
        return s


def go(src, dst, conds=(), ms=0, exit_pct=None, weight=None, **kw):
    t = El("StateTransition", None, stateToId=dst.id, duration=ms or None,
           enableExitTime=True if exit_pct is not None else None,
           exitTimeIsPercetange=True if exit_pct is not None else None,
           exitTime=exit_pct, randomWeight=weight, _id=False, **kw)
    for c in conds:
        t.add(c)
    src.add(t)
    return t


def any_to(lay, dst, conds, ms=0):
    anystate = [k for k in lay.el.kids if isinstance(k, El) and k.tag == "AnyState"][0]
    go(anystate, dst, conds, ms)


# 1. idle: дыхание, хвост, огонёк — всегда
L1 = Lay("Breath"); L1.st(next(a for a in anims if a.name == "idle_breathe"))
L2 = Lay("Tail"); s_tail = L2.st(next(a for a in anims if a.name == "tail_sway"))
s_tail_ex = L2.st(next(a for a in anims if a.name == "tail_excited"))
go(s_tail, s_tail_ex, [cond_num("expression", "equal", 4)], 500)
go(s_tail_ex, s_tail, [cond_num("expression", "notEqual", 4)], 500)
L3 = Lay("Flame")
fl_anim = A("flame_flicker2", 1.3, "loop")
fl_anim.key(flame_node, "scaleX", [(0, 1, "soft"), (0.35, 0.95, "soft"), (0.73, 1.04, "soft"), (1.04, 0.97, "soft"), (1.3, 1, None)])
fl_anim.key(flame_node, "scaleY", [(0, 1, "soft"), (0.35, 1.08, "soft"), (0.73, 0.94, "soft"), (1.04, 1.04, "soft"), (1.3, 1, None)])
L3.st(fl_anim)

# 2. моргание: случайные паузы + три вида; ручные триггеры
L4 = Lay("Blink")
nm = {a.name: a for a in anims}
waits = [L4.st(nm[w], random_=True) for w in ("blink_open_a", "blink_open_b", "blink_open_c", "blink_open_d")]
b_n, b_s, b_d = (L4.st(nm[k], random_=True) for k in ("blink", "blink_slow", "blink_double"))
for w in waits:
    go(w, b_n, ms=0, exit_pct=100, weight=8)
    go(w, b_d, ms=0, exit_pct=100, weight=2)
    go(w, b_s, ms=0, exit_pct=100, weight=1)
for b in (b_n, b_s, b_d):
    for w in waits:
        go(b, w, ms=0, exit_pct=100, weight=1)
any_to(L4, b_n, [cond_trig("blink")])
any_to(L4, b_s, [cond_trig("blinkSlow")])
any_to(L4, b_d, [cond_trig("blinkDouble")])

# 3. взгляд, наклон
L5 = Lay("GazeX"); L5.blend("gazeX", gaze_x, (-100, 0, 100))
L6 = Lay("GazeY"); L6.blend("gazeY", gaze_y, (-100, 0, 100))
L7 = Lay("Tilt"); L7.blend("tilt", tilts, (-100, 0, 100))

# 4. эмоция
L8 = Lay("Emotion")
emo_states = [L8.st(a) for a in emo_anims]
for i, s in enumerate(emo_states):
    any_to(L8, s, [cond_num("expression", "equal", i)], 280)

# 5. рот
L9 = Lay("Mouth")
mouth_states = [L9.st(a) for a in mouth_anims]
for i, s in enumerate(mouth_states):
    any_to(L9, s, [cond_num("mouth", "equal", i)], 100)

# 6. ухо: случайные дёрганья + ручные
L10 = Lay("Ears")
ew = [L10.st(nm[w], random_=True) for w in ("ear_wait_a", "ear_wait_b", "ear_wait_c")]
el_, er_ = L10.st(nm["ear_twitch_l"], random_=True), L10.st(nm["ear_twitch_r"], random_=True)
for w in ew:
    go(w, el_, exit_pct=100, weight=1)
    go(w, er_, exit_pct=100, weight=1)
for e_ in (el_, er_):
    for w in ew:
        go(e_, w, exit_pct=100, weight=1)
any_to(L10, el_, [cond_trig("earL")])
any_to(L10, er_, [cond_trig("earR")])

# 7. действия: idle / wave / write / think / celebrate
L11 = Lay("Action")
s_ai = L11.st(nm["act_idle"])
s_aw = L11.st(nm["act_wave"])
s_aw2 = L11.st(nm["act_write"])
s_at = L11.st(nm["act_think"])
s_ac = L11.st(nm["act_celebrate"])
for i, s in ((1, s_aw), (2, s_aw2), (3, s_at), (4, s_ac)):
    any_to(L11, s, [cond_num("action", "equal", i)], 220 if i != 4 else 160)
any_to(L11, s_ai, [cond_num("action", "equal", 0)], 350)

# 8. вздох и зевок
L12 = Lay("Sigh")
sw = [L12.st(nm[w], random_=True) for w in ("sigh_wait_a", "sigh_wait_b", "sigh_wait_c")]
s_sigh = L12.st(nm["sigh"], random_=True)
for w in sw:
    go(w, s_sigh, [cond_num("action", "equal", 0)], exit_pct=100)
go(s_sigh, sw[0], exit_pct=100, weight=1)
go(s_sigh, sw[1], exit_pct=100, weight=1)
go(s_sigh, sw[2], exit_pct=100, weight=1)
any_to(L12, s_sigh, [cond_trig("sigh")])
L13 = Lay("Yawn")
y0 = L13.st(nm["yawn_rest"]); y1 = L13.st(nm["yawn"])
go(y0, y1, [cond_trig("yawn")])
go(y1, y0, exit_pct=100)

# 9. реакции на тап — мешок
L14 = Lay("Tap")
t0 = L14.st(nm["tap_rest"])
taps = [L14.st(nm[k], random_=True) for k in ("tap_squash", "tap_ears", "tap_wave", "tap_squash", "tap_slowblink")]
for t in taps:
    go(t0, t, [cond_trig("tap")], weight=1)
    go(t, t0, exit_pct=100)

# ───────────────────────── сборка ─────────────────────────
art.kw["defaultStateMachineId"] = sm.id
art.add(sm)
for a in anims:
    art.add(a.build())
B.write(art)
print("anims", len(anims), "assets", len(B.assets))
