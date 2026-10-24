#!/usr/bin/env python3
"""Aggiorna i prezzi con l'API pubblica v2 Osservaprezzi MIMIT.

L'open data massivo resta la base anagrafica/fallback. La ricerca live viene
eseguita una volta per provincia, senza fuelType: l'API restituisce così tutti
gli impianti e tutti i carburanti disponibili. Nessun dataset parziale viene
pubblicato.
"""
from __future__ import annotations
import json, time, urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]; DATA=ROOT/'data'
BASE='https://carburanti.mise.gov.it/ospzApi'
UA='Mozilla/5.0 (compatible; Carburanti-PWA/1.5; +GitHub-Pages)'
TUSCANY={'AR','FI','GR','LI','LU','MS','PI','PT','PO','SI'}
PROVINCE_BOUNDS={'AR':(43.15,11.30,43.86,12.22),'FI':(43.37,10.58,44.24,11.82),'GR':(42.18,10.50,43.29,11.78),'LI':(42.68,9.65,43.67,10.78),'LU':(43.64,10.00,44.36,10.84),'MS':(43.91,9.68,44.55,10.42),'PI':(43.28,10.20,43.91,11.02),'PT':(43.73,10.50,44.25,11.14),'PO':(43.72,10.84,44.19,11.31),'SI':(42.83,10.70,43.65,11.91)}

# ID regione REALI dell'API ospzApi/registry/region (non codici ISTAT).
REGION_PROVINCES={
 1:'PU AN MC AP FM'.split(), 2:'AQ TE PE CH'.split(), 3:'PZ MT'.split(),
 4:'CB IS'.split(), 5:'BZ TN'.split(), 6:'FG BA TA BR LE BT'.split(),
 7:'CS CZ RC KR VV'.split(), 8:'CE BN NA AV SA'.split(),
 9:'VT RI RM LT FR'.split(), 10:'SS NU CA OR SU'.split(),
 11:'TP PA ME AG CL EN CT RG SR'.split(), 12:'MS LU PT FI LI PI AR SI GR PO'.split(),
 13:'TO VC NO CN AT AL BI VB'.split(), 14:'PC PR RE MO BO FE RA FC RN'.split(),
 15:'UD GO TS PN'.split(), 16:'AO'.split(), 17:'VR VI BL TV VE PD RO'.split(),
 18:'IM SV GE SP'.split(), 19:'VA CO SO MI BG BS PV CR MN LC LO MB'.split(),
 20:'PG TR'.split()
}

def request_json(path,payload=None,timeout=30,attempts=3):
 url=f"{BASE}/{path.lstrip('/')}"; data=None
 headers={'User-Agent':UA,'Accept':'application/json','Referer':'https://carburanti.mise.gov.it/ospzSearch/'}; method='GET'
 if payload is not None:
  data=json.dumps(payload,separators=(',',':')).encode(); headers['Content-Type']='application/json'; method='POST'
 last=None
 for attempt in range(attempts):
  try:
   req=urllib.request.Request(url,data=data,headers=headers,method=method)
   with urllib.request.urlopen(req,timeout=timeout) as r:
    raw=r.read().decode('utf-8','replace')
    if not raw.strip(): raise RuntimeError(f'risposta vuota HTTP {r.status}')
    return json.loads(raw)
  except Exception as exc:
   last=exc
   if attempt+1<attempts: time.sleep(2*(attempt+1))
 raise last

def parse_float(v):
 try:return float(str(v).replace(',','.'))
 except (TypeError,ValueError):return None
def valid_italy(lat,lon):return lat is not None and lon is not None and 35<=lat<=48.5 and 5.5<=lon<=19.5
def within_bbox(code,lat,lon):
 b=PROVINCE_BOUNDS.get(code); return not b or (b[0]<=lat<=b[2] and b[1]<=lon<=b[3])
def highway(name,address):
 t=f'{name} {address}'.lower(); return 'autostrad' in t or 'area di servizio' in t
def choose(old,cand):
 if old is None:return cand
 if cand['self'] and not old['self']:return cand
 if old['self'] and not cand['self']:return old
 return cand
def unwrap_rows(payload):
 if isinstance(payload,list):return payload
 if not isinstance(payload,dict):return []
 for key in ('results','array','content','data','serviceAreas','stations'):
  if isinstance(payload.get(key),list):return payload[key]
 return []
def coords(item):
 loc=item.get('location') if isinstance(item.get('location'),dict) else {}
 lat=parse_float(item.get('lat') if item.get('lat') is not None else loc.get('lat'))
 lon=parse_float(item.get('lon') if item.get('lon') is not None else (loc.get('lng') if loc.get('lng') is not None else loc.get('lon')))
 return lat,lon
def fuel_name(p):
 name=str(p.get('name') or p.get('carb') or p.get('fuel') or '').lower().strip()
 if 'benzina' in name or name in ('super','be'):return 'benzina'
 if 'gasolio' in name or 'diesel' in name or name in ('g','ga'):return 'gasolio'
 if 'gpl' in name:return 'gpl'
 if 'metano' in name or 'cng' in name:return 'metano'
 fid=str(p.get('fuelId') or p.get('idCarb') or p.get('idFuel') or '').strip()
 return {'1':'benzina','2':'gasolio','3':'metano','4':'gpl'}.get(fid)

def main():
 national_path=DATA/'stations-it.json'; tuscany_path=DATA/'stations.json'
 national=json.loads(national_path.read_text(encoding='utf-8')); by_id={str(s['id']):s for s in national['stations']}
 province_codes=sorted({str(s.get('province','')).upper() for s in by_id.values() if s.get('province')})
 region_by_province={p:r for r,ps in REGION_PROVINCES.items() for p in ps}
 provinces=[(region_by_province[p],p) for p in province_codes if p in region_by_province]
 if len(provinces)<90:raise RuntimeError(f'Elenco province incompleto ({len(provinces)})')
 fetched_provinces=api_stations=price_rows=new_stations=0; fetched_at=datetime.now(timezone.utc).isoformat()
 for region,province in provinces:
  try:
   # fuelType intenzionalmente omesso: l'API restituisce tutti i carburanti.
   payload=request_json('search/area',{'region':region,'province':province,'town':None,'priceOrder':'asc'})
   rows=unwrap_rows(payload)
  except Exception as exc:
   print(f'{province}: API non disponibile ({exc})',flush=True); continue
  if not rows:
   print(f'{province}: nessun risultato',flush=True); continue
  fetched_provinces+=1; api_stations+=len(rows)
  print(f'{province}: {len(rows)} impianti',flush=True)
  for item in rows:
   if not isinstance(item,dict) or item.get('id') is None:continue
   sid=str(item['id']); lat,lon=coords(item)
   if not valid_italy(lat,lon):continue
   station=by_id.get(sid); address=item.get('address') or item.get('addr') or ''
   if station is None:
    station={'id':sid,'name':item.get('name') or 'Distributore','brand':item.get('brand') or item.get('bnd') or '','type':'','address':address,'city':'','province':province,'lat':round(lat,6),'lon':round(lon,6),'prices':{},'highway':highway(item.get('name') or '',address)}; by_id[sid]=station; new_stations+=1
   else:
    station['lat'],station['lon'],station['province']=round(lat,6),round(lon,6),province
    if item.get('name'):station['name']=item['name']
    if item.get('brand') or item.get('bnd'):station['brand']=item.get('brand') or item.get('bnd')
    if address:station['address']=address
    station['highway']=station.get('highway',False) or highway(station.get('name',''),station.get('address',''))
   selected={}; fuels=item.get('fuels') or item.get('carburanti') or item.get('fuelPrices') or []
   for p in fuels:
    if not isinstance(p,dict):continue
    fuel=fuel_name(p)
    if not fuel:continue
    price=parse_float(p.get('price') if 'price' in p else p.get('prezzo'))
    if price is None or not 0<price<10:continue
    selfv=str(p.get('isSelf') if 'isSelf' in p else p.get('self',0)).lower() in ('1','true')
    updated=p.get('dtComu') or p.get('updated') or p.get('date') or item.get('insertDate')
    selected[fuel]=choose(selected.get(fuel),{'price':round(price,3),'self':selfv,'updated':updated}); price_rows+=1
   if selected:station['prices'].update(selected)
 if fetched_provinces<90 or api_stations<12000 or price_rows<15000:
  raise RuntimeError(f'API Osservaprezzi incompleta: province={fetched_provinces}, impianti={api_stations}, prezzi={price_rows}')
 stations=[s for s in by_id.values() if s.get('prices')]; stations.sort(key=lambda s:(s.get('province',''),s.get('city',''),s.get('name',''),str(s['id'])))
 meta={'generated_at':fetched_at,'source':'MIMIT Osservaprezzi - API pubblica v2','source_mode':'mimit-osservaprezzi-live-api-v2','source_snapshot_date':datetime.now(timezone.utc).date().isoformat(),'source_prices':f'{BASE}/search/area','stations':len(stations),'api_provinces':fetched_provinces,'api_station_results':api_stations,'api_price_rows':price_rows}
 national['stations']=stations; national['metadata'].update(meta)
 tus=[s for s in stations if s.get('province') in TUSCANY and within_bbox(s.get('province'),s['lat'],s['lon'])]
 old_tus=json.loads(tuscany_path.read_text(encoding='utf-8')); old_tus['stations']=tus; old_tus['metadata'].update(meta|{'stations':len(tus)})
 national_path.write_text(json.dumps(national,ensure_ascii=False,separators=(',',':')),encoding='utf-8'); tuscany_path.write_text(json.dumps(old_tus,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
 print(f'Osservaprezzi API v2 OK: {fetched_provinces} province, {api_stations} impianti, {price_rows} prezzi, {new_stations} nuovi.',flush=True)
if __name__=='__main__':main()
