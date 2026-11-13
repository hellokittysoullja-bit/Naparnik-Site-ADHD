import type { SVGProps } from 'react'

/**
 * Иконка вкладки «Дом» — силуэт нашего кота (владелец, 13.11): уши, голова, тело, хвост завитком, без глаз и деталей.
 * Заливка цветом текста, как у остальных иконок меню; strokeWidth принимаем для совместимости с иконками lucide —
 * активная вкладка становится чуть плотнее за счёт тонкой обводки тем же цветом.
 */
export function CatSilhouette({ strokeWidth = 2, ...props }: SVGProps<SVGSVGElement> & { strokeWidth?: number | string }) {
  const outline = Number(strokeWidth) > 2 ? 0.6 : 0
  return (
    <svg viewBox="2 1.6 20.5 20.5" fill="currentColor" stroke="currentColor" strokeWidth={outline} strokeLinejoin="round" {...props}>
      {/* уши и голова */}
      <path d="M4.6 9.6 4.9 3.2l3.6 2.6a6.7 6.7 0 0 1 3 0l3.6-2.6.3 6.4a5.4 5.4 0 0 1-.5 4.1H5.1a5.4 5.4 0 0 1-.5-4.1Z" />
      {/* тело сидя */}
      <path d="M6 13c-1.6 1.6-2.4 3.7-2.4 5.6 0 1.3.9 2.2 2.2 2.2h8.8c1.3 0 2.2-.9 2.2-2.2 0-1.9-.8-4-2.4-5.6Z" />
      {/* хвост завитком вправо-вверх */}
      <path d="M16.2 20.2c2.4 0 4.6-1.5 4.6-4.2 0-1.9-1.2-3-2.5-3-1 0-1.7.7-1.7 1.6 0 .7.5 1.2 1.1 1.2" fill="none" strokeWidth={2.1} strokeLinecap="round" />
    </svg>
  )
}
