#!/usr/bin/env python3
"""GPT / Codex; original plugin (C) 2026 Carinoasd. Original DSP, no samples. Audition only."""
from pathlib import Path
import numpy as np,json,hashlib,subprocess,base64
from scipy.signal import butter,sosfilt
from scipy.io import wavfile
R=Path(__file__).resolve().parents[1];D=R/'docs/aquarium/feeding-audition-v3';A=R/'source/plugin/gamecenter/games/aquarium/assets/feeding/audition-v3'
D.mkdir(parents=True,exist_ok=True);A.mkdir(parents=True,exist_ok=True);SR=44100

def env(t,start,attack,decay):
 u=np.maximum(0,t-start);return (t>=start)*(1-np.exp(-u/attack))*np.exp(-u/decay)
def band(x,lo,hi):return sosfilt(butter(2,[lo,hi],fs=SR,btype='bandpass',output='sos'),x)
records=[]
for g in ['a','b','c']:
 for j,dur in enumerate({'a':[.108,.116,.098,.118],'b':[.086,.101,.094,.112],'c':[.072,.082,.090,.103]}[g]):
  name=f'{g}_{j+1:02d}';seed=53000+ord(g)*100+j;rng=np.random.default_rng(seed);t=np.arange(round(dur*SR))/SR
  if g=='a':
   noise=band(rng.normal(size=len(t)),1350+j*80,4100-j*130)
   suction=np.exp(-.5*((t-(.020+j*.002))/.012)**2)*(1-np.exp(-t/.002))
   y=.46*noise*suction;st=.021+j*.0015;u=np.maximum(t-st,0)
   freq=190+(620+65*j)*np.exp(-u/.019);ph=2*np.pi*np.cumsum(freq)/SR
   y+=.47*(np.sin(ph)+.24*np.sin(ph*1.43))*env(t,st,.004,.021)
   y+=.075*band(rng.normal(size=len(t)),450,1450)*env(t,.037,.002,.013)
   y=band(y,120,4600)
  elif g=='b':
   y=np.zeros_like(t)
   for k,start in enumerate([.003,.031+j*.002]):
    u=np.maximum(t-start,0);f=(310-15*j)+(650+55*j)*np.exp(-u/.007);ph=2*np.pi*np.cumsum(f)/SR
    y+=(.48*np.sin(ph)+.17*np.sin(ph*1.81)+.15*band(rng.normal(size=len(t)),650,2800))*env(t,start,.0008,.008+k*.005)*([.80,1][k])
   y=band(y,140,3900)
  else:
   f=(400+35*j)+(550+30*j)*np.exp(-t/.008);ph=2*np.pi*np.cumsum(f)/SR
   y=(.48*np.sin(ph)+.18*np.sin(ph*1.63)+.10*np.sin(ph*2.19))*env(t,.002,.001,.009)
   y+=.13*band(rng.normal(size=len(t)),700,3100)*env(t,.002,.0007,.006)
   y+=.08*np.sin(2*np.pi*(190+j*12)*t)*env(t,.004,.001,.011);y=band(y,110,3800)
  y=np.tanh(y/(max(abs(y))+1e-12)*1.6);y=sosfilt(butter(3,4700,fs=SR,btype='lowpass',output='sos'),y)
  y-=np.mean(y);n=round(.002*SR);y[:n]*=np.linspace(0,1,n);y[-n:]*=np.linspace(1,0,n)
  y=np.concatenate([np.zeros(round(.001*SR)),y]);y*=10**(-8/20)/max(abs(y));y[0]=y[-1]=0
  master=D/f'{name}_master.wav';wavfile.write(master,SR,np.round(y*32767).astype(np.int16))
  item={'id':name,'group':g.upper(),'seed':seed,'master_seconds':round(len(y)/SR,5),'master_peak_dbfs':-8,'master_rms_dbfs':round(float(20*np.log10(np.sqrt(np.mean(y*y)))),2),'sample_rate':SR,'channels':1,'exports':[]}
  for ext,args in [('ogg',['-c:a','libvorbis','-q:a','4']),('mp3',['-c:a','libmp3lame','-b:a','128k'])]:
   p=A/f'{name}.{ext}';subprocess.run(['ffmpeg','-v','error','-y','-i',str(master),'-ac','1','-ar',str(SR),*args,str(p)],check=True)
   raw=subprocess.run(['ffmpeg','-v','error','-i',str(p),'-f','f32le','-ac','1','-ar',str(SR),'-'],capture_output=True,check=True).stdout
   yy=np.frombuffer(raw,dtype='<f4');assert np.isfinite(yy).all() and max(abs(yy))<1
   item['exports'].append({'file':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'decoded_seconds':round(len(yy)/SR,5),'peak_dbfs':round(float(20*np.log10(max(abs(yy)))),2),'rms_dbfs':round(float(20*np.log10(np.sqrt(np.mean(yy*yy)))),2),'clipped_samples':int((abs(yy)>=1).sum())})
  records.append(item)
manifest={'schema':'aquarium-feeding-audition-v3','author':'GPT / Codex; original plugin (C) 2026 Carinoasd','status':'audition-not-active','provenance':'original deterministic procedural synthesis; no third-party samples','preferred_direction':'A: short suction/slurp, user describes 丝溜; final selection pending audition','groups':{'A':'湿润吸溜','B':'卡通咀嚼','C':'轻脆咬合'},'sounds':records,'contract':{'trigger':'one locally confirmed pellet consumption only','cooldown_ms':140,'max_shared_voices':2,'skip_instead_of_queue':True,'drop_and_bgm':'unchanged','suggested_volume':.45}}
(A/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');(D/'metrics.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
data=[]
for r in records:
 b=(A/(r['id']+'.mp3')).read_bytes();data.append({'id':r['id'],'group':r['group'],'ms':round(r['master_seconds']*1000),'src':'data:audio/mpeg;base64,'+base64.b64encode(b).decode()})
h='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>吃食声音 A/B/C 试听</title><style>*{box-sizing:border-box}body{margin:0;background:#f0f3ec;color:#25483c;font:16px/1.6 system-ui,sans-serif}main{max-width:920px;margin:36px auto;padding:24px}h1{margin:0;font-size:30px}p{color:#6a7b6d}.group{background:#fffdf7;border:1px solid #d9e4d8;border-radius:20px;padding:20px;margin:20px 0}.group:first-of-type{border:2px solid #6b9e80}.buttons{display:flex;gap:12px;flex-wrap:wrap}button{font:inherit;border:0;background:#34624e;color:white;border-radius:12px;padding:14px 20px;cursor:pointer}button.active{background:#af773a}button:focus-visible{outline:3px solid #c59c4b;outline-offset:3px}.name{font-size:12px;letter-spacing:2px;color:#93753b}input{vertical-align:middle}footer{font-size:12px;color:#7c8d7c}</style><main><div class="name">ANGEL AQUARIUM / SOUND AUDITION</div><h1>哪一口，像在吃东西？</h1><p>A 组优先试“丝溜”的轻吸入感。B、C 组作对照；每组4个变体。点击播放，不自动播放、不叠加。</p><label>音量 <input aria-label="音量" id="vol" type="range" min="0" max="1" step=".05" value=".45"></label><button id="stop">停止</button><div id="groups"></div><p id="status" aria-live="polite">未选择。母版均为 -8dBFS；相同峰值不代表主观响度完全相同。</p><footer>原创程序合成 · OGG/MP3/WAV均已提供 · 没有BGM · GPT / Codex；原插件 (C) 2026 Carinoasd</footer></main><script>const clips=__CLIPS__,names={A:'A · 湿润吸溜',B:'B · 卡通咀嚼',C:'C · 轻脆咬合'};let current=null;function stop(){if(current){current.pause();current=null}document.querySelectorAll('button.active').forEach(b=>b.classList.remove('active'))}for(const g of ['A','B','C']){const section=document.createElement('section');section.className='group';const title=document.createElement('h2');title.textContent=names[g];section.appendChild(title);const buttons=document.createElement('div');buttons.className='buttons';for(const c of clips.filter(x=>x.group===g)){const b=document.createElement('button');b.textContent=c.id.toUpperCase()+' · '+c.ms+'ms';b.onclick=()=>{stop();b.classList.add('active');const a=new Audio(c.src);current=a;a.volume=Number(document.getElementById('vol').value);a.onended=()=>{if(current===a){b.classList.remove('active');current=null}};a.play().catch(()=>{stop();document.getElementById('status').textContent='浏览器拦截了声音，请再次点试听。'});document.getElementById('status').textContent='正在试听 '+c.id.toUpperCase()+'；选好后告诉小蓝编号即可。';};buttons.appendChild(b)}section.appendChild(buttons);document.getElementById('groups').appendChild(section)}document.getElementById('stop').onclick=stop;document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});window.addEventListener('pagehide',stop);</script></html>'''.replace('__CLIPS__',json.dumps(data))
(D/'preview.html').write_text(h)
print(json.dumps({'clips':12,'exports':24,'bytes':sum(f['bytes'] for r in records for f in r['exports']),'A':[{'id':r['id'],'ms':round(r['master_seconds']*1000),'rms':r['master_rms_dbfs']} for r in records if r['group']=='A']}))
