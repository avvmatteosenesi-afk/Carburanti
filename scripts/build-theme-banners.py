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
 # The entire image is visible in a protected illustration window.
 # Remaining space is filled by theme-specific comic-book decoration.
 base=Image.new("RGB",(w,h))
 pixels=base.load()
 ca,cb=rgb(a),rgb(b)
 for y in range(h):
  for x in range(w):
   t=min(1,max(0,x/w*.86+y/h*.14))
   pixels[x,y]=blend(ca,cb,t)
 draw=ImageDraw.Draw(base,"RGBA")
 cx,cy=700,132
 for n in range(24):
  theta=2*math.pi*n/24
  theta2=theta+2*math.pi/48
  draw.polygon([(cx,cy),(cx+1100*math.cos(theta),cy+1100*math.sin(theta)),(cx+1100*math.cos(theta2),cy+1100*math.sin(theta2))],fill=(255,255,255,16))
 for x,y,r in [(1030,48,65),(840,210,44),(1140,230,95)]:
  draw.ellipse((x-r,y-r,x+r,y+r),outline=(255,255,255,62),width=5)
 # Keep the complete source image; never use a cover crop or aspect-ratio distortion.
 panel=(28,12,730,248)
 inner=(panel[2]-panel[0],panel[3]-panel[1])
 thumb=ImageOps.contain(original,inner,Image.Resampling.LANCZOS)
 px=panel[0]+(inner[0]-thumb.width)//2
 py=panel[1]+(inner[1]-thumb.height)//2
 # Soft ambient shadow around the source artwork.
 shadow=Image.new("RGBA",(w,h))
 sd=ImageDraw.Draw(shadow)
 sd.rounded_rectangle((px-6,py-6,px+thumb.width+6,py+thumb.height+6),radius=15,fill=(0,0,0,80))
 shadow=shadow.filter(ImageFilter.GaussianBlur(11))
 base=Image.alpha_composite(base.convert("RGBA"),shadow)
 base.alpha_composite(thumb.convert("RGBA"),(px,py))
 # Subtle dark lower band supports legible live status and action controls.
 veil=Image.new("RGBA",(w,h),(0,0,0,0))
 vd=ImageDraw.Draw(veil)
 for y in range(195,260):
  vd.line((0,y,w,y),fill=(0,0,0,round(92*(y-195)/65)))
 base=Image.alpha_composite(base,veil).convert("RGB")
 base.save(path,"WEBP",quality=88,method=6)
 print(name,original.size,"=>",base.size)
for name,(a,b) in THEMES.items():make(name,a,b)
