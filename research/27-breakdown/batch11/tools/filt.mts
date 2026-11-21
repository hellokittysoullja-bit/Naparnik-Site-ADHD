import { readFileSync, writeFileSync } from 'node:fs'
import { readyPlan } from '/home/user/Naparnik-Site-ADHD/lib/ai/agents/breakdown'
const D = process.argv[2]
const G = [['Найти', 'Вызвать', 'Выбрать', 'Подобрать', 'Поискать'], ['Оформить', 'Открыть', 'Сделать', 'Получить', 'Завести'], ['Отнести', 'Отправить', 'Сдать', 'Отвезти', 'Отдать'], ['Подготовить', 'Собрать', 'Устроить', 'Организовать', 'Подготовиться к'], ['Начать', 'Завести', 'Взяться за'], ['Получить', 'Взять', 'Забрать'], ['Обновить', 'Поменять', 'Сменить', 'Заменить'], ['Научиться', 'Освоить', 'Выучить', 'Изучить'], ['Перевести', 'Перенести'], ['Отменить', 'Отключить', 'Отписаться от'], ['Перестать', 'Бросить', 'Не', 'Справиться с', 'Побороть', 'Пережить'], ['Настроить', 'Включить', 'Подключить', 'Установить', 'Поставить'], ['Повесить', 'Прибить', 'Поставить'], ['Пожарить', 'Приготовить', 'Сделать', 'Сварить', 'Испечь', 'Запечь'], ['Погладить', 'Отпарить'], ['Помыть', 'Почистить', 'Вымыть', 'Отмыть', 'Протереть', 'Очистить'], ['Сходить к', 'Записаться к', 'Сходить на', 'Записаться на', 'Сделать'], ['Сходить в', 'Съездить в', 'Пойти в', 'Записаться в'], ['Купить', 'Выбрать', 'Заказать', 'Подобрать'], ['Убрать', 'Разобрать', 'Убраться', 'Навести порядок'], ['Починить', 'Отремонтировать', 'Поменять'], ['Сдать', 'Сделать', 'Пройти'], ['Позвонить', 'Набрать'], ['Удалить', 'Убрать', 'Вывести'], ['Восстановить', 'Вернуть'], ['Оплатить', 'Заплатить за'], ['Забронировать', 'Заказать', 'Снять']]
const h = JSON.parse(readFileSync(`${D}/have.json`, 'utf8'))
const all: string[] = [...h.names, ...h.aliases.map((a: string[]) => a[0])]
const stem = (s: string) => s.toLowerCase().replace(/ё/g, 'е').split(/[^а-яa-z0-9]+/).filter((w) => w.length >= 3 && !['для', 'над', 'под', 'при'].includes(w)).map((w) => w.slice(0, Math.max(3, Math.min(5, w.length - 2)))).sort().join(' ')
const byStem = new Map<string, string>(); for (const a of all) byStem.set(stem(a), a)
const tasks = readFileSync(process.argv[3], 'utf8').split('\n').filter(Boolean)
const fresh: string[] = [], dup: string[] = []
for (const t of tasks) {
  const hits: string[] = []
  const r0 = readyPlan(t); const exactT = new Set(all.map((a) => a.toLowerCase().replace(/ё/g, 'е')))
  // узнано «пониманием» с предметом учёбы — у дела с предметом свой план, это новое дело
  const viaSubject = r0 && !exactT.has(r0.title.toLowerCase().replace(/ё/g, 'е')) && /( по | к уроку )/i.test(t) && !exactT.has(t.toLowerCase().replace(/ё/g, 'е'))
  if (r0 && !viaSubject) hits.push(`= ${r0.title}`)
  const st = byStem.get(stem(t)); if (st && !hits.length) hits.push(`~ ${st}`)
  if (!hits.length) for (const g of G) for (const a of g) if (t.startsWith(a + ' ')) for (const b of g) if (b !== a) { const r = readyPlan(b + t.slice(a.length)); if (r && !r.corrected) hits.push(`${b + t.slice(a.length)} → ${r.title}`) }
  if (hits.length) dup.push(`${t}  ⇒  ${[...new Set(hits)].join('; ')}`); else fresh.push(t)
}
writeFileSync(`${D}/fresh.txt`, fresh.join('\n') + '\n'); writeFileSync(`${D}/dup.txt`, dup.join('\n') + '\n')
console.log({ fresh: fresh.length, dup: dup.length })
