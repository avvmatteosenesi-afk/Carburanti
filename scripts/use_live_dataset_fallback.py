#!/usr/bin/env python3
"""Reuse the last published datasets only when the live MIMIT refresh is unavailable.

The release validator still checks the original per-price timestamps and snapshot;
this script never changes either timestamp.
"""
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
BASE = "https://avvmatteosenesi-afk.github.io/Carburanti/data/"
FILES = ("stations.json", "stations-it.json")

def fetch_dataset(name):
    request = urllib.request.Request(
        BASE + name,
        headers={"User-Agent": "Carburanti verified dataset fallback", "Cache-Control": "no-cache"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        if response.status != 200:
            raise RuntimeError(f"{name}: HTTP {response.status}")
        raw = response.read()
    if len(raw) < 1000:
        raise RuntimeError(f"{name}: risposta live troppo piccola")
    payload = json.loads(raw.decode("utf-8"))
    if not isinstance(payload.get("stations"), list) or not payload["stations"]:
        raise RuntimeError(f"{name}: dataset live non valido")
    return raw, payload

def main():
    # Fetch and parse both files before replacing either local dataset.
    fetched = {name: fetch_dataset(name) for name in FILES}
    for name, (raw, _) in fetched.items():
        (DATA / name).write_bytes(raw)
    metadata = fetched["stations.json"][1].get("metadata", {})
    print(
        "Riutilizzati i dataset già pubblicati; "
        f"snapshot conservato: {metadata.get('source_snapshot_date')}; "
        "la validazione release verificherà la data di ogni prezzo."
    )

if __name__ == "__main__":
    main()
