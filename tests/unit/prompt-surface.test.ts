import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { BREAKDOWN_SYSTEM } from '@/lib/ai/agents/breakdown'
import { MOMENTS, sessionVoiceSystem } from '@/lib/ai/agents/session-voice'
import { CHAT_SYSTEM, FOCUS_CHAT_SYSTEM } from '@/lib/ai/prompt/tasks/chat'
import { systemFor } from '@/lib/ai/prompt/assemble'
import { tools } from '@/lib/ai/tools/catalog'
import { renderMemory } from '@/lib/ai/memory/render'

/**
 * Снимок поверхности промпта (Hermes scripts/ci/prompt_surface.py + tests/ci/test_prompt_surface.py): всё, что
 * модель видит от НАС — системные инструкции каждой задачи и схемы инструментов, — отрисовано боевым кодом и
 * сверено с файлом. Любое изменение того, как кот думает, видно в ревью диффом, а не теряется в коде.
 * Обновить снимок осознанно: `pnpm vitest run tests/unit/prompt-surface.test.ts -u`.
 */
function surface() {
  const system: Record<string, string> = {
    'chat/companion': systemFor(CHAT_SYSTEM),
    'chat/focus': systemFor(FOCUS_CHAT_SYSTEM),
    breakdown: systemFor(BREAKDOWN_SYSTEM),
  }
  for (const m of MOMENTS) system[`session-voice/${m}`] = systemFor(sessionVoiceSystem(m))
  const toolSchemas = Object.fromEntries(
    tools.namesFor('chat').map((n) => {
      const spec = tools.get(n)!
      return [n, { description: spec.description, executor: spec.executor, input: z.toJSONSchema(spec.input, { io: 'input' }) }]
    }),
  )
  return { system, tools: toolSchemas, memoryEmpty: renderMemory(null) }
}

describe('поверхность промпта', () => {
  it('совпадает со снимком', async () => {
    await expect(JSON.stringify(surface(), null, 2)).toMatchFileSnapshot('./__snapshots__/prompt-surface.json')
  })
  it('в системной части нет данных человека и времени — она стабильна для кэша', () => {
    for (const text of Object.values(surface().system)) expect(text).not.toMatch(/```json|\d{1,2}:00/) // блоки данных и время — только в сообщениях
  })
})
