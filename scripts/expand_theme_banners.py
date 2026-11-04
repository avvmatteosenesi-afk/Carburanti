"""Expand the actual cartoon artwork rather than its surrounding decorative frame.

Original 1200x260 theme banners have a 480x105 artwork inset at (20,78).
Crop that inset and scale it to the full banner canvas. Run only on a
clean checkout: the source WebPs remain unchanged in the repository.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "theme-banners"
THEMES = ("dragon", "arale", "daitarn", "jeeg", "harlock", "mazinga",
          "goldrake", "lamu", "kenshiro", "candy", "yattaman", "lupin", "oscar")
for theme in THEMES:
    path = ROOT / f"{theme}.webp"
    with Image.open(path) as source:
        image = source.convert("RGB")
        if image.size != (1200, 260):
            raise ValueError(f"{path}: unexpected source size {image.size}")
        art = image.crop((20, 78, 500, 183))
        full = art.resize((1200, 260), Image.Resampling.LANCZOS)
        full.save(path, "WEBP", quality=91, method=6)
    print(f"Expanded full-width cartoon artwork: {path.name}", flush=True)
