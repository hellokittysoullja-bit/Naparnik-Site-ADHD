import { SITE_URL } from '@/lib/site'

/**
 * robots.txt — текстом, а не через app/robots.ts: у Next нет директивы Clean-param, а она нужна Яндексу.
 *
 * - Всем, включая нейропоиск (ChatGPT, Perplexity, Claude, Алиса, AI-ответы Google), открыт весь сайт, кроме API:
 *   там нечего индексировать, а каждый запрос стоит вызова модели. Боты перечислены явно — так видно, что пускать
 *   их решено осознанно; закрыть кого-то — убрать его строку и добавить Disallow.
 * - /app не закрыт намеренно: робот должен дойти до страницы и увидеть X-Robots-Tag: noindex (next.config.ts),
 *   иначе адрес может попасть в выдачу без описания по одной внешней ссылке.
 * - Clean-param (Яндекс): адреса, которые отличаются только метками роликов, — одна страница, а не дубли.
 */
const AI_BOTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'YandexAdditional',
  'YandexAdditionalBot',
]

const CLEAN = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'src', 'intro', '_t']

export function GET() {
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    '',
    'User-agent: Yandex',
    'Allow: /',
    'Disallow: /api/',
    `Clean-param: ${CLEAN.join('&')}`,
    '',
    ...AI_BOTS.flatMap((ua) => [`User-agent: ${ua}`, 'Allow: /', 'Disallow: /api/', '']),
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
  ].join('\n')
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

export const dynamic = 'force-static'
