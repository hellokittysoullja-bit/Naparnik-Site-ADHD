import type { Metadata } from 'next'
import { SdvgTest } from '@/components/sdvg/sdvg-test'
import { JsonLd } from '@/components/json-ld'
import { adhdTopic, pageLd } from '@/lib/structured-data'
import { SdvgArticle, sdvgFaqLd } from '@/components/sdvg/sdvg-article'
import { SDVG_ARTICLE } from '@/content/sdvg-article.ru'
import { pageMetadata } from '@/lib/seo'
import { siteUrl } from '@/lib/site'
import '../hero-poster.css'

// Своя карточка превью (design/brand/sdvg-og.mjs): «Тест на СДВГ для взрослых» — в мессенджерах и в картинках поиска
export const metadata: Metadata = pageMetadata({
  path: '/sdvg-test',
  title: 'Тест на СДВГ для взрослых онлайн — ASRS v1.1 (ВОЗ) и тип прокрастинации | Напарник',
  description:
    '6 вопросов опросника ВОЗ ASRS v1.1 о признаках СДВГ у взрослых и 4 вопроса о том, как ты откладываешь дела. Результат сразу, без почты и регистрации. Это самопроверка, а не диагноз.',
  shareTitle: 'Что мешает тебе начинать дела?',
  shareDescription: 'Тест на 1–2 минуты: 6 вопросов ВОЗ + 4 вопроса от Напарника. Без почты и регистрации.',
  image: { url: '/og/sdvg-test.jpg', width: 1200, height: 630, alt: 'Тест на СДВГ для взрослых: 6 вопросов ВОЗ, 1–2 минуты' },
})

const base = pageLd({
  path: '/sdvg-test',
  name: 'Тест на СДВГ для взрослых онлайн — ASRS v1.1 (ВОЗ)',
  description:
    '6 вопросов опросника ВОЗ ASRS v1.1 о признаках СДВГ у взрослых и 4 вопроса о том, как ты откладываешь дела. Это самопроверка, а не диагноз.',
  crumbs: [{ name: 'Тест на СДВГ', path: '/sdvg-test' }],
  extra: {
    about: adhdTopic,
    isAccessibleForFree: true,
    // свежесть — настоящая дата правки статьи под тестом (content/sdvg-article.ru.ts), не время сборки
    dateModified: SDVG_ARTICLE.updated,
    primaryImageOfPage: { '@type': 'ImageObject', url: siteUrl('/og/sdvg-test.jpg'), width: 1200, height: 630 },
    significantLink: siteUrl('/sdvg-test/metod'),
  },
})
// вопросы-ответы статьи — ровно те, что видны на странице
const ld = { ...base, '@graph': [...base['@graph'], sdvgFaqLd(siteUrl('/sdvg-test'))] }

export const dynamic = 'force-static'

export default function SdvgTestPage() {
  return (
    <>
      <SdvgTest article={<SdvgArticle />} />
      <JsonLd data={ld} />
    </>
  )
}
