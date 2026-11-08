import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage } from '@/components/legal-page'
import copy from '@/content/sdvg-copy.ru.json'

export const metadata: Metadata = {
  title: 'Как устроен тест на СДВГ — ASRS v1.1, подсчёт и ограничения | Напарник',
  description: 'Источник опросника ВОЗ ASRS v1.1, официальный подсчёт Harvard 0–24, что тест может и чего не может, где пройти очную диагностику.',
  alternates: { canonical: '/sdvg-test/metod' },
}

export const dynamic = 'force-static'

/** Страница метода (research/14-lead-magnets/owner-asrs-bridge.md, раздел SEO) и «Где пройти очную диагностику». */
export default function MethodPage() {
  return (
    <LegalPage title="Как устроен тест">
      <section className="flex flex-col gap-2">
        <h2>Опросник</h2>
        <p>
          Первые 6 вопросов — шкала самоотчёта о СДВГ у взрослых ASRS v1.1 Всемирной организации здравоохранения, в
          официальной русской формулировке, без изменений. Следующие 4 вопроса — от Напарника: они не часть ASRS и на балл
          не влияют.
        </p>
        <p>{copy.footer.copyright}</p>
      </section>
      <section className="flex flex-col gap-2">
        <h2>Подсчёт</h2>
        <p>
          Официальный подсчёт Harvard Medical School (обновление от 28.02.2024): каждый ответ — от 0 до 4 баллов, сумма от
          0 до 24. Порог положительного скрининга — 14. Диапазоны: 0–9, 10–13, 14–17, 18–24. Ответы считаются в твоём
          браузере и никуда не отправляются.
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h2>Что тест может и чего не может</h2>
        <ul>
          <li>Это скрининг, а не диагноз. Диагноз ставит только врач после очной беседы.</li>
          <li>
            Точность из исходной проверки 2005 года (Kessler и соавторы) относится к другой системе подсчёта и к общей
            выборке; для подсчёта 0–24 Harvard точность не публикует.
          </li>
          <li>Похожие ответы бывают при тревоге, депрессии, недосыпе, выгорании, проблемах со щитовидкой.</li>
          <li>
            Русская версия опросника проходила апробацию (Бехтеревский обзор, 2026: 500 человек), порог и точность в
            аннотации не указаны.
          </li>
        </ul>
        <p className="text-sm text-muted-foreground">{copy.footer.citation}</p>
      </section>
      <section id="vrach" className="flex flex-col gap-2">
        <h2>Где пройти очную диагностику</h2>
        <p>
          СДВГ у взрослых диагностирует психиатр или психиатр-психотерапевт: в частной клинике или в
          психоневрологическом диспансере (ПНД) по месту жительства. Возьми с собой результат этого теста и примеры того,
          что мешает в работе, учёбе или отношениях — с детства и сейчас.
        </p>
        <p>
          Если сейчас очень тяжело и есть мысли причинить себе вред — звони 112 или в скорую 103.
        </p>
      </section>
      <p>
        <Link href="/sdvg-test" className="underline">
          ← К тесту
        </Link>
      </p>
    </LegalPage>
  )
}
