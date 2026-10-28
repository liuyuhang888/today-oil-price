#!/usr/bin/env python3
"""Update the latest oil-price notice from the national price authority."""
import datetime
import json
import re
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / 'data' / 'adjustment-calendar.json'
SOURCE = 'https://www.ndrc.gov.cn/xwdt/xwfb/'

class NoticeParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.items = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        title = attrs.get('title', '')
        if tag != 'a' or '成品油' not in title or not attrs.get('href'):
            return
        match = re.search(r'(20\d{2})年(\d{1,2})月(\d{1,2})日', title)
        if not match: return
        try: date = datetime.date(*map(int, match.groups())).isoformat()
        except ValueError: return
        url = urllib.parse.urljoin(SOURCE, attrs['href'])
        if not url.startswith(SOURCE): return
        self.items.append({'date':date, 'text':title, 'url':url})


def update_notice(path=DATA):
    req = urllib.request.Request(SOURCE, headers={'User-Agent':'Mozilla/5.0 (oil-price-dashboard)'})
    with urllib.request.urlopen(req, timeout=15) as response: page = response.read().decode('utf-8')
    parser = NoticeParser(); parser.feed(page)
    if not parser.items: raise ValueError('No adjustment notice found')
    notice = max(parser.items, key=lambda item:item['date'])
    data = json.loads(path.read_text(encoding='utf-8'))
    if notice['date'] >= data.get('last_notice', {}).get('date', ''):
        data['last_notice'] = notice
        path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':'))+'\n', encoding='utf-8')
    return notice

if __name__ == '__main__': print(update_notice())
