'use client'

import { useLayoutEffect } from 'react'
import { NightScene } from '@/components/landing/night-scene'
import { Moon } from '@/components/hero-scene'

/**
 * Фон Фокуса — та же ночная сцена, что на Доме и лендинге (владелец 16.11, скриншот Фокуса: «задний фон замени на
 * наш новый, который на экране Дом»). Общий фон /app (небо по часу, гряда) под ней не рисуется: body[data-own-scene]
 * (app/globals.css). Атрибут ставится до отрисовки — Фокус и так придержан до готовности (lib/first-frame-routes.ts).
 */
export function FocusScene() {
  useLayoutEffect(() => {
    document.body.dataset.ownScene = ''
    return () => {
      delete document.body.dataset.ownScene
    }
  }, [])
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
      <NightScene />
      {/* луна меньше, чем на Доме: пузырь кота (квитанция в две строки) проходит левее неё и её не закрывает (17.11) */}
      <Moon className="absolute right-[3%] top-[max(0.5rem,env(safe-area-inset-top))] w-[clamp(56px,15vw,80px)]" />
    </div>
  )
}
