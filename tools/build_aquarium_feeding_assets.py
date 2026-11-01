#!/usr/bin/env python3
"""Author: GPT / Codex; original plugin (C) 2026 Carinoasd.
Offline export only. Runtime uses images/audio with no Python dependencies.
"""
from pathlib import Path
import hashlib,json,math,subprocess
import numpy as np
from PIL import Image,ImageDraw,ImageFont
from scipy.signal import butter,sosfilt
from scipy.io import wavfile

ROOT=Path(__file__).resolve().parents[1]
DOC=ROOT/'docs/aquarium/feeding-assets-v1'
OUT=ROOT/'source/plugin/gamecenter/games/aquarium/assets/feeding/v1'
OUT.mkdir(parents=True,exist_ok=True)
SRC=DOC/'pellets-source.png'
im=Image.open(SRC).convert('RGBA')
# Measured crop rectangles from the generated source; no recoloring or repainting.
rects=[(39,473,371,790),(438,499,817,785),(880,462,1231,786)]
visuals=[]
for idx,box in enumerate(rects,1):
    crop=im.crop(box)
    for edge,suffix in [(256,'master'),(32,'runtime')]:
        tile=Image.new('RGBA',(edge,edge))
        mini=crop.copy();mini.thumbnail((round(edge*.90),round(edge*.90)),Image.Resampling.LANCZOS)
        tile.alpha_composite(mini,((edge-mini.width)//2,(edge-mini.height)//2))
        if suffix=='master':
            tile.save(DOC/f'pellet_{idx:02d}_master.png')
        else:
            tile.save(OUT/f'pellet_{idx:02d}.webp',lossless=True,method=6)
            visuals.append(tile)
atlas=Image.new('RGBA',(96,32))
for i,tile in enumerate(visuals):atlas.alpha_composite(tile,(32*i,0))
atlas.save(OUT/'pellets_atlas.png',optimize=True)

# Original, deterministically synthesized soft wet bites, not external samples.
SR=44100
metrics=[]
for idx,(dur,pitch,seed) in enumerate([(0.17,1.0,5301),(0.185,0.94,5302),(0.16,1.065,5303)],1):
    t=np.arange(round(SR*dur))/SR
    rng=np.random.default_rng(seed)
    env=(1-np.exp(-t/0.0018))*np.exp(-t/0.027)
    freq=pitch*(300+580*np.exp(-t/0.014))
    phase=2*np.pi*np.cumsum(freq)/SR
    body=np.sin(phase)*env
    # Two damped soft resonances make a small watery mouth/pop, not a coin ding.
    resonance=0.22*np.sin(phase*1.53+0.4)*(1-np.exp(-t/0.004))*np.exp(-t/0.019)
    noise=sosfilt(butter(2,[900,4100],fs=SR,btype='bandpass',output='sos'),rng.normal(size=len(t)))
    texture=0.115*noise*(1-np.exp(-t/0.0008))*np.exp(-t/0.009)
    y=body+resonance+texture
    y=sosfilt(butter(2,[110,4700],fs=SR,btype='bandpass',output='sos'),y)
    # Fixed 4ms lead, short smooth endpoints, and conservative -12 dBFS peak.
    y=np.concatenate([np.zeros(round(.004*SR)),y])
    y-=np.mean(y)
    n=round(.003*SR);y[:n]*=np.linspace(0,1,n);y[-n:]*=np.linspace(1,0,n)
    y=y/max(abs(y))*(10**(-12/20))
    y[0]=y[-1]=0
    wav=DOC/f'eat_{idx:02d}_master.wav'
    wavfile.write(wav,SR,np.round(y*32767).astype(np.int16))
    for ext,codec_args in [('ogg',['-c:a','libvorbis','-q:a','3']),('mp3',['-c:a','libmp3lame','-b:a','96k'])]:
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-ac','1','-ar',str(SR),*codec_args,str(OUT/f'eat_{idx:02d}.{ext}')],check=True)
    metrics.append({'id':f'eat_{idx:02d}','master_duration_s':round(len(y)/SR,4),'peak_dbfs':round(20*np.log10(max(abs(y))),2),'rms_dbfs':round(20*np.log10(np.sqrt(np.mean(y*y))),2),'sample_rate':SR,'channels':1,'seed':seed})

fontpath='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
font=ImageFont.truetype(fontpath,19);small=ImageFont.truetype(fontpath,15)
preview=Image.new('RGB',(960,430),'#f6f3ec');d=ImageDraw.Draw(preview)
d.text((28,18),'AQUARIUM / FEEDING ASSETS v1',font=font,fill='#25475a')
for row,(bg,fg) in enumerate([('#cbeaf2','#24495b'),('#132b4c','#d7e7f3')]):
    y0=60+row*175;d.rounded_rectangle((20,y0,940,y0+160),radius=14,fill=bg)
    d.text((38,y0+12),'DAY' if row==0 else 'MOON',font=small,fill=fg)
    for i in range(3):
        master=Image.open(DOC/f'pellet_{i+1:02d}_master.png')
        icon=master.resize((88,88),Image.Resampling.LANCZOS)
        preview.paste(icon,(126+i*275,y0+32),icon)
        for j,size in enumerate([5,7,9,12]):
            tiny=master.resize((size,size),Image.Resampling.LANCZOS)
            preview.paste(tiny,(235+i*275,y0+45+j*23),tiny)
            d.text((254+i*275,y0+38+j*23),f'{size}px',font=small,fill=fg)
preview.save(DOC/'preview.png',optimize=True)

files=[]
for p in sorted(OUT.iterdir()):
    if p.is_file() and p.name!='manifest.json':files.append({'file':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
manifest={'schema':'aquarium-feeding-assets-v1','author':'GPT / Codex; original plugin (C) 2026 Carinoasd','pellets':[{'id':f'pellet_{i:02d}','file':f'pellet_{i:02d}.webp','size':[32,32],'atlas_rect':[(i-1)*32,0,32,32]} for i in range(1,4)],'atlas':{'file':'pellets_atlas.png','size':[96,32]},'sounds':[dict(x,ogg=x['id']+'.ogg',mp3=x['id']+'.mp3') for x in metrics],'playback':{'suggested_volume':0.45,'global_cooldown_ms':140,'max_simultaneous_voices':2,'trigger':'pellet consumption confirmed locally; never on drop, arrival alone or server rewards'},'provenance':{'art':'built-in imagegen; prompt in docs','sound':'original procedural DSP; no third-party recordings'},'files':files}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
(DOC/'audio-metrics.json').write_text(json.dumps(metrics,indent=2)+'\n')
print(json.dumps({'runtime_bytes':sum(x['bytes'] for x in files),'files':len(files),'sounds':metrics},ensure_ascii=False))
