import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from build_history import build_history


class HistoryIndexTest(unittest.TestCase):
    def test_last_valid_snapshot_per_day_and_chronological_order(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for date, time, value in [('2026/01/02', '1200', '8.00'),
                                      ('2026/01/01', '2200', '7.50'),
                                      ('2026/01/02', '2200', '8.20')]:
                folder = root / 'history' / date
                folder.mkdir(parents=True, exist_ok=True)
                (folder / f'{time}.json').write_text(json.dumps({'provinces': {'北京': {'t92': value}}}), encoding='utf-8')
            (root / 'history/2026/01/02/2300.json').write_text('{broken', encoding='utf-8')
            result = build_history(root)
            self.assertEqual([d['date'] for d in result['days']], ['2026-01-01', '2026-01-02'])
            self.assertEqual(result['days'][1]['provinces']['北京']['t92'], '8.20')
            self.assertEqual(json.loads((root / 'history-index.json').read_text(encoding='utf-8')), result)

class ImportedHistoryTest(unittest.TestCase):
    def test_imported_days_are_merged_and_archive_takes_precedence(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            imported = {'days': [
                {'date': '2026-01-01', 'source': 'eastmoney', 'provinces': {'北京': {'t92': 7.0, 't98': None}}},
                {'date': '2026-01-02', 'source': 'eastmoney', 'provinces': {'北京': {'t92': 7.1, 't98': None}}},
            ]}
            (root / 'imported-history.json').write_text(json.dumps(imported), encoding='utf-8')
            folder = root / 'history/2026/01/02'
            folder.mkdir(parents=True)
            (folder / '2200.json').write_text(json.dumps({'provinces': {'北京': {'t92': '7.20', 't98': '9.00'}}}), encoding='utf-8')
            days = build_history(root)['days']
            self.assertEqual([day['source'] for day in days], ['eastmoney', 'archive'])
            self.assertIsNone(days[0]['provinces']['北京']['t98'])
            self.assertEqual(days[1]['provinces']['北京']['t98'], '9.00')


if __name__ == '__main__':
    unittest.main()
