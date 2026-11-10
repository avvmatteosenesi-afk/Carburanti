import contextlib
import copy
import io
import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from data_freshness import MAX_PRICE_AGE, parse_timestamp, price_is_current
import validate_release
import refresh_prices_secondary
from urllib.error import HTTPError
from email.message import Message


class FreshnessTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime.now(timezone.utc)
        self.payload = {
            'metadata': {'generated_at': self.now.isoformat(),
                         'source_snapshot_date': self.now.date().isoformat(),
                         'source_mode': 'mimit-osservaprezzi-live-api-v2', 'stations': 1},
            'stations': [{'id': '1', 'province': 'PO', 'lat': 43.88, 'lon': 11.10,
                          'prices': {'benzina': {'price': 1.75, 'self': True,
                                                'updated': self.now.isoformat()}}}],
        }

    def validate(self, payload, min_stations=1, min_prices=1):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'dataset.json').write_text(json.dumps(payload))
            with patch.object(validate_release, 'ROOT', root), contextlib.redirect_stdout(io.StringIO()):
                validate_release.validate_dataset('dataset.json', min_stations, min_prices)

    def test_unchanged_price_in_weekly_window_survives_with_original_date(self):
        updated = (self.now - timedelta(days=4)).isoformat()
        self.payload['stations'][0]['prices']['gasolio'] = {'price': 1.65, 'updated': updated}
        self.validate(self.payload)
        self.assertEqual(updated, self.payload['stations'][0]['prices']['gasolio']['updated'])

    def test_price_age_boundaries_and_future_dates(self):
        self.assertTrue(price_is_current(self.now - MAX_PRICE_AGE, self.now))
        self.assertFalse(price_is_current(self.now - MAX_PRICE_AGE - timedelta(seconds=1), self.now))
        self.assertFalse(price_is_current(self.now + timedelta(hours=25), self.now))
        self.assertFalse(price_is_current(None, self.now))
        self.assertFalse(price_is_current(self.now - MAX_PRICE_AGE + timedelta(hours=1),
                                         self.now, max_age=MAX_PRICE_AGE-timedelta(hours=2)))

    def test_bad_price_dates_block_even_freshly_generated_dataset(self):
        for value in [None, 'not-a-date', (self.now - timedelta(days=9)).isoformat(),
                      (self.now + timedelta(hours=25)).isoformat()]:
            with self.subTest(updated=value):
                payload = copy.deepcopy(self.payload)
                payload['stations'][0]['prices']['benzina']['updated'] = value
                with self.assertRaises(SystemExit):
                    self.validate(payload)

    def test_stale_or_missing_acquisition_cannot_be_relabelled_live(self):
        for value in [None, (self.now - timedelta(hours=49)).isoformat(),
                      (self.now + timedelta(hours=25)).isoformat()]:
            with self.subTest(generated=value):
                self.payload['metadata']['generated_at'] = value
                with self.assertRaises(SystemExit):
                    self.validate(self.payload)

    def test_no_recent_prices_blocks_release(self):
        self.payload['stations'][0]['prices']['benzina']['updated'] = (self.now - timedelta(days=4)).isoformat()
        with self.assertRaisesRegex(SystemExit, 'nessun prezzo aggiornato'):
            self.validate(self.payload)

    def test_new_build_cannot_hide_old_provincial_acquisition(self):
        self.payload['metadata']['api_fallback_provinces']=['VV']
        self.payload['metadata']['api_fallback_acquired_at']={'VV':(self.now-timedelta(hours=49)).isoformat()}
        with self.assertRaisesRegex(SystemExit, 'fallback VV'):
            self.validate(self.payload)

    def test_coverage_thresholds_still_enforced(self):
        with self.assertRaisesRegex(SystemExit, 'impianti'):
            self.validate(self.payload, min_stations=15000)
        with self.assertRaisesRegex(SystemExit, 'prezzi validi'):
            self.validate(self.payload, min_prices=25000)

    def test_italian_and_iso_timestamp_parsing(self):
        self.assertEqual(parse_timestamp('09/11/2026 10:30:00'), parse_timestamp('2026-11-09T10:30:00Z'))
        self.assertEqual(parse_timestamp('2026-11-09T11:30:00+01:00'), parse_timestamp('2026-11-09T10:30:00Z'))

    def test_rate_limit_honors_server_retry_after(self):
        headers = Message()
        headers['Retry-After'] = '180'
        error = HTTPError('https://example.test', 429, 'Too Many Requests', headers, None)
        self.assertEqual(refresh_prices_secondary.rate_limit_delay(error, 0), 180)
        self.assertEqual(refresh_prices_secondary.rate_limit_delay(error, 3), 240)
        headers.replace_header('Retry-After', 'invalid')
        self.assertEqual(refresh_prices_secondary.rate_limit_delay(error, 0), 60)

    def test_rate_limited_request_waits_then_retries(self):
        headers = Message()
        headers['Retry-After'] = '90'
        error = HTTPError('https://example.test', 429, 'Too Many Requests', headers, None)
        from unittest.mock import MagicMock
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'{"results": []}'
        with patch.object(refresh_prices_secondary, '_last_request_at', None), \
             patch.object(refresh_prices_secondary.urllib.request, 'urlopen', side_effect=[error, response]), \
             patch.object(refresh_prices_secondary.time, 'sleep') as sleep, \
             patch('builtins.print'):
            self.assertEqual(refresh_prices_secondary.request_json('search/area'), {'results': []})
            self.assertIn(unittest.mock.call(90.0), sleep.call_args_list)


if __name__ == '__main__':
    unittest.main()
