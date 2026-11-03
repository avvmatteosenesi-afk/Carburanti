#!/usr/bin/env python3
"""Build self-contained illustrated banner assets from the theme source artwork."""
import io
import pathlib
import re
import urllib.request
from PIL import Image, ImageOps
CSS=pathlib.Path("layout-themes.css").read_text()
OUT=pathlib.Path("theme-banners")
OUT.mkdir(exist_ok=True)
themes=re.findall(r'body\[data-layout="([^"]+)"\]\{([^\n]+)\}',CSS)
failed=[]
for theme, rule in themes:
    match=re.search(r'--theme-art:url\("([^"]+)"\)',rule)
    if not match: continue
    url=match.group(1)
    try:
        req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (compatible; CarburantiBannerBuild/1.0)"})
        with urllib.request.urlopen(req,timeout=25) as resp: raw=resp.read(12_000_001)
        if len(raw)>12_000_000: raise ValueError("Image too large")
        im=Image.open(io.BytesIO(raw)).convert("RGB")
        # Cover the full header without ever stretching character proportions.
        banner=ImageOps.fit(im,(1200,260),method=Image.Resampling.LANCZOS,centering=(0.38,0.5))
        banner.save(OUT/(theme+".webp"),"WEBP",quality=85,method=6)
        print("OK",theme)
    except Exception as exc:
        failed.append((theme,str(exc)))
        print("FAILED",theme,str(exc))
if failed: raise SystemExit(f"Failed themes: {failed}")
