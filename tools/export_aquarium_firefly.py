#!/usr/bin/env python3
"""作者：GPT / Codex（小典）；原插件 (C) 2026 Carinoasd。
Mechanical candidate export only: FFmpeg crop/scale/pad/WebP, Pillow read-only inspection.
Does not retouch colors, activate content, touch player data or overwrite original PNGs.
"""
from pathlib import Path
import argparse, hashlib, json, subprocess
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'docs/aquarium/art/firefly-v1'

def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def info(path,folder,role,target):
    with Image.open(str(path)) as im:
        im.load();alpha=im.convert('RGBA').getchannel('A')
        bbox=alpha.point(lambda a:255 if a>=16 else 0).getbbox()
        return {'role':role,'file':path.relative_to(folder).as_posix(),'target_asset_path':target,
                'size':list(im.size),'mode':im.mode,'alpha_range':list(alpha.getextrema()),
                'visible_bbox_alpha16':list(bbox) if bbox else None,
                'bytes':path.stat().st_size,'sha256':digest(path)}

def encode(ffmpeg,source,target,filters,lossless=False,quality=92):
    if target.exists():raise ValueError('Refusing to overwrite: '+str(target))
    target.parent.mkdir(parents=True,exist_ok=True)
    part=target.with_name(target.stem+'.writing.webp')
    if part.exists():raise ValueError('Temporary target already exists: '+str(part))
    cmd=[str(ffmpeg),'-hide_banner','-loglevel','error','-nostdin','-i',str(source),
         '-vf',filters,'-frames:v','1','-c:v','libwebp','-lossless',str(int(lossless)),
         '-quality',str(quality),'-pix_fmt','bgra','-threads','1','-f','webp',str(part)]
    try:
        r=subprocess.run(cmd,capture_output=True)
        if r.returncode:raise RuntimeError(r.stderr.decode('utf-8','replace'))
        with Image.open(str(part)) as im:im.load()
        part.replace(target)
    finally:
        if part.exists():part.unlink()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ffmpeg',required=True,type=Path)
    parser.add_argument('--out',required=True,type=Path)
    args=parser.parse_args();out=args.out.resolve()
    if not (ROOT/'source/plugin/gamecenter').is_dir() or not (ART/'manifest.json').is_file():
        raise ValueError('Run the exporter from its repository tools directory')
    if not args.out.is_absolute():raise ValueError('--out must be absolute')
    active=(ROOT/'source/plugin/gamecenter').resolve()
    if out==active or active in out.parents:raise ValueError('Export review folder only; runtime plugin writes are forbidden')
    if out.exists() and any(out.iterdir()):raise ValueError('--out must be new or empty')
    if not args.ffmpeg.is_file():raise ValueError('FFmpeg executable not found')
    inputs=json.loads((ART/'manifest.json').read_text(encoding='utf-8'))
    items=[]
    for item in inputs['items']:
        if not item.get('preview_geometry'):continue
        source=(ART/item['file']).resolve()
        if digest(source)!=item['sha256']:raise ValueError('Source changed: '+item['id'])
        box=item['primary_component_bbox_alpha16'];l,t,r,b=box
        size=(1024,512) if item['id'] in ['building_shell_house','building_wreck_cafe'] else (512,512)
        cw,ch=size;scale=min((cw-64)/float(r-l),int(ch*.84)/float(b-t))
        rw=max(1,round((r-l)*scale));rh=max(1,round((b-t)*scale))
        x=(cw-rw)//2;y=round(ch*.9)-rh
        name=item['id']+'.webp';target=out/'decor'/name
        # Premultiplied 16-bit resampling prevents RGB from transparent pixels bleeding into edges.
        filters='format=gbrap16le,crop={}:{}:{}:{},premultiply=inplace=1,scale={}:{}:flags=lanczos,unpremultiply=inplace=1,format=rgba,pad={}:{}:{}:{}:color=0x00000000'.format(r-l,b-t,l,t,rw,rh,cw,ch,x,y)
        encode(args.ffmpeg,source,target,filters)
        small=out/'thumbs/decor'/name
        encode(args.ffmpeg,target,small,'format=gbrap16le,premultiply=inplace=1,scale=128:128:force_original_aspect_ratio=decrease:flags=lanczos,unpremultiply=inplace=1,format=rgba,pad=128:128:(ow-iw)/2:(oh-ih)/2:color=0x00000000',True,100)
        files=[info(target,out,'main','decor/'+name),info(small,out,'thumb','thumbs/decor/'+name)]
        geometry=dict(item['preview_geometry']);geometry.update({'source_size':list(size),
              'source_visible_bbox':files[0]['visible_bbox_alpha16'],'anchor':[.5,.9]})
        items.append({'id':item['id'],'name':item['name'],'kind':'building','source':str(source.relative_to(ROOT)).replace('\\','/'),
          'source_sha256':item['sha256'],'source_crop_bbox':box,'packed_bounds':[x,y,x+rw,y+rh],
          'anchor':[.5,.9],'preview_geometry':geometry,'recommended_anchor_x':item['recommended_anchor_x'],
          'review':'candidate-not-owner-approved','files':files})
    bg=next(x for x in inputs['items'] if x['id']=='tank_firefly_grove');source=ART/bg['file']
    if digest(source)!=bg['sha256']:raise ValueError('Approved background changed')
    files=[]
    for role,size,suffix in [('main',(1536,960),''),('mobile',(768,480),'_mobile'),('thumb',(240,150),'_thumb')]:
        name=bg['id']+suffix+'.webp';target=out/'background'/name;w,h=size
        encode(args.ffmpeg,source,target,'scale={}:{}:force_original_aspect_ratio=increase:flags=lanczos,crop={}:{}'.format(w,h,w,h),False,88)
        files.append(info(target,out,role,'background/'+name))
    items.append({'id':bg['id'],'name':bg['name'],'kind':'background','source':str(source.relative_to(ROOT)).replace('\\','/'),
                  'source_sha256':bg['sha256'],'review':'source-visual-owner-approved; exports-awaiting-review','files':files})
    version=subprocess.run([str(args.ffmpeg),'-version'],capture_output=True).stdout.decode('utf-8','replace').splitlines()[0]
    data={'schema':'aquarium-firefly-runtime-candidate-v1','author':'GPT / Codex; original plugin (C) 2026 Carinoasd',
      'status':'inactive-export-candidate-not-installed','runtime_config_changed':False,
      'tool':version,'export_method':'FFmpeg crop/16-bit premultiplied Lanczos scale/pad/WebP; originals unchanged; Pillow inspection only',
      'cutout_limit':'Primary alpha>=16 bbox crops canvas residue; no color decontamination or per-pixel mask retouch; subtle original fringes may remain',
      'items':items,'files':sum(len(i['files']) for i in items),'bytes':sum(f['bytes'] for i in items for f in i['files'])}
    (out/'manifest.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'status':'PASS','items':len(items),'files':data['files'],'bytes':data['bytes'],'out':str(out)},ensure_ascii=False))

if __name__=='__main__':main()
