# Генерация недостающих кадров кота по оригиналу (закрытые глаза, улыбка, рот и т.д.)
# через image-edit API: оригинал подаётся как референс, модель меняет ТОЛЬКО указанную
# деталь. Ключ и адрес — из окружения, в репозиторий не попадают:
#   IMG_API_KEY=...  IMG_BASE_URL=https://anymodel.org/v1  IMG_MODEL=cx/gpt-image-2  \
#   python3 design/mascot/gen_frames.py
# Результат — design/mascot/gen/<имя>.png; дальше кадры выравниваются по оригиналу и
# режутся на слои (см. cut.py).
import base64, os, sys, time, urllib.request, json

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REF = os.path.join(ROOT, "design/mascot/reference.png")
OUT = os.path.join(ROOT, "design/mascot/gen")
KEY = os.environ["IMG_API_KEY"]
BASE = os.environ["IMG_BASE_URL"].rstrip("/")
MODEL = os.environ.get("IMG_MODEL", "gpt-image-2")
QUALITY = os.environ.get("IMG_QUALITY", "medium")

KEEP = (
    "Keep the cat EXACTLY identical to the reference image: same watercolor ink style, same fur, "
    "same pose, same position and size, same tail with flame, same white background. "
    "Change ONLY the following detail and nothing else: "
)
FRAMES = {
    "eyes-closed": KEEP + "both eyes are gently closed, drawn as the same dark ink curved lines, no green iris and no pupils visible.",
    "eyes-half": KEEP + "both eyes are half-closed (sleepy lids), upper eyelids covering the top half of the green irises.",
    "smile": KEEP + "the mouth is a wider happy smile in the same thin ink line style.",
    "mouth-open": KEEP + "the mouth is open in a small happy laugh with a tiny pink tongue, same ink style.",
    "mouth-o": KEEP + "the mouth is a small round 'o' (curious, thinking), same ink style.",
    "head-left": KEEP + "the cat's head is turned about 30 degrees to the viewer's left (three-quarter view), looking toward the left, ears and cheek fluff following the turn; the body, paws, tail and flame stay exactly as in the reference.",
    "head-right": KEEP + "the cat's head is turned about 30 degrees to the viewer's right (three-quarter view), looking toward the right, ears and cheek fluff following the turn; the body, paws, tail and flame stay exactly as in the reference.",
    "paw-up": KEEP + "the cat's left front paw (viewer's left) is raised in a friendly wave, pads facing the viewer.",
    # кадры для куклы (parts.py / puppet.ts): веки по ступеням, эмоции глаз, лапа с ногой
    "lids-25": KEEP + "both upper eyelids are lowered to cover the top quarter of the green irises; the lids are the same dark grey fur with the same thick ink outline along the lid edge.",
    "lids-50": KEEP + "both upper eyelids are lowered to cover the top half of the green irises (half-closed, relaxed look); lids are the same dark grey fur with the same thick ink outline along the lid edge.",
    "lids-75": KEEP + "both upper eyelids are lowered to cover three quarters of the green irises (almost closed); lids are the same dark grey fur with the same thick ink outline along the lid edge.",
    "eyes-happy": KEEP + "both eyes are closed in a happy squint, drawn as two upward-curved thick ink arcs (like ^ ^), no iris visible.",
    "eyes-sad": KEEP + "both eyes look sad: the upper eyelids slant down toward the outer corners covering the upper part of the irises, the ink outline follows the slanted lids; mouth is a small downward curve.",
    "no-eyes": KEEP + "the cat has NO eyes drawn at all: where the eyes would be there is only the same smooth dark grey watercolor fur as on the forehead and cheeks, no outlines, no green, no eyelids; nose, mouth, whiskers, ears, body, tail and flame stay exactly as in the reference.",
    "wave-pose": KEEP + "the cat's front paw on the viewer's left is raised up beside its cheek in a friendly wave with the paw pads facing the viewer, the short furry leg visible coming out from the chest fur; the other paw, body, head, tail and flame stay exactly as in the reference.",
}


def call(method, path, payload=None, tries=8):
    # шлюз иногда отвечает 5xx/рвёт соединение — ждём и повторяем
    for attempt in range(tries):
        try:
            return _call(method, path, payload)
        except Exception as e:  # noqa: BLE001
            if attempt == tries - 1:
                raise
            print("retry", path, type(e).__name__, getattr(e, "code", ""), flush=True)
            time.sleep(40 * (attempt + 1))


def _call(method, path, payload=None):
    req = urllib.request.Request(
        BASE + path, method=method,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json", "User-Agent": "curl/8"},
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.status, json.load(r)


os.makedirs(OUT, exist_ok=True)
ref = "data:image/png;base64," + base64.b64encode(open(REF, "rb").read()).decode()
only = sys.argv[1:] or list(FRAMES)
for name in only:
    # асинхронный режим: картинка может рисоваться 1–3 минуты, а CDN рвёт тихое соединение
    _, job = call("POST", "/images/generations", {
        "model": MODEL, "prompt": FRAMES[name], "n": 1, "size": "1536x1024", "quality": QUALITY,
        "output_format": "png", "response_format": "b64_json", "images": [ref], "background": True,
    })
    while True:
        time.sleep(6)
        status, res = call("GET", "/images/generations/" + job["id"])
        if status == 200:
            break
    item = res["data"][0]
    png = base64.b64decode(item["b64_json"]) if item.get("b64_json") else urllib.request.urlopen(item["url"]).read()
    open(os.path.join(OUT, name + ".png"), "wb").write(png)
    print("ok", name, flush=True)
