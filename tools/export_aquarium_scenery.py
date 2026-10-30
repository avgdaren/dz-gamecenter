#!/usr/bin/env python3
"""Author GPT / Codex; original plugin (C) 2026 Carinoasd.
Deterministic crop/size/format export only; source PNG art generated with imagegen.
"""
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'docs/aquarium/expansion-v1/masters'
OUT=ROOT/'source/plugin/gamecenter/games/aquarium/assets/background/expansion-v1'

def main():
 OUT.mkdir(parents=True,exist_ok=True)
 for path in sorted(SOURCE.glob('tank_*.png')):
  im=Image.open(path).convert('RGB');w,h=im.size
  if w/h>1.6:
   tw=round(h*1.6);box=((w-tw)//2,0,(w+tw)//2,h)
  else:
   th=round(w/1.6);box=(0,(h-th)//2,w,(h+th)//2)
  im=im.crop(box)
  for suffix,size,q in [('',(1536,960),88),('_mobile',(768,480),85),('_thumb',(320,200),85)]:
   im.resize(size,Image.Resampling.LANCZOS).save(OUT/(path.stem+suffix+'.webp'),'WEBP',quality=q,method=6)

if __name__=='__main__':main()
