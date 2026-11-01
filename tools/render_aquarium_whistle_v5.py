# Author: GPT / Codex. Original plugin (C) 2026 Carinoasd.
# Original soft whistle glides. No random noise, airflow hiss, impact or click layer.
from pathlib import Path
import numpy as np,json,hashlib,wave,subprocess
ROOT=Path(__file__).resolve().parents[1];SR=44100
DOC=ROOT/'docs/aquarium/feeding-whistle-v5';RUN=ROOT/'source/plugin/gamecenter/games/aquarium/assets/feeding/whistle-v5'
(DOC/'masters').mkdir(parents=True,exist_ok=True);RUN.mkdir(parents=True,exist_ok=True)
SPECS=[dict(id='whistle_01',name='柔和下滑',ms=110,start_hz=1700,end_hz=620,curve=1.35,harmonic=.025),dict(id='whistle_02',name='清亮快滑',ms=95,start_hz=2400,end_hz=850,curve=1.7,harmonic=.015),dict(id='whistle_03',name='轻轻上扬',ms=115,start_hz=680,end_hz=1750,curve=.8,harmonic=.02),dict(id='whistle_04',name='圆润低滑',ms=105,start_hz=1280,end_hz=440,curve=1.1,harmonic=.045)]
items=[];takes=[]
for spec in SPECS:
 n=round(SR*spec['ms']/1000);t=np.arange(n)/SR;u=np.linspace(0,1,n)
 f=spec['end_hz']+(spec['start_hz']-spec['end_hz'])*(1-u)**spec['curve']
 phase=2*np.pi*np.cumsum(f)/SR
 # A coherent voiced glide, weak harmonic only for a rounded flute-like timbre.
 x=np.sin(phase)+spec['harmonic']*np.sin(2*phase+.15)
 env=np.sin(np.pi*u)**1.15;env*=np.sin(np.minimum(t/.009,1)*np.pi/2)**2;env*=np.sin(np.minimum((t[-1]-t)/.022,1)*np.pi/2)**2
 x*=env;x*=10**(-12/20)/np.max(np.abs(x));pcm=np.round(x*32767).astype('<i2')
 master=DOC/'masters'/(spec['id']+'.wav')
 with wave.open(str(master),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes(pcm.tobytes())
 assert pcm[0]==pcm[-1]==0
 files=[]
 for ext,args in [('mp3',['-c:a','libmp3lame','-b:a','128k']),('ogg',['-c:a','libvorbis','-q:a','5'])]:
  p=RUN/(spec['id']+'.'+ext);subprocess.run(['ffmpeg','-v','error','-y','-i',str(master),'-map_metadata','-1',*args,str(p)],check=True)
  decoded=subprocess.run(['ffmpeg','-v','error','-i',str(p),'-f','f32le','-acodec','pcm_f32le','-'],capture_output=True,check=True).stdout;dx=np.frombuffer(decoded,dtype='<f4');assert np.isfinite(dx).all() and max(abs(dx))<1
  b=p.read_bytes();files.append(dict(file=p.name,bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),decoded_ms=round(len(dx)/SR*1000,2),decoded_peak_dbfs=round(float(20*np.log10(max(abs(dx)))),2),clipped_samples=0))
 items.append(dict(**spec,sample_rate=SR,channels=1,master_peak_dbfs=-12,master_rms_dbfs=round(float(20*np.log10(np.sqrt(np.mean(x*x)))),2),first_sample=0,last_sample=0,files=files));takes.append(x)
meta=dict(schema='aquarium-feeding-whistle-v5',author='GPT / Codex; original plugin (C) 2026 Carinoasd',status='audition-only-not-selected',supersedes='whoosh-v4: user heard rubbing/scraping rather than 咻; not accepted',method='deterministic coherent sine whistle glide + 1.5-4.5 percent weak second harmonic; zero random noise; smooth attack and release',items=items)
for p in [RUN/'manifest.json',DOC/'QA.json']:p.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
parts=[];starts=[];elapsed=0.
for i,x in enumerate(takes):
 starts.append(round(elapsed,3))
 for _ in range(3):
  silence=np.zeros(round(SR*.45));parts.extend([x,silence]);elapsed+=(len(x)+len(silence))/SR
 parts.append(np.zeros(round(SR*.6)));elapsed+=.6
mix=np.concatenate(parts);wpath=DOC/'preview-master.wav'
with wave.open(str(wpath),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes(np.round(mix*32767).astype('<i2').tobytes())
subprocess.run(['ffmpeg','-y','-v','error','-i',str(wpath),'-map_metadata','-1','-c:a','libmp3lame','-b:a','128k',str(DOC/'set-preview.mp3')],check=True);wpath.unlink()
print(json.dumps(dict(variants=[dict(id=s['id'],ms=s['ms'],hz=[s['start_hz'],s['end_hz']]) for s in SPECS],starts=starts,seconds=elapsed,all_decodes_unclipped=True),ensure_ascii=False,indent=2))
