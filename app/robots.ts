import type { MetadataRoute } from 'next'

// Поисковикам — сайт целиком, кроме API (там нечего индексировать, а каждый запрос стоит вызова модели)
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/api/' },
    sitemap: 'https://ai-rc-one.vercel.app/sitemap.xml',
  }
}
