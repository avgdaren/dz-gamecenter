#!/usr/bin/env python3
# (C) 2026 Carinoasd. Approved Boss asset export: 小典 / Codex.
"""Deterministic native export of generated drawings; no runtime dependency.

Originals are read only. New output directory required. No poses are invented:
all sixteen drawings come from the generated source sheet recorded in PROMPTS.md.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import statistics
from build_player_art import (PALETTE_HEX, read_png, write_png, solid_mask,
                              bounding_box, cell_pixels, enlarge, write_apng)

COLORS = PALETTE_HEX + ['#C9C0F1', '#A99CD5', '#897CB6', '#6D6099',
                        '#514771', '#E2DBF8', '#B1ADCF', '#DBB5BD']
PALETTE = [tuple(bytes.fromhex(c[1:])) for c in COLORS]
MODES = ('idle', 'left', 'right', 'charge')
FPS = (6, 8, 8, 10)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def sample(w, h, pixels, mask, ow, oh, anchor, dest, scale, cache):
    result = bytearray(ow * oh * 4)
    for y in range(oh):
        sy = math.floor(anchor[1] + (y + .5 - dest[1]) / scale)
        for x in range(ow):
            sx = math.floor(anchor[0] + (x + .5 - dest[0]) / scale)
            if not (0 <= sx < w and 0 <= sy < h and mask[sy * w + sx]):
                continue
            rgb = tuple(pixels[(sy * w + sx) * 4:(sy * w + sx) * 4 + 3])
            if rgb not in cache:
                cache[rgb] = min(PALETTE, key=lambda p: 3*(rgb[0]-p[0])**2 + 4*(rgb[1]-p[1])**2 + 2*(rgb[2]-p[2])**2)
            at = (y * ow + x) * 4
            result[at:at+4] = bytes(cache[rgb]) + b'\xff'
    return result


def inspect(w, h, pixels, margin):
    colors = {tuple(pixels[i:i+3]) for i in range(0, len(pixels), 4) if pixels[i+3]}
    assert set(pixels[3::4]) <= {0, 255} and colors <= set(PALETTE)
    assert all(pixels[i:i+3] == b'\0\0\0' for i in range(0, len(pixels), 4) if not pixels[i+3])
    box = bounding_box(w, h, pixels[3::4])
    assert box[0] >= margin and box[1] >= margin and box[2] < w-margin and box[3] < h-margin, box
    return {'size': [w, h], 'bbox': box, 'opaqueColors': len(colors),
            'opaquePixels': sum(a != 0 for a in pixels[3::4]),
            'rgbaSha256': hashlib.sha256(pixels).hexdigest()}


def waist(w, h, pixels, mask, box):
    # Central gold belt star, excluding the neck jewel and right-side astrolabe.
    cx = (box[0]+box[2])/2
    height = box[3]-box[1]+1
    points = []
    for y in range(round(box[1]+height*.30), round(box[1]+height*.37)):
        for x in range(max(0, round(cx-w*.065)), min(w, round(cx+w*.065))):
            at = y*w+x
            r,g,b = pixels[at*4:at*4+3]
            if mask[at] and r >= 155 and g >= 110 and r-g >= 15 and g-b >= 35:
                points.append((x,y))
    assert len(points) >= 5, 'Cannot locate waist badge; inspect source'
    return [statistics.median(p[0] for p in points), statistics.median(p[1] for p in points)]


def face_resize(w, h, p, size=512):
    # Area average in premultiplied alpha avoids colored transparent-edge halos.
    out = bytearray(size*size*4)
    for y in range(size):
        for x in range(size):
            values = [p[(sy*w+sx)*4:(sy*w+sx)*4+4]
                      for sy in range(y*h//size, max(y*h//size+1,(y+1)*h//size))
                      for sx in range(x*w//size, max(x*w//size+1,(x+1)*w//size))]
            a = sum(v[3] for v in values)
            at = (y*size+x)*4
            if a:
                out[at:at+4] = bytes([round(sum(v[c]*v[3] for v in values)/a) for c in range(3)] + [round(a/len(values))])
    return out


def build(source, out):
    assert not out.exists(), 'Refusing to overwrite output'
    originals = {p.name:digest(p) for p in source.glob('*source*.png')}
    w,h,p = read_png(source/'boss-body-atlas-source-v1.png')
    prepared = []
    for row in range(4):
        for col in range(4):
            x,y = round(col*w/4),round(row*h/4)
            cw,ch = round((col+1)*w/4)-x,round((row+1)*h/4)-y
            part = cell_pixels(w,p,x,y,cw,ch)
            mask,removed = solid_mask(cw,ch,part)
            box = bounding_box(cw,ch,mask)
            anchor = waist(cw,ch,part,mask,box)
            prepared.append({'row':row,'col':col,'size':[cw,ch],'crop':[x,y,cw,ch],
                             'bbox':box,'sourceAnchor':anchor,'removedSpecks':removed,
                             'pixels':part,'mask':mask})
    # One common scale; align every generated waist to the same fixed origin.
    scale = min(104/max(i['bbox'][3]-i['bbox'][1]+1 for i in prepared),
                *[min(40/max(1,i['sourceAnchor'][0]-i['bbox'][0]),
                      40/max(1,i['bbox'][2]-i['sourceAnchor'][0]),
                      36/max(1,i['sourceAnchor'][1]-i['bbox'][1]),
                      73/max(1,i['bbox'][3]-i['sourceAnchor'][1])) for i in prepared])
    out.mkdir(parents=True)
    (out/'frames').mkdir()
    atlas,frames,meta,cache = bytearray(384*512*4),[],[],{}
    for i in prepared:
        cw,ch = i['size']
        native = sample(cw,ch,i['pixels'],i['mask'],96,128,i['sourceAnchor'],[48,48],scale,cache)
        info = inspect(96,128,native,6)
        assert native[(48*96+48)*4+3] == 255
        name = MODES[i['row']]+'-'+str(i['col'])+'.png'
        write_png(out/'frames'/name,96,128,native)
        for y in range(128):
            at = ((i['row']*128+y)*384+i['col']*96)*4
            atlas[at:at+96*4] = native[y*96*4:(y+1)*96*4]
        frames.append(native)
        meta.append({**{k:v for k,v in i.items() if k not in ('pixels','mask')}, **info, 'file':'frames/'+name})
    write_png(out/'boss-body-atlas-v1.png',384,512,atlas)
    for row,mode in enumerate(MODES):
        assert len({hashlib.sha256(f).hexdigest() for f in frames[row*4:row*4+4]}) == 4
        enlarged = [enlarge(96,128,f,3)[2] for f in frames[row*4:row*4+4]]
        write_apng(out/(mode+'-preview-3x.png'),288,384,enlarged,FPS[row])
    aw,ah,contact = enlarge(384,512,atlas,2)
    write_png(out/'contact-sheet-2x.png',aw,ah,contact)
    rings = {}
    for layer,size,radius in [('back',128,56),('front',64,24)]:
        rw,rh,rp = read_png(source/('boss-ring-'+layer+'-source-v1.png'))
        mask,removed = solid_mask(rw,rh,rp)
        # Preserve original centered geometry, with a uniform fit inside radius.
        ext = max(math.hypot(x+.5-rw/2,y+.5-rh/2) for y in range(rh) for x in range(rw) if mask[y*rw+x])
        s = (radius-1)/ext
        native = sample(rw,rh,rp,mask,size,size,[rw/2,rh/2],[size/2,size/2],s,cache)
        info = inspect(size,size,native,size//2-radius)
        measured = max(math.hypot(x+.5-size/2,y+.5-size/2) for y in range(size) for x in range(size) if native[(y*size+x)*4+3])
        assert measured <= radius
        name = 'boss-ring-'+layer+'-v1.png'
        write_png(out/name,size,size,native)
        rings[layer] = {**info,'file':name,'visibleRadius':measured,'removedSourceSpecks':removed,'scale':s}
    fw,fh,fp = read_png(source/'boss-face-source-v1.png')
    write_png(out/'boss-face-v1.png',512,512,face_resize(fw,fh,fp))
    assert originals == {p.name:digest(p) for p in source.glob('*source*.png')}
    files = {p.name:{'bytes':p.stat().st_size,'sha256':digest(p)} for p in out.glob('boss-*.png')}
    budget = sum(v['bytes'] for k,v in files.items() if 'face' not in k)
    assert budget <= 131072
    manifest = {'version':1,'author':'小典 / Codex','sourceSha256':originals,
                'palette':COLORS,'alpha':[0,255],'alphaCutoff':192,'frameSize':[96,128],
                'anchor':[48,48],'atlasSize':[384,512],'commonBodyScale':scale,
                'frames':meta,'rings':rings,'files':files,'bodyAndRingsBytes':budget,
                'face':{'size':[512,512],'hudDisplay':[32,32],'alpha':'8-bit'},
                'generatedPoses':16,'independentRightDrawings':True,'rulesChanged':False}
    (out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'status':'PASS','frames':16,'bodyAndRingsBytes':budget,'scale':scale,'bounds':[m['bbox'] for m in meta]}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source',type=Path)
    parser.add_argument('output',type=Path)
    args = parser.parse_args()
    build(args.source,args.output)
