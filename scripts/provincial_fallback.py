"""Reuse a missing province only from a recent, previously published acquisition."""
import copy
import json
import urllib.request
from datetime import timedelta
from data_freshness import MAX_DATASET_AGE, MAX_FUTURE_SKEW, MAX_PRICE_AGE, parse_timestamp, price_is_current

PUBLISHED = 'https://avvmatteosenesi-afk.github.io/Carburanti/data/stations-it.json'

def fetch_published():
    req=urllib.request.Request(PUBLISHED,headers={'Cache-Control':'no-cache','User-Agent':'Carburanti verified provincial fallback'})
    with urllib.request.urlopen(req,timeout=30) as response:
        return json.load(response)

def select_province(payload, province, now):
    metadata=payload.get('metadata') or {}
    # Never renew a province's acquisition date through repeated fallback builds.
    origin=(metadata.get('api_fallback_acquired_at') or {}).get(province) or metadata.get('generated_at')
    acquired=parse_timestamp(origin)
    if acquired is None or not -MAX_FUTURE_SKEW <= now-acquired <= MAX_DATASET_AGE:
        raise RuntimeError(f'{province}: fallback senza acquisizione originale entro 48 ore')
    selected=[]
    for station in payload.get('stations',[]):
        if station.get('province')!=province:continue
        prices={}
        for fuel,price in (station.get('prices') or {}).items():
            if fuel not in {'benzina','gasolio','gpl','metano'} or not isinstance(price,dict):continue
            value=price.get('price')
            if not isinstance(value,(int,float)) or not 0<value<10:continue
            if price_is_current(parse_timestamp(price.get('updated')),now,max_age=MAX_PRICE_AGE-timedelta(hours=2)):
                prices[fuel]=copy.deepcopy(price)
        lat,lon=station.get('lat'),station.get('lon')
        if not isinstance(lat,(int,float)) or not isinstance(lon,(int,float)) or not(35<=lat<=48 and 5.5<=lon<=19.5):continue
        if prices:
            item=copy.deepcopy(station);item['prices']=prices;selected.append(item)
    if not selected:raise RuntimeError(f'{province}: nessun prezzo riutilizzabile dalla pubblicazione precedente')
    return selected,acquired.isoformat()
