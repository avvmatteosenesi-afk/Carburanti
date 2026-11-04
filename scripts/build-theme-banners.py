#!/usr/bin/env python3
"""Recompose existing theme art as self-contained panoramic headers without stretching."""
import math
import pathlib
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageOps

ROOT=pathlib.Path("theme-banners")
THEMES={
 "dragon":("#0c4db6","#80d9ff"),"arale":("#f455b1","#9eefff"),
 "daitarn":("#092c75","#f9c636"),"jeeg":("#075c3e","#cbe65d"),
 "harlock":("#06132e","#9c344b"),"mazinga":("#172636","#ee5141"),
 "goldrake":("#102d78","#4fc1f3"),"lamu":("#ff65b7","#ffe477"),
 "kenshiro":("#1b2334","#b83d35"),"candy":("#f6a5c5","#fff0c5"),
 "yattaman":("#1078b9","#ffdd58"),"lupin":("#891e27","#e6bc3e"),
 "oscar":("#99712b","#f9e1a4")
}
def rgb(v):return tuple(bytes.fromhex(v.lstrip("#")))
def blend(a,b,t):return tuple(round(a[i]*(1-t)+b[i]*t) for i in range(3))
def make(name,a,b):
 path=ROOT/(name+".webp")
 if not path.exists():raise FileNotFoundError(path)
 original=Image.open(path).convert("RGB")
 w,h=1200,260
 # Fill every pixel with artwork, never stretch or crop the foreground characters.
 background=ImageOps.fit(original,(w,h),Image.Resampling.LANCZOS,centering=(.36,.5))
 background=background.filter(ImageFilter.GaussianBlur(24))
 background=ImageEnhance.Color(background).enhance(1.18)
 # Hero art: keep its aspect ratio and place its subject on the left.
 foreground=ImageOps.contain(original,(820,260),Image.Resampling.LANCZOS)
 canvas=background.convert("RGBA")
 fg=foreground.convert("RGBA")
 px=0
 py=(h-foreground.height)//2
 # Softly blend the right edge into the full-bleed artwork behind it.
 alpha=Image.new("L",fg.size,255)
 ap=alpha.load()
 fade=min(110,fg.width//4)
 for x in range(fg.width-fade,fg.width):
  opacity=round(255*(fg.width-x-1)/max(1,fade))
  for y in range(fg.height):ap[x,y]=opacity
 fg.putalpha(alpha)
 canvas.alpha_composite(fg,(px,py))
 veil=Image.new("RGBA",(w,h),(0,0,0,0))
 vd=ImageDraw.Draw(veil)
 for y in range(195,260):
  vd.line((0,y,w,y),fill=(0,0,0,round(80*(y-195)/65)))
 canvas=Image.alpha_composite(canvas,veil).convert("RGB")
 canvas.save(path,"WEBP",quality=88,method=6)
 print(name,original.size,"=>",canvas.size)
for name,(a,b) in THEMES.items():make(name,a,b)
