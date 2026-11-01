#!/usr/bin/env python3
"""GPT / Codex; original plugin (C) 2026 Carinoasd.
Original procedural cartoon bites. No third-party recordings. Offline only.
"""
from pathlib import Path
import hashlib,json,subprocess,base64,re
import numpy as np
from scipy.signal import butter,sosfilt
from scipy.io import wavfile
R=Path(__file__).resolve().parents[1]; D=R/'docs/aquarium/feeding-audio-v2'; A=R/'source/plugin/gamecenter/games/aquarium/assets/feeding/v2'
D.mkdir(parents=True,exist_ok=True);A.mkdir(parents=True,exist_ok=True)
SR=44100
spec=[('bite_01',.080,-8,5411),('bite_02',.095,-8,5412),('bite_03',.070,-8,5413),('bite_04',.115,-8,5414),('drop_01',.105,-10,5421),('drop_02',.130,-10,5422),('pop_01',.145,-12,5431)]
records=[]
for name,dur,peak,seed in spec:
 rng=np.random.default_rng(seed);t=np.arange(round(dur*SR))/SR;y=np.zeros_like(t)
 if name.startswith('bite'):
  # Dry, tightly damped, clustered micro-bites, rather than a ringing sine bell.
  variant=int(name[-2:])-1
  for j,at in enumerate([0,.011+variant*.001,.025+variant*.0015]):
   u=np.maximum(t-at,0);gate=t>=at
   env=gate*(1-np.exp(-u/.00055))*np.exp(-u/(.0055+j*.0013))
   noise=sosfilt(butter(2,[650+variant*90,4800-variant*150],fs=SR,btype='bandpass',output='sos'),rng.normal(size=len(t)))
   freq=(1050+variant*95)*np.exp(-u/.008)+260
   ph=2*np.pi*np.cumsum(freq)/SR
   grit=np.tanh(noise*1.9)*.68 + .22*np.sin(ph)+.12*np.sin(ph*1.71)
   y+=env*grit*[1,.64,.33][j]
  # Small jaw thump under the crunch; short enough not to become a wet 'ding'.
  phase=2*np.pi*np.cumsum(180+210*np.exp(-t/.007))/SR
  y+=.16*np.sin(phase)*(1-np.exp(-t/.0008))*np.exp(-t/.011)
 elif name.startswith('drop'):
  k=int(name[-2:]);ph=2*np.pi*np.cumsum(260+(900+150*k)*np.exp(-t/.010))/SR
  y=.65*np.sin(ph)*(1-np.exp(-t/.001))*np.exp(-t/.017)
  noise=sosfilt(butter(2,[950,3900],fs=SR,btype='bandpass',output='sos'),rng.normal(size=len(t)))
  y+=.14*noise*(1-np.exp(-t/.0008))*np.exp(-t/.008)
 else:
  ph=2*np.pi*np.cumsum(190+390*np.exp(-t/.018))/SR
  y=np.sin(ph)*(1-np.exp(-t/.002))*np.exp(-t/.022)
 y=sosfilt(butter(2,[110,5500],fs=SR,btype='bandpass',output='sos'),y)
 
 if name.startswith('bite'):
  y=np.tanh(y/(max(abs(y))+1e-12)*5)
  y=sosfilt(butter(3,5000,fs=SR,btype='lowpass',output='sos'),y)
 y-=y.mean();n=round(.002*SR);y[:n]*=np.linspace(0,1,n);y[-n:]*=np.linspace(1,0,n)
 y=np.concatenate([np.zeros(round(.002*SR)),y]);y*=10**(peak/20)/max(abs(y));y[0]=y[-1]=0
 master=D/(name+'_master.wav');wavfile.write(master,SR,np.round(y*32767).astype(np.int16))
 metrics={'id':name,'seconds':round(len(y)/SR,5),'peak_dbfs':peak,'rms_dbfs':round(20*np.log10(np.sqrt(np.mean(y*y))),2),'sample_rate':SR,'channels':1,'seed':seed,'encoded':[]}
 for ext,args in [('ogg',['-c:a','libvorbis','-q:a','4']),('mp3',['-c:a','libmp3lame','-b:a','128k'])]:
  p=A/(name+'.'+ext);subprocess.run(['ffmpeg','-v','error','-y','-i',str(master),'-ac','1','-ar',str(SR),*args,str(p)],check=True)
  b=subprocess.run(['ffmpeg','-v','error','-i',str(p),'-f','f32le','-ac','1','-ar',str(SR),'-'],check=True,capture_output=True).stdout
  yy=np.frombuffer(b,dtype='<f4');assert len(yy)>0 and np.isfinite(yy).all() and max(abs(yy))<1
  metrics['encoded'].append({'file':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'decoded_seconds':round(len(yy)/SR,5),'peak_dbfs':round(float(20*np.log10(max(abs(yy)))),2),'rms_dbfs':round(float(20*np.log10(np.sqrt(np.mean(yy*yy)))),2),'clipped_samples':int((abs(yy)>=1).sum())})
 records.append(metrics)
manifest={'schema':'aquarium-feeding-audio-v2','author':'GPT / Codex; original plugin (C) 2026 Carinoasd','provenance':'original deterministic procedural synthesis; no third-party samples','supersedes':'feeding/v1/eat_01..03 audio only; keep feeding/v1 pellet art','sounds':records,'playback':{'bite_volume':.45,'drop_volume':.32,'pop_volume':.22,'bite_global_cooldown_ms':140,'max_total_voices':2,'default_pitch':'fixed; alternate four bites without immediate repeats','optional_playback_rate_range':[.92,1.08],'pop_enabled_by_default':False},'feeding':{'particles_per_click':1,'max_particles':8,'max_responding_fish':4,'particle_ttl_ms':25000,'particle_fade_ms':500,'quiet_clear_ms':4000}}
(A/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');(D/'audio-metrics.json').write_text(json.dumps(records,indent=2)+'\n')
# Self-contained audio audition. All audio starts from explicit button interaction.
def uri(p):return 'data:audio/mpeg;base64,'+base64.b64encode(p.read_bytes()).decode()
data=[{'id':x['id'],'seconds':x['seconds'],'peak':x['peak_dbfs'],'src':uri(A/(x['id']+'.mp3'))} for x in records]
h='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>卡通吃食音效 v2</title><style>*{box-sizing:border-box}body{margin:0;background:#edf3ed;color:#25473f;font:16px/1.6 system-ui,sans-serif}main{max-width:880px;margin:40px auto;padding:24px}h1{font-size:30px;margin:0}p{color:#62796e}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px;margin:24px 0}.card{padding:20px;border:1px solid #d6e2d6;background:#fffdf7;border-radius:18px}.card strong{display:block}small{display:block;color:#687f75;margin:8px 0}button{border:0;border-radius:10px;padding:12px 18px;background:#2e6556;color:white;cursor:pointer;font:inherit}input{vertical-align:middle}footer{font-size:12px;color:#7a8e80}.badge{color:#a27a35;font-size:12px;letter-spacing:2px}</style><main><span class="badge">ANGEL AQUARIUM / ORIGINAL SOUND DESIGN</span><h1>咔、啵，一小口。</h1><p>4个短脆吃食变体 + 2个入水声 + 1个轻散场声。点击单项试听；没有BGM。</p><label>主音量 <input id="volume" aria-label="主音量" type="range" min="0" max="1" step=".05" value=".45"></label><div class="grid" id="grid"></div><p>这是原创程序合成音效；最终与《气泡小步舞》的混音在真实游戏中确认。散场声默认关闭，避免连点时过度提示。</p><footer>GPT / Codex · 原插件 (C) 2026 Carinoasd · 私有开发预览</footer></main><script>const data=__DATA__;let current=null;for(const item of data){const e=document.createElement('div');e.className='card';const name=document.createElement('strong');name.textContent=item.id;e.appendChild(name);const info=document.createElement('small');info.textContent=Math.round(item.seconds*1000)+' ms / '+item.peak+' dBFS';e.appendChild(info);const b=document.createElement('button');b.textContent='试听';b.onclick=()=>{if(current)current.pause();current=new Audio(item.src);current.volume=Number(document.getElementById('volume').value);current.play().catch(()=>{});};e.appendChild(b);document.getElementById('grid').appendChild(e);}document.addEventListener('visibilitychange',()=>{if(document.hidden&&current)current.pause()});</script></html>'''.replace('__DATA__',json.dumps(data))
(D/'preview.html').write_text(h)
print(json.dumps({'files':14,'encoded_bytes':sum(f['bytes'] for r in records for f in r['encoded']),'sounds':[{'id':r['id'],'ms':round(r['seconds']*1000),'peak':r['peak_dbfs'],'rms':r['rms_dbfs']} for r in records]}))
