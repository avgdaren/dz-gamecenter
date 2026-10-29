#!/usr/bin/env python3
"""Author: GPT / Codex, 2026-10-30. Original plugin (C) 2026 Carinoasd.
User-supplied WAV -> compact splash OGG/MP3. Python stdlib + ffmpeg/ffprobe.
Does not download media, grant licenses, upload files or change the game.
Usage: python3 tools/transcode_aquarium_user_splash.py INPUT.wav --out OUTPUT
"""
import argparse
from array import array
import hashlib,json,math,shutil,struct,subprocess,sys,wave
from pathlib import Path

RATE=32000

def run(args,data=None):
 return subprocess.run(args,input=data,stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True).stdout

def probe(path):
 r=json.loads(run(['ffprobe','-v','error','-select_streams','a:0','-show_entries',
  'stream=sample_rate,channels,bits_per_sample,codec_name:format=duration,size','-of','json',str(path)]))
 s=r['streams'][0];return {'sample_rate':int(s['sample_rate']),'channels':int(s['channels']),
  'bits_per_sample':int(s.get('bits_per_sample',0)),'codec':s['codec_name'],
  'container_seconds':float(r['format']['duration']),'bytes':int(r['format']['size'])}

def floats(data):
 x=array('f');x.frombytes(data)
 if sys.byteorder!='little':x.byteswap()
 return x

def raw_bytes(x):
 y=array('f',x)
 if sys.byteorder!='little':y.byteswap()
 return y.tobytes()

def decode(path,rate=None,mono=False,filters=None):
 args=['ffmpeg','-hide_banner','-loglevel','error','-i',str(path)]
 if filters:args+=['-af',filters]
 if mono:args+=['-ac','1']
 if rate:args+=['-ar',str(rate)]
 return floats(run(args+['-f','f32le','pipe:1']))

def metrics(x,rate,channels=1):
 if not x:raise ValueError('Empty audio')
 if not all(math.isfinite(v) for v in x):raise ValueError('Non-finite audio')
 peak=max(abs(v) for v in x);rms=math.sqrt(sum(v*v for v in x)/len(x))
 return {'decoded_seconds':len(x)/rate/channels,'peak':peak,'rms':rms,
  'peak_dbfs':20*math.log10(max(peak,1e-12)),'rms_dbfs':20*math.log10(max(rms,1e-12)),
  'near_full_scale_samples':sum(abs(v)>=.999 for v in x),'finite':True}

def save_wav(path,x):
 # Round to PCM16 only after compression/limiting; no earlier integer clipping.
 pcm=array('h',(max(-32768,min(32767,round(v*32767))) for v in x))
 if sys.byteorder!='little':pcm.byteswap()
 with wave.open(str(path),'wb') as w:
  w.setnchannels(1);w.setsampwidth(2);w.setframerate(RATE);w.writeframes(pcm.tobytes())

def main():
 p=argparse.ArgumentParser();p.add_argument('input');p.add_argument('--out',required=True)
 p.add_argument('--duration',type=float,default=1.55)
 p.add_argument('--target-rms',type=float,default=.0461)
 p.add_argument('--decoded-peak-ceiling',type=float,default=.55)
 p.add_argument('--license-record',help='Optional factual source/credit record; not an automatic legal review')
 args=p.parse_args()
 if not (.1<=args.duration<=4.81 and .001<=args.target_rms<=.1 and .1<=args.decoded_peak_ceiling<=.8):p.error('Unsafe or invalid processing values')
 for binary in ['ffmpeg','ffprobe']:
  if not shutil.which(binary):p.error(binary+' is required')
 source=Path(args.input)
 if not source.is_file():p.error('Input file was not found; no substitute audio is generated')
 info=probe(source)
 if info['container_seconds']<args.duration:p.error('Source is shorter than trim duration')
 original=decode(source)
 source_metrics=metrics(original,info['sample_rate'],info['channels'])
 source_sha=hashlib.sha256(source.read_bytes()).hexdigest()
 record=json.loads(Path(args.license_record).read_text()) if args.license_record else {'verification_status':'unverified'}
 if record.get('original_sha256') and record['original_sha256']!=source_sha:p.error('License record identifies another source hash')
 fade=.06;end=args.duration
 x=decode(source,RATE,True,
  'atrim=start=0:end='+str(end)+',asetpts=PTS-STARTPTS,highpass=f=35,'
  'afade=t=in:st=0:d=0.003,afade=t=out:st='+str(end-fade)+':d='+str(fade))
 # Remove DC, normalize float audio, then tame short transients.
 mean=sum(x)/len(x);x=array('f',(v-mean for v in x))
 measured=metrics(x,RATE);gain=args.target_rms/max(measured['rms'],1e-12)
 normalized=array('f',(v*gain for v in x))
 processing='acompressor=threshold=0.22:ratio=2:attack=1:release=60:knee=2:makeup=1,'
 processing+='alimiter=limit=0.48:attack=2:release=60:level=false:latency=true'
 limited=floats(run(['ffmpeg','-hide_banner','-loglevel','error','-f','f32le','-ar',str(RATE),
  '-ac','1','-i','pipe:0','-af',processing,'-f','f32le','pipe:1'],raw_bytes(normalized)))
 count=round(end*RATE)
 if len(limited)<count:limited.extend([0.]*(count-len(limited)))
 limited=limited[:count]
 m=metrics(limited,RATE)
 final_gain=min(args.target_rms/max(m['rms'],1e-12),.48/max(m['peak'],1e-12))
 limited=array('f',(v*final_gain for v in limited))
 out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
 master=out/'sfx_splash_user-master.wav';files={};attenuation=1.0
 for attempt in range(4):
  save_wav(master,array('f',(v*attenuation for v in limited)))
  worst=0.;files={}
  for ext,codec in [('ogg',['-c:a','libvorbis','-q:a','4']),('mp3',['-c:a','libmp3lame','-b:a','64k'])]:
   dest=out/('sfx_splash_user.'+ext)
   run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(master),'-map_metadata','-1',*codec,str(dest)])
   decoded=decode(dest,RATE,True);check=metrics(decoded,RATE)
   true_peak=max(abs(v) for v in decode(dest,RATE*4,True))
   if abs(check['decoded_seconds']-end)>.04:raise ValueError('Unexpected decoded duration')
   worst=max(worst,check['peak'],true_peak)
   data=dest.read_bytes();check.update({'file':dest.name,'sample_rate':RATE,'channels':1,
    'oversampled_peak_4x':true_peak,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),
    'git_blob_sha':hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()})
   files[ext]=check
  if worst<=args.decoded_peak_ceiling:break
  attenuation*=args.decoded_peak_ceiling/worst*.97
 else:raise ValueError('Post-codec peak ceiling not achieved')
 for f in files.values():
  if f['near_full_scale_samples']:raise ValueError('Output overload')
 report={'source_file':source.name,'source_sha256':source_sha,'source_info':info,
  'source_metrics':source_metrics,'processing':{'trim_seconds':end,'mono_rate':RATE,'fade_out_seconds':fade,
   'target_rms':args.target_rms,'post_codec_peak_ceiling':args.decoded_peak_ceiling,
   'compressor_and_limiter':processing,'post_codec_attenuation':attenuation},
  'files':files,'license_record':record,'license_review':'not performed by this script',
  'limitations':['A limiter does not reconstruct detail lost to source clipping.',
                 'Signal checks are not user listening or browser acceptance.']}
 (out/'QA.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 fragment={'schema':'aquarium-audio-user-splash-fragment-v1','id':'sfx_splash_user',
  'event':'fish_place','fallback_id':'sfx_splash','source_kind':'user-provided-ear0-audio',
  'source_sha256':source_sha,'license_record':record,'activation':'pending source-license review and listening',
  'formats':[{'file':v['file'],'mime':'audio/ogg' if k=='ogg' else 'audio/mpeg','bytes':v['bytes'],'sha256':v['sha256']} for k,v in files.items()]}
 (out/'manifest.fragment.json').write_text(json.dumps(fragment,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'source_sha256':source_sha,'source_near_full_scale_samples':source_metrics['near_full_scale_samples'],
                  'outputs':files,'license_review':'not automatically performed'},ensure_ascii=False))

if __name__=='__main__':main()
