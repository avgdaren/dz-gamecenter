# (C) 2026 Carinoasd. Independent Boss native-asset validation: 小典 / Codex.
import hashlib
import json
from pathlib import Path
import math
import zipfile
from build_player_art import read_png,cell_pixels

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'docs/danmaku/art/boss-production-v1'
NATIVE=SOURCE/'native-v1'
RUNTIME=ROOT/'source/plugin/gamecenter/games/_danmaku_proto'
m=json.loads((NATIVE/'manifest.json').read_text(encoding='utf-8'))
palette={tuple(bytes.fromhex(c[1:])) for c in m['palette']}
assert len(palette)==32
colors=set()
for name,info in m['files'].items():
    p=NATIVE/name
    assert hashlib.sha256(p.read_bytes()).hexdigest()==info['sha256']
    assert p.read_bytes()==(RUNTIME/'assets'/name).read_bytes()
    w,h,a=read_png(p)
    if 'face' in name:
        assert (w,h)==(512,512)
        continue
    assert set(a[3::4])=={0,255}
    for i in range(0,len(a),4):
        if a[i+3]: colors.add(tuple(a[i:i+3]))
        else: assert a[i:i+3]==b'\0\0\0'
assert colors<=palette
aw,ah,atlas=read_png(NATIVE/'boss-body-atlas-v1.png')
assert (aw,ah)==(384,512)
for row in range(4):
    distinct=set()
    for col in range(4):
        w,h,a=read_png(NATIVE/'frames'/(['idle','left','right','charge'][row]+'-'+str(col)+'.png'))
        assert (w,h)==(96,128)
        assert a==cell_pixels(aw,atlas,col*96,row*128,96,128)
        assert a[(48*96+48)*4+3]==255
        for y in range(h):
            for x in range(w):
                if x<6 or x>=w-6 or y<6 or y>=h-6: assert not a[(y*w+x)*4+3]
        distinct.add(hashlib.sha256(a).hexdigest())
    assert len(distinct)==4
for layer,size,radius in [('back',128,56),('front',64,24)]:
    w,h,a=read_png(NATIVE/('boss-ring-'+layer+'-v1.png'))
    assert (w,h)==(size,size)
    assert all(math.hypot(x+.5-w/2,y+.5-h/2)<=radius for y in range(h) for x in range(w) if a[(y*w+x)*4+3])
for name,sha in m['sourceSha256'].items(): assert hashlib.sha256((SOURCE/name).read_bytes()).hexdigest()==sha
assert hashlib.sha256((ROOT/'docs/danmaku/art/production-candidates/boss-body-v1.png').read_bytes()).hexdigest()=='79fbf9c029691bfa41e9745e2dabd21add27d93e184fe3a8f4c25f98a0862cce'
assert hashlib.sha256((ROOT/'docs/danmaku/art/boss-battle-design-v1/boss-battle-body-concept-v1.png').read_bytes()).hexdigest()=='9ac60c4cf8fa27c421266d20f4aa1a2dae5278365639a38b8dedcaf22c8aa78d'
prefix='source/plugin/gamecenter/games/_danmaku_proto/'
changed=[]
with zipfile.ZipFile(ROOT.parent/'output/danmaku-stage01-ui-v1.zip') as z:
    for name in z.namelist():
        if name.startswith(prefix) and not name.endswith('/'):
            rel=name[len(prefix):]
            if z.read(name)!=(RUNTIME/rel).read_bytes(): changed.append(rel)
assert set(changed)=={'index.html','style.css','ui.js'},changed
report={'status':'PASS','nativeFrames':16,'colors':len(colors),'binaryAlpha':True,'sixPixelMargin':True,
        'ringRadiusLimits':True,'runtimeAssetsMatch':True,'originalsUnchanged':True,
        'oldRuntimeChanged':changed,'rulesReplayMusicAndPriorArtworkUnchanged':True,'bodyAndRingBytes':m['bodyAndRingsBytes']}
target=ROOT/'tmp/danmaku/stage01-boss-art-v1/native-checks.json'
target.parent.mkdir(parents=True,exist_ok=True)
target.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report))
