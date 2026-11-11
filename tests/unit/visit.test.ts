import { describe, expect, it } from 'vitest'
import { POST as visit } from '@/app/api/visit/route'
import { entryVariantRewrites } from '@/next.config'
import { ENTRY_VARIANTS, entryVariantKey } from '@/content/entry-variants'
import { config as proxyConfig } from '@/proxy'

let ip = 0
function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/visit', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': `10.1.0.${++ip}`, ...headers },
    body: JSON.stringify(body),
  })
}
const setCookies = (res: Response) => res.headers.getSetCookie()

describe('POST /api/visit: анонимный ID и источник после первой отрисовки', () => {
  it('новому посетителю — nid httpOnly на год', async () => {
    const res = await visit(post({}))
    expect(res.status).toBe(204)
    const nid = setCookies(res).find((c) => c.startsWith('nid='))
    expect(nid).toMatch(/^nid=[A-Za-z0-9_-]{22};/)
    expect(nid).toMatch(/HttpOnly/i)
    expect(nid).toMatch(/Max-Age=31536000/)
  })

  it('идентичность только из cookie: присланный x-nid игнорируется, существующий nid не перезаписывается', async () => {
    const forged = 'FFFFFFFFFFFFFFFFFFFFFF'
    const fresh = setCookies(await visit(post({}, { 'x-nid': forged }))).find((c) => c.startsWith('nid='))
    expect(fresh).toBeDefined()
    expect(fresh).not.toContain(forged)
    const known = await visit(post({}, { cookie: 'nid=AAAAAAAAAAAAAAAAAAAAAA' }))
    expect(setCookies(known).some((c) => c.startsWith('nid='))).toBe(false)
  })

  it('источник: первый вход один раз, последний — каждый раз; чужие ключи и значения отброшены', async () => {
    const a = { utm_source: 'TikTok', src: 'reel-phone', utm_term: '<script>', email: 'x@y.z' }
    const first = setCookies(await visit(post({ a })))
    const ft = first.find((c) => c.startsWith('n_ft='))
    expect(ft).toBeDefined()
    expect(first.some((c) => c.startsWith('n_lt='))).toBe(true)
    const raw = decodeURIComponent(ft!.split(';')[0].slice(5))
    expect(raw).toContain('"utm_source":"tiktok"')
    expect(raw).not.toContain('script')
    expect(raw).not.toContain('email')
    const again = setCookies(await visit(post({ a }, { cookie: 'nid=AAAAAAAAAAAAAAAAAAAAAA; n_ft=x' })))
    expect(again.some((c) => c.startsWith('n_ft='))).toBe(false)
    expect(again.some((c) => c.startsWith('n_lt='))).toBe(true)
  })

  it('чужой сайт → 403, не JSON → 415', async () => {
    expect((await visit(post({}, { 'sec-fetch-site': 'cross-site' }))).status).toBe(403)
    expect((await visit(post({}, { 'content-type': 'text/plain' }))).status).toBe(415)
  })
})

describe('лендинг под ролик — статический rewrite вместо proxy', () => {
  // так Next сверяет значение `has` (prepare-destination.js: new RegExp(`^${value}$`))
  const match = (src: string) =>
    entryVariantRewrites().find((r) => new RegExp(`^${r.has[0].value}$`).test(src))?.destination ?? null

  it('по правилу на каждый ролик, и ведёт туда же, куда entryVariantKey', () => {
    expect(entryVariantRewrites()).toHaveLength(Object.keys(ENTRY_VARIANTS).length)
    for (const src of [...Object.keys(ENTRY_VARIANTS), 'REEL-PHONE', ' reel-fear ', 'reel-unknown', 'reel-phonex', 'xreel-phone', '']) {
      const key = entryVariantKey(src)
      expect(match(src), src).toBe(key ? `/v/${key}` : null)
    }
  })

  it('proxy работает только на переносе домена, не на первом визите', () => {
    const keys = proxyConfig.matcher.flatMap((m) => ('has' in m ? m.has.map((h) => h.key) : ['<missing>']))
    expect(keys.sort()).toEqual(['_home', '_nid', '_t'])
  })
})
