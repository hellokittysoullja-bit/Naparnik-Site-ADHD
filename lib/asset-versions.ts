// Сгенерировано scripts/asset-versions.mjs (prebuild) — не править руками.
export const ASSET_VERSIONS: Record<string, string> = {
  "/fonts/caveat-400-cyr.woff2": "fd02487731",
  "/fonts/caveat-400-lat.woff2": "46ac6f1b3d",
  "/fonts/caveat-500-cyr.woff2": "7f7605bc4b",
  "/fonts/caveat-500-lat.woff2": "a43bd9da95",
  "/fonts/golostext-400-cyr.woff2": "a47c4ea046",
  "/fonts/golostext-400-lat.woff2": "88737ca5d2",
  "/fonts/golostext-700-cyr.woff2": "28c179c26e",
  "/fonts/golostext-700-lat.woff2": "01d4deffae",
  "/fonts/manrope-400-cyr.woff2": "624dfbff66",
  "/fonts/manrope-400-lat.woff2": "20aa03d658",
  "/fonts/manrope-500-cyr.woff2": "e3de5446ed",
  "/fonts/manrope-500-lat.woff2": "d6ff66b39b",
  "/fonts/manrope-600-cyr.woff2": "8d91daae48",
  "/fonts/manrope-600-lat.woff2": "a8161085be",
  "/fonts/manrope-700-cyr.woff2": "c04eb78dd5",
  "/fonts/manrope-700-lat.woff2": "b2ea5baa18",
  "/fonts/roboto-400-cyr.woff2": "c24eaaad1c",
  "/fonts/roboto-400-lat.woff2": "db0f927dba",
  "/fonts/roboto-700-cyr.woff2": "c597e8f8f9",
  "/fonts/roboto-700-lat.woff2": "de93959c43",
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
  "/mascot/doll/tail.webp": "f2042ed71b"
};

/** Адрес своей статики с версией содержимого: такой адрес кэшируется на год (next.config.mjs). */
export function asset(p: string): string {
  const v = ASSET_VERSIONS[p];
  return v ? `${p}?v=${v}` : p;
}
