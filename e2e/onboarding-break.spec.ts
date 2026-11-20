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
