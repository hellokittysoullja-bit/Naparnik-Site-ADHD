for _t, _c in E.items():
    if _c['steps'] is None and _t in _raw:
        _r = [fix(s) for s in _raw[_t]]
        for _k, _v in _c['rep'].items():
            if isinstance(_k, int): _r[_k] = _v
        _idx = _c['order'] or list(range(len(_r)))
        _c['steps'] = [_r[i] for i in _idx if i not in _c['drop']]
        _c['drop'], _c['rep'], _c['order'] = [], {'_': 1}, None
