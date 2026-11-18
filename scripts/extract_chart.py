"""Read stacked-bar values from a vector chart in a PDF page.
usage: extract.py pdf page x0 x1 [ylo yhi]   (x0..x1 = horizontal span of one plot panel)"""
import sys, re, json, pdfplumber
pdf, page, X0, X1 = sys.argv[1], int(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4])
YLO, YHI = (float(sys.argv[5]), float(sys.argv[6])) if len(sys.argv) > 6 else (0, 1e9)
p = pdfplumber.open(pdf).pages[page - 1]
col = lambda c: None if c is None else ((round(c, 3),) if isinstance(c, (int, float)) else tuple(round(x, 3) for x in c))
words = p.extract_words()
rects = [dict(x0=r['x0'], x1=r['x1'], top=r['top'], bot=r['bottom'], c=col(r.get('non_stroking_color'))) for r in p.rects]
fills = [r for r in rects if r['c'] not in [(0.0,), None] and not (r['c'] == (1.0,) and r['x1'] - r['x0'] > 40) and r['x1'] - r['x0'] > 5 and r['bot'] - r['top'] > 0.05
         and X0 <= (r['x0'] + r['x1']) / 2 <= X1 and YLO <= r['top'] <= YHI and r['x1'] - r['x0'] < 120]
# legend: small squares anywhere on the page -> label = words to the right on the same line
legend = {}
for r in rects:
    if r['c'] in [(0.0,), (1.0,), None]: continue
    if r['x1'] - r['x0'] < 7 and r['bot'] - r['top'] < 7:
        cy = (r['top'] + r['bot']) / 2
        line = sorted([w for w in words if abs((w['top'] + w['bottom']) / 2 - cy) < 4 and 0 < w['x0'] - r['x1'] < 120], key=lambda w: w['x0'])
        txt, last = [], r['x1']
        for w in line:
            if w['x0'] - last > 12: break
            txt.append(w['text']); last = w['x1']
        if txt:
            nxt = [w for w in words if abs(w['x0'] - line[0]['x0']) < 2 and 5 < w['top'] - line[0]['top'] < 12]
            if nxt and not any(abs((r2['top'] + r2['bot']) / 2 - (nxt[0]['top'] + nxt[0]['bottom']) / 2) < 4 for r2 in rects if r2['x1'] - r2['x0'] < 7 and abs(r2['x0'] - r['x0']) < 2):
                txt.append(' '.join(w['text'] for w in sorted([w for w in words if abs(w['top'] - nxt[0]['top']) < 2 and nxt[0]['x0'] - 1 <= w['x0'] < nxt[0]['x0'] + 80], key=lambda w: w['x0'])))
        legend.setdefault(r['c'], ' '.join(txt))
# y axis: numeric words left of the panel, within YLO..YHI
ticks = [((w['top'] + w['bottom']) / 2, float(w['text'].replace(',', ''))) for w in words
         if re.fullmatch(r'-?[0-9][0-9,]*(\.[0-9]+)?', w['text']) and X0 - 40 < w['x1'] <= X0 + 6 and YLO <= w['top'] <= YHI]
ticks = sorted(set(ticks))
# robust: drop ticks that break the linear spacing (stray digits such as the 2 in 'Mtpa H2')
def fit(ts):
    n = len(ts); my = sum(t[0] for t in ts) / n; mv = sum(t[1] for t in ts) / n
    sl = sum((t[0] - my) * (t[1] - mv) for t in ts) / sum((t[0] - my) ** 2 for t in ts)
    return my, mv, sl
while len(ticks) > 3:
    my, mv, sl = fit(ticks)
    res = [abs(mv + sl * (t[0] - my) - t[1]) for t in ticks]
    if max(res) < 0.02 * (max(t[1] for t in ticks) - min(t[1] for t in ticks)): break
    ticks.pop(res.index(max(res)))
n = len(ticks); my = sum(t[0] for t in ticks) / n; mv = sum(t[1] for t in ticks) / n
slope = sum((t[0] - my) * (t[1] - mv) for t in ticks) / sum((t[0] - my) ** 2 for t in ticks)
val = lambda y: mv + slope * (y - my)
# group bars by x centre
groups = {}
for r in fills:
    k = round((r['x0'] + r['x1']) / 2)
    groups.setdefault(k, []).append(r)
out = []
for k in sorted(groups):
    segs = sorted(groups[k], key=lambda r: -r['bot'])
    below = [w['text'] for w in words if abs((w['x0'] + w['x1']) / 2 - k) < 14 and max(r['bot'] for r in segs) < w['top'] < max(r['bot'] for r in segs) + 22]
    out.append({'x': k, 'label': ' '.join(below), 'total': round(val(min(r['top'] for r in segs)) - val(max(r['bot'] for r in segs)), 3),
                'base': round(val(max(r['bot'] for r in segs)), 3), 'segments': [{'series': legend.get(r['c'], str(r['c'])), 'value': round(val(r['top']) - val(r['bot']), 3), 'lo': round(val(r['bot']), 3)} for r in segs]})
print(json.dumps({'ticks': ticks, 'legend': {str(k): v for k, v in legend.items()}, 'bars': out}, ensure_ascii=False, indent=1))
