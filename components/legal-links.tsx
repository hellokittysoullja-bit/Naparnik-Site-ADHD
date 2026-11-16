import Link from 'next/link'

/**
 * Ссылки на документы (16.11, чек-лист РКН 2026, раздел 2: политика доступна в один клик с любой страницы).
 * Мелко и тихо, но не меньше 12 px и контрастно: прятать реквизиты и документы запрещено так же, как не иметь их.
 */
export function LegalLinks({ className = '' }: { className?: string }) {
  return (
    <nav aria-label="Документы" className={`flex justify-center gap-4 text-[12px] leading-none text-foreground/70 ${className}`}>
      <Link href="/privacy" className="py-1.5 underline-offset-2 hover:underline">
        Конфиденциальность
      </Link>
      <Link href="/terms" className="py-1.5 underline-offset-2 hover:underline">
        Условия
      </Link>
    </nav>
  )
}
