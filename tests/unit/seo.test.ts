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
