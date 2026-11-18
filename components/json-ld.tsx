/**
 * Структурированные данные schema.org (JSON-LD) для поисковиков и нейропоиска. Глазом не видны, на отрисовку не влияют
 * (браузер такой <script> не выполняет). Писать сюда только то, что правда видно на странице или делает продукт:
 * без выдуманных оценок, отзывов и цифр (Google снимает за это разметку со всего сайта).
 */
export function JsonLd({ data }: { data: object }) {
  // «<» экранируем: строка из данных не может закрыть тег </script>
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
}
