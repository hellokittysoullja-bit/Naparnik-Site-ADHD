import json,sys
D=sys.argv[1]
c=json.load(open(D+'/curated-batch8.json')); m=json.load(open(D+'/mins.json'))
FIX={('Купить открытку',7):15,('Купить удлинитель',6):30,('Купить маску для сна',7):30,('Купить торт ребёнку',6):30,('Пережить ПМС',1):60,('Научить ребёнка писать',11):20,('Научить ребёнка писать',5):20,('Научить ребёнка писать',6):20,('Обсудить свадьбу',2):60}
for (t,i),v in FIX.items(): m[t][i]=v
assert all(len(m[t])==len(c['plans'][t]['steps']) for t in c['plans'])
json.dump(m,open(D+'/mins.json','w'),ensure_ascii=False); print('ok',len(m))
