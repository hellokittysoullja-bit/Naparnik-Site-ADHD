# Мини-набор для генерации RML (Rive Markup Language): узлы, картинки, кости, анимации.
# build.py собирает из него scene.rml кота; сборка .riv — `rive design/mascot/rive --once`.
from xml.sax.saxutils import quoteattr

FPS = 60
_n = [10]


def nid():
    _n[0] += 1
    return f"0:{_n[0]}"


def attrs(d):
    out = []
    for k, v in d.items():
        if v is None:
            continue
        if isinstance(v, bool):
            v = "true" if v else "false"
        elif isinstance(v, float):
            v = f"{v:.4f}".rstrip("0").rstrip(".")
        out.append(f"{k}={quoteattr(str(v))}")
    return " ".join(out)


class El:
    """Элемент RML с дочерними; .id — идентификатор для ссылок (клип, анимации, кости)."""

    def __init__(self, tag, name=None, **kw):
        self.tag = tag
        self.name = name
        self.kw = kw
        self.kids = []
        self.id = None
        if kw.pop("_id", True):
            self.id = nid()

    def add(self, *kids):
        self.kids.extend(kids)
        return self

    def render(self, ind=0):
        a = dict(self.kw)
        if self.name:
            a["name"] = self.name
        if self.id and self.tag not in ("Fill", "SolidColor", "Weight", "Tendon", "Skin", "Mesh"):
            a["id"] = self.id
        pad = "    " * ind
        head = f"{pad}<{self.tag} {attrs(a)}".rstrip()
        if not self.kids:
            return head + "/>"
        body = "\n".join(k.render(ind + 1) if isinstance(k, El) else "    " * (ind + 1) + k for k in self.kids)
        return f"{head}>\n{body}\n{pad}</{self.tag}>"


def node(name, x=0, y=0, **kw):
    return El("Node", name, x=x, y=y, **kw)


class Anim:
    """LinearAnimation: треки = {(объект, свойство): [(секунда, значение, ease)]}."""

    KEYS = {"x": 13, "y": 14, "rotation": 15, "scaleX": 16, "scaleY": 17, "opacity": 18}

    def __init__(self, name, seconds, loop="oneShot"):
        self.name = name
        self.seconds = seconds
        self.loop = loop
        self.tracks = {}
        self.el = El("LinearAnimation", name, loopValue=loop, duration=round(seconds * FPS), fps=FPS)
        self.id = self.el.id

    def key(self, obj, prop, frames):
        """frames: [(t_sec, value, ease)], ease: None=hold, 'lin', 'io', 'out', 'in', ('c',x1,y1,x2,y2), 'el'"""
        self.tracks[(obj, prop)] = frames
        return self

    def build(self):
        by_obj = {}
        for (obj, prop), fr in self.tracks.items():
            by_obj.setdefault(obj.id, []).append((prop, fr))
        for oid, props in by_obj.items():
            ko = El("KeyedObject", None, objectId=oid, _id=False)
            for prop, fr in props:
                kp = El("KeyedProperty", None, propertyKey=self.KEYS.get(prop, prop), _id=False)
                for i, (t, v, ease) in enumerate(fr):
                    kf = El("KeyFrameDouble", None, value=v, frame=round(t * FPS), _id=False)
                    if i == len(fr) - 1:
                        pass
                    elif ease == "lin":
                        kf.kw["interpolationType"] = "linear"
                    elif ease is not None:
                        c = {"io": (0.42, 0, 0.58, 1), "out": (0.16, 0.84, 0.44, 1), "in": (0.55, 0.06, 0.68, 0.19),
                             "soft": (0.37, 0, 0.63, 1), "over": (0.34, 1.56, 0.64, 1)}.get(ease, ease)
                        kf.kw["interpolationType"] = "cubic"
                        kf.add(El("CubicEaseInterpolator", None, x1=c[0], y1=c[1], x2=c[2], y2=c[3], _id=False))
                    kp.add(kf)
                ko.add(kp)
            self.el.add(ko)
        return self.el
