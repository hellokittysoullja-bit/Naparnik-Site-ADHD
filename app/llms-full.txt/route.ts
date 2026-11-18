import asrs from '@/content/asrs-ru.json'
import { PAINS } from '@/content/pains.ru'
import { SDVG_ARTICLE as A } from '@/content/sdvg-article.ru'
import { siteUrl } from '@/lib/site'

/**
 * Полный текст публичных страниц одним файлом для нейросетей (llms-full.txt — спутник app/llms.txt). Собирается из
 * тех же файлов контента, что и страницы, поэтому не расходится с сайтом. Только то, что уже видно на страницах.
 */
export const dynamic = 'force-static'

export function GET() {
  const out: string[] = []
  out.push('# Напарник — полный текст публичных страниц', '')
  out.push(
    '> Бесплатный русскоязычный веб-напарник для тех, кому трудно начинать дела: люди с плохим фокусом, прокрастинацией или СДВГ. Кот-напарник сидит рядом во время короткой сессии фокуса, дело разбивается на маленькие шаги, из стартов растёт остров. Без регистрации. Это не медицинский сервис; тест на СДВГ — самопроверка, а не диагноз.',
    '',
  )

  out.push(`## ${A.title}`, '', `Адрес: ${siteUrl('/sdvg-test')} · обновлено ${A.updated}`, '')
  out.push(...A.intro.flatMap((p) => [p, '']))
  out.push(`### ${A.questionsTitle}`, '', A.questionsLead, '', asrs.instruction, '')
  out.push(...asrs.items.map((q, i) => `${i + 1}. ${q}`), '', `Варианты ответа: ${asrs.options.join(', ')}.`, '')
  out.push(`### ${A.scoringTitle}`, '', ...A.scoring, '', ...A.bands.map((b) => `- ${b.range} — ${b.text}`), '', A.scoringNote, '')
  out.push(`### ${A.faqTitle}`, '')
  for (const f of A.faq) out.push(`**${f.q}**`, '', f.a, '')
  out.push(`### ${A.helpTitle}`, '', A.help, '')

  out.push('## Что мешает начать и что с этим делает Напарник', '', `Адрес: ${siteUrl('/pomogaet')}`, '')
  for (const p of PAINS) {
    out.push(`### ${p.title}`, '', `Адрес: ${siteUrl(`/pomogaet/${p.slug}`)}`, '', p.lead, '')
    out.push(...p.helps.map((h) => `- **${h.name}.** ${h.text}`), '')
  }
  return new Response(out.join('\n'), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } })
}
