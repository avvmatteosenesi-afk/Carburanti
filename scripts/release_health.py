"""Publish a small provenance record for the exact, validated Pages datasets."""
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def main():
    datasets = {}
    for name in ('stations.json', 'stations-it.json'):
        raw = (ROOT / 'data' / name).read_bytes()
        payload = json.loads(raw)
        datasets[name] = {'sha256': hashlib.sha256(raw).hexdigest(), 'metadata': payload['metadata'],
                          'prices': sum(len(s.get('prices') or {}) for s in payload['stations'])}
    report = {'build_sha': os.environ.get('GITHUB_SHA', ''), 'validated_at': datetime.now(timezone.utc).isoformat(),
              'datasets': datasets}
    (ROOT / 'data/release-health.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print('Provenienza dei dataset validati registrata in data/release-health.json')

if __name__ == '__main__':
    main()
