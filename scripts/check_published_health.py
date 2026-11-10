"""Independent, read-only check of both published datasets and their provenance."""
import hashlib
import json
import os
import tempfile
import time
import urllib.request
from pathlib import Path
import validate_release

BASE = 'https://avvmatteosenesi-afk.github.io/Carburanti/'

def fetch(path):
    req = urllib.request.Request(BASE+path+f'?health={time.time_ns()}', headers={'Cache-Control':'no-cache','User-Agent':'Carburanti published health check'})
    with urllib.request.urlopen(req, timeout=30) as response:
        return response.read()

def check():
    if b'Carburanti' not in fetch('index.html'):
        raise RuntimeError('Pagina pubblicata non riconoscibile')
    report = json.loads(fetch('data/release-health.json'))
    original_root = validate_release.ROOT
    try:
        with tempfile.TemporaryDirectory() as folder:
            validate_release.ROOT = Path(folder)
            for name,minimum,prices in [('stations.json',900,1500),('stations-it.json',15000,25000)]:
                raw=fetch('data/'+name)
                if hashlib.sha256(raw).hexdigest()!=report['datasets'][name]['sha256']:
                    raise RuntimeError(f'{name}: dataset e provenienza non corrispondono (possibile propagazione CDN)')
                # Preserve production filename: the Tuscany coverage/geography guards also run.
                path=Path(folder)/'data'/name;path.parent.mkdir(exist_ok=True);path.write_bytes(raw)
                validate_release.validate_dataset('data/'+name,minimum,prices)
    finally:
        validate_release.ROOT=original_root
    return report

def main():
    for attempt in range(3):
        try:
            report=check();break
        except Exception:
            if attempt==2:raise
            time.sleep(10)
    text=f"## Controllo indipendente del sito pubblicato\n\nHTTP, hash, freschezza, copertura e coordinate: OK.\n\nBuild: `{report['build_sha']}`\n"
    print(text)
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'],'a') as stream:stream.write(text)

if __name__=='__main__':main()
