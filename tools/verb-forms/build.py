"""
Формы глаголов базы дел → инфинитив (22.11). Человек пишет «помою посуду», «позвоню маме», «давай помоем», «помыл
посуду» — в базе дело «Помыть посуду». Здесь для каждого инфинитива, который встречается в названиях дел и синонимах,
собираются его личные формы, повелительное наклонение и прошедшее время (pymorphy3), и пишутся в
lib/ai/agents/breakdown-verb-forms.ts. Форма берётся, только если pymorphy сам первым разбором считает её этим глаголом
(хотя бы одним разбором; слова из самой базы не трогаются) и она не совпадает со словом из базы и не ведёт к двум разным глаголам.
Запуск: python3 tools/verb-forms/build.py <словарь слов базы, по слову в строке> (нужен pymorphy3).
"""
import sys, json
import pymorphy3

m = pymorphy3.MorphAnalyzer()
vocab = [w.strip() for w in open(sys.argv[1]) if w.strip()]
words = set(vocab)
infs = sorted({w for w in vocab if any(p.tag.POS == 'INFN' and p.normal_form == w for p in m.parse(w))})
TAGS = [
    {'1per', 'sing', 'futr'}, {'1per', 'sing', 'pres'}, {'1per', 'plur', 'futr'}, {'1per', 'plur', 'pres'},
    {'2per', 'sing', 'futr'}, {'2per', 'sing', 'pres'},
    {'impr', 'sing', 'excl'}, {'impr', 'plur', 'excl'}, {'impr', 'plur', 'incl'},
    {'masc', 'sing', 'past'}, {'femn', 'sing', 'past'}, {'plur', 'past'},
]
cand = {}
lead_cand = {}
for inf in infs:
    p = next(p for p in m.parse(inf) if p.tag.POS == 'INFN' and p.normal_form == inf)
    for tag in TAGS:
        f = p.inflect(tag)
        if not f:
            continue
        w = f.word.replace('ё', 'е')
        if w == inf:
            continue
        lead = w in words
        # форма — правда этот глагол хотя бы одним разбором («настрою» pymorphy первым считает существительным
        # «настрой», но слова «настрой» в базе нет — значит, человек пишет глагол); слова из базы не трогаются выше
        if not any(x.tag.POS == 'VERB' and x.normal_form.replace('ё', 'е') == inf for x in m.parse(w)):
            continue
        (lead_cand if lead else cand).setdefault(w, set()).add(inf)
out = {w: next(iter(v)) for w, v in sorted(cand.items()) if len(v) == 1}
# слово, которое есть в базе и другим словом («встречу» — «назначить встречу»), меняется только первым в фразе:
# «встречу курьера» — глагол, «перенести встречу» — нет
lead_out = {w: next(iter(v)) for w, v in sorted(lead_cand.items()) if len(v) == 1}
with open('lib/ai/agents/breakdown-verb-forms.ts', 'w') as f:
    f.write('// Собрано tools/verb-forms/build.py — руками не править. Форма глагола из базы дел → инфинитив\n')
    f.write('// («помою» → «помыть»): поиск пробует так, только если фраза как написана не нашлась\n')
    f.write('export const VERB_FORMS: Readonly<Record<string, string>> = ')
    f.write(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
    f.write('\n')
    f.write('/** то же для форм, совпадающих со словом из базы: меняются только первым словом фразы */\n')
    f.write('export const VERB_FORMS_LEAD: Readonly<Record<string, string>> = ')
    f.write(json.dumps(lead_out, ensure_ascii=False, separators=(',', ':')))
    f.write('\n')
print(len(infs), 'infinitives,', len(out), 'forms,', len(lead_out), 'lead forms')
