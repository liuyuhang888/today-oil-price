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



class HistoryEnrichmentTest(unittest.TestCase):
    def test_only_matching_grades_enrich_98(self):
        from import_98_history import enrich
        data = {'days': [{'date': '2026-09-25', 'provinces': {'北京': {'t92': 8.61, 't95': 9.17, 't98': None}}}]}
        self.assertEqual(enrich(data, '北京', {'2026-09-25': (8.61, 9.17, 10.67)}), 1)
        self.assertEqual(data['days'][0]['provinces']['北京']['t98'], 10.67)
        self.assertEqual(enrich(data, '北京', {'2026-09-25': (7.0, 9.17, 11.0)}), 0)
        self.assertEqual(data['days'][0]['provinces']['北京']['t98'], 10.67)


class VehicleCatalogTest(unittest.TestCase):
    def test_only_miit_variants_and_no_phev_combined_consumption(self):
        from import_vehicle_catalog import build_brand
        data = {'brand': {'name_zh':'测试'}, 'models': [{'name':'车型', 'years':[{'year':2025, 'variants':[
            {'trim':'国内燃油', 'kind':0, 'sources':['miit'], 'fuel_l_100km':6.5},
            {'trim':'国内插混', 'kind':3, 'sources':['miit_old'], 'fuel_l_100km':1.0},
            {'trim':'海外汽油', 'kind':0, 'sources':['epa'], 'fuel_l_100km':7.0},
            {'trim':'纯电', 'kind':1, 'sources':['miit'], 'fuel_l_100km':None},
        ]}]}]}
        rows = build_brand(data)
        self.assertEqual(len(rows), 2)
        self.assertTrue(any(row[5] == 0 and row[4] == 6.5 for row in rows))
        self.assertTrue(any(row[5] == 3 and row[4] is None for row in rows))
        self.assertFalse(any('海外' in row[3] or '纯电' in row[3] for row in rows))


if __name__ == '__main__':
    unittest.main()
