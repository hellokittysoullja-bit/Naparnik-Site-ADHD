import json, re, sys, glob
D = sys.argv[1]
src = ''.join(open(f).read() for f in sorted(glob.glob(f'{D}/cur[0-9]*.py'), key=lambda p: int(re.search(r'cur(\d+)', p).group(1))))
g = {'MERGE': {}, 'RENAME': {}}; exec(src, g)
E = g['E']; MERGE = g['MERGE']; RENAME = g['RENAME']
raw = {}
for f in glob.glob(f'{D}/raw[0-9].json'): raw.update(json.load(open(f)))
tasks = [l for l in open(f'{D}/tasks.txt').read().split('\n') if l]
# одно слово / синонимы → старые дела (map2: alias=OLD:… или NEW:…)
skip, extra = dict(MERGE), {}
for t, tgt in MERGE.items():
    for sy in E.get(t, {}).get('syn', []): skip.setdefault(sy, tgt)
for l in open(f'{D}/map2.txt').read().split('\n'):
    if not l: continue
    a, t = l.split('=', 1)
    kind, name = t.split(':', 1)
    if kind == 'OLD': skip.setdefault(a, name)
    else: extra.setdefault(name, []).append(a)
h = json.load(open(f'{D}/have.json'))
EX = {n.lower() for n in h['names']} | {a[0].lower() for a in h['aliases']}
seen = set()
out, problems = {}, []
# защита (20.11): ручное дело, которого нет в списке гоблина, раньше молча выпадало (так потерялись 20 дел batch10);
# дело с названием, которое уже есть в базе, — дубль
for t, c in E.items():
    if c['steps'] and t not in tasks and t not in MERGE: problems.append(f'ручное дело не в tasks.txt: {t}')
    if t.lower() in {n.lower() for n in h['names']}: problems.append(f'дело уже есть в базе: {t}')
for t in tasks:
    if t in MERGE: continue
    if t not in E: problems.append(f'не куриpовано: {t}'); continue
    c = E[t]
    if c['steps']: steps = list(c['steps'])
    else:
        if t not in raw: problems.append(f'нет сырья: {t}'); continue
        r = [s.strip() for s in raw[t]]
        for k, v in c['rep'].items():
            if isinstance(k, int): r[k] = v
        idx = c['order'] or list(range(len(r)))
        steps = [r[i] for i in idx if i not in c['drop']]
    steps = [re.sub(r'\s*\.+$', '', s.strip()) for s in steps]
    for s in steps:
        first = s.split()[0].lower()
        if re.search(r'(ите|йте|ьте)(сь)?$', first) or re.search(r'\b(ваш\w*|вас|вам|вы)\b', s, re.I): problems.append(f'повелит./вы: {t}: {s}')
        if ' — ' in s or ' - ' in s: problems.append(f'тире: {t}: {s}')
    if not (2 <= len(steps) <= 18): problems.append(f'длина {len(steps)}: {t}')
    if c['m'] and len(c['m']) != len(steps): problems.append(f'минут {len(c["m"])} ≠ шагов {len(steps)}: {t}')
    syn = []
    for s_ in c['syn'] + extra.get(t, []):
        k = s_.lower()
        if k == t.lower() or k in EX or k in seen or s_ in skip: continue
        seen.add(k); syn.append(s_)
    out[RENAME.get(t, t)] = dict(steps=steps, edited=bool(c.get('ed') or c['drop'] or c['rep'] or c['order']), why=c['why'], synonyms=syn, m=c['m'])
for name in extra:
    if name not in out and name not in MERGE: problems.append(f'синонимы к несуществующему: {name}')
skip = {k: v for k, v in skip.items() if k.lower() not in EX and v is not None and k not in out}
json.dump(dict(plans=out, skip=skip), open(f'{D}/curated-batch11.json', 'w'), ensure_ascii=False, indent=1)
print('plans', len(out), 'skip', len(skip), 'edited', sum(v['edited'] for v in out.values()))
print('\n'.join(problems[:80]))
if problems: sys.exit(1)
