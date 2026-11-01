# Author: GPT / Codex. Original plugin (C) 2026 Carinoasd.
# Packs generated distinct poses only; no generated anatomical deformation here.
from PIL import Image,ImageDraw
from scipy.ndimage import label,binary_dilation
import numpy as np,json,hashlib
from pathlib import Path
DOC=Path(__file__).resolve().parent
OUT=DOC.parents[2];RUNTIME=OUT/'source/plugin/gamecenter/games/aquarium/assets/fish-motion/v1'
RUNTIME.mkdir(parents=True,exist_ok=True);DOC.mkdir(parents=True,exist_ok=True)
SPECS={
'pond_curl_seahorse':dict(name='卷尾海马',n=4,cycle=1000,scale=.375,anchors=[(397,140),(1025,140),(397,767),(1026,767)],target=(148,64),action='dorsal fin ripple'),
'pond_bell_jelly':dict(name='铃伞水母',n=4,cycle=1400,scale=.345,anchors=[(333,300),(970,302),(337,910),(957,910)],target=(128,109),action='bell contraction with trailing tentacles'),
'bay_gummy_octopus':dict(name='软糖章鱼',n=4,cycle=1100,scale=.355,anchors=[(310,255),(937,255),(335,850),(936,842)],target=(124,83),action='alternating arm curls'),
'bay_moon_mermaid':dict(name='月汐人鱼',n=8,cycle=1200,scale=.55,anchors=[(320,217),(704,218),(1088,218),(1468,218),(320,655),(704,648),(1088,647),(1468,651)],target=(184,83),action='tail and fan-fin undulation')}
entries=[];checks={};previews=[]
contact=Image.new('RGB',(8*256,4*290),'#12394d');draw=ImageDraw.Draw(contact)
for row,(id,s) in enumerate(SPECS.items()):
 im=Image.open(DOC/f'{id}-poses.webp').convert('RGBA');arr=np.array(im);lab,n=label(arr[:,:,3]>32);cnt=np.bincount(lab.ravel());ids=np.argsort(cnt[1:])[-s['n']:]+1
 components=[]
 for k in ids:
  y,x=np.where(lab==k);components.append((int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1),int(k)))
 components.sort(key=lambda b:(b[1]//(im.height//2),b[0]))
 frames=[];records=[]
 for i,b in enumerate(components):
  x0,y0,x1,y1,k=b;pad=3;x0=max(0,x0-pad);y0=max(0,y0-pad);x1=min(im.width,x1+pad);y1=min(im.height,y1+pad)
  crop=arr[y0:y1,x0:x1].copy();mask=binary_dilation(lab[y0:y1,x0:x1]==k,iterations=3);crop[:,:,3]*=mask
  pic=Image.fromarray(crop).resize((round((x1-x0)*s['scale']),round((y1-y0)*s['scale'])),Image.Resampling.LANCZOS)
  ax,ay=s['anchors'][i];tx,ty=s['target'];pos=(round(tx-(ax-x0)*s['scale']),round(ty-(ay-y0)*s['scale']))
  assert pos[0]>=0 and pos[1]>=0 and pos[0]+pic.width<=256 and pos[1]+pic.height<=256,(id,i,pos,pic.size)
  f=Image.new('RGBA',(256,256));f.alpha_composite(pic,pos);frames.append(f);records.append({'source_bbox':[x0,y0,x1,y1],'source_anchor':[ax,ay],'target_anchor':[tx,ty],'packed_bbox':list(f.getbbox())})
 sheet=Image.new('RGBA',(256*s['n'],256))
 for i,f in enumerate(frames):sheet.alpha_composite(f,(256*i,0));contact.paste(f,(256*i,row*290+30),f)
 path=RUNTIME/f'{id}.webp';sheet.save(path,'WEBP',lossless=True,method=6,exact=True)
 raw=path.read_bytes();src=(DOC/f'{id}-poses.webp').read_bytes()
 entry=dict(id=id,name=s['name'],source_sha256=hashlib.sha256(src).hexdigest(),source_facing='right',frame_size=[256,256],grid=[s['n'],1],frame_count=s['n'],cycle_ms=s['cycle'],anchor=[.5,.5],neutral_frame=0,method='imagegen distinct pose frames; uniform rescale and anchor packing; no inverse warp',action=s['action'],file=path.name,bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest(),git_blob_sha=hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest(),decoded_rgba_bytes=sheet.width*sheet.height*4)
 entries.append(entry)
 # Source pose master is immutable; exporting never redraws it.
 gifframes=[]
 for f in frames:
  bg=Image.new('RGBA',(256,256),'#12394d');bg.alpha_composite(f);gifframes.append(bg.convert('RGB'))
 gifframes[0].save(DOC/f'{id}-loop.gif',save_all=True,append_images=gifframes[1:],duration=round(s['cycle']/s['n']/10)*10,loop=0)
 draw.text((8,row*290+6),f'{id} | {s["n"]} poses | {s["cycle"]}ms',fill='white')
 a=np.array(sheet)[:,:,3];framehashes=[hashlib.sha256(f.tobytes()).hexdigest() for f in frames]
 checks[id]={'sheet_size':list(sheet.size),'bytes':len(raw),'transparent_fraction':float((a==0).mean()),'unique_frames':len(set(framehashes)),'frame_count':s['n'],'frame_records':records,'all_alpha_edges_clear':all(np.array(f)[:,:,3][[0,-1],:].max()==0 and np.array(f)[:,:,3][:,[0,-1]].max()==0 for f in frames)}
 assert checks[id]['all_alpha_edges_clear'];assert len(set(framehashes))==s['n']
manifest=json.loads((DOC/'base-manifest.json').read_text());old=list(manifest['items']);manifest['items']+=entries
assert manifest['items'][:12]==old and len(manifest['items'])==16
manifest['method']='mixed: unchanged legacy inverse-deformation sheets + four imagegen distinct-pose animation sheets'
manifest.pop('decoded_rgba_bytes_per_sheet',None)
manifest['legacy_decoded_rgba_bytes_per_sheet']=3145728
manifest['all_sheets_decoded_rgba_bytes']=37748736+sum(e['decoded_rgba_bytes'] for e in entries)
manifest['status']='candidate-awaiting-live-integration'
(RUNTIME/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
(DOC/'new-entries.json').write_text(json.dumps(entries,ensure_ascii=False,indent=2)+'\n')
(DOC/'packing.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2)+'\n')
contact.save(DOC/'contact-sheet.jpg',quality=92)
print(json.dumps({'entries':[{k:e[k] for k in ['id','frame_count','cycle_ms','bytes','decoded_rgba_bytes']} for e in entries],'total_runtime_bytes':sum(e['bytes'] for e in entries),'extra_decoded_bytes':sum(e['decoded_rgba_bytes'] for e in entries),'old12_unchanged':True},ensure_ascii=False,indent=2))
