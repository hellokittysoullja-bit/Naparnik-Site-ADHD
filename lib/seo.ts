import type { Metadata } from 'next'

/**
 * Метаданные публичной страницы: адрес (canonical), заголовок и описание в поиске и в превью ссылки, картинка.
 *
 * Зачем (аудит 18.11, research/29-seo-audit): Next заменяет `openGraph` страницы ЦЕЛИКОМ, если страница задаёт свой, —
 * теряются картинка, `locale`, `siteName`. А страница без своего openGraph/twitter наследует заголовок лендинга: превью
 * «Помогает», методики, политики в Telegram и X показывало «Сдвинем твоё дело за 2 минуты». Поэтому каждая публичная
 * страница собирает метаданные здесь. Адреса относительные — абсолютными их делает `metadataBase` (lib/site.ts).
 */
const SITE_NAME = 'Напарник'
/** общая картинка превью (кот на ночной сцене, design/brand/build.mjs) */
export const DEFAULT_OG_IMAGE = { url: '/opengraph-image.png', width: 1200, height: 630, alt: 'Напарник — кот на ночном холме' }

type PageMeta = {
  /** путь страницы от корня: '/', '/sdvg-test' */
  path: string
  title: string
  description: string
  /** заголовок и описание в превью ссылки, если отличаются от поисковых */
  shareTitle?: string
  shareDescription?: string
  image?: { url: string; width: number; height: number; alt?: string }
  type?: 'website' | 'article'
}

export function pageMetadata({ path, title, description, shareTitle, shareDescription, image, type = 'website' }: PageMeta): Metadata {
  const ogTitle = shareTitle ?? title
  const ogDescription = shareDescription ?? description
  const img = image ?? DEFAULT_OG_IMAGE
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title: ogTitle, description: ogDescription, url: path, siteName: SITE_NAME, locale: 'ru_RU', type, images: [img] },
    twitter: { card: 'summary_large_image', title: ogTitle, description: ogDescription, images: [img.url] },
  }
}
