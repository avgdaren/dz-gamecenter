#!/usr/bin/env python3
# (C) 2026 Carinoasd. Native icon exports: 小典 / Codex.
import hashlib
import json
from pathlib import Path
from build_player_art import read_png,write_png
from build_boss_art import face_resize

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'docs/danmaku/art/game-icon-v1'
OUT=SOURCE/'exports'
TARGET=ROOT/'docs/danmaku/handoff-v1/forum/icon.png'


def main():
    assert not OUT.exists() and not TARGET.exists(),'Refusing to overwrite icon exports'
    src=SOURCE/'icon-source-v1.png';original=src.read_bytes()
    w,h,pixels=read_png(src);assert w==h and w>=512
    OUT.mkdir();TARGET.parent.mkdir(parents=True,exist_ok=True)
    items={}
    for size in [512,128,64,32]:
        data=face_resize(w,h,pixels,size)
        assert set(data[3::4])=={255}
        target=OUT/('icon-'+str(size)+'.png');write_png(target,size,size,data)
        items[target.name]={'size':[size,size],'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}
    TARGET.write_bytes((OUT/'icon-128.png').read_bytes())
    assert src.read_bytes()==original
    manifest={'tool':'built-in imagegen','exporter':'小典 / Codex','sourceSize':[w,h],
              'sourceSha256':hashlib.sha256(original).hexdigest(),'files':items,
              'suggestedForumIcon':'../../handoff-v1/forum/icon.png','runtimeIconSize':[128,128],'sourceUnchanged':True}
    (SOURCE/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'status':'PASS','sourceSize':[w,h],'exports':list(items),'runtimeIconBytes':TARGET.stat().st_size}))


if __name__=='__main__':main()
