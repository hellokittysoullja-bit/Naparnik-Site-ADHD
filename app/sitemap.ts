import type { MetadataRoute } from 'next'
import { PAINS } from '@/content/pains.ru'
import { siteUrl } from '@/lib/site'

// Публичные страницы. Экраны /app личные (память на устройстве), в выдаче не нужны: у них X-Robots-Tag noindex.
// Варианты под ролики (/v/*), «после сессии» и карточки типа из теста — тоже noindex, их здесь нет.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl('/'), changeFrequency: 'weekly', priority: 1 },
    // тест — главный вход из поиска («тест на СДВГ»)
    { url: siteUrl('/sdvg-test'), changeFrequency: 'monthly', priority: 0.9 },
    { url: siteUrl('/sdvg-test/metod'), changeFrequency: 'monthly', priority: 0.6 },
    // каталог «боль → приём»: публичные страницы, под поиск и под ролики
    { url: siteUrl('/pomogaet'), changeFrequency: 'monthly', priority: 0.7 },
    ...PAINS.map((p) => ({ url: siteUrl(`/pomogaet/${p.slug}`), changeFrequency: 'monthly' as const, priority: 0.6 })),
    { url: siteUrl('/privacy'), changeFrequency: 'yearly', priority: 0.2 },
    { url: siteUrl('/terms'), changeFrequency: 'yearly', priority: 0.2 },
  ]
}
