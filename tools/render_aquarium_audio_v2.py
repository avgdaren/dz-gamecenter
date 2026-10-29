#!/usr/bin/env python3
"""Author: GPT / Codex, 2026-10-30. Original plugin (C) 2026 Carinoasd.
Original moon theme + splash, water-transition and coin sounds. No samples.
Production only: Python/numpy/scipy/ffmpeg; not browser runtime dependencies.
Uses unchanged v1 production helpers from render_aquarium_audio.py.
"""
from pathlib import Path
import argparse,hashlib,json,subprocess
import numpy as np
import render_aquarium_audio as a

SR=a.SR
BPM=72
BEAT=60/BPM
DURATION=160


def moon():
 rng=np.random.default_rng(2026103002)
 track=np.zeros((SR*DURATION,2),np.float32);events=[]
 chords=[(35,[59,62,66,69,73]),(31,[55,59,62,66,69]),
         (38,[57,62,66,69,76]),(33,[57,61,64,69,71]),
         (28,[55,59,62,66,71]),(30,[54,57,61,64,69]),
         (31,[55,59,62,66,69]),(33,[57,61,64,69,71])]
 melody=[[(.5,78,1.5),(2.5,74,1)],[(0,74,1.4),(2,71,1.4)],
         [(.5,76,1),(2,78,1.5)],[(0,76,1.5),(2.5,73,1)],
         [(.5,71,1),(2,74,1.5)],[(0,73,1.3),(2,69,1.5)],
         [(.5,71,1.2),(2.5,74,1)],[(0,73,1.5),(2.5,69,1)]]
 variation=[[(.5,74,1),(2,78,1.5)],[(0,79,1.5),(2.5,78,1)],
            [(.5,76,1.2),(2.5,74,1)],[(0,73,2.5)],
            [(.5,74,1),(2.0,76,1.5)],[(0,73,1.5),(2.5,69,1)],
            [(.5,71,1.3),(2.5,69,1)],[(0,73,1.3),(2.5,71,1)]]
 def note(beat,midi,duration,kind,amp,pan):
  a.add_wrap(track,a.stereo(a.voice(midi,duration,kind,amp),pan),beat*BEAT)
  events.append({'beat':round(beat,4),'midi':midi,'seconds':duration,'instrument':kind,'amplitude':amp,'pan':pan})
 for bar in range(48):
  section,pos=divmod(bar,8);energy=[.80,.94,1,.68,.90,.82][section]
  root,chord=chords[pos]
  note(bar*4,root+12,3.0,'bass',.058*energy,-.04)
  for j,m in enumerate(chord[:4]):
   note(bar*4+j*.05,m,3.8,'keys',.023*energy,-.35+j*.22)
  for j,m in enumerate(chord[1:4]):
   note(bar*4,m-12,4.8,'pad',.012*energy,[-.65,0,.65][j])
  for j,(offset,index) in enumerate([(1,1),(2.5,3),(3.5,4)]):
   if section==3 and j!=1:continue
   note(bar*4+offset+rng.uniform(-.015,.015),chord[index],1.6,'harp',.026*energy,[-.45,.35,-.2][j])
  for j,(offset,m,dur) in enumerate((variation if section in [2,5] else melody)[pos]):
   if section==3 and j>0:continue
   note(bar*4+offset+.03,m,dur*BEAT+1.15,'keys',.098*energy*rng.uniform(.94,1.04),.1)
  if section in [1,4] and pos in [2,6]:
   note(bar*4+3.3,chord[2]+12,1.5,'harp',.018,-.35)
 dry=track.copy()
 for delay,gain in [(.097,.075),(.181,.06),(.283,.05),(.419,.04),(.613,.027),(.839,.02),(1.127,.012)]:
  track+=np.roll(dry,round(delay*SR),axis=0)[:,::-1]*gain
 track=a.lowpass(np.concatenate((track[-SR:],track)),4500)[SR:]
 return a.finish(track,-24,-5),events


def sfx():
 rng=np.random.default_rng(2026103003)
 # A brief, recognizable water impact, then smaller air bubbles.
 t=np.arange(round(.78*SR))/SR
 noise=a.lowpass(rng.normal(size=len(t)),6000)-a.lowpass(rng.normal(size=len(t)),550)
 envelope=(1-np.exp(-t*320))*np.exp(-t*12)
 splash=noise*envelope*.13
 low=(180+250*np.exp(-t*25))
 splash+=np.sin(2*np.pi*np.cumsum(low)/SR)*np.exp(-t*18)*.17
 for start,freq in [(.17,410),(.30,540),(.43,690)]:
  local=np.maximum(0,t-start)
  phase=2*np.pi*(freq*local-90*local**2)
  splash+=np.where(t>=start,np.sin(phase)*(1-np.exp(-local*250))*np.exp(-local*28)*.07,0)
 splash=a.edge_fade(splash,.004,.10)
 # Soft, short stream for switching water areas.
 t2=np.arange(round(.42*SR))/SR
 filtered=a.lowpass(rng.normal(size=len(t2)),2800)
 env=np.sin(np.pi*np.minimum(1,t2/.42))**1.8
 water=a.edge_fade(filtered*.22*env + .04*np.sin(2*np.pi*(300*t2+200*t2*t2))*env,.01,.06)
 # A gentle three-note rising acknowledgement for one confirmed summary.
 coin=np.zeros(round(.68*SR),np.float32)
 for start,m,amp in [(0,81,.17),(.10,85,.14),(.21,88,.10)]:
  part=a.voice(m,min(.45,.68-start),'harp',amp)
  at=round(start*SR);coin[at:at+len(part)]+=part
 coin=a.edge_fade(coin,.006,.07)
 return {'sfx_splash':a.finish(a.stereo(splash),-24,-8),
         'sfx_water':a.finish(a.stereo(water),-25,-10),
         'sfx_coin':a.finish(a.stereo(coin),-25,-10)}


def main():
 p=argparse.ArgumentParser();p.add_argument('--out',required=True);args=p.parse_args()
 out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
 masters=out/'masters';masters.mkdir(exist_ok=True)
 bgm,events=moon();items={'bgm_moonlit_garden':bgm,**sfx()}
 report={'date':'2026-10-30','author':'GPT / Codex','sample_rate':SR,'bpm':BPM,'bars':48,'files':{}}
 for name,x in items.items():
  wav=masters/(name+'.wav');a.write_wav(wav,x)
  for fmt in ['ogg','mp3']:
   dest=out/(name+'.'+fmt);a.encode(wav,dest,fmt);decoded=a.decode(dest)
   info=a.stats(decoded);data=dest.read_bytes()
   info.update({'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),
                'git_blob_sha':hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()})
   if name.startswith('bgm'):
    step=float(np.max(np.abs(decoded[0]-decoded[-1])))
    local=float(np.percentile(np.abs(np.diff(np.concatenate((decoded[-SR//10:],decoded[:SR//10])),axis=0)),99))
    info.update({'loop_boundary_step':step,'local_sample_step_p99':local,'loop_step_ratio':step/max(local,1e-9)})
   assert info['finite'] and info['clipped_samples']==0
   assert abs(info['duration_seconds']-len(x)/SR)<.08
   report['files'][dest.name]=info
 a.write_wav(masters/'moon-preview-24s.wav',bgm[:24*SR]);a.encode(masters/'moon-preview-24s.wav',out/'moon-preview-24s.mp3','mp3')
 audition=np.concatenate((items['sfx_splash'],np.zeros((SR//2,2)),items['sfx_water'],np.zeros((SR//2,2)),items['sfx_coin']))
 a.write_wav(masters/'new-sfx-audition.wav',audition);a.encode(masters/'new-sfx-audition.wav',out/'new-sfx-audition.mp3','mp3')
 (out/'score.json').write_text(json.dumps({'title':'月庭微光','bpm':BPM,'bars':48,'events':events},ensure_ascii=False,indent=2)+'\n')
 (out/'QA.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'seconds':DURATION,'events':len(events),'files':{k:{q:v[q] for q in ['bytes','duration_seconds','peak_dbfs','rms_dbfs']} for k,v in report['files'].items()}}))

if __name__=='__main__':main()
