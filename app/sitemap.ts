import type { MetadataRoute } from 'next'
import { PAINS } from '@/content/pains.ru'

// Публичная точка входа — лендинг; экраны /app личные (память на устройстве) и в выдаче не нужны
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://adhd-naparnik.vercel.app'
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    // каталог «боль → приём»: публичные страницы, под поиск и под ролики
    { url: `${base}/pomogaet`, changeFrequency: 'monthly', priority: 0.7 },
    ...PAINS.map((p) => ({ url: `${base}/pomogaet/${p.slug}`, changeFrequency: 'monthly' as const, priority: 0.6 })),
  ]
}
