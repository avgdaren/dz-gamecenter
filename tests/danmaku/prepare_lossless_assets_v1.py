"""(C) 2026 Carinoasd. Lossless image encoding with exact RGBA verification: 小典 / Codex."""
from pathlib import Path
import json,re,base64,hashlib,subprocess,struct,time
import argparse,zlib,binascii
root=Path(__file__).resolve().parents[2];parser=argparse.ArgumentParser();parser.add_argument('--cwebp',type=Path,required=True);parser.add_argument('--ffmpeg',type=Path,required=True);parser.add_argument('--campaign-html',type=Path,required=True);parser.add_argument('--forum-root',type=Path,required=True);parser.add_argument('--output-dir',type=Path,default=root/'docs/danmaku/assets-lossless-v1');args=parser.parse_args();tmp=root/'tmp/danmaku/asset-optimization-v1';tmp.mkdir(parents=True,exist_ok=True);out=args.output_dir;out.mkdir(parents=True,exist_ok=True);tool=args.cwebp;ffmpeg=args.ffmpeg
html=args.campaign_html.read_text(encoding='utf-8');data=json.loads(re.search(r'window.CampaignData=(.*?);window.Stage02RefinedData=',html,re.S).group(1));sources={}
for group,rows in [('first',data['firstAssets']),('garden',data['garden']['assets'])]:
 for key,uri in rows.items():sources[group+'/'+key]=base64.b64decode(uri.split(',',1)[1])
forum=args.forum_root/'angel_danmaku'
for p in (forum/'assets').glob('*.png'):sources['forum/'+p.name]=p.read_bytes()
keep=set()
for key,b in sources.items():
 group,name=key.split('/',1)
 if group=='garden' and name not in ['sky','paving','rail','arch','portrait'] or group=='first' and name not in ['title','portrait','corridor'] or group=='forum' and not any(x in name for x in ['portrait','corridor']):keep.add(hashlib.sha256(b).hexdigest())
def repack(data):
 chunks=[];offset=8
 while offset<len(data):
  n=struct.unpack('>I',data[offset:offset+4])[0];chunks.append((data[offset+4:offset+8],data[offset+8:offset+8+n]));offset+=n+12
 compressed=zlib.compress(zlib.decompress(b''.join(v for k,v in chunks if k==b'IDAT')),9);parts=[data[:8]];done=False
 for tag,value in chunks:
  if tag==b'IDAT':
   if done:continue
   value=compressed;done=True
  parts.append(struct.pack('>I',len(value))+tag+value+struct.pack('>I',binascii.crc32(tag+value)&0xffffffff))
 result=b''.join(parts);return result if len(result)<len(data) else data
unique={hashlib.sha256(b).hexdigest():b for b in sources.values()};report={};(tmp/'images').mkdir(exist_ok=True)
def rgba(p):return subprocess.check_output([str(ffmpeg),'-v','error','-i',str(p),'-f','rawvideo','-pix_fmt','rgba','-'])
for i,(digest,b) in enumerate(unique.items()):
 old=tmp/'images'/(digest+'.png');old.write_bytes(b);web=tmp/'images'/(digest+'.webp');subprocess.run([str(tool),'-quiet','-z','9','-exact','-mt','-metadata','all',str(old),'-o',str(web)],check=True)
 a=rgba(old);c=rgba(web);assert a==c,digest
 chosen=web if web.stat().st_size<len(b) else old
 if digest in keep:
  png=tmp/'images'/(digest+'-repacked.png');png.write_bytes(repack(b));chosen=png;assert rgba(chosen)==a
 name='image-'+hashlib.sha256(chosen.read_bytes()).hexdigest()[:20]+chosen.suffix;(out/name).write_bytes(chosen.read_bytes());width,height=struct.unpack('>II',b[16:24]);report[digest]={'file':name,'sourceSha256':digest,'sha256':hashlib.sha256(chosen.read_bytes()).hexdigest(),'sourceBytes':len(b),'bytes':chosen.stat().st_size,'width':width,'height':height,'rgbaSha256':hashlib.sha256(a).hexdigest(),'rgbaIdentical':True,'mode':'lossless-exact' if chosen.suffix=='.webp' else 'png-lossless-deflate','browserSamplingPreserved':digest in keep}
 print(json.dumps({'image':i+1,'total':len(unique),'saved':len(b)-chosen.stat().st_size}),flush=True)
manifest={'version':1,'author':'小典 / Codex','prototypeCopyright':'(C) 2026 Carinoasd','tool':'cwebp 1.6.0 -z 9 -exact -mt -metadata all','toolSource':'https://developers.google.com/speed/webp/download','mapping':{key:hashlib.sha256(b).hexdigest() for key,b in sources.items()},'images':report,'sourceBytesUnique':sum(len(b) for b in unique.values()),'optimizedBytesUnique':sum(r['bytes'] for r in report.values())};(out/'MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({k:v for k,v in manifest.items() if k.endswith('Unique')}))
