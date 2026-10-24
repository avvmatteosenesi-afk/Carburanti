#!/usr/bin/env python3
"""Aggiorna i prezzi tramite la API pubblica v2 di Osservaprezzi MIMIT.

L'open data massivo resta la base anagrafica/fallback. I prezzi vengono poi
rinfrescati usando https://carburanti.mise.gov.it/ospzApi, cioe' l'API JSON
attuale del portale pubblico Osservaprezzi.
"""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
BASE = "https://carburanti.mise.gov.it/ospzApi"
UA = "Mozilla/5.0 (compatible; Carburanti-PWA/1.3; +GitHub-Pages)"
TUSCANY = {"AR", "FI", "GR", "LI", "LU", "MS", "PI", "PT", "PO", "SI"}
PROVINCE_BOUNDS = {
    "AR": (43.15, 11.30, 43.86, 12.22), "FI": (43.37, 10.58, 44.24, 11.82),
    "GR": (42.18, 10.50, 43.29, 11.78), "LI": (42.68, 9.65, 43.67, 10.78),
    "LU": (43.64, 10.00, 44.36, 10.84), "MS": (43.91, 9.68, 44.55, 10.42),
    "PI": (43.28, 10.20, 43.91, 11.02), "PT": (43.73, 10.50, 44.25, 11.14),
    "PO": (43.72, 10.84, 44.19, 11.31), "SI": (42.83, 10.70, 43.65, 11.91),
}
FUEL_IDS = {"1": "benzina", "2": "gasolio", "3": "metano", "4": "gpl"}


def request_json(path: str, payload=None, timeout: int = 30, attempts: int = 3):
    url = f"{BASE}/{path.lstrip('/')}"
    data = None
    headers = {
        "User-Agent": UA,
        "Accept": "application/json",
        "Referer": "https://carburanti.mise.gov.it/ospzSearch/",
    }
    method = "GET"
    if payload is not None:
        data = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        headers["Content-Type"] = "application/json"
        method = "POST"
    last = None
    for attempt in range(attempts):
        try:
            req = urllib.request.Request(url, data=data, headers=headers, method=method)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                raw = r.read().decode("utf-8", "replace")
                ctype = r.headers.get("Content-Type", "")
                if "json" not in ctype.lower() and not raw.lstrip().startswith(("{", "[")):
                    raise RuntimeError(f"risposta non JSON HTTP {r.status}: {raw[:120]!r}")
                return json.loads(raw)
        except Exception as exc:
            last = exc
            if attempt + 1 < attempts:
                time.sleep(2 * (attempt + 1))
    raise last


def province_map():
    data = request_json("registry/province")
    out = []
    if isinstance(data, list):
        for x in data:
            if not isinstance(x, dict):
                continue
            code = str(x.get("code") or x.get("sigla") or x.get("province") or x.get("id") or "").upper().strip()
            region = x.get("regionId") or x.get("region") or x.get("regioneId")
            if code and region is not None:
                try: out.append((int(region), code))
                except (TypeError, ValueError): pass
    elif isinstance(data, dict):
        rows = data.get("content") or data.get("array") or data.get("data") or data.get("provinces")
        if isinstance(rows, list):
            for x in rows:
                if not isinstance(x, dict): continue
                code = str(x.get("code") or x.get("sigla") or x.get("province") or x.get("id") or "").upper().strip()
                region = x.get("regionId") or x.get("region") or x.get("regioneId")
                if code and region is not None:
                    try: out.append((int(region), code))
                    except (TypeError, ValueError): pass
    # Il search/area richiede la regione, ma se il registry non la espone ricaviamo
    # l'associazione dal registry region e/o dall'anagrafica fallback in main().
    return out, data


def parse_float(v):
    try: return float(str(v).replace(",", "."))
    except (TypeError, ValueError): return None


def valid_italy(lat, lon):
    return lat is not None and lon is not None and 35 <= lat <= 48.5 and 5.5 <= lon <= 19.5


def within_bbox(code, lat, lon):
    b = PROVINCE_BOUNDS.get(code)
    return not b or (b[0] <= lat <= b[2] and b[1] <= lon <= b[3])


def highway(name, address):
    t = f"{name} {address}".lower()
    return "autostrad" in t or "area di servizio" in t


def choose(old, cand):
    if old is None: return cand
    if cand["self"] and not old["self"]: return cand
    if old["self"] and not cand["self"]: return old
    return cand


def unwrap_rows(payload):
    if isinstance(payload, list): return payload
    if not isinstance(payload, dict): return []
    for key in ("array", "content", "data", "results", "serviceAreas", "stations"):
        if isinstance(payload.get(key), list): return payload[key]
    return []


def main():
    national_path = DATA / "stations-it.json"
    tuscany_path = DATA / "stations.json"
    national = json.loads(national_path.read_text(encoding="utf-8"))
    by_id = {str(s["id"]): s for s in national["stations"]}

    # Province effettivamente presenti nell'anagrafica MIMIT. Il registry v2 viene
    # interrogato come controllo di disponibilita', ma non dipendiamo dal suo schema.
    try:
        _, registry_raw = province_map()
        print(f"Registry province API v2 disponibile ({type(registry_raw).__name__}).", flush=True)
    except Exception as exc:
        print(f"Registry province non necessario/non disponibile: {exc}", flush=True)

    province_codes = sorted({str(s.get("province", "")).upper() for s in by_id.values() if s.get("province")})
    # Mappa regione ISTAT usata dal portale (1..20), ricavata per provincia.
    region_provinces = {
        1:"TO VC NO CN AT AL BI VB".split(), 2:"AO".split(), 3:"VA CO SO MI BG BS PV CR MN LC LO MB".split(),
        4:"BZ TN".split(), 5:"VR VI BL TV VE PD RO".split(), 6:"UD GO TS PN".split(), 7:"IM SV GE SP".split(),
        8:"PC PR RE MO BO FE RA FC RN".split(), 9:"MS LU PT FI LI PI AR SI GR PO".split(), 10:"PG TR".split(),
        11:"PU AN MC AP FM".split(), 12:"VT RI RM LT FR".split(), 13:"AQ TE PE CH".split(), 14:"CB IS".split(),
        15:"CE BN NA AV SA".split(), 16:"FG BA TA BR LE BT".split(), 17:"PZ MT".split(), 18:"CS CZ RC KR VV".split(),
        19:"TP PA ME AG CL EN CT RG SR".split(), 20:"SS NU CA OR SU".split(),
    }
    region_by_province = {p:r for r, ps in region_provinces.items() for p in ps}
    provinces = [(region_by_province[p], p) for p in province_codes if p in region_by_province]
    if len(provinces) < 90:
        raise RuntimeError(f"Elenco province anagrafica incompleto ({len(provinces)})")

    fetched_provinces = api_stations = price_rows = new_stations = 0
    fetched_at = datetime.now(timezone.utc).isoformat()

    for region, province in provinces:
        try:
            payload = request_json("search/area", {
                "region": region, "province": province, "town": "",
                "fuelType": "", "priceOrder": "asc"
            })
        except Exception as exc:
            print(f"{province}: ricerca API v2 non disponibile ({exc})", flush=True)
            continue
        rows = unwrap_rows(payload)
        fetched_provinces += 1
        api_stations += len(rows)
        for item in rows:
            if not isinstance(item, dict): continue
            sid = str(item.get("id", "")).strip()
            lat, lon = parse_float(item.get("lat")), parse_float(item.get("lon"))
            if not sid or not valid_italy(lat, lon): continue
            station = by_id.get(sid)
            if station is None:
                station = {"id":sid,"name":item.get("name") or item.get("bnd") or "Distributore","brand":item.get("bnd") or "","type":"","address":item.get("addr") or "","city":"","province":province,"lat":round(lat,6),"lon":round(lon,6),"prices":{},"highway":highway(item.get("name") or "",item.get("addr") or "")}
                by_id[sid] = station; new_stations += 1
            else:
                station["lat"], station["lon"], station["province"] = round(lat,6), round(lon,6), province
                if item.get("name"): station["name"] = item["name"]
                if item.get("bnd"): station["brand"] = item["bnd"]
                if item.get("addr"): station["address"] = item["addr"]
                station["highway"] = station.get("highway",False) or highway(station.get("name",""),station.get("address",""))
            selected = {}
            fuels = item.get("carburanti") or item.get("fuels") or item.get("fuelPrices") or []
            for p in fuels:
                if not isinstance(p, dict): continue
                fuel = FUEL_IDS.get(str(p.get("idCarb") or p.get("fuelId") or p.get("idFuel") or "").strip())
                if not fuel:
                    name = str(p.get("carb") or p.get("fuel") or "").lower().strip()
                    fuel = {"benzina":"benzina","gasolio":"gasolio","gpl":"gpl","metano":"metano"}.get(name)
                if not fuel: continue
                price = parse_float(p.get("prezzo") if "prezzo" in p else p.get("price"))
                if price is None or not (0 < price < 10): continue
                selfv = str(p.get("isSelf") if "isSelf" in p else p.get("self",0)).lower() in ("1","true")
                updated = p.get("dtComu") or p.get("updated") or p.get("date")
                cand={"price":round(price,3),"self":selfv,"updated":updated}
                selected[fuel]=choose(selected.get(fuel),cand); price_rows += 1
            if selected: station["prices"] = selected

    if fetched_provinces < 90 or api_stations < 12000 or price_rows < 15000:
        raise RuntimeError(f"API Osservaprezzi v2 incompleta: province={fetched_provinces}, impianti={api_stations}, prezzi={price_rows}")

    stations=[s for s in by_id.values() if s.get("prices")]
    stations.sort(key=lambda s:(s.get("province",""),s.get("city",""),s.get("name",""),str(s["id"])))
    national["stations"]=stations
    national["metadata"].update({"generated_at":fetched_at,"source":"MIMIT Osservaprezzi - API pubblica v2","source_mode":"mimit-osservaprezzi-live-api-v2","source_snapshot_date":datetime.now(timezone.utc).date().isoformat(),"source_prices":f"{BASE}/search/area","stations":len(stations),"api_provinces":fetched_provinces,"api_station_results":api_stations,"api_price_rows":price_rows})
    tus=[s for s in stations if s.get("province") in TUSCANY and within_bbox(s.get("province"),s["lat"],s["lon"])]
    old_tus=json.loads(tuscany_path.read_text(encoding="utf-8")); old_tus["stations"]=tus
    old_tus["metadata"].update({"generated_at":fetched_at,"source":national["metadata"]["source"],"source_mode":national["metadata"]["source_mode"],"source_snapshot_date":national["metadata"]["source_snapshot_date"],"source_prices":national["metadata"]["source_prices"],"stations":len(tus),"api_provinces":fetched_provinces,"api_station_results":api_stations,"api_price_rows":price_rows})
    national_path.write_text(json.dumps(national,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    tuscany_path.write_text(json.dumps(old_tus,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    print(f"Osservaprezzi API v2 OK: {fetched_provinces} province, {api_stations} risultati, {price_rows} prezzi, {new_stations} nuovi impianti.",flush=True)

if __name__ == "__main__": main()
