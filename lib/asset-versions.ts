// Сгенерировано scripts/asset-versions.mjs (prebuild) — не править руками.
export const ASSET_VERSIONS: Record<string, string> = {
  "/fonts/caveat-400-cyr.woff2": "b53b37d617",
  "/fonts/caveat-400-lat.woff2": "849e5b0df7",
  "/fonts/caveat-500-cyr.woff2": "0b19c815ce",
  "/fonts/caveat-500-lat.woff2": "ff7db7dac1",
  "/fonts/golostext-400-cyr.woff2": "b5bd45c7e9",
  "/fonts/golostext-400-lat.woff2": "6c9c926db7",
  "/fonts/golostext-700-cyr.woff2": "997162f0c7",
  "/fonts/golostext-700-lat.woff2": "fe42236efd",
  "/fonts/manrope-400-cyr.woff2": "589c68f089",
  "/fonts/manrope-400-lat.woff2": "74df2f69da",
  "/fonts/manrope-500-cyr.woff2": "3f1828b09a",
  "/fonts/manrope-500-lat.woff2": "2387ea7a37",
  "/fonts/manrope-600-cyr.woff2": "478dd40d43",
  "/fonts/manrope-600-lat.woff2": "9e3b678c08",
  "/fonts/manrope-700-cyr.woff2": "52be353fdb",
  "/fonts/manrope-700-lat.woff2": "c2c2ae7475",
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
