/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Базовые security-заголовки, которых не было вообще.
  // Permissions-Policy НАРОЧНО не глушит microphone: голосовой ввод
  // (hooks/use-dictation.ts, Web Speech API) — реальная, проверенная рендером
  // рабочая фича продукта, глухой запрет `microphone=()` сломал бы её молча.
  // camera/geolocation продукт не использует нигде — им можно быть строгими.
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
