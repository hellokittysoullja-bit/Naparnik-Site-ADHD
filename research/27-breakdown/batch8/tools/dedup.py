import json, re
R = 'lib/ai/agents/'
MERGE = {'Сделать карту для ребёнка': 'Оформить карту ребёнку', 'Составить план выплаты долга': 'Составить план выплаты долгов', 'Убрать мусор из машины': 'Выбросить мусор из машины', 'Отправить открытки из путешествия': 'Отправить открытку из поездки', 'Купить зонтик': 'Купить зонт', 'Купить подарок на Новый год': 'Купить подарки на Новый год', 'Выйти из всех устройств': 'Выйти из аккаунта на чужом устройстве'}
MOVE = {'Отмыть кружки от чая': 'Отмыть кружку от чая', 'Заблокировать мошенников': 'Заблокировать мошенника'}
q = lambda s: json.dumps(s, ensure_ascii=False)
g = open(R + 'breakdown-goblin.ts').read()
for t in MERGE:
    g, n = re.subn(r'\n  ' + re.escape(q(t)) + r': \[.*\],', '', g); assert n == 1, t
open(R + 'breakdown-goblin.ts', 'w').write(g)
a = open(R + 'breakdown-aliases.ts').read()
def entry(name):
    m = re.search(r'\n  ' + re.escape(q(name)) + r': (\[.*\]),', a); return m
def get(name):
    m = entry(name); return json.loads(m.group(1)) if m else None
def put(name, lst):
    global a
    m = entry(name); line = f'\n  {q(name)}: [{", ".join(q(x) for x in lst)}],'
    if m: a = a[:m.start()] + (line if lst else '') + a[m.end():]
    elif lst: i = a.rindex('\n}'); a = a[:i] + line + a[i:]
for t, tgt in MERGE.items():
    own = get(t) or []; put(t, [])
    cur = get(tgt) or []
    put(tgt, cur + [x for x in [t] + own if x not in cur])
for al, tgt in MOVE.items():
    for k, v in re.findall(r'\n  ("[^"]+"): (\[.*\]),', a):
        lst = json.loads(v)
        if al in lst: put(json.loads(k), [x for x in lst if x != al])
    put(tgt, (get(tgt) or []) + [al])
open(R + 'breakdown-aliases.ts', 'w').write(a)
mp = 'research/27-breakdown/minutes/minutes.json'; m = json.load(open(mp))
for t in MERGE: del m[t]
json.dump(m, open(mp, 'w'), ensure_ascii=False, separators=(',', ':'))
print('ok')
