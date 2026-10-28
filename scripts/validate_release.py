#!/usr/bin/env python3
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = ['index.html','app.js','trip.js','marker-fix.js','zone-colors-v2.js','location-visibility.js','manifest.webmanifest','data/stations.json','data/stations-it.json']
missing = [x for x in REQUIRED if not (ROOT / x).exists()]
if missing:
    raise SystemExit('File mancanti: ' + ', '.join(missing))

# Generous rectangular envelopes: deliberately wider than UI fitBounds, but tight enough
# to reject gross province/coordinate mismatches (e.g. a Rome coordinate labelled PO).
PROVINCE_ENVELOPES = {
    'AR': (42.95, 44.05, 11.05, 12.45), 'FI': (43.15, 44.45, 10.35, 12.05),
    'GR': (41.95, 43.50, 10.25, 12.00), 'LI': (42.35, 43.90, 9.35, 11.05),
    'LU': (43.40, 44.60, 9.75, 11.10), 'MS': (43.65, 44.75, 9.45, 10.70),
    'PI': (43.05, 44.15, 9.95, 11.30), 'PO': (43.50, 44.40, 10.55, 11.60),
    'PT': (43.50, 44.50, 10.25, 11.45), 'SI': (42.55, 43.90, 10.45, 12.20),
}

def parse_dt(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    except ValueError:
        return None

def validate_dataset(rel, min_stations, min_prices):
    payload = json.loads((ROOT / rel).read_text(encoding='utf-8'))
    stations = payload.get('stations', [])
    n = len(stations)
    if n < min_stations:
        raise SystemExit(f'{rel}: solo {n} impianti')

    metadata = payload.get('metadata', {})
    declared = metadata.get('stations')
    if declared is not None and int(declared) != n:
        raise SystemExit(f'{rel}: metadata stations={declared}, contenuto={n}')

    price_count = 0
    latest_price = None
    invalid_coords = []
    gross_geo_mismatches = []
    for s in stations:
        lat, lon = s.get('lat'), s.get('lon')
        if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)) or not (35 <= lat <= 48 and 5 <= lon <= 20):
            invalid_coords.append(str(s.get('id')))
        if rel.endswith('stations.json') and s.get('province') in PROVINCE_ENVELOPES and isinstance(lat, (int, float)) and isinstance(lon, (int, float)):
            lo_lat, hi_lat, lo_lon, hi_lon = PROVINCE_ENVELOPES[s['province']]
            if not (lo_lat <= lat <= hi_lat and lo_lon <= lon <= hi_lon):
                gross_geo_mismatches.append((str(s.get('id')), s.get('province'), lat, lon, s.get('city')))
        for info in (s.get('prices') or {}).values():
            try:
                price = float(info.get('price'))
            except (TypeError, ValueError, AttributeError):
                continue
            if price <= 0:
                continue
            price_count += 1
            updated = parse_dt(info.get('updated')) if isinstance(info, dict) else None
            if updated and (latest_price is None or updated > latest_price):
                latest_price = updated

    if invalid_coords:
        raise SystemExit(f'{rel}: coordinate non valide per {len(invalid_coords)} impianti, esempi {invalid_coords[:5]}')
    if gross_geo_mismatches:
        raise SystemExit(f'{rel}: provincia/coordinate incompatibili: {gross_geo_mismatches[:5]}')
    if price_count < min_prices:
        raise SystemExit(f'{rel}: solo {price_count} prezzi validi')

    snap = metadata.get('source_snapshot_date')
    mode = str(metadata.get('source_mode') or '')
    if snap:
        age = (datetime.now(timezone.utc).date() - datetime.fromisoformat(snap).date()).days
        print(f'{rel}: {n} impianti, {price_count} prezzi, snapshot {snap}, età {age} giorni, fonte {mode}')
        if age < -1:
            raise SystemExit(f'{rel}: snapshot futuro non plausibile ({snap})')
        if age > 30:
            raise SystemExit(f'{rel}: fallback eccessivamente vecchio ({age} giorni)')
        if ('live' in mode.lower() or 'api' in mode.lower()) and age > 2:
            raise SystemExit(f'{rel}: fonte dichiarata live ma snapshot vecchio di {age} giorni')
        if age > 2:
            print(f'WARNING: {rel}: fallback MIMIT non recente ({age} giorni), pubblicazione consentita per continuità di servizio')
    else:
        print(f'{rel}: {n} impianti, {price_count} prezzi, fonte live/senza snapshot')

    if latest_price:
        latest_age = (datetime.now(timezone.utc) - latest_price.astimezone(timezone.utc)).total_seconds() / 86400
        print(f'{rel}: prezzo più recente aggiornato {latest_age:.1f} giorni fa')
        if latest_age > 30:
            raise SystemExit(f'{rel}: nessun prezzo aggiornato negli ultimi 30 giorni')

validate_dataset('data/stations-it.json', 15000, 25000)
validate_dataset('data/stations.json', 900, 1500)

html = (ROOT / 'index.html').read_text(encoding='utf-8')
for token in ['trip.js','marker-fix.js','zone-colors-v2.js','location-visibility.js']:
    if token not in html:
        raise SystemExit('index.html non include ' + token)

manifest = json.loads((ROOT / 'manifest.webmanifest').read_text(encoding='utf-8'))
if manifest.get('display') != 'standalone':
    raise SystemExit('manifest: display deve essere standalone')
icon_sizes = {i.get('sizes') for i in manifest.get('icons', [])}
if not {'192x192', '512x512'}.issubset(icon_sizes):
    raise SystemExit('manifest: icone 192x192 e 512x512 mancanti')
if 'apple-touch-icon' not in html or 'carburanti-green-180.png' not in html:
    raise SystemExit('index.html: apple-touch-icon 180x180 mancante')

print('Validazione release OK')
