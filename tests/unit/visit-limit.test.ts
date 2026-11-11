import { describe, expect, it } from 'vitest'
import { POST } from '@/app/api/visit/route'

// 40 первых визитов за минуту с одного IP (люди за общим адресом мобильного оператора) — каждый получает nid
describe('/api/visit за общим IP', () => {
  it('не режет 40 визитов в минуту с одного адреса', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 40; i++) {
      const res = await POST(
        new Request('https://example.test/api/visit', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin', 'x-forwarded-for': '203.0.113.7' },
          body: JSON.stringify({ a: { utm_source: 'tiktok' } }),
        }),
      )
      statuses.push(res.status)
    }
    expect(statuses.filter((s) => s !== 204)).toEqual([])
  })
})
