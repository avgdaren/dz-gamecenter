#!/usr/bin/env python3
"""Author: GPT / Codex; original plugin (C) 2026 Carinoasd.
Synthetic fixtures only. Does not test or substitute the user's missing WAV.
"""
from pathlib import Path
import array,json,math,subprocess,sys,tempfile,wave

ROOT=Path(__file__).resolve().parents[2]
SCRIPT=ROOT/'tools/transcode_aquarium_user_splash.py'

def main():
 checks=0
 with tempfile.TemporaryDirectory(prefix='aq-user-splash-test-') as name:
  p=Path(name);source=p/'synthetic-test-only.wav';pcm=array.array('h')
  rate=48000
  for i in range(round(4.81*rate)):
   t=i/rate
   value=math.sin(math.tau*330*t)*.0008
   # Sparse clipped transients exercise compression/limiting at low overall RMS.
   if .10<t<.1008 or .35<t<.3508 or .80<t<.8008:value=1.0
   v=round(max(-1,min(1,value))*32767);pcm.extend([v,v])
  if sys.byteorder!='little':pcm.byteswap()
  with wave.open(str(source),'wb') as w:
   w.setnchannels(2);w.setsampwidth(2);w.setframerate(rate);w.writeframes(pcm.tobytes())
  result=subprocess.run([sys.executable,str(SCRIPT),str(source),'--out',str(p/'out')],text=True,capture_output=True,check=True)
  report=json.loads((p/'out/QA.json').read_text())
  assert report['source_metrics']['near_full_scale_samples']>0;checks+=1
  for item in report['files'].values():
   assert item['sample_rate']==32000 and item['channels']==1;checks+=1
   assert abs(item['decoded_seconds']-1.55)<.04;checks+=1
   assert item['finite'] and item['near_full_scale_samples']==0;checks+=1
   assert item['peak']<=.55 and item['oversampled_peak_4x']<=.55;checks+=1
   assert item['bytes']<30000;checks+=1
  fragment=json.loads((p/'out/manifest.fragment.json').read_text())
  assert fragment['fallback_id']=='sfx_splash';checks+=1
  assert fragment['license_record']['verification_status']=='unverified';checks+=1
  assert 'pending' in fragment['activation'];checks+=1
  missing=subprocess.run([sys.executable,str(SCRIPT),str(p/'missing.wav'),'--out',str(p/'missing-out')],capture_output=True)
  assert missing.returncode!=0 and not (p/'missing-out').exists();checks+=1
  license_record=p/'wrong-source.json';license_record.write_text(json.dumps({'original_sha256':'0'*64}))
  mismatch=subprocess.run([sys.executable,str(SCRIPT),str(source),'--out',str(p/'mismatch-out'),'--license-record',str(license_record)],capture_output=True)
  assert mismatch.returncode!=0 and not (p/'mismatch-out').exists();checks+=1
 print(json.dumps({'status':'PASS','checks':checks,'scope':'synthetic fixture only; actual user WAV unavailable'}))

if __name__=='__main__':main()
