'use client'

import { useEffect, useRef, useState } from 'react'
import { MascotSvg } from '@/components/mascot-svg'
import { hapticThreshold } from '@/lib/haptics'

/*
 * #23 · PULL-TO-REFRESH: «кот потягивается».
 *
 * Обычный pull-to-refresh — служебный спиннер. Здесь тот же жест отдаёт
 * характером: тянешь ленту вниз — существо просыпается и потягивается,
 * отпускаешь — данные обновляются. Награда за ЗАВЕРШЁННЫЙ жест, а не
 * анимация по таймеру, поэтому не приедается (та же контингентность, что у
 * сияния в сцене).
 *
 * Почему не нативный overscroll: жест перехватываем ТОЛЬКО когда лента уже
 * в самом верху (scrollTop === 0) и палец идёт вниз — иначе не мешаем ни
 * обычному скроллу, ни системному «назад». Проверяем touch-события, а не
 * pointer: на десктопе pull-to-refresh не нужен, там есть перезагрузка.
 */

const THRESHOLD = 68 // px — столько нужно протянуть, чтобы жест засчитался
const MAX_PULL = 96 // дальше не тянем: резина, а не бесконечная лента

export function PullToStretch({
  scrollRef,
  onRefresh,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>
  onRefresh: () => Promise<void> | void
}) {
  const [pull, setPull] = useState(0)
  const [stretching, setStretching] = useState(false)
  const startY = useRef<number | null>(null)
  const crossedRef = useRef(false)
  /*
   * stretching и onRefresh держим в ref-ах, а не в зависимостях эффекта.
   * Причина не в оптимизации: пока `stretching` был зависимостью, его
   * переключение перерегистрировало слушатели, а cleanup обнулял
   * transform — лента срывалась назад в тот самый момент, когда должна
   * была приоткрыто держаться на время обновления. Слушатели ставим один
   * раз за жизнь ленты, а свежие значения читаем из ref-ов.
   */
  const stretchingRef = useRef(false)
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    function onTouchStart(e: TouchEvent) {
      // Тянуть можно только с самого верха — иначе это обычный скролл.
      if (el!.scrollTop > 0) {
        startY.current = null
        return
      }
      startY.current = e.touches[0].clientY
      crossedRef.current = false
      // Страховка: если предыдущий жест оборвался, не оставив touchend
      // (переключение приложения, системный жест), лента могла остаться
      // приоткрытой. Новое касание всегда начинает с чистого состояния.
      if (!stretchingRef.current) {
        setPull(0)
        el!.style.transition = ''
        el!.style.transform = ''
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (startY.current === null || stretchingRef.current) return
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0) {
        // Палец пошёл вверх — отдаём жест обычному скроллу.
        setPull(0)
        startY.current = null
        el!.style.transform = ''
        return
      }
      // Резиновое сопротивление: чем дальше, тем туже — жест сообщает
      // телом, что предел близко, без всякой подписи.
      const eased = Math.min(MAX_PULL, dy * 0.5)
      setPull(eased)
      // Лента ФИЗИЧЕСКИ уходит вниз за пальцем, освобождая зазор, в котором
      // просыпается существо. Без этого индикатор просто ложился поверх
      // приветствия — «наклейка сверху» вместо оттягиваемой шторки.
      // Пишем в style напрямую: это следование за пальцем кадр в кадр,
      // прогонять его через React-состояние — лишние рендеры на каждый
      // touchmove.
      el!.style.transform = `translateY(${eased}px)`
      if (!crossedRef.current && eased >= THRESHOLD) {
        crossedRef.current = true
        // Подтверждение порога ДО отпускания пальца: человек знает, что
        // отпускать уже можно, и не тянет вслепую дальше.
        hapticThreshold()
      }
    }

    async function onTouchEnd() {
      if (startY.current === null) return
      const reached = crossedRef.current
      startY.current = null
      // Возврат ленты — всегда с пружинкой: палец отпущен, дальше двигает
      // не человек, а физика. transition ставим только здесь, чтобы во
      // время самого жеста лента шла за пальцем без задержки.
      el!.style.transition = 'transform 320ms cubic-bezier(0.34, 1.3, 0.64, 1)'
      const settle = () => {
        el!.style.transform = ''
        window.setTimeout(() => {
          el!.style.transition = ''
        }, 340)
      }
      if (!reached) {
        setPull(0)
        settle()
        return
      }
      stretchingRef.current = true
      setStretching(true)
      setPull(THRESHOLD)
      // Лента остаётся приоткрытой на время обновления: место, где идёт
      // работа, видно — это и есть индикатор загрузки, отдельный не нужен.
      el!.style.transform = `translateY(${THRESHOLD}px)`
      try {
        await onRefreshRef.current()
      } finally {
        // Держим потягивание до конца его анимации (0.85s в CSS), иначе
        // награда обрывается на полудвижении.
        window.setTimeout(() => {
          stretchingRef.current = false
          setStretching(false)
          setPull(0)
          settle()
        }, 850)
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
      // Снимаем инлайновые стили за собой: иначе лента может остаться
      // сдвинутой, если размонтирование застало жест в середине.
      el.style.transform = ''
      el.style.transition = ''
    }
  }, [scrollRef])

  const visible = pull > 2 || stretching
  const ready = pull >= THRESHOLD

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center overflow-hidden"
      style={{
        height: visible ? Math.max(pull, stretching ? THRESHOLD : 0) : 0,
        transition: startY.current === null ? 'height 220ms ease-out' : 'none',
      }}
    >
      <div
        className="flex items-end pb-1"
        style={{
          opacity: visible ? Math.min(1, pull / THRESHOLD) : 0,
          transform: `scale(${0.8 + Math.min(1, pull / THRESHOLD) * 0.2})`,
        }}
      >
        <span className={stretching ? 'cat-stretch block' : 'block'}>
          <MascotSvg
            // Потягивается — значит просыпается: сонный до порога,
            // довольный после. Мимика сообщает состояние жеста без текста.
            expression={stretching ? 'happy' : ready ? 'excited' : 'sleepy'}
            size={38}
          />
        </span>
      </div>
    </div>
  )
}
