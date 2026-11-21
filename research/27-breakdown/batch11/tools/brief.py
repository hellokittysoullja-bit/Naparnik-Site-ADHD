import json,sys,glob
d={}
for f in sorted(glob.glob('raw[0-9].json')): d.update(json.load(open(f)))
tasks=[l.strip() for l in open('tasks.txt') if l.strip()]
a,b=int(sys.argv[1]),int(sys.argv[2])
for i,t in enumerate(tasks[a:b],a):
    if t.startswith('Купить '): continue
    s=d.get(t)
    if not s: print(f"{i} {t}: —"); continue
    print(f"{i} {t} ({len(s)}): "+" | ".join(x.strip().rstrip('.')[:42] for x in s[:4]))
