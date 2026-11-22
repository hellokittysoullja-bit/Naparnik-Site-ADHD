# время, написанное в самом шаге («варить 40 минут», «на 3 дня», «на ночь»), важнее оценки по похожим шагам
import json, re, sys
D = sys.argv[1]
c = json.load(open(D + '/curated-batch12.json')); m = json.load(open(D + '/mins.json'))
HAND = {('Позвонить в газовую службу при запахе газа', 3): 1, ('Сдать ковёр в химчистку', 4): 30, ('Обработать обувь пропиткой', 1): 60,
        # число в шаге — не длительность шага
        ('Придумать, что приготовить', 2): 5, ('Сходить к диетологу', 2): 15, ('Отправить коммерческое предложение', 4): 1, ('Выпить мелатонин', 1): 1,
        ('Засолить капусту', 5): 4320}
n = 0
for t, v in c['plans'].items():
    for i, s in enumerate(v['steps']):
        x = None
        if re.search(r'на ночь|за ночь', s): x = 720
        mm = re.search(r'(\d+)(?:[–-](\d+))?\s*(минут|мин\b|час|дн|дня|дней)', s)
        if mm and not re.search(r'с \d+ см|\d+ см', s):
            k = int(mm.group(2) or mm.group(1)); u = mm.group(3)
            x = k if u.startswith('мин') else k * 60 if u.startswith('час') else k * 1440
            if re.search(r'кажд|раз в|по \d+ минут в день', s): x = None
        if (t, i) in HAND: x = HAND[(t, i)]
        if x and x != m[t][i]: n += 1; print(f'{t}: «{s}» {m[t][i]} → {x}'); m[t][i] = x
json.dump(m, open(D + '/mins.json', 'w'), ensure_ascii=False)
print('исправлено', n)
