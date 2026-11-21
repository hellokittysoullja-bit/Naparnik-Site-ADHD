import json,re,sys
D=sys.argv[1]
c=json.load(open(D+'/curated-batch10.json')); m=json.load(open(D+'/mins.json'))
WAIT=re.compile(r'ждат|дожд|доставк|высох|высуш|сохнуть|результат|ответ[аы]? от|решени[ея] |рассмотр|постир|запуст|оставить на|ремонт|зачислен|получить (?:паспорт|полис|справку|документ)|отработать|сезон|урожай|свадьб|практик|ночь|ночлег|спать|сон', re.I)
GRID=[1,2,3,5,10,15,20,30,45,60,90,120,180,240,300,360,480,720,1440,2880,4320,10080]
snap=lambda x: min(GRID,key=lambda g:abs(g-x))
flag=[]
for t,v in c['plans'].items():
    if v['m']: continue
    mm=[snap(x) for x in m[t]]
    for i,s in enumerate(v['steps']):
        if mm[i]>120 and not WAIT.search(s+' '+t): mm[i]=60 if mm[i]>=240 else mm[i]
    m[t]=mm
    if sum(mm)>480 or max(mm)>=180: flag.append(t)
json.dump(m,open(D+'/mins.json','w'),ensure_ascii=False)
for t in flag: print(t,'['+str(sum(m[t]))+']',' | '.join(f'{s[:34]}={x}' for s,x in zip(c['plans'][t]['steps'],m[t])))
