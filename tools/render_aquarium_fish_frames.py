#!/usr/bin/env python3
"""Author: GPT / Codex, 2026-10-30. Original plugin (C) 2026 Carinoasd.
Offline code-native animation export: original PNG -> single-texture inverse warp.
Needs Pillow and Node, no npm/build/CDN/runtime dependency.
Usage: python3 tools/render_aquarium_fish_frames.py --masters DIR [--output DIR]
Masters are matched by existing art manifest source_sha256, not filenames.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math
import subprocess
import tempfile
from PIL import Image,ImageDraw

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'source/plugin/gamecenter/games/aquarium/assets'
PARAMS={
 'pond_blue':(.36,.70,.040,.006,720),
 'pond_orange_tail':(.49,.76,.045,.005,760),
 'pond_leaf':(.34,.74,.035,.004,580),
 'pond_peach':(.49,.76,.042,.005,820),
 'pond_glass_moon':(.43,.71,.030,.007,920),
 'pond_feather':(.66,.80,.040,.006,1000),
 'bay_silver':(.33,.75,.032,.004,540),
 'bay_coral':(.35,.73,.030,.007,800),
 'bay_lantern':(.31,.70,.035,.006,840),
 'bay_ribbon':(.78,.86,.050,.004,1100),
 'bay_star_ray':(.67,.74,.024,.009,1200),
 'bay_aurora':(.46,.73,.030,.008,1000),
}

def file_info(p):
 d=p.read_bytes()
 return {'file':p.name,'bytes':len(d),'sha256':hashlib.sha256(d).hexdigest(),
         'git_blob_sha':hashlib.sha1(b'blob '+str(len(d)).encode()+b'\0'+d).hexdigest()}

def main():
 p=argparse.ArgumentParser();p.add_argument('--masters',required=True);p.add_argument('--output');a=p.parse_args()
 out=Path(a.output) if a.output else ASSETS/'fish-motion/v1';out.mkdir(parents=True,exist_ok=True)
 manifest=json.loads((ASSETS/'manifest.json').read_text())
 source_files={hashlib.sha256(f.read_bytes()).hexdigest():f for f in Path(a.masters).rglob('*.png')}
 fishes=[x for x in manifest['items'] if x['kind']=='fish']
 assert len(fishes)==12
 entries=[];size=256;frames=12;cols=4;rows=3
 with tempfile.TemporaryDirectory(prefix='aq-fish-motion-') as temporary:
  temp=Path(temporary);jobs=[]
  for entry in fishes:
   source=source_files.get(entry['source_sha256'])
   if source is None:raise ValueError('Missing original PNG: '+entry['id'])
   box=entry['source_visible_bbox'];bounds=entry['exported_content_bounds']
   with Image.open(source) as original:
    original=original.convert('RGBA').crop(box)
    w,h=bounds[2]-bounds[0],bounds[3]-bounds[1]
    normalized=Image.new('RGBA',(512,512));normalized.paste(original.resize((w,h),Image.Resampling.LANCZOS),(bounds[0],bounds[1]))
    normalized=normalized.resize((size,size),Image.Resampling.LANCZOS)
   raw=temp/(entry['id']+'.rgba');raw.write_bytes(normalized.tobytes())
   hinge,head,amp,fin,cycle=PARAMS[entry['id']]
   options={'hinge':hinge,'headLock':head,'amplitude':amp,'finAmplitude':fin,'finStart':.26,'pivotY':.50}
   jobs.append({'id':entry['id'],'name':entry['name'],'raw':str(raw),'warp':options,
                'source_sha256':entry['source_sha256'],'cycle_ms':cycle})
  job={'size':size,'frames':frames,'output':str(temp),'items':jobs}
  job_path=temp/'job.json';job_path.write_text(json.dumps(job))
  subprocess.run(['node',str(ROOT/'tools/render_aquarium_fish_frames.mjs'),str(job_path)],check=True)
  for item in jobs:
   sheet=Image.new('RGBA',(cols*size,rows*size))
   for i in range(frames):
    image=Image.frombytes('RGBA',(size,size),(temp/(item['id']+'-'+str(i).zfill(2)+'.rgba')).read_bytes())
    # No mask argument: copy the exact RGBA including transparency once.
    sheet.paste(image,(i%cols*size,i//cols*size))
   dest=out/(item['id']+'.webp');sheet.save(dest,'WEBP',lossless=True,method=6,exact=True)
   entries.append({'id':item['id'],'name':item['name'],'source_sha256':item['source_sha256'],
      'source_facing':'right','frame_size':[size,size],'grid':[cols,rows],'frame_count':frames,
      'cycle_ms':item['cycle_ms'],'anchor':[.5,.5],'neutral_frame':0,'warp':item['warp'],**file_info(dest)})
  # A six-fish fixed-scale animation for quick user inspection, no tail overlay.
  preview=[]
  for i in range(frames):
   board=Image.new('RGB',(768,512),'#eef7fa')
   for j,item in enumerate(jobs[:6]):
    image=Image.frombytes('RGBA',(size,size),(temp/(item['id']+'-'+str(i).zfill(2)+'.rgba')).read_bytes())
    board.paste(image,(j%3*size,j//3*size),image)
   preview.append(board)
  palette=preview[0].quantize(colors=256)
  preview=[board.quantize(palette=palette,dither=Image.Dither.NONE) for board in preview]
  preview_dir=ROOT/'docs/aquarium/fish-motion-v1'
  preview_dir.mkdir(parents=True,exist_ok=True)
  preview[0].save(preview_dir/'pond-preview.gif',save_all=True,append_images=preview[1:],loop=0,duration=70,disposal=2)
 data={'schema':'aquarium-fish-motion-v1','author':'GPT / Codex; original plugin (C) 2026 Carinoasd',
       'status':'candidate-awaiting-live-integration','method':'single-texture continuous inverse deformation; not hand-drawn frames',
       'source_manifest':'assets/manifest.json','source_facing':'right','items':entries,
       'decoded_rgba_bytes_per_sheet':cols*rows*size*size*4,
       'all_sheets_decoded_rgba_bytes':len(entries)*cols*rows*size*size*4}
 (out/'manifest.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'fish':len(entries),'frames':len(entries)*frames,'runtime_bytes':sum(x['bytes'] for x in entries)},ensure_ascii=False))

if __name__=='__main__':main()
