import { SITE_NAME, SITE_URL, siteUrl } from '@/lib/site'

/**
 * Разметка schema.org для страниц сайта (components/json-ld.tsx). Тексты — уже согласованные описания страниц
 * (metadata в app/), без новых обещаний; без оценок и отзывов, которых нет. Красная линия 7 (knowledge/INDEX.md):
 * ни слова о диагнозе и лечении — продукт помогает начинать дела.
 */

const ORG_ID = `${SITE_URL}/#org`
const SITE_ID = `${SITE_URL}/#site`
const APP_ID = `${SITE_URL}/#app`

/** Ссылка на организацию из общей разметки (автор, издатель) */
export const orgRef = { '@id': ORG_ID }

const org = {
  '@type': 'Organization',
  '@id': ORG_ID,
  name: SITE_NAME,
  url: SITE_URL,
  logo: siteUrl('/images/app-icon.png'),
}

const website = {
  '@type': 'WebSite',
  '@id': SITE_ID,
  name: SITE_NAME,
  url: SITE_URL,
  inLanguage: 'ru',
  publisher: orgRef,
}

/** Главная: кто мы, что за сайт и что за приложение */
export const landingLd = {
  '@context': 'https://schema.org',
  '@graph': [
    org,
    website,
    {
      '@type': 'WebApplication',
      '@id': APP_ID,
      name: SITE_NAME,
      url: SITE_URL,
      inLanguage: 'ru',
      applicationCategory: 'LifestyleApplication',
      operatingSystem: 'Любой современный браузер',
      browserRequirements: 'Нужен JavaScript',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'RUB' },
      description:
        'Напарник сидит рядом, пока ты начинаешь, и растит остров из твоих стартов. Бесплатно, без регистрации, без стриков и стыда.',
      featureList: [
        'Разламывает дело на маленькие шаги: больше 2000 готовых планов и разбивка любого дела',
        'Короткие сессии фокуса с котом-напарником рядом',
        'Остров, который растёт с каждым стартом',
        'Мастер «Не могу начать»: один шаг под то, что мешает',
        'Напоминания в Telegram',
      ],
      publisher: orgRef,
    },
  ],
}

type Crumb = { name: string; path: string }

export function breadcrumbs(items: Crumb[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: SITE_NAME, path: '/' }, ...items].map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: siteUrl(c.path),
    })),
  }
}

/** Обычная страница сайта с хлебными крошками */
export function pageLd(opts: { path: string; name: string; description?: string; crumbs: Crumb[]; extra?: object }) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': siteUrl(opts.path),
        url: siteUrl(opts.path),
        name: opts.name,
        ...(opts.description ? { description: opts.description } : {}),
        inLanguage: 'ru',
        isPartOf: { '@id': SITE_ID },
        publisher: orgRef,
        ...opts.extra,
      },
      breadcrumbs(opts.crumbs),
      // ссылки по @id поисковик разрешает только внутри одной страницы — организация и сайт идут с каждой
      org,
      website,
    ],
  }
}

/** О чём страницы теста: тема, а не утверждение о человеке */
export const adhdTopic = {
  '@type': 'MedicalCondition',
  name: 'Синдром дефицита внимания и гиперактивности',
  alternateName: ['СДВГ', 'ADHD'],
}
