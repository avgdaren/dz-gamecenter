#!/usr/bin/env python3
"""Author: GPT / Codex; original plugin (C) 2026 Carinoasd.
Synthetic fixtures only. Does not test or substitute the user's missing WAV.
"""
from pathlib import Path
import array,hashlib,importlib.util,json,math,os,shutil,subprocess,sys,tempfile,wave
from unittest.mock import patch

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
  report=json.loads((p/'out/QA.json').read_text(encoding='utf-8'))
  assert report['source_metrics']['near_full_scale_samples']>0;checks+=1
  for item in report['files'].values():
   assert item['sample_rate']==32000 and item['channels']==1;checks+=1
   assert abs(item['decoded_seconds']-1.55)<.04;checks+=1
   assert item['finite'] and item['near_full_scale_samples']==0;checks+=1
   assert item['peak']<=.55 and item['oversampled_peak_4x']<=.55;checks+=1
   assert item['bytes']<30000;checks+=1
  fragment=json.loads((p/'out/manifest.fragment.json').read_text(encoding='utf-8'))
  assert fragment['fallback_id']=='sfx_splash';checks+=1
  assert fragment['license_record']['verification_status']=='unverified';checks+=1
  assert 'pending' in fragment['activation'];checks+=1
  missing=subprocess.run([sys.executable,str(SCRIPT),str(p/'missing.wav'),'--out',str(p/'missing-out')],capture_output=True)
  assert missing.returncode!=0 and not (p/'missing-out').exists();checks+=1
  license_record=p/'wrong-source.json';license_record.write_text(json.dumps({'original_sha256':'0'*64}))
  mismatch=subprocess.run([sys.executable,str(SCRIPT),str(source),'--out',str(p/'mismatch-out'),'--license-record',str(license_record)],capture_output=True)
  assert mismatch.returncode!=0 and not (p/'mismatch-out').exists();checks+=1
  record=p/'utf8-bom.json';record.write_text(json.dumps({'original_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
   'title':'掉落水中：测试夹具','verification_status':'unverified'},ensure_ascii=False),encoding='utf-8-sig')
  binary=p/'tool directory with spaces';binary.mkdir()
  executable=binary/'ffmpeg executable';executable.symlink_to(shutil.which('ffmpeg'))
  env=dict(os.environ,AQUARIUM_FFMPEG=str(executable),AQUARIUM_FFPROBE=str(p/'missing-ffprobe'))
  subprocess.run([sys.executable,str(SCRIPT),str(source),'--out',str(p/'fallback'),
   '--license-record',str(record)],env=env,capture_output=True,check=True)
  fallback=json.loads((p/'fallback/QA.json').read_text(encoding='utf-8'))
  assert fallback['license_record']['title']=='掉落水中：测试夹具';checks+=1
  assert fallback['source_info']['probe_method']=='stdlib-wave-fallback';checks+=1
  assert all(v['peak']<=.55 and v['oversampled_peak_4x']<=.55 for v in fallback['files'].values());checks+=1
  # Probe-only checks: non-WAV fallback plus a present but broken executable.
  spec=importlib.util.spec_from_file_location('splash_pipeline',SCRIPT);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
  module.FFPROBE=str(p/'missing-ffprobe');module.FFMPEG=str(executable)
  ogg_info=module.probe(p/'fallback/sfx_splash_user.ogg')
  assert ogg_info['probe_method']=='ffmpeg-stream-and-decoded-length-fallback';checks+=1
  assert ogg_info['sample_rate']==32000 and ogg_info['channels']==1 and abs(ogg_info['container_seconds']-1.55)<.04;checks+=1
  with patch.object(module,'run',side_effect=OSError('Simulated Windows missing DLL / 0xC0000135')):
   assert module.probe(source)['probe_method']=='stdlib-wave-fallback';checks+=1
  invalid=subprocess.run([sys.executable,str(SCRIPT),str(source),'--out',str(p/'bad-exe'),
   '--ffmpeg',str(p/'not-ffmpeg')],capture_output=True)
  assert invalid.returncode!=0 and not (p/'bad-exe').exists();checks+=1
  subprocess.run([sys.executable,str(SCRIPT),str(source),'--out',str(p/'cli-path'),
   '--ffmpeg',str(executable),'--ffprobe',str(p/'missing-probe')],capture_output=True,check=True)
  assert (p/'cli-path/manifest.fragment.json').is_file();checks+=1
 print(json.dumps({'status':'PASS','checks':checks,'scope':'synthetic fixture only; actual user WAV unavailable'}))

if __name__=='__main__':main()
