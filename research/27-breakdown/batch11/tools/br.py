# сжатый вид планов для чтения: номер, дело, шаги через | (после авто-правки формы cur0)
import sys, re
exec(open('cur0.py').read())
tasks=[l for l in open('tasks.txt').read().split('\n') if l]
a,b=int(sys.argv[1]),int(sys.argv[2])
for i,t in enumerate(tasks[a:b],a):
    c=E.get(t)
    if not c: print(f'{i} {t}: —'); continue
    st=c['steps']
    print(f"{i} {t} ({len(st)}): "+" | ".join(re.sub(r'\s+',' ',x)[:60] for x in st))
