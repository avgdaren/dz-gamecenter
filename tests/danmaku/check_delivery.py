#!/usr/bin/env python3
# (C) 2026 Carinoasd. Read-only offline delivery audit: 小典 / Codex.
"""Check the shipped files without launching a browser or running a game.

--freeze creates a new, reviewable playtest baseline after every audit passes.
Normal execution checks that baseline. Existing baselines are never overwritten.
"""
import argparse
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path, PurePosixPath
import re
import zipfile
import package_preview

ROOT=Path(__file__).resolve().parents[2]
RUNTIME=ROOT/'source/plugin/gamecenter/games/_danmaku_proto'
OUTPUT=ROOT.parent/'output'
PREFIX='source/plugin/gamecenter/games/_danmaku_proto/'
BASELINE=ROOT/'docs/danmaku/PLAYTEST-BASELINE-r3.json'


def sha(data):
    return hashlib.sha256(data).hexdigest()


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.files=[]
        self.scripts=0

    def handle_starttag(self,tag,attrs):
        for key,value in attrs:
            if key not in ('src','href') or not value or value.startswith(('data:','#')):
                continue
            if value=='./':
                continue
            assert not re.match(r'(?i)(?:[a-z]+:|//)',value), 'External dependency: '+value
            self.files.append(value)
            if tag=='script':self.scripts+=1


def audit():
    html_path=OUTPUT/'danmaku-stage01-boss-r3-offline.html'
    zip_path=OUTPUT/'danmaku-stage01-boss-r3.zip'
    html=html_path.read_bytes()
    expected=package_preview.standalone_html(package_preview.bundled_rules()).encode('utf-8')
    assert html==expected, 'Standalone differs from current source'
    assert (RUNTIME/'rules-data.js').read_text(encoding='utf-8')==package_preview.bundled_rules()
    current={p.relative_to(RUNTIME).as_posix():p.read_bytes() for p in RUNTIME.rglob('*') if p.is_file()}
    refs=References();refs.feed((RUNTIME/'index.html').read_text(encoding='utf-8'))
    for name in refs.files:assert name in current, 'Missing local dependency: '+name
    images=set()
    for name,data in current.items():
        if name.endswith(('.js','.html','.css')):
            images.update(re.findall(r'''["'](assets/[^"'\s]+\.png)["']''',data.decode('utf-8')))
    assert images=={n for n in current if n.endswith('.png')}, 'Image inventory mismatch'
    for name in images:assert current[name].startswith(b'\x89PNG\r\n\x1a\n')
    standalone_refs=References();standalone_refs.feed(html.decode('utf-8'))
    assert not standalone_refs.files, 'Standalone still has external files'
    with zipfile.ZipFile(zip_path) as archive:
        names=archive.namelist()
        assert len(names)==len(set(names)), 'Duplicate archive entry'
        assert archive.testzip() is None
        for name in names:
            path=PurePosixPath(name)
            assert not path.is_absolute() and '..' not in path.parts and ':' not in name
            assert path.suffix in {'.html','.js','.php','.css','.json','.png','.md'}, name
            assert not {'tmp','chrome','downloads','profile-stderr','node_modules'}.intersection(path.parts)
        manifest=json.loads(archive.read('DELIVERY-MANIFEST.json'))
        assert set(manifest)==set(names)-{'DELIVERY-MANIFEST.json'}
        for name,meta in manifest.items():
            data=archive.read(name)
            assert len(data)==meta['bytes'] and sha(data)==meta['sha256'], name
        assert archive.read('START.html')==html
        packaged={n[len(PREFIX):]:archive.read(n) for n in names if n.startswith(PREFIX)}
        assert packaged==current, 'Archive runtime differs from source'
    snapshot={'label':'Boss修正版 r3候选基线','recordedDate':'2026-11-12','author':'小典 / Codex',
              'runtimeVersion':'stage01-boss-r3','rule':'danmaku-stage01-r3',
              'scope':'private-offline-single-stage','playtestOwner':'avg达人',
              'fullAutoplayByDefault':False,'userFeedback':'用户提出身体静止与三阶段相似；r3针对修正，待用户试玩',
              'standalone':{'file':html_path.name,'bytes':len(html),'sha256':sha(html)},
              'archive':{'file':zip_path.name,'bytes':zip_path.stat().st_size,'sha256':sha(zip_path.read_bytes())},
              'runtimeFiles':{n:{'bytes':len(d),'sha256':sha(d)} for n,d in sorted(current.items())}}
    report={'status':'PASS','runtimeFiles':len(current),'archiveFiles':len(names),
            'classicScripts':refs.scripts,'pngAssets':len(images),'sourceAndArchiveMatch':True,
            'standaloneMatchesSource':True,'archiveHashesMatch':True,'noExternalRuntimeFiles':True,
            'browserLaunched':False,'gameSimulationRun':False,'runtimeModified':False}
    return snapshot,report


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--freeze',action='store_true',help='Create the first playtest baseline; refuse overwrite')
    args=parser.parse_args()
    snapshot,report=audit()
    if args.freeze:
        assert not BASELINE.exists(), 'Refusing to overwrite the accepted baseline'
        BASELINE.write_text(json.dumps(snapshot,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    else:
        assert json.loads(BASELINE.read_text(encoding='utf-8'))==snapshot, 'Playtest baseline has changed'
    report['playtestBaselineMatch']=True
    target=ROOT/'tmp/danmaku/boss-r3/quick-delivery-checks.json'
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report))


if __name__=='__main__':main()
