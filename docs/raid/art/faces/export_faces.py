#!/usr/bin/env python3
"""作者：GPT / Codex；原插件 (C) 2026 Carinoasd。
按用户授权的流水线从已编辑全图提取透明层；不生成/重画五官。
默认读取已保留的768px edited.png，可复现导出；--prepare用于首次从生成文件缩放并校正整数平移。
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter
ROOT = Path(__file__).resolve().parents[4]
ART = Path(__file__).resolve().parent
ASSETS = ROOT / 'source/plugin/gamecenter/games/raid/assets'
ROIS = {1:(238,112,486,340),2:(244,104,492,344)}

def align_translation(base, edited, roi):
    import numpy as np
    # Register immutable scenery/hair/book edges, excluding the expression area.
    a=np.asarray(base.convert('L'),dtype=np.float32)
    b=np.asarray(edited.convert('L'),dtype=np.float32)
    a=np.abs(np.diff(a,axis=0,prepend=a[:1]))+np.abs(np.diff(a,axis=1,prepend=a[:,:1]))
    b=np.abs(np.diff(b,axis=0,prepend=b[:1]))+np.abs(np.diff(b,axis=1,prepend=b[:,:1]))
    mask=np.ones((768,768),dtype=bool);x1,y1,x2,y2=roi
    mask[max(0,y1-40):min(768,y2+40),max(0,x1-40):min(768,x2+40)]=False
    mask[:12]=False;mask[-12:]=False;mask[:,:12]=False;mask[:,-12:]=False
    scores=[]
    for dy in range(-6,7):
        for dx in range(-6,7):
            shifted=np.roll(b,(dy,dx),(0,1))
            score=float(np.mean(np.abs(a[::2,::2]-shifted[::2,::2])[mask[::2,::2]]))
            scores.append((score,abs(dx)+abs(dy),dx,dy))
    _,_,dx,dy=min(scores)
    result=base.copy();result.paste(edited,(dx,dy));return result,(dx,dy)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--prepare',action='store_true');args=parser.parse_args()
    inputs=json.loads((ART/'generation-inputs.json').read_text())
    report=[];sheet=Image.new('RGB',(1536,768),'#191322')
    for item in inputs:
        phase,hit=item['phase'],item['hit'];stem=f'p{phase}-hit{hit}'
        base=Image.open(ASSETS/('boss.webp' if phase==1 else 'boss-phase2.webp')).convert('RGB')
        edited_path=ART/(stem+'-edited.png');shift=(0,0)
        if args.prepare:
            source=Path(item['source']);source=source if source.is_absolute() else ART/source
            edited=Image.open(source).convert('RGB').resize((768,768),Image.Resampling.LANCZOS)
            edited,shift=align_translation(base,edited,ROIS[phase]);edited.save(edited_path)
        edited=Image.open(edited_path).convert('RGBA');assert edited.size==(768,768)
        mask=Image.new('L',(768,768),0);ImageDraw.Draw(mask).ellipse(ROIS[phase],fill=255)
        mask=mask.filter(ImageFilter.GaussianBlur(14));mask.save(ART/f'p{phase}-mask.png')
        layer=Image.new('RGBA',(768,768),(0,0,0,0));layer.paste(edited,(0,0),mask)
        output=ASSETS/f'boss-face-p{phase}-hit{hit}.webp'
        for quality in (88,82):
            layer.save(output,'WEBP',quality=quality,method=6,exact=True)
            if output.stat().st_size<=40000:break
        assert output.stat().st_size<=40000
        layer=Image.open(output).convert('RGBA');assert all(layer.getpixel(xy)[3]==0 for xy in ((0,0),(767,0),(0,767),(767,767)))
        composed=Image.alpha_composite(base.convert('RGBA'),layer).convert('RGB')
        diff=ImageChops.difference(base,composed);diff=diff.point(lambda x:min(255,x*5))
        qa=Image.new('RGB',(2304,768));qa.paste(base,(0,0));qa.paste(composed,(768,0));qa.paste(diff,(1536,0))
        qa_path=ART/(stem+'-compare.webp');qa.save(qa_path,'WEBP',quality=90,method=6)
        crop=composed.crop((220,95,520,380)).resize((384,365),Image.Resampling.LANCZOS)
        sheet.paste(crop,(hit*384,(phase-1)*384))
        if hit==1:sheet.paste(base.crop((220,95,520,380)).resize((384,365),Image.Resampling.LANCZOS),(0,(phase-1)*384))
        report.append({'file':str(output.relative_to(ROOT)),'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'size':[768,768],'quality':quality,'roi':ROIS[phase],'feather':14,'alignment_translation':shift,'comparison':str(qa_path.relative_to(ROOT))})
    sheet.save(ART/'strength-comparison.webp','WEBP',quality=92,method=6)
    (ART/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False))
if __name__=='__main__':main()
