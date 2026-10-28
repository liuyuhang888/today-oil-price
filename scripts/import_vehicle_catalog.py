#!/usr/bin/env python3
"""Import a compact, attributed catalog from publicly published vehicle data."""
import hashlib
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = 'https://eficien.com/data/vehicles/'
SOURCE = 'https://eficien.com/vehicles.html'


def fetch(name):
    request = urllib.request.Request(BASE + name, headers={'User-Agent':'Mozilla/5.0 (today-oil-price catalog import)'})
    with urllib.request.urlopen(request, timeout=40) as response:
        return json.load(response)


def build(manifest, catalog):
    brands = {item['id']: item.get('name_zh') or item.get('name') for item in manifest['brands']}
    models = {item['i']: item for item in catalog['models']}
    output = []
    seen = set()
    for row in catalog['rows']:
        if len(row) < 9 or row[8] not in (0, 2, 3):
            continue  # This calculator is for gasoline; omit EV, diesel and hydrogen.
        model = models.get(row[0])
        if not model or not brands.get(model['b']) or not isinstance(row[1], int):
            continue
        brand, year = brands[model['b']], str(row[1])
        name = model.get('z') or model.get('n') or ''
        trim = str(row[2] or '').strip()
        name = (name + (' · ' + trim if trim and trim != name else '')).strip()
        if not name: continue
        specs = []
        if isinstance(row[3], (int,float)) and row[3] > 0: specs.append(f'{row[3] / 1000:g}L')
        if isinstance(row[4], (int,float)) and row[4] > 0: specs.append(f'{row[4]:g}kW')
        if specs: name += ' · ' + ' / '.join(specs)
        # The aggregate source does not label charge-depleted fuel values.
        # Never use PHEV combined consumption as a charge-depleted figure.
        kind = int(row[8])
        raw = row[5]
        value = round(float(raw), 2) if kind != 3 and isinstance(raw, (int,float)) and 0 < raw < 100 else None
        ident = hashlib.sha256(json.dumps([brand, year, name, row[3], row[4], kind, value], ensure_ascii=False).encode()).hexdigest()[:16]
        if ident in seen: continue
        seen.add(ident)
        output.append([ident,brand,year,name,value,kind])
    if len(output) < 1000:
        raise ValueError('Catalog appears incomplete; existing file retained')
    return {'source':SOURCE, 'generated_at':catalog['meta'].get('generated_at'), 'rows':output}


def main():
    data = build(fetch('manifest.json'), fetch('index.json'))
    path = ROOT/'data'/'vehicle-catalog.json'
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(',',':'))+'\n',encoding='utf-8')
    print('vehicle catalog:', len(data['rows']), 'variants')


if __name__ == '__main__': main()
