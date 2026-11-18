import { expect, test } from '@playwright/test'

/**
 * «Оценить время» в «Делах» (18.11): без модели, по базе оценённых шагов; «Считаю время…» видно всегда 1–1,5 с,
 * потом сумма дела. Дело из базы — ровно ручные минуты: «Постирать бельё» 5+2+2+1+60+2+10 = 82 минуты.
 */
test('«Оценить время»: сначала «Считаю время…» не меньше секунды, потом честная сумма дела', async ({ page }) => {
  await page.goto('/app/deals')
  await page.evaluate(() => {
    const steps = [
      'Отсортировать бельё по цвету и типу ткани', 'Проверить карманы', 'Загрузить бельё в стиральную машину',
      'Добавить моющее средство', 'Запустить программу стирки', 'Вынуть бельё из машины', 'Развесить бельё для сушки',
    ].map((text) => ({ text }))
    localStorage.setItem('naparnik:deals', JSON.stringify([{ id: 'd1', title: 'Постирать бельё', icon: 'shirt', createdAt: Date.now(), steps }]))
  })
  await page.reload()
  await page.getByRole('button', { name: /^Инструменты/ }).click()
  const t0 = Date.now()
  await page.getByRole('button', { name: 'Оценить время' }).click()
  await expect(page.getByRole('button', { name: 'Считаю время…' })).toBeVisible()
  await expect(page.getByText('1 час 22 минуты')).toBeVisible({ timeout: 5_000 })
  expect(Date.now() - t0).toBeGreaterThanOrEqual(950)
})
