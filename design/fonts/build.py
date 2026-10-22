#!/usr/bin/env python3
"""Шрифты сайта из исходников Google Fonts (design/fonts/src, OFL) → public/fonts и app/fonts.css.

Зачем свои, а не next/font/google: у Google рукописный Caveat на два алфавита весил 151 КБ, Manrope — 38 КБ, и
на 3G текст первого экрана появлялся на ~1 с позже кота. Здесь:
  1. статические начертания (Manrope 400/500/600/700, Caveat 400/500 — на сайте других нет), каждое порезано
     по unicode-range на кириллицу + цифры + пунктуацию (один файл закрывает русский экран) и латиницу;
  2. для первого экрана лендинга — крошечные подмножества ровно под его символы (hero.tsx), вшитые как
     data: URI в app/hero-fonts.css (подключён только в app/page.tsx): текст героя рисуется своим шрифтом
     с первой отрисовки на любой сети, без ожидания файла и без подмены запасного. Объявлены ПОСЛЕ внешних
     @font-face той же семьи — при пересечении unicode-range побеждает позднее правило. Покрытие символов
     проверяет design/fonts/check.mjs на каждом `npm run build` (prebuild);
  3. запасные "… Fallback" на local(Arial) с метриками, подогнанными под высоту строки и переносы.
Запуск: python3 design/fonts/build.py  (нужны fonttools, brotli), затем node scripts/asset-versions.mjs — он проставит
версии ?v=хэш в url() app/fonts.css (то же делает prebuild). Контекстные альтернативы (calt) сохранены.
"""
import base64, os, re, sys
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "design", "fonts", "src")
OUT = os.path.join(ROOT, "public", "fonts")
CSS = os.path.join(ROOT, "app", "fonts.css")
HERO_CSS = os.path.join(ROOT, "app", "hero-fonts.css")  # только лендинг (app/page.tsx), /app его не грузит

# кириллица + цифры + пунктуация + кавычки — один файл на русский экран; латинские буквы — отдельно
CYR = "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116,U+0020-0040,U+005B-0060,U+007B-007E,U+00A0,U+00AB,U+00BB,U+2010-2015,U+2018-201F,U+2026,U+2122"
LAT = "U+0041-005A,U+0061-007A,U+00C0-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-200F,U+2016-2017,U+2020-2025,U+2027-206F,U+20AC,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
FONTS = {"Manrope": (400, 500, 600, 700), "Caveat": (400, 500)}
# первый экран лендинга: (семья, вес) → откуда брать символы. Символы = все кириллические буквы из hero.tsx
# (на случай вариантов текста) + цифры + пробел + пунктуация. Веса — те, что видны при рендере (pwglyphs).
HERO_FACES = (("Manrope", 500), ("Manrope", 700), ("Caveat", 500))
PUNCT = " .,:;!?…—–-«»() 2"
# запасные: ascent/descent в em и size-adjust (Manrope — как считает next/font; Caveat — подбор по строкам героя)
FALLBACK = {"Manrope": (1.066, 0.300, 103.19), "Caveat": (0.960, 0.300, 73.0)}


def opts(**kw):
    o = subset.Options(flavor="woff2", hinting=False, notdef_outline=True, **kw)
    o.layout_features = ["*"]
    return o


def instance(fam, w):
    vf = TTFont(os.path.join(SRC, f"{fam}[wght].ttf"))
    return instancer.instantiateVariableFont(vf, {"wght": w}, inplace=False)


def cut(font, unicodes=None, text=None):
    o = opts()
    f = TTFont(); f.importXML  # noqa — тихая проверка, что fontTools на месте
    s = subset.Subsetter(o)
    s.populate(unicodes=subset.parse_unicodes(unicodes) if unicodes else [], text=text or "")
    import copy
    f = copy.deepcopy(font)
    s.subset(f)
    import io
    buf = io.BytesIO(); o.flavor = "woff2"; f.flavor = "woff2"; f.save(buf)
    return buf.getvalue(), len(f.getGlyphOrder())


def hero_chars(fam):
    src = open(os.path.join(ROOT, "components", "landing", "hero.tsx"), encoding="utf-8").read()
    if fam == "Caveat":
        # рукопись на первом экране — две фиксированные строки: приветствие (константа) и подпись-стрелка
        parts = re.findall(r'"(Привет[^"]*)"', src) + re.findall(r'font-hand[^>]*>\s*([^<]+)<br\s*/>\s*([^<]+)</p>', src, re.S)
        text = "".join("".join(p) if isinstance(p, tuple) else p for p in parts).replace("&nbsp;", " ")
        assert "Напарник" in text and "неделю" in text, "не нашёл строки рукописи в hero.tsx"
        return "".join(sorted(set(text) | set(PUNCT)))
    cyr = {c for c in src if "Ѐ" <= c <= "ӿ"}
    return "".join(sorted(cyr | set(PUNCT) | set("0123456789")))


def uranges(chars):
    cps = sorted({ord(c) for c in chars})
    out, a, b = [], cps[0], cps[0]
    for c in cps[1:]:
        if c == b + 1: b = c
        else: out.append((a, b)); a = b = c
    out.append((a, b))
    return ", ".join(f"U+{a:04X}" if a == b else f"U+{a:04X}-{b:04X}" for a, b in out)


def main():
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith(".woff2"): os.remove(os.path.join(OUT, f))
    css = ["/* Сгенерировано design/fonts/build.py — не править руками. Шрифты сайта: внешние файлы по весам и",
           "   алфавитам и запасные с подогнанными метриками. Вшитые подмножества первого экрана — hero-fonts.css. */", ""]
    statics = {}
    for fam, ws in FONTS.items():
        for w in ws:
            st = instance(fam, w); statics[(fam, w)] = st
            for tag, rng in (("cyr", CYR), ("lat", LAT)):
                data, n = cut(st, unicodes=rng)
                name = f"{fam.lower()}-{w}-{tag}.woff2"
                open(os.path.join(OUT, name), "wb").write(data)
                print(f"{name:26} {len(data)//1024:3} КБ  {n} глифов")
                css += ["@font-face {", f'  font-family: "{fam}";', f'  src: url("/fonts/{name}") format("woff2");',
                        f"  font-weight: {w};", "  font-style: normal;", "  font-display: block;",
                        f"  unicode-range: {rng.replace(',', ', ')};", "}", ""]
    hero = ["/* Сгенерировано design/fonts/build.py — не править руками. Первый экран лендинга: подмножества ровно под",
            "   его символы, вшитые в CSS — текст героя своим шрифтом с первой отрисовки. Подключается только в",
            "   app/page.tsx (после globals.css, т.е. после внешних @font-face той же семьи — при пересечении",
            "   unicode-range побеждает позднее правило). design/fonts/check.mjs проверяет покрытие на каждом build. */", ""]
    for fam, w in HERO_FACES:
        chars = hero_chars(fam)
        data, n = cut(statics[(fam, w)], text=chars)
        b64 = base64.b64encode(data).decode()
        print(f"inline {fam} {w}: {len(data)//1024} КБ ({len(b64)//1024} КБ base64), {n} глифов, {len(chars)} символов")
        hero += ["@font-face {", f'  font-family: "{fam}";', f'  src: url("data:font/woff2;base64,{b64}") format("woff2");',
                 f"  font-weight: {w};", "  font-style: normal;", "  font-display: block;",
                 f"  unicode-range: {uranges(chars)};", "}", ""]
    open(HERO_CSS, "w", encoding="utf-8").write("\n".join(hero))
    print("hero css", os.path.getsize(HERO_CSS) // 1024, "КБ →", HERO_CSS)
    css += ["/* запасные на время загрузки внешних файлов: local(Arial) с метриками под высоту строки и переносы */"]
    for fam, (asc, desc, sa) in FALLBACK.items():
        css += ["@font-face {", f'  font-family: "{fam} Fallback";', '  src: local("Arial");', f"  size-adjust: {sa}%;",
                f"  ascent-override: {asc / sa * 100:.1f}%;", f"  descent-override: {desc / sa * 100:.1f}%;",
                "  line-gap-override: 0%;", "}", ""]
    open(CSS, "w", encoding="utf-8").write("\n".join(css))
    print("css", os.path.getsize(CSS) // 1024, "КБ →", CSS)


if __name__ == "__main__":
    main()
