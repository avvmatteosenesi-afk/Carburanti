#!/usr/bin/env python3
"""Aggiorna i prezzi usando l'API pubblica dell'Osservaprezzi MIMIT.

La sorgente primaria dell'app resta l'open data giornaliero. Se il CSV massivo MIMIT
non e' raggiungibile, questo passaggio interroga direttamente la stessa API pubblica
usata dal portale Osservaprezzi, provincia per provincia. L'archivio giornaliero resta
quindi solo la base anagrafica/fallback.
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
BASE = "https://carburanti.mise.gov.it/OssPrezziSearch/ricerca"
UA = "Mozilla/5.0 (compatible; Carburanti-PWA/1.2; +GitHub-Pages)"
TUSCANY = {"AR", "FI", "GR", "LI", "LU", "MS", "PI", "PT", "PO", "SI"}
PROVINCE_BOUNDS = {
    "AR": (43.15, 11.30, 43.86, 12.22), "FI": (43.37, 10.58, 44.24, 11.82),
    "GR": (42.18, 10.50, 43.29, 11.78), "LI": (42.68, 9.65, 43.67, 10.78),
    "LU": (43.64, 10.00, 44.36, 10.84), "MS": (43.91, 9.68, 44.55, 10.42),
    "PI": (43.28, 10.20, 43.91, 11.02), "PT": (43.73, 10.50, 44.25, 11.14),
    "PO": (43.72, 10.84, 44.19, 11.31), "SI": (42.83, 10.70, 43.65, 11.91),
}
FUEL_IDS = {"1": "benzina", "2": "gasolio", "3": "metano", "4": "gpl"}


def post_json(path: str, fields: dict, timeout: int = 25, attempts: int = 3):
    data = urllib.parse.urlencode(fields).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE}/{path}", data=data,
        headers={
            "User-Agent": UA,
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
            "Origin": "https://carburanti.mise.gov.it",
            "Referer": "https://carburanti.mise.gov.it/OssPrezziSearch/",
        }, method="POST")
    last = None
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode("utf-8", "replace"))
        except Exception as exc:
            last = exc
            if attempt + 1 < attempts:
                time.sleep(2 * (attempt + 1))
    raise last


def province_map():
    result = []
    seen = set()
    for region in range(1, 21):
        try:
            provinces = post_json("province", {"regioneId": region})
        except Exception as exc:
            print(f"Regione {region}: elenco province non disponibile ({exc})", flush=True)
            continue
        if not isinstance(provinces, dict):
            continue
        for code in provinces:
            code = str(code).upper().strip()
            if code and code not in seen:
                seen.add(code)
                result.append((region, code))
    return result


def parse_float(v):
    try:
        return float(str(v).replace(",", "."))
    except (TypeError, ValueError):
        return None


def valid_italy(lat, lon):
    return lat is not None and lon is not None and 35 <= lat <= 48.5 and 5.5 <= lon <= 19.5


def within_bbox(code, lat, lon):
    b = PROVINCE_BOUNDS.get(code)
    return not b or (b[0] <= lat <= b[2] and b[1] <= lon <= b[3])


def highway(name, address):
    t = f"{name} {address}".lower()
    return "autostrad" in t or "area di servizio" in t


def choose(old, cand):
    if old is None:
        return cand
    if cand["self"] and not old["self"]:
        return cand
    if old["self"] and not cand["self"]:
        return old
    return cand


def main():
    national_path = DATA / "stations-it.json"
    tuscany_path = DATA / "stations.json"
    national = json.loads(national_path.read_text(encoding="utf-8"))
    by_id = {str(s["id"]): s for s in national["stations"]}

    provinces = province_map()
    if len(provinces) < 90:
        raise RuntimeError(f"API Osservaprezzi: elenco province incompleto ({len(provinces)})")

    fetched_provinces = 0
    api_stations = 0
    price_rows = 0
    new_stations = 0
    fetched_at = datetime.now(timezone.utc).isoformat()

    for region, province in provinces:
        try:
            # carb vuoto = tutti i carburanti, come previsto dal portale pubblico.
            payload = post_json("localita", {
                "region": region, "province": province, "town": "",
                "carb": "", "ordPrice": "asc"
            })
        except Exception as exc:
            print(f"{province}: ricerca prezzi non disponibile ({exc})", flush=True)
            continue
        rows = payload.get("array", []) if isinstance(payload, dict) else []
        if not isinstance(rows, list):
            continue
        fetched_provinces += 1
        api_stations += len(rows)
        for item in rows:
            sid = str(item.get("id", "")).strip()
            lat, lon = parse_float(item.get("lat")), parse_float(item.get("lon"))
            if not sid or not valid_italy(lat, lon):
                continue
            station = by_id.get(sid)
            if station is None:
                station = {
                    "id": sid,
                    "name": item.get("name") or item.get("bnd") or "Distributore",
                    "brand": item.get("bnd") or "",
                    "type": "",
                    "address": item.get("addr") or "",
                    "city": "",
                    "province": province,
                    "lat": round(lat, 6), "lon": round(lon, 6),
                    "prices": {},
                    "highway": highway(item.get("name") or "", item.get("addr") or ""),
                }
                by_id[sid] = station
                new_stations += 1
            else:
                # L'API live e' autorevole anche per coordinate/nome/indirizzo correnti.
                station["lat"], station["lon"] = round(lat, 6), round(lon, 6)
                station["province"] = province
                if item.get("name"): station["name"] = item["name"]
                if item.get("bnd"): station["brand"] = item["bnd"]
                if item.get("addr"): station["address"] = item["addr"]
                station["highway"] = station.get("highway", False) or highway(station.get("name", ""), station.get("address", ""))

            selected = {}
            for p in item.get("carburanti", []) or []:
                fuel = FUEL_IDS.get(str(p.get("idCarb", "")).strip())
                if not fuel:
                    continue
                price = parse_float(p.get("prezzo"))
                if price is None or not (0 < price < 10):
                    continue
                cand = {"price": round(price, 3), "self": str(p.get("isSelf", "0")) == "1", "updated": None}
                selected[fuel] = choose(selected.get(fuel), cand)
                price_rows += 1
            # Risposta live: sostituiamo il listino, evitando prezzi cessati rimasti nel fallback.
            if selected:
                station["prices"] = selected

    # Pretendiamo copertura nazionale sostanziale: in caso contrario non sovrascriviamo il fallback.
    if fetched_provinces < 90 or api_stations < 12000 or price_rows < 15000:
        raise RuntimeError(
            f"API Osservaprezzi incompleta: province={fetched_provinces}, impianti={api_stations}, prezzi={price_rows}")

    stations = [s for s in by_id.values() if s.get("prices")]
    stations.sort(key=lambda s: (s.get("province", ""), s.get("city", ""), s.get("name", ""), str(s["id"])))
    national["stations"] = stations
    national["metadata"].update({
        "generated_at": fetched_at,
        "source": "MIMIT Osservaprezzi - API pubblica in tempo reale",
        "source_mode": "mimit-osservaprezzi-live-api",
        "source_snapshot_date": datetime.now(timezone.utc).date().isoformat(),
        "source_prices": f"{BASE}/localita",
        "stations": len(stations),
        "api_provinces": fetched_provinces,
        "api_station_results": api_stations,
        "api_price_rows": price_rows,
    })

    tus = [s for s in stations if s.get("province") in TUSCANY and within_bbox(s.get("province"), s["lat"], s["lon"])]
    old_tus = json.loads(tuscany_path.read_text(encoding="utf-8"))
    old_tus["stations"] = tus
    old_tus["metadata"].update({
        "generated_at": fetched_at,
        "source": national["metadata"]["source"],
        "source_mode": national["metadata"]["source_mode"],
        "source_snapshot_date": national["metadata"]["source_snapshot_date"],
        "source_prices": national["metadata"]["source_prices"],
        "stations": len(tus),
        "api_provinces": fetched_provinces,
        "api_station_results": api_stations,
        "api_price_rows": price_rows,
    })

    national_path.write_text(json.dumps(national, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    tuscany_path.write_text(json.dumps(old_tus, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Osservaprezzi live OK: {fetched_provinces} province, {api_stations} risultati impianto, {price_rows} prezzi, {new_stations} nuovi impianti.", flush=True)


if __name__ == "__main__":
    main()
