// Content-Security-Policy: скрипты, стили, картинки, шрифты и запросы — только со своего домена. Чужой скрипт
// (внедрённый через уязвимость или расширение-«помощник») не загрузится и не отправит данные наружу.
// 'unsafe-inline' для скриптов — осознанно: nonce требует динамического рендера каждой страницы и стоил бы
// статического HTML с CDN (первая отрисовка — см. CLAUDE.md). eval, плагины, подмена <base> и встраивание
// в чужие фреймы запрещены и так. Vercel Toolbar на превью-деплоях получает свои адреса.
const isDev = process.env.NODE_ENV !== 'production'
const isPreview = process.env.VERCEL_ENV === 'preview'
const live = isPreview ? ' https://vercel.live' : ''
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}${live}`,
  `style-src 'self' 'unsafe-inline'${live}`,
  `img-src 'self' data: blob:${isPreview ? ' https://vercel.live https://vercel.com' : ''}`,
  `font-src 'self' data:${isPreview ? ' https://vercel.live https://assets.vercel.com' : ''}`,
  `connect-src 'self'${isPreview ? ' https://vercel.live wss://ws-us3.pusher.com' : ''}${isDev ? ' ws:' : ''}`,
  "media-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  `frame-src ${isPreview ? 'https://vercel.live' : "'none'"}`,
  "frame-ancestors 'none'",
].join('; ')

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Проверка типов — часть сборки: ошибка типа больше не уезжает в прод молча (раньше стоял ignoreBuildErrors).
  images: {
    unoptimized: true,
  },
  // Базовые security-заголовки, которых не было вообще.
  // Permissions-Policy НАРОЧНО не глушит microphone: голосовой ввод
  // (hooks/use-dictation.ts, Web Speech API) — реальная, проверенная рендером
  // рабочая фича продукта, глухой запрет `microphone=()` сломал бы её молча.
  // camera/geolocation продукт не использует нигде — им можно быть строгими.
  // Вернувшийся (метка naparnik_home из lib/memory.ts, markHome) — сразу домой, до загрузки лендинга или знакомства.
  // Редирект на уровне маршрутизации Vercel: без функции и без задержки; ?intro=1 — посмотреть лендинг всё равно
  // (именно со значением: пустой ?intro маршрутизатор считает отсутствующим).
  async redirects() {
    const home = [{ type: 'cookie', key: 'naparnik_home', value: '1' }]
    const intro = [{ type: 'query', key: 'intro' }]
    return [
      { source: '/', has: home, missing: intro, destination: '/app', permanent: false },
      { source: '/app/start', has: home, destination: '/app', permanent: false },
    ]
  },
  async headers() {
    // Своя статика с версией содержимого в адресе (?v=хэш, scripts/asset-versions.mjs): шрифты и кот кэшируются
    // на год без перепроверки — повторный визит не переспрашивает сервер про ~20 файлов. Адреса без ?v не затронуты.
    const immutable = (source) => ({
      source,
      has: [{ type: 'query', key: 'v' }],
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    })
    return [
      immutable('/fonts/:path*'),
      immutable('/mascot/:path*'),
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Content-Security-Policy', value: csp },
          // встраивание в чужой фрейм запрещено (и для старых браузеров без frame-ancestors): кликджекинг
          // разрешений микрофона и уведомлений
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=()',
          },
        ],
      },
    ]
  },
}

export default nextConfig
