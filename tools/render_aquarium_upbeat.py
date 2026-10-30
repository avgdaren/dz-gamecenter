#!/usr/bin/env python3
"""Original score and synthesis: GPT / Codex, 2026-10-30.
Original plugin (C) 2026 Carinoasd. No external samples. Offline numpy/ffmpeg only.
Run: python3 tools/render_aquarium_upbeat.py --out /absolute/output
"""
import argparse,hashlib,json,math,subprocess,wave
from pathlib import Path
import numpy as np
from scipy.signal import butter,sosfilt

SR=44100;BPM=112;BEAT=60/BPM;BARS=64;SECONDS=BARS*4*BEAT;SEED=2026103047

def voice(midi,duration,kind):
 t=np.arange(round(duration*SR))/SR;f=440*2**((midi-69)/12)
 if kind=='pluck':
  x=sum(np.sin(2*np.pi*f*k*t+.08*k)*np.exp(-t*(2.1+k*.7))/(k**1.65) for k in range(1,9))
 elif kind=='wood':
  x=np.sin(2*np.pi*f*t)*np.exp(-t/0.32)+.23*np.sin(2*np.pi*f*2.76*t)*np.exp(-t/.085)
 elif kind=='flute':
  phase=2*np.pi*f*t+.012*np.sin(2*np.pi*4.7*t)
  x=(np.sin(phase)+.12*np.sin(2*phase)+.035*np.sin(3*phase))*np.minimum(1,t/.035)*np.exp(-t/2)
 elif kind=='bass':x=(np.sin(2*np.pi*f*t)+.17*np.sin(4*np.pi*f*t))*np.exp(-t/.40)
 elif kind=='keys':
  x=(np.sin(2*np.pi*f*t+.25*np.sin(2*np.pi*f*t)*np.exp(-t*5))+.18*np.sin(4*np.pi*f*t)*np.exp(-t*4))*np.exp(-t/1.1)
 else:raise ValueError(kind)
 a=min(len(t),round(.008*SR));z=min(len(t),round(.08*SR))
 x[:a]*=np.sin(np.linspace(0,np.pi/2,a))**2;x[-z:]*=np.cos(np.linspace(0,np.pi/2,z))**2
 return x.astype(np.float32)

def add(track,x,seconds,pan=0):
 theta=(pan+1)*np.pi/4;signal=np.stack([x*np.cos(theta),x*np.sin(theta)],axis=1)
 pos=round(seconds*SR)%len(track)
 while len(signal):
  n=min(len(signal),len(track)-pos);track[pos:pos+n]+=signal[:n];signal=signal[n:];pos=0

def compose():
 rng=np.random.default_rng(SEED);track=np.zeros((round(SECONDS*SR),2),np.float32);events=[]
 # F6, C/E, Dm7, Am7, Bbmaj7, F/A, Gm7, C9.
 chords=[(41,[65,69,72,74]),(40,[64,67,72,76]),(38,[62,65,69,72]),(45,[64,67,69,72]),(34,[62,65,69,70]),(45,[65,69,72,77]),(43,[62,65,67,70]),(36,[64,67,70,74])]
 A=[[(.25,77,.5),(1,81,.5),(1.75,79,.5),(2.5,77,.75),(3.5,74,.4)],[(.5,76,.5),(1.25,79,.5),(2,84,.75),(3.25,79,.5)],[(0,81,.75),(1.25,77,.5),(2,74,.5),(3,77,.75)],[(.5,76,.5),(1.25,72,.5),(2,76,.75),(3.25,79,.5)],[(.25,77,.5),(1,81,.5),(2,82,.75),(3.25,81,.5)],[(0,79,.5),(1,77,.75),(2.25,74,.5),(3,72,.75)],[(.5,74,.5),(1.25,77,.5),(2,79,.75),(3.25,77,.5)],[(.25,76,.75),(1.5,74,.5),(2.5,72,.75)]]
 B=[[(0,81,.5),(1,84,.75),(2.25,86,.5),(3,84,.75)],[(.5,83,.5),(1.25,79,.5),(2,76,1.25)],[(0,81,.75),(1.25,84,.5),(2.25,81,.5),(3,77,.75)],[(.5,79,.5),(1.5,76,.75),(2.75,72,.75)],[(0,82,.75),(1.25,81,.5),(2,77,.5),(3,74,.75)],[(.25,77,.5),(1,81,.5),(2,84,.75),(3.25,81,.5)],[(0,79,.75),(1.25,77,.5),(2,74,1)],[(.5,76,.5),(1.5,79,.75),(2.75,84,.75)]]
 def note(beat,midi,duration,kind,amp,pan=0):
  add(track,voice(midi,duration,kind)*amp,beat*BEAT,pan)
  events.append({'beat':round(beat,5),'midi':midi,'seconds':duration,'instrument':kind,'amp':round(amp,5),'pan':pan})
 for bar in range(BARS):
  section,pos=divmod(bar,8);root,chord=chords[pos];energy=[.82,.94,1,.72,.80,1,.96,.85][section]
  for b,m in [(0,root), (1.5,root+7),(2.5,root+12),(3.5,root+7)]:
   if section==3 and b not in (0,2.5):continue
   note(bar*4+b,m,.48,'bass',.105*energy)
  for beat in [.0,1.5,2.5,3.5]:
   if section in (3,4) and beat in (1.5,3.5):continue
   for i,m in enumerate(chord[:3]):note(bar*4+beat+i*.012,m,.62,'pluck',.040*energy,-.36+i*.22)
  for i,beat in enumerate([.5,1.25,2,2.75,3.25]):
   if section==3 and i%2:continue
   note(bar*4+beat+rng.uniform(-.009,.009),chord[i%4]+12,.48,'wood',.018*energy,(-.55 if i%2 else .55))
  melody=B if section in (2,5,7) else A
  for i,(beat,m,d) in enumerate(melody[pos]):
   if section==3 and i>1:continue
   kind='flute' if section in (2,4,5) else 'keys'
   note(bar*4+beat+.016,m,d*BEAT+.16,kind,.095*energy*rng.uniform(.94,1.03),.08)
  # Soft airy eighth-note shaker, deliberately far below melody. No kick/snare.
  if section!=3:
   for k in range(8):
    if section==4 and k%2:continue
    t=np.arange(round(.055*SR))/SR
    noise=rng.normal(0,1,len(t));noise=sosfilt(butter(2,[4000,9000],btype='bandpass',fs=SR,output='sos'),noise)
    env=np.sin(np.pi*np.minimum(1,t/.055))**2*np.exp(-t*45)
    add(track,(noise*env*.012*energy*(1 if k%2 else .7)).astype(np.float32),(bar*4+k*.5)*BEAT,-.15 if k%2 else .15)
 dry=track.copy()
 for delay,gain in [(.069,.07),(.131,.055),(.213,.05),(.327,.04),(.461,.025),(.619,.018)]:track+=np.roll(dry,round(delay*SR),axis=0)[:,::-1]*gain
 # Periodic pre-roll preserves filter state around loop, including reverb tails.
 track=sosfilt(butter(2,7200,fs=SR,output='sos'),np.concatenate([track[-SR:],track]),axis=0)[SR:].astype(np.float32)
 track-=track.mean(axis=0);rms=np.sqrt(np.mean(track.astype(np.float64)**2));track*=10**(-23/20)/rms
 track*=min(1,10**(-5/20)/np.max(np.abs(track)))
 return track,events

def wav(path,x):
 with wave.open(str(path),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes(np.round(np.clip(x,-1,1)*32767).astype('<i2').tobytes())

def encode(source,dest):
 codec=['-c:a','libvorbis','-q:a','3'] if dest.suffix=='.ogg' else ['-c:a','libmp3lame','-b:a','96k']
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(source),'-map_metadata','-1',*codec,str(dest)],check=True)

def decode(path):
 r=subprocess.run(['ffmpeg','-v','error','-i',str(path),'-f','f32le','-ar',str(SR),'-ac','2','pipe:1'],capture_output=True,check=True)
 return np.frombuffer(r.stdout,dtype='<f4').reshape(-1,2)

def main():
 p=argparse.ArgumentParser();p.add_argument('--out',required=True);args=p.parse_args();out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
 x,events=compose();master=out/'bgm_bubble_skip-master.wav';wav(master,x)
 report={'author':'GPT / Codex','title':'气泡小步舞','bpm':BPM,'bars':BARS,'seconds':SECONDS,'key':'F major','seed':SEED,'samples':len(x),'score_events':len(events),'files':{},'browser_tested':False,'user_listening_accepted':False}
 for ext in ['ogg','mp3']:
  dest=out/('bgm_bubble_skip.'+ext);encode(master,dest);z=decode(dest)
  near=np.concatenate([z[-SR//10:],z[:SR//10]]);rms=float(np.sqrt(np.mean(z.astype(np.float64)**2)));jump=float(np.max(np.abs(z[0]-z[-1])))
  info={'bytes':dest.stat().st_size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'seconds':len(z)/SR,'peak':float(np.max(np.abs(z))),'rms_dbfs':20*math.log10(rms),'clipped_samples':int(np.count_nonzero(abs(z)>=1)),'finite':bool(np.isfinite(z).all()),'loop_boundary_step':jump,'local_step_p99':float(np.percentile(abs(np.diff(near,axis=0)),99))}
  assert info['finite'] and info['clipped_samples']==0 and info['peak']<.7 and abs(info['seconds']-SECONDS)<.05
  report['files'][dest.name]=info
 wav(out/'preview_24s.wav',x[:24*SR]);encode(out/'preview_24s.wav',out/'preview_24s.mp3')
 wav(out/'loop_boundary_8s.wav',np.concatenate([x[-4*SR:],x[:4*SR]]));encode(out/'loop_boundary_8s.wav',out/'loop_boundary_8s.mp3')
 (out/'score.json').write_text(json.dumps({'title':report['title'],'bpm':BPM,'bars':BARS,'events':events},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 (out/'QA.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(report,ensure_ascii=False))

if __name__=='__main__':main()
