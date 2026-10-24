#!/usr/bin/env python3
import json
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
required=['index.html','app.js','trip.js','marker-fix.js','zone-colors-v2.js','location-visibility.js','manifest.webmanifest','data/stations.json','data/stations-it.json']
missing=[x for x in required if not (ROOT/x).exists()]
if missing: raise SystemExit('File mancanti: '+', '.join(missing))
for rel,minn in [('data/stations-it.json',15000),('data/stations.json',900)]:
 p=json.loads((ROOT/rel).read_text(encoding='utf-8')); n=len(p.get('stations',[]))
 if n<minn: raise SystemExit(f'{rel}: solo {n} impianti')
 meta=p.get('metadata',{}); snap=meta.get('source_snapshot_date')
 if snap:
  age=(datetime.now(timezone.utc).date()-datetime.fromisoformat(snap).date()).days
  print(f'{rel}: {n} impianti, snapshot {snap}, età {age} giorni, fonte {meta.get("source_mode")}')
  if age>30: raise SystemExit(f'{rel}: fallback eccessivamente vecchio ({age} giorni)')
  if age>2: print(f'WARNING: {rel}: fallback MIMIT non recente ({age} giorni), pubblicazione consentita per continuità di servizio')
 else: print(f'{rel}: {n} impianti, fonte live')
html=(ROOT/'index.html').read_text(encoding='utf-8')
for token in ['trip.js','marker-fix.js','zone-colors-v2.js','location-visibility.js']:
 if token not in html: raise SystemExit('index.html non include '+token)
print('Validazione release OK')
