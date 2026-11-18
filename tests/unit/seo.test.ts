import { describe, expect, it } from 'vitest'
import sitemap from '@/app/sitemap'
import { GET as robots } from '@/app/robots.txt/route'
import { GET as llms } from '@/app/llms.txt/route'
import { landingLd, pageLd } from '@/lib/structured-data'
import { PAINS } from '@/content/pains.ru'

describe('SEO и нейропоиск', () => {
  it('sitemap: главная, тест, метод, каталог и все боли; личных экранов нет', () => {
    const urls = sitemap().map((e) => new URL(e.url).pathname)
    for (const p of ['/', '/sdvg-test', '/sdvg-test/metod', '/pomogaet', ...PAINS.map((x) => `/pomogaet/${x.slug}`)]) {
      expect(urls).toContain(p)
    }
    expect(urls.some((p) => p.startsWith('/app') || p.startsWith('/v/') || p.startsWith('/api'))).toBe(false)
  })

  it('robots.txt: API закрыт для всех групп, у Яндекса Clean-param, есть sitemap', async () => {
    const text = await robots().text()
    const groups = text.split('\n\n').filter((g) => g.startsWith('User-agent'))
    for (const g of groups) expect(g).toContain('Disallow: /api/')
    expect(groups.every((g) => !/Disallow: \/\s*$/m.test(g))).toBe(true)
    expect(text).toMatch(/Clean-param: .*utm_source.*src/)
    expect(text).toMatch(/^Sitemap: https:\/\/.+\/sitemap\.xml$/m)
  })

  it('llms.txt: ссылки на тест и все боли, без обещаний лечения', async () => {
    const text = await llms().text()
    expect(text.startsWith('# Напарник')).toBe(true)
    expect(text).toContain('/sdvg-test')
    for (const p of PAINS) expect(text).toContain(`/pomogaet/${p.slug}`)
    expect(text).not.toMatch(/вылеч|лечит СДВГ|у тебя СДВГ|диагностиру/i)
  })

  it('разметка без выдуманных оценок и отзывов', () => {
    const all = JSON.stringify([landingLd, pageLd({ path: '/x', name: 'x', crumbs: [] })])
    expect(all).not.toMatch(/aggregateRating|"review"|ratingValue/)
    expect(all).toContain('"price":"0"')
  })
})

// Второй заход 18.11 (research/29-seo-audit): превью у каждой страницы своё, статья под тестом, полный текст для ИИ
describe('превью, статья под тестом, полный текст', async () => {
  const { pageMetadata } = await import('@/lib/seo')
  const { GET: llmsFull } = await import('@/app/llms-full.txt/route')
  const { SDVG_ARTICLE } = await import('@/content/sdvg-article.ru')
  const { sdvgFaqLd } = await import('@/components/sdvg/sdvg-article')
  const asrs = (await import('@/content/asrs-ru.json')).default

  it('у страницы свой адрес, свой заголовок превью и всегда картинка (свой openGraph в Next выбрасывает общую)', () => {
    const m = pageMetadata({ path: '/x', title: 'T', description: 'D', shareTitle: 'S' })
    expect(m.alternates?.canonical).toBe('/x')
    expect(m.openGraph).toMatchObject({ title: 'S', url: '/x', locale: 'ru_RU', siteName: 'Напарник' })
    expect((m.openGraph as { images: unknown[] }).images).toHaveLength(1)
    expect(m.twitter).toMatchObject({ title: 'S' })
  })

  it('robots: Content-Signal в каждой группе, ysclid из выдачи Яндекса не плодит дубли', async () => {
    const text = await robots().text()
    for (const g of text.split('\n\n').filter((g) => g.startsWith('User-agent'))) expect(g).toContain('Content-Signal: search=yes, ai-input=yes')
    expect(text).toMatch(/Clean-param: .*ysclid/)
  })

  it('FAQPage — ровно вопросы и ответы, видимые на странице; диапазоны — как в подсчёте теста', () => {
    expect(sdvgFaqLd().mainEntity.map((q) => [q.name, q.acceptedAnswer.text])).toEqual(SDVG_ARTICLE.faq.map((f) => [f.q, f.a]))
    expect(SDVG_ARTICLE.bands.map((b) => b.range)).toEqual(['0–9', '10–13', '14–17', '18–24'])
    expect(SDVG_ARTICLE.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('llms-full.txt: вопросы ВОЗ дословно, все боли, без обещаний лечения; llms.txt на него ссылается', async () => {
    const text = await llmsFull().text()
    for (const q of asrs.items) expect(text).toContain(q)
    for (const p of PAINS) expect(text).toContain(`/pomogaet/${p.slug}`)
    expect(text).not.toMatch(/вылеч|лечит СДВГ|у тебя СДВГ/i)
    expect(await llms().text()).toContain('/llms-full.txt')
  })
})
