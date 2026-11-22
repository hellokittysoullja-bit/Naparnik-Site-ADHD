import { expect, test } from '@playwright/test'

/**
 * «Оценить время» в «Делах» (18.11): без модели, по базе оценённых шагов; «Считаю время…» видно всегда 1–1,5 с,
 * потом сумма дела. Дело из базы — ручные минуты с поправкой суммы (22.11, research/30-estimate): «Постирать бельё»
 * 3+1+1+1+60+1+7 = 74 минуты (стирка машиной не сжимается).
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
  await expect(page.getByText('1 час 14 минут')).toBeVisible({ timeout: 5_000 })
  expect(Date.now() - t0).toBeGreaterThanOrEqual(950)
})

test('«Оценить время» у дела без шагов (22.11, владелец: «у любого дела»): время по названию, ожидание отдельно', async ({ page }) => {
  await page.goto('/app/deals')
  await page.evaluate(() => {
    localStorage.setItem('naparnik:deals', JSON.stringify([
      { id: 'd1', title: 'Помыть посуду', createdAt: Date.now(), steps: [] },
      { id: 'd2', title: 'Подать налоговый вычет', createdAt: Date.now() - 1, steps: [] },
    ]))
  })
  await page.reload()
  const card = (t: string) => page.getByRole('listitem').filter({ hasText: t })
  await card('Помыть посуду').getByRole('button', { name: /^Инструменты/ }).click()
  await page.getByRole('button', { name: 'Оценить время' }).click()
  await expect(card('Помыть посуду').locator('.time-pill')).toBeVisible({ timeout: 5_000 })
  await expect(page.getByText('Сначала разломай')).toHaveCount(0)
  await card('Подать налоговый вычет').getByRole('button', { name: /^Инструменты/ }).click()
  await page.getByRole('button', { name: 'Оценить время' }).click()
  // ждать решения налоговой — не твоя работа: «и ждать …» рядом с временем, а не внутри
  await expect(card('Подать налоговый вычет').getByText(/^и ждать /)).toBeVisible({ timeout: 5_000 })
  const d = await page.evaluate(() => JSON.parse(localStorage.getItem('naparnik:deals')!))
  expect(d.find((x: { id: string }) => x.id === 'd1').minutes).toBeGreaterThan(0)
  expect(d.find((x: { id: string }) => x.id === 'd2').wait).toBeGreaterThan(1440)
})
