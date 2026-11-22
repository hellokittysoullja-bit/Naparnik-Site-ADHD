# Партия 12 → база: планы в breakdown-goblin.ts, синонимы в breakdown-aliases.ts, минуты в minutes.json
import json, re, sys, os
D = os.path.dirname(os.path.abspath(__file__)); R = '/home/user/Naparnik-Site-ADHD/lib/ai/agents/'
cur = json.load(open(D + '/curated-batch12.json')); plans, old = cur['plans'], cur['old_aliases']
q = lambda s: json.dumps(s, ensure_ascii=False)
g = open(R + 'breakdown-goblin.ts').read()
end = g.index('\n}\n', g.index('export const GOBLIN_PLANS'))
existing = set(re.findall(r'^  "([^"]+)": \[', g[:end], re.M))
clash = set(plans) & existing
assert not clash, clash
g = g[:end] + '\n' + ''.join(f'  {q(t)}: [{", ".join(q(s) for s in v["steps"])}],\n' for t, v in plans.items()).rstrip('\n') + g[end:]
open(R + 'breakdown-goblin.ts', 'w').write(g)
a = open(R + 'breakdown-aliases.ts').read()
added_old = 0
for o, names in old.items():
    m = re.search(r'^  ' + re.escape(q(o)) + r': \[(.*)\],$', a, re.M)
    have = set(json.loads('[' + m.group(1) + ']')) if m else set()
    names = [n for n in names if n not in have and n != o]
    if not names: continue
    added_old += len(names)
    if m:
        a = a[:m.start()] + f'  {q(o)}: [{m.group(1)}, {", ".join(q(x) for x in names)}],' + a[m.end():]
    else:
        aend = a.rindex('\n}')
        a = a[:aend] + f'\n  {q(o)}: [{", ".join(q(x) for x in names)}],' + a[aend:]
aend = a.rindex('\n}')
a = a[:aend] + ''.join(f'\n  {q(t)}: [{", ".join(q(s) for s in v["synonyms"])}],' for t, v in plans.items() if v['synonyms']) + a[aend:]
open(R + 'breakdown-aliases.ts', 'w').write(a)
mins = json.load(open(D + '/mins.json'))
mp = '/home/user/Naparnik-Site-ADHD/research/27-breakdown/minutes/minutes.json'
mj = json.load(open(mp))
for t in plans: mj[t] = mins[t]
json.dump(mj, open(mp, 'w'), ensure_ascii=False, separators=(',', ':'))
print('дел', len(plans), 'синонимов новым', sum(len(v['synonyms']) for v in plans.values()), 'старым', added_old)
