#!/usr/bin/env python3
"""Import gasoline/plug-in variants with an explicit Chinese MIIT source."""
import concurrent.futures
import hashlib
import http.client
import tempfile
import threading
import json
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = 'https://eficien.com/data/vehicles/'
SOURCE = 'https://eficien.com/vehicles.html'


_lock = threading.Lock()
_next_request = 0.0

def fetch(name):
    global _next_request
    request = urllib.request.Request(BASE + name, headers={'User-Agent': 'Mozilla/5.0 (today-oil-price catalog import)'})
    for attempt in range(4):
        try:
            with _lock:
                delay = _next_request - time.monotonic()
                if delay > 0: time.sleep(delay)
                _next_request = time.monotonic() + .25
            with urllib.request.urlopen(request, timeout=20) as response:
                return json.load(response)
        except urllib.error.HTTPError:
            raise
        except (OSError, ValueError, http.client.HTTPException):
            if attempt == 3: raise
            time.sleep(2 + attempt)


def build_brand(data):
    brand_data = data['brand']
    brand = brand_data.get('name_zh') or brand_data.get('name')
    rows, seen = [], set()
    if not brand:
        return rows
    for model in data['models']:
        model_name = model.get('name_zh') or model.get('name') or ''
        for year_data in model.get('years', []):
            year = year_data.get('year')
            if not isinstance(year, int):
                continue
            for variant in year_data.get('variants', []):
                sources = variant.get('sources') or []
                kind = variant.get('kind')
                if not set(sources).intersection({'miit', 'miit_old'}) or kind not in (0, 2, 3):
                    continue
                trim = str(variant.get('trim') or '').strip()
                name = (model_name + (' · ' + trim if trim and trim != model_name else '')).strip()
                if not name:
                    continue
                displacement, power = variant.get('displ_ml'), variant.get('power_kw')
                specs = []
                if isinstance(displacement, (int, float)) and displacement > 0: specs.append(f'{displacement / 1000:g}L')
                if isinstance(power, (int, float)) and power > 0: specs.append(f'{power:g}kW')
                if specs: name += ' · ' + ' / '.join(specs)
                raw = variant.get('fuel_l_100km')
                # Combined PHEV figures are not charge-depleted fuel consumption.
                value = round(float(raw), 2) if kind != 3 and isinstance(raw, (int, float)) and 0 < raw < 100 else None
                ident = hashlib.sha256(json.dumps([brand, str(year), name, displacement, power, kind, value], ensure_ascii=False).encode()).hexdigest()[:16]
                if ident not in seen:
                    seen.add(ident)
                    rows.append([ident, brand, str(year), name, value, int(kind)])
    return rows


def main():
    manifest = fetch('manifest.json')
    files = [entry['file'] for entry in manifest['brands'] if entry.get('file', '').startswith('brands/') and entry['file'].endswith('.json')]
    if len(files) < 100:
        raise ValueError('Incomplete brand manifest; existing catalog retained')
    print('Loading', len(files), 'brand files', flush=True)
    chunks = []
    cache = Path(tempfile.gettempdir()) / 'oil-vehicle-brand-cache'
    cache.mkdir(exist_ok=True)
    def load_brand(path):
        local = cache / path.rsplit('/', 1)[-1]
        if local.exists():
            try: return build_brand(json.loads(local.read_text(encoding='utf-8')))
            except (OSError, ValueError, KeyError): pass
        data = fetch(path)
        rows = build_brand(data)
        local.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
        return rows
    # Limited concurrency avoids excessive load on the public data source.
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for index, rows in enumerate(pool.map(load_brand, files), 1):
            chunks.extend(rows)
            if index % 40 == 0: print('Processed', index, 'brands', flush=True)
    if len(chunks) < 1000:
        raise ValueError('Incomplete domestic catalog; existing catalog retained')
    out = ROOT / 'data' / 'vehicles'
    out.mkdir(parents=True, exist_ok=True)
    shards, brands = [[] for _ in range(16)], {}
    for row in chunks:
        slot = int(hashlib.sha256(row[1].encode('utf-8')).hexdigest()[:8], 16) % len(shards)
        brands[row[1]] = f'{slot:02d}'
        shards[slot].append(row)
    for index, rows in enumerate(shards):
        (out / f'{index:02d}.json').write_text(json.dumps({'rows': rows}, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    search = [[row[0], row[1], row[2], row[3]] for row in chunks]
    (out / 'search.json').write_text(json.dumps({'rows': search}, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    meta = {'source': SOURCE, 'generated_at': manifest.get('meta', {}).get('generated_at'), 'count': len(chunks), 'brands': brands, 'scope': 'miit'}
    (out / 'manifest.json').write_text(json.dumps(meta, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print('Domestic vehicle catalog:', len(chunks), 'variants from', len(brands), 'brands')


if __name__ == '__main__': main()
