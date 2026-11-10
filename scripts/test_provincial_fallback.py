import unittest
from datetime import datetime,timedelta,timezone
from provincial_fallback import select_province

class ProvincialFallbackTests(unittest.TestCase):
    def setUp(self):
        self.now=datetime.now(timezone.utc)
        self.old=(self.now-timedelta(days=4)).isoformat()
        self.payload={'metadata':{'generated_at':self.now.isoformat()},'stations':[{'id':'1','province':'VV','lat':38.7,'lon':16.1,'prices':{'benzina':{'price':1.7,'self':True,'updated':self.old}}}]}
    def test_preserves_original_price_and_acquisition_dates(self):
        rows,origin=select_province(self.payload,'VV',self.now)
        self.assertEqual(rows[0]['prices']['benzina']['updated'],self.old)
        self.assertEqual(origin,self.payload['metadata']['generated_at'])
    def test_repeated_build_does_not_renew_original_acquisition(self):
        self.payload['metadata']['api_fallback_acquired_at']={'VV':(self.now-timedelta(hours=49)).isoformat()}
        with self.assertRaisesRegex(RuntimeError,'48 ore'):select_province(self.payload,'VV',self.now)
    def test_old_prices_are_not_carried_from_archive(self):
        self.payload['stations'][0]['prices']['benzina']['updated']=(self.now-timedelta(days=9)).isoformat()
        with self.assertRaisesRegex(RuntimeError,'nessun prezzo'):select_province(self.payload,'VV',self.now)
    def test_other_province_cannot_fill_missing_province(self):
        with self.assertRaisesRegex(RuntimeError,'nessun prezzo'):select_province(self.payload,'PO',self.now)

if __name__=='__main__':unittest.main()
