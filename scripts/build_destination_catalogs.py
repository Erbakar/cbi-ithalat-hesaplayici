"""Build data/<sector>.json for the destination-import model (Turkish goods sold at Turkish fairs,
imported by a buyer into the EU or the UK).

Codes: the GTİP lists in sources/2026-11-whatsapp (see destination_sources.py).
Duties: the official UK Trade Tariff API. /api/v2 = UK tariff; /xi/api/v2 = the EU tariff as applied in
Northern Ireland (EU TARIC measures, origin "eu"). A Turkish 12-digit GTİP is matched on its first
8 digits (EU Combined Nomenclature). Anything that is not a plain ad valorem rate is kept as text and
marked for expert review; nothing is guessed.

Usage: python3 scripts/build_destination_catalogs.py [--refresh]
"""
import json, re, sys, time, urllib.request, urllib.error, datetime
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from destination_sources import collect

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache' / 'tariff'
REFRESH = '--refresh' in sys.argv
API = {'UK': 'https://www.trade-tariff.service.gov.uk/api/v2', 'EU': 'https://www.trade-tariff.service.gov.uk/xi/api/v2'}
TODAY = datetime.date.today().isoformat()

def get(dest, path):
    file = CACHE / dest / (path.replace('/', '_') + '.json')
    if file.exists() and not REFRESH:
        data = json.loads(file.read_text())
        return None if data == {'_status': 404} else data
    file.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(5):
        try:
            req = urllib.request.Request(f'{API[dest]}/{path}', headers={'Accept': 'application/json', 'User-Agent': 'tariff-snapshot/1.0'})
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.load(r)
            file.write_text(json.dumps(data))
            time.sleep(0.15)
            return data
        except urllib.error.HTTPError as e:
            if e.code == 404:
                file.write_text(json.dumps({'_status': 404}))
                return None
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(2 * (attempt + 1)); continue
            raise
        except (urllib.error.URLError, TimeoutError):
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f'{dest} {path} failed')

PCT = re.compile(r'^(\d+(?:\.\d+)?) ?%$')
def rate(text):
    m = PCT.match(text.strip())
    return float(m.group(1)) if m else None

# Measure types (TARIC ids, same in both tariffs).
THIRD = {'103'}                       # Third country duty
PREF = {'142', '106'}                 # Tariff preference, Customs Union Duty
VAT = {'305'}                         # Value added tax (UK only)
TRADE_REMEDY = {'551', '552', '553', '554', '555', '561', '562', '564', '565', '566', '570', '695', '696', '690', '691'}
QUOTA = {'122', '123', '143', '146', '147', '907'}
LOW_VALUE = {'C10', 'C11'}            # EU low-value consignment duty / handling fee (informational)

def measures(dest, doc):
    inc = {(i['type'], i['id']): i for i in doc.get('included', [])}
    def area_has_tr(area_id, seen=()):
        if area_id == 'TR': return True
        area = inc.get(('geographical_area', area_id))
        kids = ((area or {}).get('relationships', {}).get('children_geographical_areas', {}) or {}).get('data') or []
        return any(k['id'] == 'TR' for k in kids)
    out = []
    for ref in doc['data']['relationships'].get('import_measures', {}).get('data', []):
        m = inc[(ref['type'], ref['id'])]
        a, r = m['attributes'], m['relationships']
        if dest == 'EU' and a.get('origin') != 'eu':
            continue
        mt = r['measure_type']['data']['id']
        area = (r.get('geographical_area') or {}).get('data') or {}
        excluded = [x['id'] for x in ((r.get('excluded_countries') or {}).get('data') or [])]
        de = (r.get('duty_expression') or {}).get('data')
        text = inc[('duty_expression', de['id'])]['attributes'].get('base', '') if de else ''
        text = re.sub(r'<[^>]+>', '', text).strip()
        mtd = inc.get(('measure_type', mt), {}).get('attributes', {}).get('description', mt)
        out.append({'type': mt, 'typeLabel': mtd, 'area': area.get('id'), 'appliesToTR': bool(area.get('id')) and area_has_tr(area['id']) and 'TR' not in excluded,
                    'text': text, 'conditions': bool(((r.get('measure_conditions') or {}).get('data'))), 'order': ((r.get('order_number') or {}).get('data') or {}).get('id')})
    return out

def leaf_summary(dest, cid, doc):
    ms = measures(dest, doc)
    third = [m for m in ms if m['type'] in THIRD and m['area'] == '1011' and not m['order']]
    pref = [m for m in ms if m['type'] in PREF and m['appliesToTR'] and not m['order']]
    # An erga omnes measure with conditions and no duty of its own (e.g. goods exported from Russia or
    # Belarus) and anti-dumping "statistic" records do not hit Turkish goods; a duty with a rate, or an
    # anti-dumping control registered for Türkiye itself, does.
    remedies = [m for m in ms if m['type'] in TRADE_REMEDY and m['appliesToTR'] and m['type'] != '566'
                and not (m['area'] == '1011' and m['conditions'] and not m['text'])]
    attrs = doc['data']['attributes']
    out = {'commodity': cid, 'description': attrs.get('description_plain') or attrs.get('description'),
           'thirdCountry': {'text': third[0]['text'], 'rate': rate(third[0]['text'])} if len(third) == 1 else None,
           'preference': None,
           'remedies': [{'label': m['typeLabel'], 'area': m['area'], 'text': m['text']} for m in remedies],
           'quota': any(m['type'] in QUOTA and m['appliesToTR'] for m in ms),
           'vat': sorted({m['text'] for m in ms if m['type'] in VAT})}
    if pref:
        best = min(pref, key=lambda m: rate(m['text']) if rate(m['text']) is not None else 1e9)
        out['preference'] = {'text': best['text'], 'label': best['typeLabel'], 'rate': rate(best['text'])}
    reasons = []
    if not out['thirdCountry'] or out['thirdCountry']['rate'] is None:
        reasons.append('Genel vergi yüzde oranı değil: ' + (out['thirdCountry'] or {}).get('text', 'bulunamadı'))
    if out['preference'] and out['preference']['rate'] is None:
        reasons.append('Türkiye tercihli vergisi yüzde oranı değil: ' + out['preference']['text'])
    for m in out['remedies']:
        if m['text']:
            reasons.append(f"Türkiye menşeine uygulanabilen ek vergi / korunma önlemi var ({m['label']}: {m['text']}).")
        else:
            reasons.append('Bu kodda Türkiye menşeli mal için anti-damping / telafi edici vergi kontrol kaydı var; tarifede vergi tutarı yok. Durum uzman tarafından teyit edilmeli.')
    out['reasons'] = reasons
    out['status'] = 'review' if reasons else 'ok'
    return out

KEY = ('thirdCountry', 'preference', 'remedies', 'quota', 'status')
def summarize(dest, docs):
    """docs: list of (commodity id, json). One result per CN8."""
    per = [leaf_summary(dest, cid, doc) for cid, doc in docs]
    sig = lambda p: json.dumps({k: p[k] for k in KEY}, sort_keys=True)
    first = per[0]
    result = {k: first[k] for k in KEY + ('reasons',)}
    result['vat'] = sorted({v for p in per for v in p['vat']})
    result['commodities'] = [p['commodity'] for p in per]
    if len({sig(p) for p in per}) > 1:
        result['status'] = 'review'
        result['reasons'] = ['Bu GTİP hedef ülke tarifesinde farklı vergili alt kodlara ayrılıyor.']
        result['variants'] = per
    return result

def leaves(dest, cn8):
    doc = get(dest, f'commodities/{cn8}00')
    if doc and doc['data']['attributes'].get('declarable'):
        return [(cn8 + '00', doc)]
    heading = get(dest, f'headings/{cn8[:4]}')
    if not heading:
        return []
    inc = heading.get('included', [])
    ids = [i['attributes']['goods_nomenclature_item_id'] for i in inc if i['type'] == 'commodity'
           and i['attributes']['goods_nomenclature_item_id'].startswith(cn8) and i['attributes'].get('leaf')]
    out = []
    for cid in sorted(set(ids)):
        d = get(dest, f'commodities/{cid}')
        if d and d['data']['attributes'].get('declarable'): out.append((cid, d))
    return out

def main():
    data = collect()
    for sector, payload in data.items():
        tariffs = {}
        cn8s = sorted({p['code'].replace('.', '')[:8] for p in payload['products']})
        for n, cn8 in enumerate(cn8s, 1):
            tariffs[cn8] = {}
            for dest in ('EU', 'UK'):
                docs = leaves(dest, cn8)
                tariffs[cn8][dest] = summarize(dest, docs) if docs else {'status': 'not-found', 'reasons': ['Bu kod hedef ülke tarifesinde bulunamadı.'], 'commodities': []}
            if n % 50 == 0: print(f'{sector}: {n}/{len(cn8s)}', file=sys.stderr)
        for p in payload['products']:
            p['cn8'] = p['code'].replace('.', '')[:8]
        out = {'sector': sector, 'snapshotDate': TODAY, 'products': payload['products'], 'tariffs': tariffs, 'excelSources': payload['sources']}
        (ROOT / '.cache' / f'{sector}-destination.json').write_text(json.dumps(out, ensure_ascii=False))
        st = {}
        for t in tariffs.values():
            for d, v in t.items(): st[(d, v['status'])] = st.get((d, v['status']), 0) + 1
        print(sector, len(payload['products']), 'products', len(cn8s), 'cn8', st, file=sys.stderr)

if __name__ == '__main__':
    main()
