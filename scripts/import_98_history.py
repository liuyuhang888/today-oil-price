#!/usr/bin/env python3
"""Enrich dated 98# prices when two grades agree with existing adjustment data."""
import json
import re
import time
import urllib.request
from build_history import DATA_DIR, build_history

SLUGS = {'北京':'beijing','天津':'tianjin','河北':'hebei','山西':'shanxi','内蒙古':'neimenggu','辽宁':'liaoning','吉林':'jilin','黑龙江':'heilongjiang','上海':'shanghai','江苏':'jiangsu','浙江':'zhejiang','安徽':'anhui','福建':'fujian','江西':'jiangxi','山东':'shandong','河南':'henan','湖北':'hubei','湖南':'hunan','广东':'guangdong','广西':'guangxi','海南':'hainan','重庆':'chongqing','四川':'sichuan','贵州':'guizhou','云南':'yunnan','西藏':'xizang','陕西':'shaanxi','甘肃':'gansu','青海':'qinghai','宁夏':'ningxia','新疆':'xinjiang'}
SOURCE='https://www.soyoujia.cn/'


def parse_history(body):
    match = re.search(r'trend:\s*(\{[^;\n]+\})', body)
    if not match:
        raise ValueError('Missing historical chart data')
    trend = json.loads(match.group(1))
    dates, a, b, c = (trend[key] for key in ('xlabels','s92','s95','s98'))
    if not dates or not len(dates) == len(a) == len(b) == len(c):
        raise ValueError('Invalid historical arrays')
    return dict(zip(dates, zip(a,b,c)))


def enrich(imported, province, records):
    count = 0
    for day in imported['days']:
        local = day.get('provinces', {}).get(province)
        numbers = records.get(day['date'])
        if not local or not numbers:
            continue
        try:
            p92,p95,p98 = map(float,numbers)
            if abs(float(local['t92'])-p92) > .02 or abs(float(local['t95'])-p95) > .02 or not 0 < p98 < 100:
                continue
        except (TypeError,ValueError):
            continue
        if local.get('t98') != p98:
            local['t98'] = p98
            count += 1
        day['t98_source'] = SOURCE
    return count


def main():
    path=DATA_DIR/'imported-history.json'
    imported=json.loads(path.read_text(encoding='utf-8'))
    changed=0
    for province,slug in SLUGS.items():
        try:
            req=urllib.request.Request(f'{SOURCE}{slug}/lishi',headers={'User-Agent':'Mozilla/5.0 (oil-price-history; contact: github.com/liuyuhang888/today-oil-price)'})
            with urllib.request.urlopen(req,timeout=12) as response: html=response.read().decode('utf-8')
            if province not in html[:3000]: raise ValueError('Province name mismatch')
            count=enrich(imported,province,parse_history(html))
            changed+=count
            print(province,count,flush=True)
        except (OSError,ValueError,KeyError) as error:
            print(province,'skipped:',error,flush=True)
        time.sleep(.5)
    path.write_text(json.dumps(imported,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    build_history(DATA_DIR)
    print('98# records added:',changed)


if __name__=='__main__': main()
