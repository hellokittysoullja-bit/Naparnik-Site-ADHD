import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { proxy } from '@/proxy'
import { GET as handoff } from '@/app/api/handoff/route'
import { HANDOFF_TTL_MS, signHandoff, verifyHandoff } from '@/lib/handoff'

const SECRET = 's'.repeat(40)
const NEW = 'naparnik.example'
const NID = 'BBBBBBBBBBBBBBBBBBBBBB'

beforeEach(() => {
  vi.stubEnv('CANONICAL_HOST', NEW)
  vi.stubEnv('VISIT_SECRET', SECRET)
})
afterEach(() => vi.unstubAllEnvs())

const req = (url: string, headers: Record<string, string> = {}) =>
  new NextRequest(url, { headers: { host: new URL(url).host, ...headers } })
const setCookies = (res: Response) => res.headers.getSetCookie()

describe('перенос ID на свой домен: только подписанный жетон (security-audit §2.2)', () => {
  it('голые ?_nid=&_home=1 (чужая ссылка) ID не ставят ни на каком домене, а только убираются из адреса', async () => {
    for (const host of ['adhd-naparnik.vercel.app', NEW]) {
      const res = await proxy(req(`https://${host}/app?_nid=${NID}&_home=1&src=x`))
      expect(res.status).toBe(307)
      expect(new URL(res.headers.get('location')!).search).toBe('?src=x')
      expect(setCookies(res)).toEqual([])
    }
  })

  it('жетон со старого адреса ставит ID и метку на новом домене', async () => {
    const t = await signHandoff({ nid: NID, home: true, host: NEW, exp: Date.now() + 60_000 }, SECRET)
    const res = await proxy(req(`https://${NEW}/app?_t=${t}&src=x`))
    expect(new URL(res.headers.get('location')!).search).toBe('?src=x')
    const set = setCookies(res).join('\n')
    expect(set).toMatch(new RegExp(`nid=${NID};.*HttpOnly`, 'i'))
    expect(set).toMatch(/naparnik_home=1/)
  })

  it('чужой домен, просрочка, подделка, без секрета — игнор', async () => {
    const good = { nid: NID, home: true, host: NEW, exp: Date.now() + 60_000 }
    const t = await signHandoff(good, SECRET)
    expect(setCookies(await proxy(req(`https://adhd-naparnik.vercel.app/app?_t=${t}`)))).toEqual([])
    expect(await verifyHandoff(t, SECRET, 'other.example')).toBeNull()
    const old = await signHandoff({ ...good, exp: Date.now() - 1 }, SECRET)
    expect(await verifyHandoff(old, SECRET, NEW)).toBeNull()
    const far = await signHandoff({ ...good, exp: Date.now() + HANDOFF_TTL_MS * 10 }, SECRET)
    expect(await verifyHandoff(far, SECRET, NEW)).toBeNull()
    const forged = await signHandoff({ ...good, nid: 'ATTACKERxxxxxxxxxxxxxx' }, 'x'.repeat(40))
    expect(await verifyHandoff(forged, SECRET, NEW)).toBeNull()
    const [body, sig] = t.split('.')
    expect(await verifyHandoff(`${body}A.${sig}`, SECRET, NEW)).toBeNull()
    expect(await verifyHandoff(t, undefined, NEW)).toBeNull()
    expect(await verifyHandoff(t, 'short', NEW)).toBeNull()
  })

  it('/api/handoff на старом адресе подписывает cookie самого человека и не уводит на чужой сайт', async () => {
    const res = await handoff(
      new Request('https://adhd-naparnik.vercel.app/api/handoff?to=/app&src=reel-1', {
        headers: { cookie: `nid=${NID}; naparnik_home=1` },
      }),
    )
    expect(res.status).toBe(307)
    const loc = new URL(res.headers.get('location')!)
    expect(loc.host).toBe(NEW)
    expect(loc.pathname).toBe('/app')
    expect(loc.searchParams.get('src')).toBe('reel-1')
    const carried = await verifyHandoff(loc.searchParams.get('_t'), SECRET, NEW)
    expect(carried).toMatchObject({ nid: NID, home: true })

    for (const to of ['//evil.example/x', '/\\evil.example']) {
      const r = await handoff(new Request(`https://adhd-naparnik.vercel.app/api/handoff?to=${encodeURIComponent(to)}`))
      const l = new URL(r.headers.get('location')!)
      expect(l.host).toBe(NEW)
      expect(l.pathname).toBe('/')
    }
  })

  it('без секрета переезд идёт без переноса ID (лучше потерять, чем принять чужой)', async () => {
    vi.stubEnv('VISIT_SECRET', '')
    const res = await handoff(
      new Request('https://adhd-naparnik.vercel.app/api/handoff?to=/app', { headers: { cookie: `nid=${NID}` } }),
    )
    expect(new URL(res.headers.get('location')!).searchParams.has('_t')).toBe(false)
  })
})
