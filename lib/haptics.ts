/**
 * Хаптика: подтверждение действия телом, минуя зрение.
 * Android (Chrome) — navigator.vibrate. На iOS Safari navigator.vibrate
 * нет вовсе, и раньше iPhone не получал ни одного тика. iOS 18 сам даёт
 * системный тик при переключении нативного `<input type="checkbox" switch>`
 * — переключаем невидимый свитч через его label. Работает только внутри
 * жеста пользователя (тап), то есть ровно там, где хаптика и нужна.
 * Паттерн на iOS сводится к числу тиков. Нет поддержки — тихо ничего.
 */

let iosSwitch: HTMLLabelElement | null = null

function iosTick() {
  if (typeof document === 'undefined') return
  if (!iosSwitch) {
    const label = document.createElement('label')
    label.setAttribute('aria-hidden', 'true')
    label.style.cssText =
      'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.setAttribute('switch', '')
    input.tabIndex = -1
    label.appendChild(input)
    document.body.appendChild(label)
    iosSwitch = label
  }
  iosSwitch.click()
}

function vibrate(pattern: number | number[]) {
  if (typeof navigator === 'undefined') return
  if (typeof navigator.vibrate !== 'function') {
    // Только у iOS-подобных устройств с тачем — на десктопе свитч бесполезен
    if (!/iP(hone|ad|od)/.test(navigator.userAgent) && navigator.maxTouchPoints < 2) return
    const pulses = Array.isArray(pattern) ? Math.ceil(pattern.length / 2) : 1
    try {
      iosTick()
      for (let i = 1; i < pulses; i++) window.setTimeout(iosTick, i * 90)
    } catch {
      /* молчим */
    }
    return
  }
  try {
    navigator.vibrate(pattern)
  } catch {
    // старые браузеры могут бросить — молчим
  }
}

/** Лёгкий тик: нажатие главной кнопки (старт сессии) */
export function hapticStart() {
  vibrate(15)
}

/** Двойной мягкий: находка появилась */
export function hapticReward() {
  vibrate([20, 80, 30])
}

/** Едва заметный: завершение сессии */
export function hapticDone() {
  vibrate(10)
}

/*
 * Ниже — хаптика, привязанная к СОБЫТИЯМ МИРА, а не к тапам (#28).
 * Разница принципиальная: отдача на каждый тап — это шум, к нему рука
 * привыкает за день и перестаёт различать. Отдача на событие («вырос
 * ориентир», «редкая находка») остаётся значимой, потому что заработана и
 * случается редко. Тот же принцип контингентности, что и в сцене: самое
 * заметное — ответ на событие, а не таймер.
 */

/** Ориентир вырос на острове: короткий «толчок земли» — два нарастающих. */
export function hapticLandmark() {
  vibrate([12, 60, 28])
}

/** Редкая находка (сияние): узнаваемый тройной перелив — только для rare. */
export function hapticRare() {
  vibrate([10, 50, 18, 50, 34])
}

/** Реакция поставлена на реплику: одиночный мягкий тик, тише старта. */
export function hapticReaction() {
  vibrate(8)
}

/** Порог pull-to-refresh пройден: подтверждение до отпускания пальца. */
export function hapticThreshold() {
  vibrate(12)
}
