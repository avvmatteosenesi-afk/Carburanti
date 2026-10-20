#!/usr/bin/env python3
"""Scarica gli open data MIMIT e genera i dataset dell'app Carburanti.

Dal 10/02/2026 i CSV MIMIT usano il separatore '|'.
Genera:
  - data/stations-it.json: impianti nazionali con prezzi correnti
  - data/stations.json: soli impianti toscani, con controllo provincia↔coordinate
"""
from __future__ import annotations

import csv
import io
import json
import math
import os
import re
import sys
import unicodedata
import urllib.request
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

STATIONS_URL = "https://www.mimit.gov.it/images/exportCSV/anagrafica_impianti_attivi.csv"
PRICES_URL = "https://www.mimit.gov.it/images/exportCSV/prezzo_alle_8.csv"

TUSCANY_PROVINCES = {"AR", "FI", "GR", "LI", "LU", "MS", "PI", "PT", "PO", "SI"}

# Bounding box prudenziali: servono a eliminare coordinate manifestamente incompatibili
# con la provincia dichiarata (es. impianto PO con coordinate a Roma), non a ricostruire
# i confini amministrativi al metro.
PROVINCE_BOUNDS = {
    "AR": (43.15, 11.30, 43.86, 12.22),
    "FI": (43.37, 10.58, 44.24, 11.82),
    "GR": (42.18, 10.50, 43.29, 11.78),
    "LI": (42.68, 9.65, 43.67, 10.78),
    "LU": (43.64, 10.00, 44.36, 10.84),
    "MS": (43.91, 9.68, 44.55, 10.42),
    "PI": (43.28, 10.20, 43.91, 11.02),
    "PT": (43.73, 10.50, 44.25, 11.14),
    "PO": (43.72, 10.84, 44.19, 11.31),
    "SI": (42.83, 10.70, 43.65, 11.91),
}

UA = "Carburanti-PWA/1.0 (+GitHub Pages; MIMIT open data)"


def fetch_text(url: str) -> str:
    last_error = None
    for attempt in range(1, 5):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/csv,*/*"})
            with urllib.request.urlopen(req, timeout=180) as response:
                raw = response.read()
            for enc in ("utf-8-sig", "utf-8", "latin-1"):
                try:
                    return raw.decode(enc)
                except UnicodeDecodeError:
                    pass
            return raw.decode("utf-8", errors="replace")
        except Exception as exc:
            last_error = exc
            if attempt < 4:
                time.sleep(attempt * 4)
    raise last_error


def norm_key(value: str) -> str:
    value = unicodedata.normalize("NFKD", value or "")
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]", "", value.lower())


def norm_text(value: str) -> str:
    value = unicodedata.normalize("NFKD", value or "")
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", value.strip().lower())


def rows_from_text(text: str):
    lines = [line for line in text.splitlines() if line.strip()]
    header_index = None
    for i, line in enumerate(lines[:25]):
        if "idimpianto" in norm_key(line):
            header_index = i
            break
    if header_index is None:
        raise RuntimeError("Intestazione idImpianto non trovata nel CSV MIMIT")
    reader = csv.DictReader(io.StringIO("\n".join(lines[header_index:])), delimiter="|")
    for row in reader:
        yield {norm_key(k): (v or "").strip() for k, v in row.items() if k is not None}


def parse_float(value: str):
    try:
        return float((value or "").strip().replace(",", "."))
    except (TypeError, ValueError):
        return None


def parse_bool(value: str) -> bool:
    return norm_text(value) in {"1", "true", "si", "s", "yes", "y"}


def parse_date(value: str):
    value = (value or "").strip()
    if not value:
        return None
    fmts = (
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S%z",
    )
    for fmt in fmts:
        try:
            dt = datetime.strptime(value, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue
    return None


def iso_date(value: str) -> str | None:
    dt = parse_date(value)
    return dt.isoformat() if dt else (value or None)


def fuel_key(desc: str):
    t = norm_text(desc)
    # Manteniamo solo le quattro tipologie previste dall'app, senza elettrico.
    if t == "benzina" or t.startswith("benzina self"):
        return "benzina"
    if t == "gasolio" or t.startswith("gasolio self"):
        return "gasolio"
    if t == "gpl":
        return "gpl"
    if t == "metano":
        return "metano"
    return None


def valid_italy(lat, lon):
    return lat is not None and lon is not None and 35.0 <= lat <= 48.5 and 5.5 <= lon <= 19.5


def within_province_bbox(code: str, lat: float, lon: float) -> bool:
    box = PROVINCE_BOUNDS.get(code)
    if not box:
        return True
    min_lat, min_lon, max_lat, max_lon = box
    return min_lat <= lat <= max_lat and min_lon <= lon <= max_lon


def is_highway_station(station: dict) -> bool:
    text = norm_text(" ".join([
        station.get("type", ""), station.get("name", ""), station.get("address", "")
    ]))
    if "autostrad" in text or "area di servizio" in text:
        return True
    # Sigle autostradali nell'indirizzo, usate solo come indizio aggiuntivo.
    return bool(re.search(r"\b(a\s?\d{1,3}|e\s?\d{1,3})\b", text)) and "km" in text


def choose_price(existing, candidate):
    if existing is None:
        return candidate
    # La modalità self è prioritaria, coerentemente con l'uso consumer dell'app.
    if candidate["self"] and not existing["self"]:
        return candidate
    if existing["self"] and not candidate["self"]:
        return existing
    # A parità di modalità, preferiamo la comunicazione più recente.
    e_dt = parse_date(existing.get("updated_raw", ""))
    c_dt = parse_date(candidate.get("updated_raw", ""))
    if c_dt and (not e_dt or c_dt >= e_dt):
        return candidate
    return existing


def main():
    print("Download anagrafica MIMIT…", flush=True)
    stations_text = fetch_text(STATIONS_URL)
    print("Download prezzi MIMIT…", flush=True)
    prices_text = fetch_text(PRICES_URL)

    stations = {}
    malformed_coords = 0
    for row in rows_from_text(stations_text):
        sid = row.get("idimpianto", "").strip()
        if not sid:
            continue
        lat = parse_float(row.get("latitudine"))
        lon = parse_float(row.get("longitudine"))
        if not valid_italy(lat, lon):
            malformed_coords += 1
            continue
        province = (row.get("provincia") or "").upper().strip()
        station = {
            "id": sid,
            "name": row.get("nomeimpianto") or row.get("bandiera") or "Distributore",
            "brand": row.get("bandiera") or "",
            "type": row.get("tipoimpianto") or "",
            "address": row.get("indirizzo") or "",
            "city": row.get("comune") or "",
            "province": province,
            "lat": round(lat, 6),
            "lon": round(lon, 6),
            "prices": {},
        }
        station["highway"] = is_highway_station(station)
        stations[sid] = station

    selected_prices = {}
    price_rows = 0
    for row in rows_from_text(prices_text):
        sid = row.get("idimpianto", "").strip()
        if sid not in stations:
            continue
        fuel = fuel_key(row.get("desccarburante") or row.get("carburante") or "")
        if not fuel:
            continue
        price = parse_float(row.get("prezzo"))
        if price is None or price <= 0 or price > 10:
            continue
        price_rows += 1
        self_mode = parse_bool(row.get("isself") or row.get("self") or "")
        updated_raw = row.get("dtcomu") or row.get("datacomunicazione") or row.get("data") or ""
        candidate = {
            "price": round(price, 3),
            "self": self_mode,
            "updated": iso_date(updated_raw),
            "updated_raw": updated_raw,
        }
        key = (sid, fuel)
        selected_prices[key] = choose_price(selected_prices.get(key), candidate)

    for (sid, fuel), p in selected_prices.items():
        p = dict(p)
        p.pop("updated_raw", None)
        stations[sid]["prices"][fuel] = p

    national = [s for s in stations.values() if s["prices"]]
    national.sort(key=lambda s: (s.get("province", ""), s.get("city", ""), s.get("name", ""), s["id"]))

    tuscany = []
    excluded_mismatch = []
    for s in national:
        code = s.get("province", "")
        if code not in TUSCANY_PROVINCES:
            continue
        if not within_province_bbox(code, s["lat"], s["lon"]):
            excluded_mismatch.append({"id": s["id"], "province": code, "lat": s["lat"], "lon": s["lon"]})
            continue
        tuscany.append(s)

    generated_at = datetime.now(timezone.utc).isoformat()
    common_meta = {
        "generated_at": generated_at,
        "source": "MIMIT open data - Prezzi praticati e anagrafica degli impianti",
        "source_stations": STATIONS_URL,
        "source_prices": PRICES_URL,
        "fuels": ["benzina", "gasolio", "gpl", "metano"],
        "electric": False,
    }

    national_payload = {
        "metadata": {
            **common_meta,
            "scope": "Italy",
            "stations": len(national),
            "malformed_coordinates_excluded": malformed_coords,
            "price_rows_considered": price_rows,
        },
        "stations": national,
    }
    tuscany_payload = {
        "metadata": {
            **common_meta,
            "scope": "Tuscany",
            "stations": len(tuscany),
            "province_coordinate_mismatches_excluded": len(excluded_mismatch),
            "excluded_ids": [x["id"] for x in excluded_mismatch],
        },
        "stations": tuscany,
    }

    for path, payload in [
        (DATA_DIR / "stations-it.json", national_payload),
        (DATA_DIR / "stations.json", tuscany_payload),
    ]:
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        tmp.replace(path)
        print(f"Scritto {path.relative_to(ROOT)} ({path.stat().st_size / 1024 / 1024:.2f} MB)")

    print(f"Impianti Italia: {len(national)}")
    print(f"Impianti Toscana validi: {len(tuscany)}")
    print(f"Anomalie provincia↔coordinate escluse: {len(excluded_mismatch)}")
    if excluded_mismatch:
        print("Esempi esclusi:", excluded_mismatch[:10])


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERRORE: {exc}", file=sys.stderr)
        raise
