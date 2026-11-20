import json, re, sys
D, R = sys.argv[1], '/home/user/Naparnik-Site-ADHD/lib/ai/agents/'
cur = json.load(open(f'{D}/curated-batch8.json'))
plans, skip = cur['plans'], cur['skip']
q = lambda s: json.dumps(s, ensure_ascii=False)
g = open(R + 'breakdown-goblin.ts').read()
end = g.index('\n}\n', g.index('export const GOBLIN_PLANS'))
existing = set(re.findall(r'^  "([^"]+)": \[', g[:end], re.M))
assert not (set(plans) & existing), set(plans) & existing
body = ''.join(f'  {q(t)}: [{", ".join(q(s) for s in v["steps"])}],\n' for t, v in plans.items())
g = g[:end] + '\n' + body.rstrip('\n') + g[end:]
open(R + 'breakdown-goblin.ts', 'w').write(g)
a = open(R + 'breakdown-aliases.ts').read()
aend = a.rindex('\n}')
for old, new in [(o, n) for n, o in skip.items()]:
    pass
# синонимы старых дел: дописываем в их список (или создаём запись)
add = {}
for n, o in skip.items():
    if o is None: continue
    if o in plans:
        if n not in plans[o]['synonyms']: plans[o]['synonyms'].append(n)  # слито внутри партии
    else: add.setdefault(o, []).append(n)
for o, names in add.items():
    m = re.search(r'^  ' + re.escape(q(o)) + r': \[(.*)\],$', a, re.M)
    if m:
        items = m.group(1) + ', ' + ', '.join(q(x) for x in names)
        a = a[:m.start()] + f'  {q(o)}: [{items}],' + a[m.end():]
    else:
        aend = a.rindex('\n}')
        a = a[:aend] + f'\n  {q(o)}: [{", ".join(q(x) for x in names)}],' + a[aend:]
aend = a.rindex('\n}')
newal = ''.join(f'\n  {q(t)}: [{", ".join(q(s) for s in v["synonyms"])}],' for t, v in plans.items() if v['synonyms'])
a = a[:aend] + newal + a[aend:]
open(R + 'breakdown-aliases.ts', 'w').write(a)
print('добавлено дел', len(plans), 'синонимов', sum(len(v['synonyms']) for v in plans.values()), 'старым делам', sum(map(len, add.values())))
# минуты
mins = json.load(open(f'{D}/mins.json'))
mp = '/home/user/Naparnik-Site-ADHD/research/27-breakdown/minutes/minutes.json'
mj = json.load(open(mp))
for t in plans: mj[t] = mins[t]
json.dump(mj, open(mp, 'w'), ensure_ascii=False, separators=(',', ':'))
print('минуты', len(plans))
