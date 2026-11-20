# правки минут batch9 после mfix (повторять при пересборке)
import json,sys
D=sys.argv[1]
m=json.load(open(D+'/mins.json'))
m['Подать заявку в управляющую компанию'][3]=15; m['Подать заявку в управляющую компанию'][4]=5
m['Сдать анализ на гормоны'][8]=5
json.dump(m,open(D+'/mins.json','w'),ensure_ascii=False)
c=json.load(open(D+'/curated-batch9.json'))
for t,v in c['plans'].items(): v['m']=m[t]; assert len(m[t])==len(v['steps']),t
json.dump(c,open(D+'/curated-batch9.json','w'),ensure_ascii=False,indent=1)
print('patched',len(m))
