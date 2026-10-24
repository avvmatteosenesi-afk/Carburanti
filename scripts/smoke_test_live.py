#!/usr/bin/env python3
import json,time,urllib.request
from datetime import datetime,timezone
BASE='https://avvmatteosenesi-afk.github.io/Carburanti/'
UA='Carburanti post-deploy smoke test'
def get(path,attempts=6):
 last=None
 for i in range(attempts):
  try:
   req=urllib.request.Request(BASE+path+('?' if '?' not in path else '&')+f'smoke={int(time.time())}',headers={'User-Agent':UA,'Cache-Control':'no-cache'})
   with urllib.request.urlopen(req,timeout=25) as r:
    if r.status!=200: raise RuntimeError(f'HTTP {r.status}')
    return r.read()
  except Exception as e:
   last=e; time.sleep(5*(i+1))
 raise last
for asset in ['index.html','app.js','marker-fix.js','manifest.webmanifest','carburanti-green-180.png']:
 data=get(asset)
 if len(data)<100: raise SystemExit(f'{asset}: risposta troppo piccola')
p=json.loads(get('data/stations.json').decode('utf-8')); n=len(p.get('stations',[])); m=p.get('metadata',{})
if n<900: raise SystemExit(f'Dataset live Toscana implausibile: {n}')
snap=m.get('source_snapshot_date')
if not snap: raise SystemExit('Dataset live senza source_snapshot_date')
age=(datetime.now(timezone.utc).date()-datetime.fromisoformat(snap).date()).days
if age>30: raise SystemExit(f'Dataset live eccessivamente vecchio: {age} giorni')
print(f'Smoke test live OK: {n} impianti Toscana, snapshot {snap}, fonte {m.get("source_mode")}')
