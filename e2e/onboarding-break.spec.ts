import { expect, test } from '@playwright/test'

// Знакомство «Работа / проекты» + «Не знаю, с чего начать»: своё дело разламывается поленом (владелец 20.11)
test('знакомство: разломанное своё дело не пропадает после перезагрузки (20.11)', async ({ page }) => {
  await page.goto('/app/start?step=7&s=work&h=day&b=where&m=relief&c=q15')
  await page.getByPlaceholder('Вписать своё дело').fill('Помыть посуду')
  await page.getByRole('button', { name: 'Разбить задачу' }).click()
  await expect(page.getByText('Твой первый шаг:')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Продолжить' })).toBeEnabled({ timeout: 8000 })
  await page.reload()
  // раньше: пустое поле и горящая «Продолжить» без выбранного шага
  await expect(page.getByText('Твой первый шаг:')).toBeVisible()
  await expect(page.getByPlaceholder('Вписать своё дело')).toHaveCount(0)
})

// iPhone владельца 22.11: в знакомстве шаги под запиской уходили под «Продолжить» и стояли серыми точками — не 1:1 с Фокусом
for (const vp of [{ width: 390, height: 664 }, { width: 393, height: 852 }, { width: 360, height: 640 }]) {
  test(`знакомство: шаги под запиской — номера 2, 3…, все над «Продолжить» (${vp.width}×${vp.height})`, async ({ page }) => {
    await page.setViewportSize(vp)
    await page.goto('/app/start?step=7&s=work&h=day&b=where&m=relief&c=q15')
    await page.getByPlaceholder('Вписать своё дело').fill('Пойти к психиатру')
    await page.getByRole('button', { name: 'Разбить задачу' }).click()
    await expect(page.getByRole('button', { name: 'Продолжить' })).toBeEnabled({ timeout: 8000 })
    const r = await page.evaluate(() => {
      const list = document.querySelector('[data-rv-list]')
      const cta = document.querySelector('.thumb-cta')!.getBoundingClientRect().top
      const rows = [...(list?.children ?? [])].map((el) => el.getBoundingClientRect().bottom)
      const nums = [...document.querySelectorAll('[data-rv-list] [data-rv-bullet]')].map((el) => el.textContent?.trim())
      return { rows, cta, nums }
    })
    expect(r.rows.length).toBeGreaterThan(0)
    for (const b of r.rows) expect(b).toBeLessThanOrEqual(r.cta)
    expect(r.nums).toEqual(r.rows.map((_, i) => String(i + 2)))
  })
}
