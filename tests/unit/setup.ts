import { beforeEach } from 'vitest'
import { setAlertSinkForTests } from '@/lib/ai/core/alerts'
import { resetBreakerForTests } from '@/lib/ai/core/breaker'

/**
 * Состояние обвязки, которое живёт в памяти процесса (предохранитель, счётчик «ИИ лежит»), не должно перетекать из
 * теста в тест: упавшая модель одного теста иначе меняла бы порядок цепочки в следующем.
 */
beforeEach(() => {
  resetBreakerForTests()
  setAlertSinkForTests(() => {})
})
