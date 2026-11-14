// Сгенерировано scripts/asset-versions.mjs (prebuild) — не править руками.
export const ASSET_VERSIONS: Record<string, string> = {
  "/fonts/caveat-400-cyr.woff2": "b6d6d5b42e",
  "/fonts/caveat-400-lat.woff2": "a4dce80c9d",
  "/fonts/caveat-500-cyr.woff2": "db40bc99a5",
  "/fonts/caveat-500-lat.woff2": "4e7750a6c1",
  "/fonts/jetbrains-mono-common.woff2": "3fae999114",
  "/fonts/jetbrains-mono-cyrillic-ext.woff2": "992eea2f70",
  "/fonts/jetbrains-mono-cyrillic.woff2": "af74869558",
  "/fonts/jetbrains-mono-greek.woff2": "3edf363dbf",
  "/fonts/jetbrains-mono-latin-ext.woff2": "7db7affbce",
  "/fonts/jetbrains-mono-latin.woff2": "1e06740a02",
  "/fonts/jetbrains-mono-vietnamese.woff2": "1390e86cc2",
  "/fonts/manrope-400-cyr.woff2": "f52388e583",
  "/fonts/manrope-400-lat.woff2": "fe47bdf4bb",
  "/fonts/manrope-500-cyr.woff2": "eb2621c0c2",
  "/fonts/manrope-500-lat.woff2": "d60ce66944",
  "/fonts/manrope-600-cyr.woff2": "ff3c4bc100",
  "/fonts/manrope-600-lat.woff2": "d9cae8b8be",
  "/fonts/manrope-700-cyr.woff2": "752b2a6308",
  "/fonts/manrope-700-lat.woff2": "1bbd9fed7e",
  "/mascot/poster/neutral.webp": "ce1781ecfa",
  "/mascot/doll/body.webp": "86376e3ba9",
  "/mascot/doll/eye-l.webp": "a95da21712",
  "/mascot/doll/eye-r.webp": "a4ec871516",
  "/mascot/doll/flame.webp": "1773ccf88a",
  "/mascot/doll/happy.webp": "c1f75e9a22",
  "/mascot/doll/hl-l.webp": "fcf8e04692",
  "/mascot/doll/hl-r.webp": "fd68ef5a06",
  "/mascot/doll/lid-l.webp": "78f2ead594",
  "/mascot/doll/lid-r.webp": "8713252705",
  "/mascot/doll/pupil-l.webp": "f19c18bba5",
  "/mascot/doll/pupil-r.webp": "29df3aebb3",
  "/mascot/doll/rig.json": "7be893fcd0",
  "/mascot/doll/sleep.webp": "e7d4a9ffe4",
  "/mascot/doll/tail.webp": "f2042ed71b",
  "/scene/night-landscape.mp4": "3d86bc82f1",
  "/scene/night-landscape.webm": "3970c9000f",
  "/scene/night-landscape.webp": "fa97fa4fe1",
  "/scene/night-portrait.mp4": "4b1dcf5283",
  "/scene/night-portrait.webm": "a9a645abe6",
  "/scene/night-portrait.webp": "11ae8a5f98"
};

/** Адрес своей статики с версией содержимого: такой адрес кэшируется на год (next.config.ts). */
export function asset(p: string): string {
  const v = ASSET_VERSIONS[p];
  return v ? `${p}?v=${v}` : p;
}
