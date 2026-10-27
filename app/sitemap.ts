import type { MetadataRoute } from 'next'

// Публичная точка входа — лендинг; экраны /app личные (память на устройстве) и в выдаче не нужны
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: 'https://ai-rc-one.vercel.app/', changeFrequency: 'weekly', priority: 1 }]
}
