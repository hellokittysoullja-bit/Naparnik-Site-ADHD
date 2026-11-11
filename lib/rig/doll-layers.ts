/**
 * Имена слоёв куклы (public/mascot/doll/, собирает design/mascot/doll_build.py — он источник правды). Нужны, чтобы
 * начать грузить слои параллельно с rig.json, а не после него. Список сверяет с rig.json тест
 * tests/unit/doll-layers.test.ts: пересобрали куклу с другим набором слоёв — тест покажет, что поправить здесь.
 */
export const DOLL_LAYERS = [
  "tail.webp", "flame.webp", "body.webp",
  "eye-l.webp", "pupil-l.webp", "hl-l.webp", "lid-l.webp",
  "eye-r.webp", "pupil-r.webp", "hl-r.webp", "lid-r.webp",
  "happy.webp", "sleep.webp",
] as const;
