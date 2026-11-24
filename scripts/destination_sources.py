"""Read-only extraction of the GTİP lists sent in the Freight Forwarding WhatsApp group (Nov 2026).
The lists carry only codes and descriptions; the '474 s.K.V.O.' column is a bound rate and is NOT used."""
import json, re, hashlib, sys
from pathlib import Path
import openpyxl

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'sources' / '2026-11-whatsapp'
SECTORS = {
    'textiles': ['TARİFE 51 FASIL.xlsx', 'TARİFE 52. FASIL.xlsx', 'TARİFE 53. FASIL.xlsx', 'TARİFE 54.FASIL.xlsx', 'TARİFE 55 .FASIL.xlsx', 'TARİFE 56.FASIL.xlsx'],
    'footwear': ['64. fasıl ayakkabı  gtip.xlsx'],
}
clean = lambda x: re.sub(r'\s+', ' ', str(x or '').replace('\xa0', ' ')).strip()

def read(file):
    path = SRC / file
    products, trail, heading = [], [], ''
    for rownum, row in enumerate(openpyxl.load_workbook(path, data_only=True).active.values, 1):
        code, desc = clean(row[0]).replace(' ', ''), clean(row[1])
        unit = clean(row[2]) if len(row) > 2 else ''
        if re.fullmatch(r'\d{2}\.\d{2}', code):            # heading, e.g. 51.01
            heading, trail = desc.rstrip(':'), []
            continue
        depth = len(re.match(r'^[- ]*', desc).group().replace(' ', ''))
        text = desc.lstrip('- ').rstrip(' :')
        if re.fullmatch(r'\d{4}\.\d{2}\.\d{2}\.\d{2}\.\d{2}', code):
            context = ' / '.join([heading] + trail[:max(depth - 1, 0)])
            products.append({'code': code, 'label': text, 'context': context, 'heading': code[:4],
                             'unit': None if unit in ('', '-') else unit, 'sourceFile': file, 'sourceRow': rownum})
        elif desc.startswith('-'):
            trail = trail[:max(depth - 1, 0)] + [text]
    return path, products

def collect():
    out = {}
    for sector, files in SECTORS.items():
        products, sources = [], []
        for f in files:
            path, rows = read(f)
            products += rows
            sources.append({'file': f, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'rows': len(rows)})
        out[sector] = {'products': products, 'sources': sources}
    return out

if __name__ == '__main__':
    data = collect()
    json.dump(data, sys.stdout, ensure_ascii=False)
