import { describe, expect, it } from 'vitest'
import { POST as companion } from '@/app/api/companion/route'
import { POST as breakdown } from '@/app/api/breakdown/route'
import { POST as voice } from '@/app/api/session-voice/route'

let ip = 0
/** у каждого запроса свой IP, чтобы тесты не упирались в лимит друг друга */
function post(body: string, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': `10.0.0.${++ip}`, ...headers },
    body,
  })
}

describe('API: вход проверяется до вызова модели', () => {
  it('битый JSON → 400 без тела', async () => {
    const res = await companion(post('{bad'))
    expect(res.status).toBe(400)
    expect(await res.text()).toBe('')
  })

  it('чужая форма тела → 400', async () => {
    expect((await companion(post('{"messages":"x"}'))).status).toBe(400)
    expect((await companion(post('{"messages":[],"memory":{}}'))).status).toBe(400)
  })

  it('file-часть (сервер скачал бы чужой URL) выбрасывается — без текста запрос пуст → 400', async () => {
    const body = JSON.stringify({
      messages: [{ id: '1', role: 'user', parts: [{ type: 'file', mediaType: 'image/png', url: 'http://127.0.0.1:9/x.png' }] }],
    })
    expect((await companion(post(body))).status).toBe(400)
  })

  it('тело больше потолка → 413', async () => {
    expect((await breakdown(post(JSON.stringify({ task: 'а'.repeat(10_000) })))).status).toBe(413)
  })

  it('запрос с чужого сайта → 403', async () => {
    const res = await breakdown(post('{"task":"убрать стол"}', { 'sec-fetch-site': 'cross-site' }))
    expect(res.status).toBe(403)
  })

  it('moment вне списка (в т.ч. __proto__) → 400', async () => {
    expect((await voice(post('{"moment":"__proto__","task":"x"}'))).status).toBe(400)
  })

  it('лимит запросов с одного IP → 429 с Retry-After', async () => {
    const req = () => post('{"task":"ab"}', { 'x-real-ip': '10.9.9.9' }) // невалидно (min 3) — модель не зовётся
    const codes: number[] = []
    for (let i = 0; i < 12; i++) codes.push((await breakdown(req())).status)
    expect(codes.slice(0, 10).every((c) => c === 400)).toBe(true)
    const last = await breakdown(req())
    expect(last.status).toBe(429)
    expect(Number(last.headers.get('retry-after'))).toBeGreaterThan(0)
  })
})
