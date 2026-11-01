# Author: GPT / Codex. Original plugin (C) 2026 Carinoasd.
# Original procedural sound design: smooth swept airflow; no impact/click layer.
from pathlib import Path
import numpy as np,json,hashlib,subprocess,wave
from scipy.signal import butter,sosfilt
SR=44100
ROOT=Path(__file__).resolve().parents[1]
RUN=ROOT/'source/plugin/gamecenter/games/aquarium/assets/feeding/whoosh-v4'
DOC=ROOT/'docs/aquarium/feeding-whoosh-v4'
RUN.mkdir(parents=True,exist_ok=True);(DOC/'masters').mkdir(parents=True,exist_ok=True)
SPECS=[
 dict(id='whoosh_01',label='轻气流',ms=92,start=2400,end=1050,q=.65,tone=.06,seed=831),
 dict(id='whoosh_02',label='柔滑音',ms=108,start=1700,end=700,q=.95,tone=.14,seed=832),
 dict(id='whoosh_03',label='轻上扬',ms=82,start=1050,end=2550,q=.7,tone=.08,seed=833),
 dict(id='whoosh_04',label='圆润下滑',ms=118,start=1350,end=540,q=1.2,tone=.20,seed=834)]
def swept_air(x,centers,q):
 y=np.zeros_like(x);x1=x2=y1=y2=0.
 for i,(sample,f) in enumerate(zip(x,centers)):
  w=2*np.pi*f/SR;a=np.sin(w)/(2*q);c=np.cos(w);a0=1+a
  b0=a/a0;b2=-b0;a1=-2*c/a0;a2=(1-a)/a0
  out=b0*sample+b2*x2-a1*y1-a2*y2
  y[i]=out;x2=x1;x1=sample;y2=y1;y1=out
 return y
entries=[];takes=[]
for s in SPECS:
 n=round(SR*s['ms']/1000);t=np.arange(n)/SR;u=np.linspace(0,1,n);rng=np.random.default_rng(s['seed'])
 ease=u*u*(3-2*u);centers=s['start']*(s['end']/s['start'])**ease
 air=swept_air(rng.standard_normal(n),centers,s['q']);air=sosfilt(butter(2,[380,4300],btype='bandpass',fs=SR,output='sos'),air);air/=np.sqrt(np.mean(air*air))
 phase=2*np.pi*np.cumsum(centers*.72)/SR;whistle=np.sin(phase)+.13*np.sin(phase*1.97+.6);whistle/=np.sqrt(np.mean(whistle*whistle))
 # Smooth single lobe, 14ms attack and 25ms release; no impulses or mouth taps.
 env=np.sin(np.pi*u)**1.25;attack=np.sin(np.pi/2*np.minimum(t/.014,1))**2;release=np.sin(np.pi/2*np.minimum((t[-1]-t)/.025,1))**2
 x=((1-s['tone'])*air+s['tone']*whistle)*env*attack*release
 x=sosfilt(butter(2,3900,fs=SR,output='sos'),x);x-=np.mean(x);x*=np.minimum(u/.03,1)*np.minimum((1-u)/.08,1)
 x=x/max(abs(x))*10**(-10/20);pcm=np.round(x*32767).astype('<i2')
 master=DOC/'masters'/(s['id']+'.wav')
 with wave.open(str(master),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes(pcm.tobytes())
 files=[]
 for ext,args in [('mp3',['-c:a','libmp3lame','-b:a','128k']),('ogg',['-c:a','libvorbis','-q:a','5'])]:
  target=RUN/(s['id']+'.'+ext);subprocess.run(['ffmpeg','-y','-v','error','-i',str(master),'-map_metadata','-1',*args,str(target)],check=True)
  data=target.read_bytes();decoded=subprocess.run(['ffmpeg','-v','error','-i',str(target),'-f','f32le','-acodec','pcm_f32le','-'],check=True,capture_output=True).stdout;dx=np.frombuffer(decoded,dtype='<f4')
  assert np.isfinite(dx).all() and np.max(np.abs(dx))<1
  files.append(dict(file=target.name,bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),decoded_ms=round(len(dx)/SR*1000,2),decoded_peak_dbfs=round(float(20*np.log10(max(abs(dx)))),2),clipped_samples=int(np.sum(abs(dx)>=1))))
 e=dict(**s,sample_rate=SR,channels=1,master_peak_dbfs=round(float(20*np.log10(max(abs(x)))),2),master_rms_dbfs=round(float(20*np.log10(np.sqrt(np.mean(x*x)))),2),first_sample=int(pcm[0]),last_sample=int(pcm[-1]),files=files)
 entries.append(e);takes.append(x)
manifest=dict(schema='aquarium-feeding-whoosh-v4',author='GPT / Codex; original plugin (C) 2026 Carinoasd',status='audition-only-not-selected',method='original seeded procedural swept-air synthesis; smooth envelope; no impact layer',user_feedback='A/B/C rejected as too hard; try short soft 咻',trigger_contract=dict(consumption_confirmed_only=True,min_gap_ms=140,shared_max_voices=2,overflow='skip, no queue'),items=entries)
(RUN/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');(DOC/'QA.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
# Convenient whole set preview, 3 repetitions each, separated by silence. No BGM.
preview=[]
for x in takes:
 for _ in range(3):preview.extend([x,np.zeros(round(SR*.45))])
 preview.append(np.zeros(round(SR*.6)))
joined=np.concatenate(preview);wav=DOC/'set-preview.wav'
with wave.open(str(wav),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes(np.round(joined*32767).astype('<i2').tobytes())
subprocess.run(['ffmpeg','-y','-v','error','-i',str(wav),'-map_metadata','-1','-c:a','libmp3lame','-b:a','128k',str(DOC/'set-preview.mp3')],check=True);wav.unlink()
print(json.dumps([dict(id=e['id'],ms=e['ms'],peak=e['master_peak_dbfs'],rms=e['master_rms_dbfs'],files=e['files']) for e in entries],ensure_ascii=False,indent=2))
