# что скачано после прошлого чтения: печать (SKIM/FULL как scan.py) и запоминание в seen.txt
import os, subprocess, sys
exec(open('cur0.py').read())
seen = set(open('seen.txt').read().split('\n')) if os.path.exists('seen.txt') else set()
tasks=[l for l in open('tasks.txt').read().split('\n') if l]
new=[i for i,t in enumerate(tasks) if t in E and t not in seen]
print('новых', len(new))
if sys.argv[1:] == ['mark']:
    open('seen.txt','w').write('\n'.join(t for t in tasks if t in E)); sys.exit()
open('/tmp/claude-0/only.txt','w').write('\n'.join(tasks[i] for i in new))
