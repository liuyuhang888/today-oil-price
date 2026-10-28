#!/usr/bin/env python3
"""Import dated provincial adjustment records from Eastmoney's oil price data."""
import argparse
import datetime
import json
import math
import urllib.parse
import urllib.request

from build_history import DATA_DIR, build_history

API = 'https://datacenter-web.eastmoney.com/api/data/v1/get'
SOURCE = 'https://data.eastmoney.com/cjsj/oil_default.html'
FIELDS = {'t0': 'V0', 't89': 'V89', 't92': 'V92', 't95': 'V95'}


def fetch_page(year, page):
    params = {'reportName': 'RPTA_WEB_YJ_JH', 'columns': 'ALL',
              'filter': f"(DIM_DATE>='{year}-01-01')(DIM_DATE<'{year + 1}-01-01')",
              'sortColumns': 'DIM_DATE', 'sortTypes': '1', 'pageNumber': page,
              'pageSize': 500, 'source': 'WEB', 'client': 'WEB'}
    request = urllib.request.Request(API + '?' + urllib.parse.urlencode(params),
                                     headers={'User-Agent': 'Mozilla/5.0', 'Referer': SOURCE})
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.load(response)
    if not payload.get('success') or not payload.get('result'):
        raise ValueError(f"Eastmoney returned no data: {payload.get('message')}")
    return payload['result']


def import_year(year, data_dir=DATA_DIR):
    records = []
    page = 1
    while True:
        result = fetch_page(year, page)
        records.extend(result['data'])
        if page >= result['pages']:
            break
        page += 1
    days = {}
    for row in records:
        date = row['DIM_DATE'][:10]
        datetime.date.fromisoformat(date)
        if not date.startswith(f'{year}-') or not row.get('CITYNAME'):
            raise ValueError('Unexpected date or province in response')
        provinces = days.setdefault(date, {})
        name = row['CITYNAME']
        if name in provinces:
            raise ValueError(f'Duplicate province {name} on {date}')
        values = {}
        for field, source_field in FIELDS.items():
            value = row.get(source_field)
            values[field] = round(value, 2) if isinstance(value, (int, float)) and math.isfinite(value) and value > 0 else None
        # This source does not provide 98# prices.
        values['t98'] = None
        provinces[name] = values
    if not days or any(len(provinces) < 20 for provinces in days.values()):
        raise ValueError('Incomplete historical response; existing import was not changed')
    path = data_dir / 'imported-history.json'
    existing = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {'days': []}
    prior = {day['date']: day for day in existing['days']}
    for date, provinces in days.items():
        old_day = prior.get(date, {})
        for name, values in provinces.items():
            old = old_day.get('provinces', {}).get(name, {})
            if old.get('t98') and old.get('t92') == values.get('t92') and old.get('t95') == values.get('t95'):
                values['t98'] = old['t98']
    kept = [day for day in existing['days'] if not day['date'].startswith(f'{year}-')]
    kept.extend({'date': date, 'source': 'eastmoney', **({'t98_source': prior[date]['t98_source']} if prior.get(date, {}).get('t98_source') else {}), 'provinces': provinces}
                for date, provinces in days.items())
    output = {'source': SOURCE, 'days': sorted(kept, key=lambda day: day['date'])}
    path.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    build_history(data_dir)
    print(f"Imported {len(days)} adjustment dates, {len(records)} provincial records for {year}.")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--year', type=int, default=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).year)
    args = parser.parse_args()
    if not 2000 <= args.year <= 2100:
        parser.error('year must be between 2000 and 2100')
    import_year(args.year)
