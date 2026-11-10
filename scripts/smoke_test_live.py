#!/usr/bin/env python3
import json,time,urllib.request
from datetime import datetime,timezone
from pathlib import Path
from data_freshness import MAX_DATASET_AGE, MAX_FUTURE_SKEW, parse_timestamp
BASE='https://avvmatteosenesi-afk.github.io/Carburanti/'
UA='Carburanti post-deploy smoke test'
def get(path,attempts=6,expected=None):
 last=None
 for i in range(attempts):
  try:
   req=urllib.request.Request(BASE+path+('?' if '?' not in path else '&')+f'smoke={int(time.time())}',headers={'User-Agent':UA,'Cache-Control':'no-cache'})
   with urllib.request.urlopen(req,timeout=25) as r:
    if r.status!=200: raise RuntimeError(f'HTTP {r.status}')
    raw=r.read()
    if expected is not None and raw != expected:
     raise RuntimeError(f'{path}: il sito non serve ancora il dataset del deploy corrente')
    return raw
  except Exception as e:
   last=e; time.sleep(5*(i+1))
 raise last
for asset in ['index.html','app.js','marker-fix.js','manifest.webmanifest','carburanti-green-180.png','layout-themes.css','refresh-ui.js','data-health.js','trip-services.js','sw.js','vendor/leaflet-1.9.4/leaflet.js','vendor/leaflet-1.9.4/leaflet.css']:
 data=get(asset)
 if len(data)<100: raise SystemExit(f'{asset}: risposta troppo piccola')
# Controlla che tutti i banner dei temi pubblicati siano referenziati dal CSS,
# scaricabili come WebP validi e mantengano un rapporto panoramico.
import re
from io import BytesIO
from PIL import Image
css=get('layout-themes.css').decode('utf-8')
banners=sorted(set(re.findall(r'theme-banners/([a-z0-9-]+)\.webp',css)))
if len(banners)!=13:
 raise SystemExit(f'CSS temi: attesi 13 banner distinti, trovati {len(banners)}: {banners}')
for name in banners:
 raw=get(f'theme-banners/{name}.webp')
 if len(raw)<100 or raw[:4]!=b'RIFF' or raw[8:12]!=b'WEBP':
  raise SystemExit(f'{name}.webp: file WebP mancante o non valido')
 try:
  with Image.open(BytesIO(raw)) as image:
   width,height=image.size
   image.verify()
 except Exception as exc:
  raise SystemExit(f'{name}.webp: immagine non decodificabile: {exc}')
 if width < height*2.2:
  raise SystemExit(f'{name}.webp: rapporto non panoramico ({width}x{height})')
print(f'Banner live OK: {len(banners)} WebP validi e panoramici')
root=Path(__file__).resolve().parents[1]
for name,minimum in [('stations.json',900),('stations-it.json',15000)]:
 path=f'data/{name}'
 # A successful HTTP response must contain this deployment's validated data,
 # not the previous Pages artifact still propagating through the CDN.
 p=json.loads(get(path,expected=(root/path).read_bytes()).decode('utf-8'))
 n=len(p.get('stations',[])); m=p.get('metadata',{})
 if n<minimum: raise SystemExit(f'{path}: dataset live implausibile: {n}')
 generated=parse_timestamp(m.get('generated_at'))
 if generated is None or not -MAX_FUTURE_SKEW <= datetime.now(timezone.utc)-generated <= MAX_DATASET_AGE:
  raise SystemExit(f'{path}: acquisizione non recente o non valida')
 print(f'Smoke test live OK: {path}, {n} impianti, acquisizione {generated.isoformat()}, fonte {m.get("source_mode")}')
