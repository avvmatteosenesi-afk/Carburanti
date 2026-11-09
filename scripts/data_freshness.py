"""Separate acquisition freshness from the date a station communicated its price.

MIMIT instructions: unchanged prices must be communicated within the eighth day.
https://carburanti.mise.gov.it/documenti/Istruzioni%20gestori_ottobre_2023.pdf
Never replace a price's original timestamp with the acquisition time.
"""
from datetime import datetime, timedelta, timezone

MAX_PRICE_AGE = timedelta(days=8)
MAX_DATASET_AGE = timedelta(hours=48)
MAX_FUTURE_SKEW = timedelta(hours=24)


def parse_timestamp(value):
    if not value:
        return None
    raw = str(value).strip()
    try:
        parsed = datetime.fromisoformat(raw.replace('Z', '+00:00'))
    except ValueError:
        parsed = None
        for fmt in ('%d/%m/%Y %H:%M:%S', '%d/%m/%Y %H:%M', '%d/%m/%Y',
                    '%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M'):
            try:
                parsed = datetime.strptime(raw, fmt)
                break
            except ValueError:
                continue
    if parsed is None:
        return None
    return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed.astimezone(timezone.utc)


def price_is_current(updated, now, max_age=MAX_PRICE_AGE):
    return updated is not None and -MAX_FUTURE_SKEW <= now - updated <= max_age
