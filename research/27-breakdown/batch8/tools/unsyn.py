import json, re
BAD = ['Разобрать контейнеры','Выкинуть просроченное','Вызвать мастера по кондиционерам','Подстричь ребёнка','Заблокировать спамера','Отдать котёнка','Купить корм для приюта',
'Купить тампоны','Купить масло','Взять ключи','Сфотографироваться','Проверить уши','Проветрить спальню','Поговорить о детях',
'Помыть чайник','Купить торт','Убрать стол','Убрать посуду','Записаться в бассейн','Записаться на УЗИ','Забрать права','Сделать копию','Сделать маску','Убрать одежду','Помыть миску','Полить рассаду','Постирать постельное','Почистить дорожку','Купить билеты']
p = 'lib/ai/agents/breakdown-aliases.ts'; s = open(p).read(); n = 0
for b in BAD:
    q = json.dumps(b, ensure_ascii=False)
    for pat in [', ' + q, q + ', ', q]:
        # только внутри массива синонимов, не как ключ
        m = re.search(r'(\[[^\]]*?)' + re.escape(pat) + r'([^\]]*\])', s)
        if m and not s[m.start():m.end()].startswith(q + ':'):
            s = s[:m.start()] + m.group(1) + m.group(2) + s[m.end():]; n += 1; break
    else: print('нет', b)
s = re.sub(r'\n  "[^"]+": \[\],', '', s)
open(p, 'w').write(s); print('убрано', n)
for f in ['goblin7/curated-batch7.json', 'goblin8/curated-batch8.json']:
    c = json.load(open(f'{D}/{f}' if False else '/tmp/claude-0/-home-user-Naparnik-Site-ADHD/df603098-ec8f-56bd-b920-75ef60b14f8a/scratchpad/' + f))
    for v in c['plans'].values(): v['synonyms'] = [x for x in v['synonyms'] if x not in BAD]
    c['skip'] = {k: v for k, v in c['skip'].items() if k not in BAD}
    json.dump(c, open('/tmp/claude-0/-home-user-Naparnik-Site-ADHD/df603098-ec8f-56bd-b920-75ef60b14f8a/scratchpad/' + f, 'w'), ensure_ascii=False, indent=1)
