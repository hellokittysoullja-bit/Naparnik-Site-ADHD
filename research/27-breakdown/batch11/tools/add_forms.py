# дописать формулировки существительным (forms.py → проверка formchk.mts) синонимами в breakdown-aliases.ts
import json, re, sys
q = lambda s: json.dumps(s, ensure_ascii=False)
p = '/home/user/Naparnik-Site-ADHD/lib/ai/agents/breakdown-aliases.ts'
a = open(p).read()
add = {}
for l in open(sys.argv[1]).read().split('\n'):
    if l: f, t = l.split('\t'); add.setdefault(t, []).append(f)
new = []
for t, fs in add.items():
    m = re.search(r'^  ' + re.escape(q(t)) + r': \[(.*)\],$', a, re.M)
    if m: a = a[:m.start()] + f'  {q(t)}: [{m.group(1)}, {", ".join(q(x) for x in fs)}],' + a[m.end():]
    else: new.append(f'  {q(t)}: [{", ".join(q(x) for x in fs)}],')
end = a.rindex('\n}')
a = a[:end] + '\n  // формулировки существительным (21.11, research/27-breakdown/batch11/tools/forms.py): «Мытьё духовки», «Запись к стоматологу»\n' + '\n'.join(new) + a[end:]
open(p, 'w').write(a)
print('форм', sum(map(len, add.values())), 'дел', len(add))
