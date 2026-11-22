import sys, pymorphy3
m = pymorphy3.MorphAnalyzer()
out = open(sys.argv[2], 'w')
for t in open(sys.argv[1]):
    t = t.strip()
    if not t: continue
    w, *rest = t.split(' ')
    p = [x for x in m.parse(w.lower()) if x.tag.POS == 'INFN']
    if not p: continue
    p = p[0]
    tail = ' '.join(rest)
    for tag, name in [({'1per', 'sing', 'futr'}, '1sg'), ({'1per', 'sing', 'pres'}, '1sg'), ({'impr', 'sing', 'excl'}, 'imp'), ({'masc','sing','past'}, 'past'), ({'1per','plur','futr'}, '1pl')]:
        f = p.inflect(tag)
        if f: out.write(f'{name}\t{t}\t{f.word} {tail}'.rstrip() + '\n')
