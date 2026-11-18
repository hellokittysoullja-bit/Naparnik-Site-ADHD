import Link from 'next/link'
import asrs from '@/content/asrs-ru.json'
import { SDVG_ARTICLE as A } from '@/content/sdvg-article.ru'

/**
 * Статья под экраном входа теста — для людей, которые хотят понять тест до начала, и для поисковиков, которым без неё
 * на странице видны только заголовок и кнопка (research/29-seo-audit). Серверный компонент: весь текст в HTML.
 * Показывается только на экране входа (sdvg-test.tsx), при обновлении на вопросе прячется до первого кадра
 * (`html[data-test-step]`, globals.css).
 */
export function SdvgArticle() {
  return (
    <article className="sdvg-article mt-10 flex flex-col gap-8 border-t border-border pt-8 text-left text-[15px] leading-relaxed">
      <section className="flex flex-col gap-3">
        <h2 className="text-[22px] font-bold leading-snug">{A.title}</h2>
        {A.intro.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="sdvg-q">
        <h2 id="sdvg-q" className="text-lg font-bold leading-snug">
          {A.questionsTitle}
        </h2>
        <p className="text-muted-foreground">{A.questionsLead}</p>
        <p className="text-muted-foreground">{asrs.instruction}</p>
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          {asrs.items.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
        <p className="text-muted-foreground">Варианты ответа: {asrs.options.join(' · ')}.</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold leading-snug">{A.scoringTitle}</h2>
        {A.scoring.map((p) => (
          <p key={p}>{p}</p>
        ))}
        <ul className="flex flex-col gap-1">
          {A.bands.map((b) => (
            <li key={b.range}>
              <span className="font-semibold tabular-nums">{b.range}</span> — {b.text}
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground">{A.scoringNote}</p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold leading-snug">{A.faqTitle}</h2>
        {A.faq.map((f) => (
          <div key={f.q} className="flex flex-col gap-1">
            <h3 className="font-semibold">{f.q}</h3>
            <p>{f.a}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold leading-snug">{A.helpTitle}</h2>
        <p>{A.help}</p>
        <ul className="flex flex-col gap-2">
          {A.helpLinks.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="text-primary underline underline-offset-4">
                {l.text}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <p className="text-[13px] text-muted-foreground">
        Обновлено <time dateTime={A.updated}>{new Date(A.updated).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</time>
      </p>
    </article>
  )
}

/** Те же вопросы-ответы для разметки FAQPage: только то, что видно на странице */
export function sdvgFaqLd() {
  return {
    '@type': 'FAQPage',
    mainEntity: A.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }
}
