# цепочки: дело слито в дело, которое само слито в старое — ведём сразу к концу цепочки
for _k in list(MERGE):
    _v, _n = MERGE[_k], 0
    while _v in MERGE and MERGE[_v] is not None and _n < 5: _v, _n = MERGE[_v], _n + 1
    MERGE[_k] = _v
